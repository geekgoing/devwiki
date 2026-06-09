import { describe, expect, it } from "vitest";

import {
  countDocumentComments,
  getDocumentCommentStats,
  getFlatDocumentCommentStats,
} from "@/lib/comment-utils";
import type { DocumentComment } from "@/types/devwiki";

function comment(
  id: string,
  replies: DocumentComment[] = [],
): DocumentComment {
  return {
    id,
    authorLabel: "테스터",
    body: "댓글",
    createdAt: "2026-06-02T00:00:00.000Z",
    createdBy: "user-id",
    editorLabel: null,
    parentCommentId: null,
    replies,
    updatedAt: "2026-06-02T00:00:00.000Z",
    updatedBy: "user-id",
  };
}

describe("comment utils", () => {
  it("counts top-level comments and replies separately", () => {
    const comments = [
      comment("comment-1", [comment("reply-1"), comment("reply-2")]),
      comment("comment-2"),
    ];

    expect(getDocumentCommentStats(comments)).toEqual({
      replyCount: 2,
      topLevelCount: 2,
      totalCount: 4,
    });
    expect(countDocumentComments(comments)).toBe(4);
  });

  it("counts flat comment rows for comment activity summaries", () => {
    expect(
      getFlatDocumentCommentStats([
        { parentCommentId: null },
        { parentCommentId: "comment-1" },
        { parentCommentId: "comment-1" },
      ]),
    ).toEqual({
      replyCount: 2,
      topLevelCount: 1,
      totalCount: 3,
    });
  });
});
