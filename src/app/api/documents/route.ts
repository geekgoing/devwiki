import type { NextRequest } from "next/server";

import {
  parseContentType,
  parseInterviewCategory,
  parseLearningFilter,
  parseStatusFilter,
} from "@/lib/content-routes";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocuments } from "@/lib/documents";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();

  if (configured && !user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (configured && !member) {
    return Response.json(
      { error: "등록된 멤버 계정만 사용할 수 있습니다." },
      { status: 403 },
    );
  }

  const { searchParams } = request.nextUrl;
  const contentTypeValue = searchParams.get("content_type") ?? undefined;
  const contentType = contentTypeValue
    ? parseContentType(contentTypeValue)
    : undefined;
  const interviewCategory = parseInterviewCategory(
    searchParams.get("category") ?? undefined,
  );
  const learning = parseLearningFilter(
    searchParams.get("learning") ?? undefined,
  );
  const status = parseStatusFilter(searchParams.get("status") ?? undefined);
  const query = searchParams.get("q")?.trim() ?? "";
  const documents = await getDocuments({
    contentType,
    interviewCategory:
      contentType && contentType !== "interview_qa"
        ? undefined
        : interviewCategory,
    learning,
    query,
    status,
    canReadPrivate: !configured || Boolean(member),
    viewerId: user?.id,
  });

  return Response.json(
    { documents },
    {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    },
  );
}
