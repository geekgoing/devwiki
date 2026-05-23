import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Link2,
  MessageSquare,
  Pencil,
  Star,
  Tags,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { addComment, updateDocumentLearningState } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { CopyLinkButton } from "@/components/copy-link-button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { MarkdownToc } from "@/components/markdown-toc";
import { MemberGate } from "@/components/member-gate";
import { RevisionHistory } from "@/components/revision-history";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { canEditContent, canManageMembers } from "@/lib/permissions";
import { siteDescription, siteName } from "@/lib/site";
import {
  getBacklinkDocuments,
  getDocumentBySlug,
  getDocumentComments,
  getDocumentRevisions,
  getRelatedDocuments,
} from "@/lib/documents";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DocumentDetail, RelatedDocument } from "@/types/devwiki";

type DocumentPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function LinkedDocumentCard({ document }: { document: RelatedDocument }) {
  return (
    <li>
      <Link
        href={`/documents/${encodeURIComponent(document.slug)}`}
        className="block rounded-md border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50"
      >
        <span className="block text-sm font-medium text-slate-800">
          {document.title}
        </span>
        {document.summary ? (
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">
            {document.summary}
          </span>
        ) : (
          <span className="mt-1 block font-mono text-xs text-slate-400">
            /{document.slug}
          </span>
        )}
      </Link>
    </li>
  );
}

function loginHref(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}

function documentSharePath(slug: string) {
  return `/documents/${encodeURIComponent(slug)}`;
}

export async function generateMetadata({
  params,
}: DocumentPageProps): Promise<Metadata> {
  const { slug: encodedSlug } = await params;
  const slug = decodeURIComponent(encodedSlug);
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const canReadPrivate = !configured || Boolean(member);
  const document = await getDocumentBySlug(slug, {
    canReadPrivate,
    viewerId: user?.id,
  });
  const fallbackTitle = "회원 전용 문서";
  const title = document?.title ?? fallbackTitle;
  const description =
    document?.summary ?? "로그인한 DevWiki 멤버만 문서를 확인할 수 있습니다.";
  const url = documentSharePath(slug);

  return {
    title,
    description,
    openGraph: {
      title: `${title} · ${siteName}`,
      description,
      siteName,
      type: "article",
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${siteName}`,
      description: document ? description : siteDescription,
    },
  };
}

function LinkSection({
  documents,
  editHref,
  emptyText,
  icon,
  showEmptyState = false,
  title,
}: {
  documents: RelatedDocument[];
  editHref?: string;
  emptyText: string;
  icon: ReactNode;
  showEmptyState?: boolean;
  title: string;
}) {
  if (!documents.length && !showEmptyState) {
    return null;
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      </div>
      {documents.length ? (
        <ol className="mt-3 space-y-2">
          {documents.map((document) => (
            <LinkedDocumentCard key={document.id} document={document} />
          ))}
        </ol>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-xs leading-5 text-slate-500">{emptyText}</p>
          {editHref ? (
            <Link
              href={editHref}
              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
            >
              <Pencil size={13} aria-hidden />
              편집에서 추가
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}

function LearningStateButton({
  document,
  field,
}: {
  document: DocumentDetail;
  field: "favorite" | "completed";
}) {
  const enabled =
    field === "favorite" ? document.isFavorite : document.isCompleted;
  const Icon = field === "favorite" ? Star : CheckCircle2;
  const label =
    field === "favorite"
      ? enabled
        ? "즐겨찾기 해제"
        : "즐겨찾기"
      : enabled
        ? "숙지 취소"
        : "숙지 완료";

  return (
    <form action={updateDocumentLearningState}>
      <input type="hidden" name="document_id" value={document.id} />
      <input type="hidden" name="slug" value={document.slug} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
      <button
        type="submit"
        className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
          enabled
            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
        }`}
      >
        <Icon
          size={16}
          className={enabled && field === "favorite" ? "fill-current" : ""}
          aria-hidden
        />
        {label}
      </button>
    </form>
  );
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { slug: encodedSlug } = await params;
  const slug = decodeURIComponent(encodedSlug);
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const canReadPrivate = !configured || Boolean(member);

  if (configured && !user) {
    redirect(loginHref(`/documents/${encodedSlug}`));
  }

  if (configured && user && !member) {
    return (
      <>
        <AppHeader configured={configured} canCreate={false} user={user} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
          <MemberGate user={user} />
        </main>
      </>
    );
  }

  const document = await getDocumentBySlug(slug, {
    canReadPrivate,
    viewerId: user?.id,
  });

  if (!document) {
    notFound();
  }

  const [revisions, comments, relatedDocuments, backlinkDocuments] =
    await Promise.all([
      getDocumentRevisions(document.id, { canReadPrivate }),
      getDocumentComments(document.id, { canReadPrivate }),
      getRelatedDocuments(document.id, { canReadPrivate }),
      getBacklinkDocuments(document.id, { canReadPrivate }),
    ]);
  const canContribute = canEditContent(member);
  const canDiscuss = Boolean(configured && member);
  const canTrackLearning = Boolean(configured && member);
  const shouldShowRelatedDocuments =
    relatedDocuments.length > 0 || canContribute;
  const editHref = `/documents/${encodeURIComponent(document.slug)}/edit`;

  return (
    <>
      <AppHeader
        configured={configured}
        activeContentType={document.contentType}
        canCreate={canContribute}
        canManageMembers={canManageMembers(member)}
        member={member}
        user={user}
      />
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-7 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
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
            <div className="flex flex-wrap justify-end gap-2">
              {canTrackLearning ? (
                <>
                  <LearningStateButton document={document} field="favorite" />
                  <LearningStateButton document={document} field="completed" />
                </>
              ) : null}
              <CopyLinkButton path={documentSharePath(document.slug)} />
              {canContribute ? (
                <Link
                  href={editHref}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  <Pencil size={16} aria-hidden />
                  수정
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={14} aria-hidden />
                마지막 수정
              </span>
              <strong className="mt-1 block font-medium text-slate-700">
                {formatDate(document.updatedAt)}
              </strong>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden />
                생성
              </span>
              <strong className="mt-1 block font-medium text-slate-700">
                {formatDate(document.createdAt)}
              </strong>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <span className="inline-flex items-center gap-1.5">
                <Link2 size={14} aria-hidden />
                연결
              </span>
              <strong className="mt-1 block font-medium text-slate-700">
                {relatedDocuments.length + backlinkDocuments.length}개
              </strong>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare size={14} aria-hidden />
                토론
              </span>
              <strong className="mt-1 block font-medium text-slate-700">
                {comments.length}개
              </strong>
            </div>
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

          <LinkSection
            documents={relatedDocuments}
            editHref={editHref}
            emptyText="아직 연결된 문서가 없습니다."
            icon={<ArrowRight size={16} className="text-slate-500" aria-hidden />}
            showEmptyState={shouldShowRelatedDocuments}
            title="연관 문서"
          />

          <LinkSection
            documents={backlinkDocuments}
            emptyText="아직 이 문서를 참조하는 문서가 없습니다."
            icon={<ArrowLeft size={16} className="text-slate-500" aria-hidden />}
            title="이 문서를 참조하는 문서"
          />

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

            {canDiscuss ? (
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
