import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildDocumentAiMessages,
  createDocumentAiSuggestion,
  normalizeDocumentAiResponse,
} from "@/lib/ai/document-assist";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.DEVWIKI_AI_API_URL;
  delete process.env.DEVWIKI_AI_JSON_MODE;
});

describe("document AI assistant", () => {
  it("builds a JSON-only summary prompt with document context", () => {
    const messages = buildDocumentAiMessages({
      kind: "summary",
      title: "Redis 분산 락",
      bodyMarkdown: "## 핵심\nSET NX PX를 사용한다.",
      contentType: "term",
      currentTags: ["Redis"],
      knownTags: ["Redis", "동시성"],
    });

    expect(messages[0].content).toContain("반드시 JSON 객체만 반환");
    expect(messages[1].content).toContain("Redis 분산 락");
    expect(messages[1].content).toContain('"summary"');
  });

  it("maps suggested tags to existing tag names by slug", () => {
    const result = normalizeDocumentAiResponse(
      "tags",
      {
        tags: [
          { name: "redis", reason: "본문 핵심 기술" },
          { name: "분산 락", reason: "락 전략" },
          { name: "redis", reason: "중복" },
        ],
      },
      {
        currentTags: [],
        knownTags: ["Redis", "분산 락"],
      },
    );

    expect(result).toEqual({
      kind: "tags",
      tags: [
        { name: "Redis", reason: "본문 핵심 기술", isExisting: true },
        { name: "분산 락", reason: "락 전략", isExisting: true },
      ],
    });
  });

  it("uses a YouTube search URL when a specific video URL is not verified", () => {
    const result = normalizeDocumentAiResponse(
      "youtube",
      {
        queries: [
          {
            query: "트랜잭션 격리 수준 MVCC",
            reason: "개념 보강",
          },
        ],
      },
      {
        currentTags: [],
        knownTags: [],
      },
    );

    expect(result.kind).toBe("youtube");

    if (result.kind === "youtube") {
      expect(result.videos[0]).toMatchObject({
        title: "트랜잭션 격리 수준 MVCC",
        isSearchLink: true,
      });
      expect(result.videos[0].url).toContain("youtube.com/results?");
    }
  });

  it("does not pass through AI-generated YouTube watch URLs as verified videos", () => {
    const result = normalizeDocumentAiResponse(
      "youtube",
      {
        videos: [
          {
            title: "가짜 영상",
            url: "https://www.youtube.com/watch?v=fake-id",
            reason: "AI가 만든 URL",
          },
        ],
      },
      {
        currentTags: ["트랜잭션"],
        knownTags: [],
      },
    );

    expect(result.kind).toBe("youtube");

    if (result.kind === "youtube") {
      expect(result.videos[0].isSearchLink).toBe(true);
      expect(result.videos[0].url).toContain("youtube.com/results?");
      expect(result.videos[0].url).not.toContain("watch?v=fake-id");
    }
  });

  it("omits OpenAI JSON mode unless explicitly enabled", async () => {
    process.env.DEVWIKI_AI_API_URL = "http://example.test/v1/chat/completions";
    let requestBody: Record<string, unknown> | null = null;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));

        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"summary":"짧은 요약"}' } }],
          }),
          { status: 200 },
        );
      }),
    );

    await createDocumentAiSuggestion({
      kind: "summary",
      title: "Redis",
      bodyMarkdown: "본문",
      contentType: "term",
      currentTags: [],
      knownTags: [],
    });

    expect(requestBody).not.toHaveProperty("response_format");
  });

  it("enables OpenAI JSON mode when configured", async () => {
    process.env.DEVWIKI_AI_API_URL = "http://example.test/v1/chat/completions";
    process.env.DEVWIKI_AI_JSON_MODE = "1";
    let requestBody: Record<string, unknown> | null = null;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));

        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"summary":"짧은 요약"}' } }],
          }),
          { status: 200 },
        );
      }),
    );

    await createDocumentAiSuggestion({
      kind: "summary",
      title: "Redis",
      bodyMarkdown: "본문",
      contentType: "term",
      currentTags: [],
      knownTags: [],
    });

    expect(requestBody).toHaveProperty("response_format", {
      type: "json_object",
    });
  });
});
