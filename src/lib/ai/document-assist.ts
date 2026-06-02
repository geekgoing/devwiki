import { toTagSlug } from "@/lib/slugify";
import type { DocumentContentType, InterviewCategory } from "@/types/devwiki";

export type DocumentAiAssistKind = "draft" | "summary" | "tags" | "youtube";

export type DocumentAiAssistInput = {
  kind: DocumentAiAssistKind;
  title: string;
  summary?: string;
  bodyMarkdown: string;
  contentType: DocumentContentType;
  interviewCategory?: InterviewCategory | null;
  currentTags: string[];
  knownTags: string[];
};

export type DocumentAiDraftSuggestion = {
  title: string;
  summary: string;
  bodyMarkdown: string;
  tags: DocumentAiTagSuggestion[];
};

export type DocumentAiTagSuggestion = {
  name: string;
  reason: string;
  isExisting: boolean;
};

export type DocumentAiYoutubeSuggestion = {
  title: string;
  url: string;
  reason: string;
  isSearchLink: boolean;
};

export type DocumentAiAssistResult =
  | {
      kind: "draft";
      draft: DocumentAiDraftSuggestion;
    }
  | {
      kind: "summary";
      summary: string;
    }
  | {
      kind: "tags";
      tags: DocumentAiTagSuggestion[];
    }
  | {
      kind: "youtube";
      videos: DocumentAiYoutubeSuggestion[];
    };

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type RawTagSuggestion = {
  name?: unknown;
  reason?: unknown;
};

type RawYoutubeSuggestion = {
  query?: unknown;
  title?: unknown;
  url?: unknown;
  reason?: unknown;
  searchQuery?: unknown;
};

const DEFAULT_MODEL = "gpt-4.1-mini";
const MAX_BODY_CHARS = 12000;
const MAX_KNOWN_TAGS = 80;
const MAX_TAG_SUGGESTIONS = 8;
const MAX_YOUTUBE_QUERIES = 3;
const MAX_YOUTUBE_RESULTS = 5;
const AI_TIMEOUT_MS = 45000;
const YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

