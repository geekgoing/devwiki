import { NextResponse, type NextRequest } from "next/server";

import { requireAuthenticatedMember } from "@/lib/auth";
import {
  ALLOWED_IMAGE_TYPES,
  DEVWIKI_ASSETS_BUCKET,
  MAX_IMAGE_SIZE_BYTES,
  encodeAssetPath,
  sanitizeAssetName,
  sanitizeMarkdownAlt,
} from "@/lib/assets";

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuthenticatedMember();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "업로드할 이미지 파일이 없습니다." },
        { status: 400 },
      );
    }

    const extension = ALLOWED_IMAGE_TYPES.get(file.type);

    if (!extension) {
      return NextResponse.json(
        { error: "png, jpeg, webp, gif 이미지만 업로드할 수 있습니다." },
        { status: 415 },
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "이미지는 10MB 이하만 업로드할 수 있습니다." },
        { status: 413 },
      );
    }

    const safeName = sanitizeAssetName(file.name);
    const assetPath = `${user.id}/${crypto.randomUUID()}-${safeName}.${extension}`;
    const { data, error } = await supabase.storage
      .from(DEVWIKI_ASSETS_BUCKET)
      .upload(assetPath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const path = data.path;
    const alt = sanitizeMarkdownAlt(String(formData.get("alt") || safeName));
    const src = `/api/assets/${encodeAssetPath(path)}`;

    return NextResponse.json({
      path,
      src,
      markdown: `![${alt}](${src})`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "이미지 업로드 권한을 확인하지 못했습니다.",
      },
      { status: 401 },
    );
  }
}
