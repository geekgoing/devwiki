import { describe, expect, it } from "vitest";

import { slugify, toTagSlug } from "@/lib/slugify";

describe("slugify", () => {
  it("keeps Korean letters and normalizes separators", () => {
    expect(slugify("  트랜잭션 격리 수준 / MVCC?  ")).toBe(
      "트랜잭션-격리-수준-mvcc",
    );
  });

  it("trims separators after max-length slicing", () => {
    expect(slugify("alpha beta gamma", 11)).toBe("alpha-beta");
  });

  it("uses a shorter tag slug limit", () => {
    expect(toTagSlug("a".repeat(80))).toHaveLength(60);
  });
});
