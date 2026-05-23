import { NextResponse, type NextRequest } from "next/server";

import { getCurrentMember } from "@/lib/auth";
import {
  DEVWIKI_ASSETS_BUCKET,
} from "@/lib/assets";
import { createClient } from "@/lib/supabase/server";

type AssetRouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

export async function GET(_request: NextRequest, context: AssetRouteContext) {
  try {
    const { path } = await context.params;
    const assetPath = path?.join("/");

    if (!assetPath) {
      return NextResponse.json(
        { error: "이미지 경로가 없습니다." },
        { status: 400 },
      );
    }

    const member = await getCurrentMember();

    if (!member) {
      return NextResponse.json(
        { error: "이미지 접근 권한이 없습니다." },
        { status: 401 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(DEVWIKI_ASSETS_BUCKET)
      .createSignedUrl(assetPath, 60);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? "이미지를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const response = NextResponse.redirect(data.signedUrl, { status: 307 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "이미지 접근 권한을 확인하지 못했습니다.",
      },
      { status: 401 },
    );
  }
}
