import { describe, expect, it } from "vitest";

import {
  buildDocumentAiMessages,
  normalizeDocumentAiResponse,
} from "@/lib/ai/document-assist";

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
        videos: [
          {
            title: "트랜잭션 격리 수준",
            searchQuery: "트랜잭션 격리 수준 MVCC",
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
        title: "트랜잭션 격리 수준",
        isSearchLink: true,
      });
      expect(result.videos[0].url).toContain("youtube.com/results?");
    }
  });
});
