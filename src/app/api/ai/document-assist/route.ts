import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  createDocumentAiSuggestion,
  DocumentAiConfigError,
} from "@/lib/ai/document-assist";
import { getCurrentMember } from "@/lib/auth";
import { canEditContent } from "@/lib/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Member } from "@/types/devwiki";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_LIMIT = 30;
const rateLimitBuckets = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();

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

function errorResponse(
  message: string,
  status: number,
  headers?: HeadersInit,
) {
  return Response.json({ error: message }, { status, headers });
}

function configuredRateLimit() {
  const value = Number(process.env.DEVWIKI_AI_RATE_LIMIT_PER_10_MINUTES);

  return Number.isFinite(value) && value > 0 ? value : DEFAULT_RATE_LIMIT;
}

function getRateLimitKey(request: NextRequest, member: Member | null) {
  if (member?.email) {
    return `member:${member.email.toLowerCase()}`;
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
  const forwardedHost = forwardedFor?.trim();

  return `ip:${forwardedHost || request.headers.get("x-real-ip") || "local"}`;
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const limit = configuredRateLimit();
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return null;
  }

  if (current.count >= limit) {
    return Math.ceil((current.resetAt - now) / 1000);
  }

  current.count += 1;
  return null;
}

export async function POST(request: NextRequest) {
  let member: Member | null = null;

  if (isSupabaseConfigured()) {
    member = await getCurrentMember();

    if (!member) {
      return errorResponse("로그인이 필요합니다.", 401);
    }

    if (!canEditContent(member)) {
      return errorResponse("editor 이상의 권한이 필요합니다.", 403);
    }
  }

  const retryAfter = checkRateLimit(getRateLimitKey(request, member));

  if (retryAfter !== null) {
    return errorResponse("AI 요청이 너무 많습니다. 잠시 후 다시 시도하세요.", 429, {
      "Retry-After": String(retryAfter),
    });
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