export class DocumentAiConfigError extends Error {
  constructor() {
    super(
      "AI API 설정이 없습니다. DEVWIKI_AI_API_URL 환경변수를 설정하세요.",
    );
  }
}

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\r\n/g, "\n").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}\n\n...(이하 생략)`;
}

function clampText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function uniqueNames(values: string[]) {
  const namesBySlug = new Map<string, string>();

  values.forEach((value) => {
    const name = value.trim();
    const slug = toTagSlug(name);

    if (name && slug && !namesBySlug.has(slug)) {
      namesBySlug.set(slug, name);
    }
  });

  return Array.from(namesBySlug.values());
}

function contentTypeLabel(contentType: DocumentContentType) {
  if (contentType === "interview_qa") {
    return "면접 Q&A";
  }

  if (contentType === "scenario") {
    return "상황 시뮬레이션";
  }

  return "기술 용어";
}

function interviewCategoryLabel(category?: InterviewCategory | null) {
  if (category === "behavioral") {
    return "인성";
  }

  if (category === "technical") {
    return "기술";
  }

  return "해당 없음";
}

function buildBaseContext(input: DocumentAiAssistInput) {
  const knownTags = uniqueNames(input.knownTags).slice(0, MAX_KNOWN_TAGS);
  const currentTags = uniqueNames(input.currentTags);

  return {
    title: input.title.trim() || "제목 미정",
    summary: input.summary?.trim() || "",
    bodyMarkdown: compactText(input.bodyMarkdown, MAX_BODY_CHARS),
    contentType: contentTypeLabel(input.contentType),
    interviewCategory: interviewCategoryLabel(input.interviewCategory),
    currentTags,
    knownTags,
  };
}

export function buildDocumentAiMessages(
  input: DocumentAiAssistInput,
): ChatMessage[] {
  const context = buildBaseContext(input);
  const system = [
    "너는 DevWiki의 한국어 기술 문서 작성 보조자다.",
    "결과는 반드시 JSON 객체만 반환한다. Markdown 코드펜스나 설명 문장을 덧붙이지 않는다.",
    "검증되지 않은 사실을 단정하지 않고, 문서 본문에 없는 내용은 일반적인 초안/추천 수준으로만 작성한다.",
    "요약은 300자 이하로 작성한다.",
    "태그는 기존 태그를 우선 매핑하고, 꼭 필요할 때만 새 태그를 제안한다.",
    "YouTube 특정 영상 URL을 확실히 알 수 없으면 URL을 지어내지 말고 searchQuery를 제공한다.",
  ].join("\n");
  const base = [
    `작업: ${input.kind}`,
    `문서 제목: ${context.title}`,
    `콘텐츠 유형: ${context.contentType}`,
    `면접 분류: ${context.interviewCategory}`,
    `현재 요약: ${context.summary || "없음"}`,
    `현재 태그: ${context.currentTags.join(", ") || "없음"}`,
    `기존 태그 후보: ${context.knownTags.join(", ") || "없음"}`,
    "본문:",
    context.bodyMarkdown || "없음",
  ].join("\n\n");

  if (input.kind === "draft") {
    return [
      { role: "system", content: system },
      {
        role: "user",
        content: `${base}\n\n다음 JSON 스키마로 Markdown 초안을 작성해줘.\n{\n  "title": "120자 이하 제목",\n  "summary": "300자 이하 요약",\n  "bodyMarkdown": "# 제목으로 시작하는 한국어 Markdown 본문",\n  "tags": [{ "name": "태그명", "reason": "짧은 추천 이유" }]\n}`,
      },
    ];
  }

  if (input.kind === "summary") {
    return [
      { role: "system", content: system },
      {
        role: "user",
        content: `${base}\n\n다음 JSON 스키마로 문서 목록에 들어갈 요약을 작성해줘.\n{\n  "summary": "300자 이하 요약"\n}`,
      },
    ];
  }

  if (input.kind === "tags") {
    return [
      { role: "system", content: system },
      {
        role: "user",
        content: `${base}\n\n다음 JSON 스키마로 태그를 추천해줘. 기존 태그 후보와 의미가 같으면 기존 태그 이름을 그대로 사용해.\n{\n  "tags": [{ "name": "태그명", "reason": "짧은 추천 이유" }]\n}`,
      },
    ];
  }

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: `${base}\n\n다음 JSON 스키마로 YouTube에서 검색할 학습용 검색어를 추천해줘. 영상 URL은 절대 만들지 말고 검색어만 작성해.\n{\n  "queries": [{ "query": "YouTube 검색어", "reason": "짧은 추천 이유" }]\n}`,
    },
  ];
}

function createAiUrl() {
  const rawUrl = process.env.DEVWIKI_AI_API_URL?.trim();

  if (!rawUrl) {
    throw new DocumentAiConfigError();
  }

  const url = new URL(rawUrl);
  const normalizedPath = url.pathname.replace(/\/+$/, "");

  if (!normalizedPath) {
    url.pathname = "/v1/chat/completions";
  } else if (normalizedPath === "/v1") {
    url.pathname = "/v1/chat/completions";
  }

  return url;
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const directText = record.output_text ?? record.content ?? record.text;

  if (typeof directText === "string") {
    return directText;
  }

  const choices = record.choices;

  if (Array.isArray(choices)) {
    const first = choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    const content = message?.content ?? first?.text;

    if (typeof content === "string") {
      return content;
    }
  }

  return "";
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence) as Record<string, unknown>;
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
    }

    throw new Error("AI 응답을 JSON으로 해석하지 못했습니다.");
  }
}

function getKnownTagMap(knownTags: string[], currentTags: string[]) {
  const names = uniqueNames([...knownTags, ...currentTags]);

  return new Map(names.map((name) => [toTagSlug(name), name]));
}

function normalizeTagSuggestions(
  value: unknown,
  knownTags: string[],
  currentTags: string[],
): DocumentAiTagSuggestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const knownTagMap = getKnownTagMap(knownTags, currentTags);
  const seen = new Set<string>();
  const suggestions: DocumentAiTagSuggestion[] = [];

  value.forEach((item) => {
    const raw = item as RawTagSuggestion;
    const rawName = clampText(raw.name, 40);
    const slug = toTagSlug(rawName);

    if (!slug || seen.has(slug)) {
      return;
    }

    const existingName = knownTagMap.get(slug);
    const name = existingName ?? rawName;

    suggestions.push({
      name,
      reason: clampText(raw.reason, 120),
      isExisting: Boolean(existingName),
    });
    seen.add(slug);
  });

  return suggestions.slice(0, MAX_TAG_SUGGESTIONS);
}

function createYoutubeSearchUrl(query: string) {
  const params = new URLSearchParams({ search_query: query });

  return `https://www.youtube.com/results?${params.toString()}`;
}

