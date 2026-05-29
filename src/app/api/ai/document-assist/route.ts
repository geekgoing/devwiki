import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  createDocumentAiSuggestion,
  DocumentAiConfigError,
} from "@/lib/ai/document-assist";
import { getCurrentMember } from "@/lib/auth";
import { canEditContent } from "@/lib/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const runtime = "nodejs";

const requestSchema = z.object({
  kind: z.enum(["draft", "summary", "tags", "youtube"]),
  title: z.string().trim().max(120),
  summary: z.string().trim().max(300).optional(),
  bodyMarkdown: z.string().trim().max(30000),
  contentType: z.enum(["term", "interview_qa", "scenario"]),
  interviewCategory: z.enum(["technical", "behavioral"]).nullable().optional(),
  currentTags: z.array(z.string().trim().max(40)).max(20).default([]),
  knownTags: z.array(z.string().trim().max(40)).max(120).default([]),
});

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  if (isSupabaseConfigured()) {
    const member = await getCurrentMember();

    if (!member) {
      return errorResponse("로그인이 필요합니다.", 401);
    }

    if (!canEditContent(member)) {
      return errorResponse("editor 이상의 권한이 필요합니다.", 403);
    }
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse("요청 JSON을 읽지 못했습니다.", 400);
  }

  const parsed = requestSchema.safeParse(payload);

  if (!parsed.success) {
    return errorResponse("AI 보조 요청 형식이 올바르지 않습니다.", 400);
  }

  const hasContext =
    parsed.data.title.length > 0 ||
    parsed.data.summary?.length ||
    parsed.data.bodyMarkdown.length > 0;

  if (!hasContext) {
    return errorResponse("제목이나 본문을 먼저 입력하세요.", 400);
  }

  try {
    const result = await createDocumentAiSuggestion(parsed.data);

    return Response.json(result);
  } catch (error) {
    if (error instanceof DocumentAiConfigError) {
      return errorResponse(error.message, 503);
    }

    return errorResponse(
      error instanceof Error
        ? error.message
        : "AI 보조 요청을 처리하지 못했습니다.",
      502,
    );
  }
}
