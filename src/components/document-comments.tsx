"use client";

import { MessageSquare, Pencil, Reply, Trash2, X } from "lucide-react";
import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  addComment as addCommentAction,
  deleteComment,
  updateComment,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getDocumentCommentStats } from "@/lib/comment-utils";
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

function DocumentHiddenFields({
  contentType,
  documentId,
  slug,
}: {
  contentType: DocumentContentType;
  documentId: string;
  slug: string;
}) {
  return (
    <>
      <input type="hidden" name="content_type" value={contentType} />
      <input type="hidden" name="document_id" value={documentId} />
      <input type="hidden" name="slug" value={slug} />
    </>
  );
}

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
      <DocumentHiddenFields
        contentType={contentType}
        documentId={documentId}
        slug={slug}
      />
      <input type="hidden" name="comment_id" value={commentId} />
    </>
  );
}

function authorInitial(label: string) {
  return label.trim().slice(0, 1).toUpperCase() || "?";
}

function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & {
  children: ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button {...props} disabled={pending || props.disabled}>
      {pending ? pendingLabel : children}
    </Button>
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
  const commentFormRef = useRef<HTMLFormElement>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(
    null,
  );
  const canDiscuss = Boolean(configured && currentUserId && memberRole);
  const canModerate = canEditContent(memberRole ? { role: memberRole } : null);
  const commentStats = getDocumentCommentStats(comments);

  async function submitComment(formData: FormData) {
    await addCommentAction(formData);
    commentFormRef.current?.reset();
  }

  async function submitReply(formData: FormData) {
    await addCommentAction(formData);
    setReplyingToCommentId(null);
  }

  function renderComment(comment: DocumentComment, isReply = false) {
    const isEditing = editingCommentId === comment.id;
    const isReplying = replyingToCommentId === comment.id;
    const canManage = canModerate || comment.createdBy === currentUserId;
    const canReply = canDiscuss && !isReply && !isEditing;
    const replyCount = comment.replies.length;

    return (
      <li
        key={comment.id}
        className={
          isReply
            ? "rounded-lg border bg-muted/20 p-3 sm:p-4"
            : "rounded-lg border bg-background p-4 sm:p-5"
        }
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {authorInitial(comment.authorLabel)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {comment.authorLabel}
              </span>
              <span aria-hidden>·</span>
              <time>{formatDate(comment.createdAt)}</time>
              {!isReply && replyCount ? (
                <>
                  <span aria-hidden>·</span>
                  <Badge variant="secondary">답글 {replyCount}개</Badge>
                </>
              ) : null}
              {comment.updatedAt !== comment.createdAt ? (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    수정됨
                    {comment.editorLabel ? `: ${comment.editorLabel}` : ""}
                  </span>
                </>
              ) : null}
            </div>

            {isEditing ? (
              <form
                action={async (formData) => {
                  await updateComment(formData);
                  setEditingCommentId(null);
                }}
                className="mt-3 space-y-3"
              >
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
                  rows={isReply ? 4 : 5}
                  defaultValue={comment.body}
                  className="min-h-28 resize-y bg-background text-sm leading-6"
                />
                <div className="flex flex-wrap gap-2">
                  <SubmitButton type="submit" size="sm" pendingLabel="저장 중">
                    저장
                  </SubmitButton>
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
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                {comment.body}
              </p>
            )}

            {canReply || canManage ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {canReply ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingCommentId(null);
                      setReplyingToCommentId(isReplying ? null : comment.id);
                    }}
                  >
                    <Reply size={14} aria-hidden />
                    답글
                  </Button>
                ) : null}
                {canManage && !isEditing ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReplyingToCommentId(null);
                      setEditingCommentId(comment.id);
                    }}
                  >
                    <Pencil size={14} aria-hidden />
                    수정
                  </Button>
                ) : null}
                {canManage ? (
                  <form
                    action={async (formData) => {
                      await deleteComment(formData);
                      setEditingCommentId((current) =>
                        current === comment.id ? null : current,
                      );
                      setReplyingToCommentId((current) =>
                        current === comment.id ? null : current,
                      );
                    }}
                    onSubmit={(event) => {
                      const message = comment.replies.length
                        ? "댓글을 삭제할까요? 대댓글도 함께 삭제됩니다."
                        : "댓글을 삭제할까요?";

                      if (!window.confirm(message)) {
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
                    <SubmitButton
                      type="submit"
                      variant="outline"
                      size="sm"
                      pendingLabel="삭제 중"
                    >
                      <Trash2 size={14} aria-hidden />
                      삭제
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            ) : null}

            {canReply && isReplying ? (
              <form
                action={submitReply}
                className="mt-4 rounded-lg border bg-muted/35 p-3"
              >
                <DocumentHiddenFields
                  contentType={contentType}
                  documentId={documentId}
                  slug={slug}
                />
                <input
                  type="hidden"
                  name="parent_comment_id"
                  value={comment.id}
                />
                <Textarea
                  name="body"
                  required
                  maxLength={2000}
                  rows={3}
                  className="min-h-24 resize-y bg-background text-sm leading-6"
                  placeholder={`${comment.authorLabel}님에게 답글`}
                />
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setReplyingToCommentId(null)}
                  >
                    <X size={14} aria-hidden />
                    취소
                  </Button>
                  <SubmitButton
                    type="submit"
                    size="sm"
                    pendingLabel="등록 중"
                  >
                    답글 남기기
                  </SubmitButton>
                </div>
              </form>
            ) : null}

            {comment.replies.length ? (
              <ol className="mt-4 space-y-3 border-l pl-4">
                {comment.replies.map((reply) => renderComment(reply, true))}
              </ol>
            ) : null}
          </div>
        </div>
      </li>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4 sm:px-6">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare
              size={18}
              className="text-muted-foreground"
              aria-hidden
            />
            토론
          </CardTitle>
          <CardDescription className="mt-1">
            댓글 {commentStats.topLevelCount}개
            {commentStats.replyCount
              ? ` · 답글 ${commentStats.replyCount}개`
              : ""}
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="secondary">{commentStats.totalCount}개</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5 sm:px-6">
        {canDiscuss ? (
          <form
            ref={commentFormRef}
            action={submitComment}
            className="rounded-lg border bg-muted/35 p-4 sm:p-5"
          >
            <DocumentHiddenFields
              contentType={contentType}
              documentId={documentId}
              slug={slug}
            />
            <Textarea
              name="body"
              required
              maxLength={2000}
              rows={5}
              className="min-h-32 resize-y bg-background text-sm leading-6"
              placeholder="질문, 추가 사례, 다른 관점을 남겨보세요."
            />
            <div className="mt-3 flex justify-end">
              <SubmitButton type="submit" pendingLabel="등록 중">
                의견 남기기
              </SubmitButton>
            </div>
          </form>
        ) : configured ? (
          <p className="rounded-lg border bg-muted/35 px-4 py-3 text-sm leading-6 text-muted-foreground">
            의견 작성은 로그인한 멤버만 할 수 있습니다.
          </p>
        ) : null}

        {comments.length ? (
          <ol className="space-y-4">
            {comments.map((comment) => renderComment(comment))}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm leading-6 text-muted-foreground">
            아직 남겨진 의견이 없습니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