function fallbackYoutubeQuery(
  input: Pick<DocumentAiAssistInput, "title" | "currentTags">,
) {
  return uniqueNames([input.title, ...input.currentTags])
    .filter(Boolean)
    .join(" ")
    .trim();
}

function normalizeYoutubeQueries(
  payload: Record<string, unknown>,
  input: Pick<DocumentAiAssistInput, "title" | "currentTags">,
) {
  const rawValue = Array.isArray(payload.queries)
    ? payload.queries
    : Array.isArray(payload.videos)
      ? payload.videos
      : [];
  const queries = rawValue
    .map((item) => {
      const raw = item as RawYoutubeSuggestion;
      const query =
        clampText(raw.query, 120) ||
        clampText(raw.searchQuery, 120) ||
        clampText(raw.title, 120);

      return {
        query,
        reason: clampText(raw.reason, 160),
      };
    })
    .filter((item) => item.query)
    .slice(0, MAX_YOUTUBE_QUERIES);

  if (queries.length) {
    return queries;
  }

  const query = fallbackYoutubeQuery(input);

  return query ? [{ query, reason: "문서 주제 기반 검색" }] : [];
}

function normalizeYoutubeSearchLinks(
  payload: Record<string, unknown>,
  input: Pick<DocumentAiAssistInput, "title" | "currentTags">,
): DocumentAiYoutubeSuggestion[] {
  return normalizeYoutubeQueries(payload, input).map((item) => ({
    title: item.query,
    reason: item.reason,
    url: createYoutubeSearchUrl(item.query),
    isSearchLink: true,
  }));
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

type YoutubeSearchItem = {
  id?: {
    kind?: string;
    videoId?: string;
  };
  snippet?: {
    title?: string;
    channelTitle?: string;
  };
};

async function searchYoutubeVideos(query: string) {
  const apiKey = process.env.DEVWIKI_YOUTUBE_API_KEY?.trim();

  if (!apiKey) {
    return [];
  }

  const params = new URLSearchParams({
    key: apiKey,
    maxResults: "3",
    part: "snippet",
    q: query,
    safeSearch: "moderate",
    type: "video",
    videoEmbeddable: "true",
  });
  const relevanceLanguage =
    process.env.DEVWIKI_YOUTUBE_RELEVANCE_LANGUAGE?.trim();
  const regionCode = process.env.DEVWIKI_YOUTUBE_REGION_CODE?.trim();

  if (relevanceLanguage) {
    params.set("relevanceLanguage", relevanceLanguage);
  }

  if (regionCode) {
    params.set("regionCode", regionCode);
  }

  const response = await fetch(
    `${YOUTUBE_SEARCH_ENDPOINT}?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { items?: YoutubeSearchItem[] };

  return (payload.items ?? [])
    .filter((item) => item.id?.kind === "youtube#video" && item.id.videoId)
    .map((item) => ({
      videoId: item.id?.videoId ?? "",
      title: decodeHtmlEntities(item.snippet?.title ?? ""),
      channelTitle: decodeHtmlEntities(item.snippet?.channelTitle ?? ""),
    }))
    .filter((item) => item.videoId && item.title);
}

async function createYoutubeSuggestions(
  payload: Record<string, unknown>,
  input: Pick<DocumentAiAssistInput, "title" | "currentTags">,
): Promise<DocumentAiYoutubeSuggestion[]> {
  const queries = normalizeYoutubeQueries(payload, input);
  const apiKey = process.env.DEVWIKI_YOUTUBE_API_KEY?.trim();

  if (!apiKey) {
    return normalizeYoutubeSearchLinks(payload, input);
  }

  const seenVideoIds = new Set<string>();
  const videos: DocumentAiYoutubeSuggestion[] = [];

  for (const query of queries) {
    const searchResults = await searchYoutubeVideos(query.query);

    searchResults.forEach((video) => {
      if (
        seenVideoIds.has(video.videoId) ||
        videos.length >= MAX_YOUTUBE_RESULTS
      ) {
        return;
      }

      videos.push({
        title: video.title,
        reason: [query.reason, video.channelTitle].filter(Boolean).join(" · "),
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
        isSearchLink: false,
      });
      seenVideoIds.add(video.videoId);
    });

    if (videos.length >= MAX_YOUTUBE_RESULTS) {
      break;
    }
  }

  return videos.length ? videos : normalizeYoutubeSearchLinks(payload, input);
}

function shouldUseJsonMode() {
  return process.env.DEVWIKI_AI_JSON_MODE === "1";
}

function buildAiRequestBody(
  input: DocumentAiAssistInput,
  messages: ChatMessage[],
) {
  return {
    model: process.env.DEVWIKI_AI_MODEL?.trim() || DEFAULT_MODEL,
    messages,
    temperature: input.kind === "draft" ? 0.45 : 0.2,
    ...(shouldUseJsonMode()
      ? {
          response_format: { type: "json_object" },
        }
      : {}),
  };
}

async function normalizeDocumentAiResponseAsync(
  kind: DocumentAiAssistKind,
  payload: Record<string, unknown>,
  input: DocumentAiAssistInput,
): Promise<DocumentAiAssistResult> {
  if (kind === "youtube") {
    return {
      kind,
      videos: await createYoutubeSuggestions(payload, input),
    };
  }

  return normalizeDocumentAiResponse(kind, payload, {
    knownTags: input.knownTags,
    currentTags: input.currentTags,
    title: input.title,
  });
}

export function normalizeDocumentAiResponse(
  kind: DocumentAiAssistKind,
  payload: Record<string, unknown>,
  input: Pick<DocumentAiAssistInput, "knownTags" | "currentTags"> & {
    title?: string;
  },
): DocumentAiAssistResult {
  if (kind === "draft") {
    return {
      kind,
      draft: {
        title: clampText(payload.title, 120),
        summary: clampText(payload.summary, 300),
        bodyMarkdown: clampText(payload.bodyMarkdown, 20000),
        tags: normalizeTagSuggestions(
          payload.tags,
          input.knownTags,
          input.currentTags,
        ),
      },
    };
  }

  if (kind === "summary") {
    return {
      kind,
      summary: clampText(payload.summary, 300),
    };
  }

  if (kind === "tags") {
    return {
      kind,
      tags: normalizeTagSuggestions(
        payload.tags,
        input.knownTags,
        input.currentTags,
      ),
    };
  }

  return {
    kind,
    videos: normalizeYoutubeSearchLinks(payload, {
      title: input.title ?? "",
      currentTags: input.currentTags,
    }),
  };
}

export async function createDocumentAiSuggestion(
  input: DocumentAiAssistInput,
): Promise<DocumentAiAssistResult> {
  const url = createAiUrl();
  const apiKey = process.env.DEVWIKI_AI_API_KEY?.trim();
  const messages = buildDocumentAiMessages(input);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(buildAiRequestBody(input, messages)),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(
      `AI API 호출에 실패했습니다. (${response.status}) ${message.slice(0, 200)}`,
    );
  }

  const rawPayload = (await response.json()) as unknown;
  const content = extractResponseText(rawPayload);

  if (!content) {
    throw new Error("AI 응답에 처리할 텍스트가 없습니다.");
  }

  return normalizeDocumentAiResponseAsync(
    input.kind,
    parseJsonObject(content),
    input,
  );
}
