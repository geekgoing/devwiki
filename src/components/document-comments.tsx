"use client";

import { CheckCircle2, MessageSquare, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

import {
  addComment as addCommentAction,
  deleteComment,
  resolveComment,
  updateComment,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { canEditContent } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type {
  DocumentComment,
  DocumentContentType,
  MemberRole,
} from "@/types/devwiki";

type DocumentCommentsProps = {
  comments: DocumentComment[];
  configured: boolean;
  contentType: DocumentContentType;
  currentUserId?: string | null;
  documentId: string;
  memberRole?: MemberRole | null;
  slug: string;
};

function CommentHiddenFields({
  commentId,
  contentType,
  documentId,
  slug,
}: {
  commentId: string;
  contentType: DocumentContentType;
  documentId: string;
  slug: string;
}) {
  return (
    <>
      <input type="hidden" name="content_type" value={contentType} />
      <input type="hidden" name="document_id" value={documentId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="comment_id" value={commentId} />
    </>
  );
}

export function DocumentComments({
  comments,
  configured,
  contentType,
  currentUserId,
  documentId,
  memberRole,
  slug,
}: DocumentCommentsProps) {
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const canDiscuss = Boolean(configured && currentUserId && memberRole);
  const canModerate = canEditContent(memberRole ? { role: memberRole } : null);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare
            size={16}
            className="text-muted-foreground"
            aria-hidden
          />
          토론
        </CardTitle>
        {comments.length ? (
          <CardAction>
            <Badge variant="secondary">{comments.length}개</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {comments.length ? (
          <ol className="space-y-3">
            {comments.map((comment) => {
              const isEditing = editingCommentId === comment.id;
              const canManage =
                canModerate || comment.createdBy === currentUserId;

              return (
                <li
                  key={comment.id}
                  className="rounded-lg border bg-muted/35 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {comment.authorLabel}
                      </span>
                      <span aria-hidden>·</span>
                      <time>{formatDate(comment.createdAt)}</time>
                      {comment.updatedAt !== comment.createdAt ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>
                            수정됨
                            {comment.editorLabel
                              ? `: ${comment.editorLabel}`
                              : ""}
                          </span>
                        </>
                      ) : null}
                    </div>
                    {comment.resolvedAt ? (
                      <Badge
                        variant="outline"
                        className="border-teal-200 bg-teal-50 text-teal-700"
                      >
                        <CheckCircle2 size={12} aria-hidden />
                        해결됨
                      </Badge>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <form action={updateComment} className="mt-3 space-y-2">
                      <CommentHiddenFields
                        commentId={comment.id}
                        contentType={contentType}
                        documentId={documentId}
                        slug={slug}
                      />
                      <Textarea
                        name="body"
                        required
                        maxLength={2000}
                        rows={4}
                        defaultValue={comment.body}
                        className="resize-y bg-background"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" size="sm">
                          저장
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCommentId(null)}
                        >
                          <X size={14} aria-hidden />
                          취소
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                      {comment.body}
                    </p>
                  )}

                  {comment.resolvedAt ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(comment.resolvedAt)} 해결
                      {comment.resolvedByLabel
                        ? `: ${comment.resolvedByLabel}`
                        : ""}
                    </p>
                  ) : null}

                  {canManage || canModerate ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canManage && !isEditing ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCommentId(comment.id)}
                        >
                          <Pencil size={14} aria-hidden />
                          수정
                        </Button>
                      ) : null}
                      {canManage ? (
                        <form
                          action={deleteComment}
                          onSubmit={(event) => {
                            if (!window.confirm("댓글을 삭제할까요?")) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <CommentHiddenFields
                            commentId={comment.id}
                            contentType={contentType}
                            documentId={documentId}
                            slug={slug}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            <Trash2 size={14} aria-hidden />
                            삭제
                          </Button>
                        </form>
                      ) : null}
                      {canModerate ? (
                        <form action={resolveComment}>
                          <CommentHiddenFields
                            commentId={comment.id}
                            contentType={contentType}
                            documentId={documentId}
                            slug={slug}
                          />
                          <input
                            type="hidden"
                            name="resolved"
                            value={comment.resolvedAt ? "0" : "1"}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            <CheckCircle2 size={14} aria-hidden />
                            {comment.resolvedAt ? "해결 취소" : "해결"}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            문서 방향이나 보강할 질문을 남길 수 있습니다.
          </p>
        )}

        {canDiscuss ? (
          <form action={addCommentAction} className="mt-4 space-y-2">
            <input type="hidden" name="content_type" value={contentType} />
            <input type="hidden" name="document_id" value={documentId} />
            <input type="hidden" name="slug" value={slug} />
            <Textarea
              name="body"
              required
              maxLength={2000}
              rows={4}
              className="resize-y"
              placeholder="질문이나 보강 의견"
            />
            <Button type="submit">의견 남기기</Button>
          </form>
        ) : configured ? (
          <p className="mt-4 rounded-lg border bg-muted/35 px-3 py-2 text-xs leading-5 text-muted-foreground">
            의견 작성은 로그인한 멤버만 할 수 있습니다.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
