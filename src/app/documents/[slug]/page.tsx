import {
  CalendarDays,
  Clock3,
  Link2,
  MessageSquare,
  Pencil,
  Tags,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addComment } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { MarkdownToc } from "@/components/markdown-toc";
import { MemberGate } from "@/components/member-gate";
import { RevisionHistory } from "@/components/revision-history";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import {
  getDocumentBySlug,
  getDocumentComments,
  getDocumentRevisions,
  getRelatedDocuments,
} from "@/lib/documents";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type DocumentPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { slug: encodedSlug } = await params;
  const slug = decodeURIComponent(encodedSlug);
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const canReadPrivate = !configured || Boolean(member);

  const document = await getDocumentBySlug(slug, { canReadPrivate });

  if (!document && configured && user && !member) {
    return (
      <>
        <AppHeader configured={configured} canCreate={false} user={user} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
          <MemberGate user={user} />
        </main>
      </>
    );
  }

  if (!document) {
    notFound();
  }

  const [revisions, comments, relatedDocuments] = await Promise.all([
    getDocumentRevisions(document.id, { canReadPrivate }),
    getDocumentComments(document.id, { canReadPrivate }),
    getRelatedDocuments(document.id, { canReadPrivate }),
  ]);
  const canContribute = Boolean(configured && member);
  const shouldShowRelatedDocuments =
    relatedDocuments.length > 0 || canContribute;

  return (
    <>
      <AppHeader
        configured={configured}
        canCreate={Boolean(member)}
        canManageMembers={member?.role === "owner"}
        user={user}
      />
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-7 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        <section className="rounded-md border border-slate-200 bg-white px-5 py-6 shadow-sm shadow-slate-200/60 sm:px-7 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={document.status} />
                <span className="rounded-md bg-slate-50 px-2 py-1 font-mono text-xs text-slate-400">
                  /{document.slug}
                </span>
              </div>
              <h1
                className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
                data-testid="document-title"
              >
                {document.title}
              </h1>
              {document.summary ? (
                <p
                  className="mt-4 max-w-3xl text-base leading-7 text-slate-600"
                  data-testid="document-summary"
                >
                  {document.summary}
                </p>
              ) : null}
            </div>
            {canContribute ? (
              <Link
                href={`/documents/${encodeURIComponent(document.slug)}/edit`}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                <Pencil size={16} aria-hidden />
                수정
              </Link>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={14} aria-hidden />
              마지막 수정 {formatDate(document.updatedAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} aria-hidden />
              생성 {formatDate(document.createdAt)}
            </span>
          </div>

          {document.tags.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {document.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/?q=${encodeURIComponent(tag.name)}`}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                >
                  <Tags size={12} aria-hidden />
                  {tag.name}
                </Link>
              ))}
            </div>
          ) : null}
        </section>

        <article className="min-w-0 rounded-md border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <div className="p-5 sm:p-8">
            <MarkdownRenderer content={document.bodyMarkdown} />
          </div>
        </article>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <MarkdownToc content={document.bodyMarkdown} />

          {shouldShowRelatedDocuments ? (
            <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <div className="flex items-center gap-2">
                <Link2 size={16} className="text-slate-500" aria-hidden />
                <h2 className="text-sm font-semibold text-slate-950">
                  연관 문서
                </h2>
              </div>
              {relatedDocuments.length ? (
                <ol className="mt-3 space-y-2">
                  {relatedDocuments.map((relatedDocument) => (
                    <li key={relatedDocument.id}>
                      <Link
                        href={`/documents/${encodeURIComponent(
                          relatedDocument.slug,
                        )}`}
                        className="block rounded-md border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <span className="block text-sm font-medium text-slate-800">
                          {relatedDocument.title}
                        </span>
                        {relatedDocument.summary ? (
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">
                            {relatedDocument.summary}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs leading-5 text-slate-500">
                    아직 연결된 문서가 없습니다.
                  </p>
                  <Link
                    href={`/documents/${encodeURIComponent(document.slug)}/edit`}
                    className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                  >
                    <Pencil size={13} aria-hidden />
                    편집에서 추가
                  </Link>
                </div>
              )}
            </section>
          ) : null}

          <RevisionHistory
            currentBody={document.bodyMarkdown}
            documentId={document.id}
            revisions={revisions}
            canRestore={canContribute}
          />

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-slate-500" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-950">토론</h2>
            </div>

            {comments.length ? (
              <ol className="mt-3 space-y-3">
                {comments.map((comment) => (
                  <li
                    key={comment.id}
                    className="rounded-md border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {comment.body}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">
                        {comment.authorLabel}
                      </span>
                      <span aria-hidden>·</span>
                      <time>{formatDate(comment.createdAt)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                문서 방향이나 보강할 질문을 남길 수 있습니다.
              </p>
            )}

            {canContribute ? (
              <form action={addComment} className="mt-4 space-y-2">
                <input type="hidden" name="document_id" value={document.id} />
                <input type="hidden" name="slug" value={document.slug} />
                <textarea
                  name="body"
                  required
                  rows={4}
                  className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="질문이나 보강 의견"
                />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  의견 남기기
                </button>
              </form>
            ) : configured ? (
              <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                의견 작성은 로그인한 멤버만 할 수 있습니다.
              </p>
            ) : null}
          </section>
        </aside>
      </main>
    </>
  );
}
