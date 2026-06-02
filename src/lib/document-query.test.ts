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
      params("category=behavioral&favorites=1&q=cache"),
      "term",
    );

    expect(filters).toMatchObject({
      contentType: "term",
      favoritesOnly: true,
      interviewCategory: undefined,
      query: "cache",
      status: "active",
    });
  });

  it("serializes only active filters into API paths", () => {
    expect(
      documentApiPath({
        contentType: "interview_qa",
        interviewCategory: "technical",
        favoritesOnly: true,
        query: "redis",
        status: "draft",
      }),
    ).toBe(
      "/api/documents?content_type=interview_qa&category=technical&favorites=1&status=draft&q=redis",
    );
  });

  it("detects empty search pages", () => {
    expect(
      hasActiveDocumentQuery({
        favoritesOnly: false,
        query: "",
        status: "active",
      }),
    ).toBe(false);
  });
});
