import { describe, expect, it } from "vitest";

import { buildSideBySideRows, diffStats, lineDiff } from "@/lib/revision-diff";

describe("revision diff", () => {
  it("tracks added and removed lines with stable line numbers", () => {
    const diff = lineDiff("A\nB\nC", "A\nB2\nC\nD");

    expect(diff.map((line) => [line.type, line.text])).toEqual([
      ["same", "A"],
      ["removed", "B"],
      ["added", "B2"],
      ["same", "C"],
      ["added", "D"],
    ]);
    expect(diffStats(diff)).toEqual({ added: 2, removed: 1 });
  });

  it("builds side-by-side rows for replacements", () => {
    const rows = buildSideBySideRows(lineDiff("old\nsame", "new\nsame"));

    expect(rows[0]).toMatchObject({
      before: { line: 1, text: "old", type: "removed" },
      after: { line: 1, text: "new", type: "added" },
    });
    expect(rows[1]).toMatchObject({
      before: { line: 2, text: "same", type: "same" },
      after: { line: 2, text: "same", type: "same" },
    });
  });
});
