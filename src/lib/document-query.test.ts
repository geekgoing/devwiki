import { describe, expect, it } from "vitest";

import {
  documentApiPath,
  hasActiveDocumentQuery,
  readDocumentQueryFilters,
} from "@/lib/document-query";

function params(value: string) {
  return new URLSearchParams(value);
}

describe("document query filters", () => {
  it("drops interview category outside interview documents", () => {
    const filters = readDocumentQueryFilters(
      params("category=behavioral&learning=favorite&q=cache"),
      "term",
    );

    expect(filters).toMatchObject({
      contentType: "term",
      interviewCategory: undefined,
      learning: "favorite",
      query: "cache",
      status: "active",
    });
  });

  it("serializes only active filters into API paths", () => {
    expect(
      documentApiPath({
        contentType: "interview_qa",
        interviewCategory: "technical",
        learning: "todo",
        query: "redis",
        status: "draft",
      }),
    ).toBe(
      "/api/documents?content_type=interview_qa&category=technical&learning=todo&status=draft&q=redis",
    );
  });

  it("detects empty search pages", () => {
    expect(
      hasActiveDocumentQuery({
        learning: "all",
        query: "",
        status: "active",
      }),
    ).toBe(false);
  });
});
