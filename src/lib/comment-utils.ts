import type { DocumentComment } from "@/types/devwiki";

export function countDocumentComments(comments: DocumentComment[]): number {
  return comments.reduce(
    (total, comment) => total + 1 + countDocumentComments(comment.replies),
    0,
  );
}
