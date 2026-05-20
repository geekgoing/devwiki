import { MessageSquare, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { addComment } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { MarkdownToc } from "@/components/markdown-toc";
import { MemberGate } from "@/components/member-gate";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import {
  getDocumentBySlug,
  getDocumentComments,
  getDocumentRevisions,
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

  if (configured && !user) {
    redirect("/login");
  }

  if (configured && user && !member) {
    return (
      <>
        <AppHeader configured={configured} canCreate={false} user={user} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <MemberGate user={user} />
        </main>
      </>
    );
  }

  const document = await getDocumentBySlug(slug);

  if (!document) {
    notFound();
  }

  const [revisions, comments] = await Promise.all([
    getDocumentRevisions(document.id),
    getDocumentComments(document.id),
  ]);

  return (
    <>
      <AppHeader
        configured={configured}
        canCreate={Boolean(member)}
        canManageMembers={member?.role === "owner"}
        user={user}
      />
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        <article className="min-w-0">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="text-3xl font-semibold tracking-tight text-slate-950"
                  data-testid="document-title"
                >
                  {document.title}
                </h1>
                <StatusBadge status={document.status} />
              </div>
              {document.summary ? (
                <p
                  className="mt-3 max-w-3xl text-sm leading-6 text-slate-600"
                  data-testid="document-summary"
                >
                  {document.summary}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-slate-500">
                마지막 수정 {formatDate(document.updatedAt)}
              </p>
            </div>

            {configured && user ? (
              <Link
                href={`/documents/${encodeURIComponent(document.slug)}/edit`}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Pencil size={16} aria-hidden />
                수정
              </Link>
            ) : null}
          </div>

          {document.tags.length ? (
            <div className="mb-6 flex flex-wrap gap-2">
              {document.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}

          <div className="rounded-md border border-slate-200 bg-white p-5 sm:p-7">
            <MarkdownRenderer content={document.bodyMarkdown} />
          </div>
        </article>

        <aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
          <MarkdownToc content={document.bodyMarkdown} />

          <section
            className="rounded-md border border-slate-200 bg-white p-4"
            data-testid="revision-history"
          >
            <h2 className="text-sm font-semibold text-slate-950">변경 이력</h2>
            {revisions.length ? (
              <ol className="mt-3 space-y-3">
                {revisions.map((revision) => (
                  <li key={revision.id} className="border-l border-slate-200 pl-3">
                    <p className="text-sm font-medium text-slate-800">
                      {revision.editSummary || revision.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      제목 스냅샷: {revision.title}
                    </p>
                    {revision.summary ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {revision.summary}
                      </p>
                    ) : null}
                    <details className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                      <summary className="cursor-pointer text-xs font-medium text-slate-600">
                        본문 스냅샷
                      </summary>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
                        {revision.bodyMarkdown}
                      </pre>
                    </details>
                    <time className="mt-1 block text-xs text-slate-500">
                      {formatDate(revision.createdAt)}
                    </time>
                    <p className="mt-1 text-xs text-slate-400">
                      수정자:{" "}
                      {revision.editedBy
                        ? revision.editedBy.slice(0, 8)
                        : "알 수 없음"}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Supabase 연결 후 수정 이력이 쌓입니다.
              </p>
            )}
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4">
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
                    <time className="mt-2 block text-xs text-slate-500">
                      {formatDate(comment.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                문서 방향이나 보강할 질문을 남길 수 있습니다.
              </p>
            )}

            {configured && user ? (
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
                  className="inline-flex h-9 items-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  의견 남기기
                </button>
              </form>
            ) : null}
          </section>
        </aside>
      </main>
    </>
  );
}
