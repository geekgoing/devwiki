import type { DocumentComment } from "@/types/devwiki";

export type DocumentCommentStats = {
  replyCount: number;
  topLevelCount: number;
  totalCount: number;
};

export function getDocumentCommentStats(
  comments: DocumentComment[],
  depth = 0,
): DocumentCommentStats {
  return comments.reduce<DocumentCommentStats>(
    (stats, comment) => {
      const childStats = getDocumentCommentStats(comment.replies, depth + 1);

      return {
        replyCount:
          stats.replyCount + childStats.replyCount + (depth > 0 ? 1 : 0),
        topLevelCount:
          stats.topLevelCount + childStats.topLevelCount + (depth === 0 ? 1 : 0),
        totalCount: stats.totalCount + childStats.totalCount + 1,
      };
    },
    {
      replyCount: 0,
      topLevelCount: 0,
      totalCount: 0,
    },
  );
}

export function countDocumentComments(comments: DocumentComment[]): number {
  return getDocumentCommentStats(comments).totalCount;
}

export function getFlatDocumentCommentStats(
  comments: Array<{
    parentCommentId: string | null;
  }>,
): DocumentCommentStats {
  return comments.reduce<DocumentCommentStats>(
    (stats, comment) => ({
      replyCount: stats.replyCount + (comment.parentCommentId ? 1 : 0),
      topLevelCount: stats.topLevelCount + (comment.parentCommentId ? 0 : 1),
      totalCount: stats.totalCount + 1,
    }),
    {
      replyCount: 0,
      topLevelCount: 0,
      totalCount: 0,
    },
  );
}
