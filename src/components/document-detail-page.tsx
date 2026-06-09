import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
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

import { updateDocumentFavoriteState } from "@/app/actions";
import { CopyLinkButton } from "@/components/copy-link-button";
import { DocumentComments } from "@/components/document-comments";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { MarkdownToc } from "@/components/markdown-toc";
import { MemberGate } from "@/components/member-gate";
import { RevisionHistory } from "@/components/revision-history";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDocumentCommentStats } from "@/lib/comment-utils";
import {
  contentTypeLabels,
  contentTypePath,
  documentDetailPath,
  documentEditPath,
  legacyDocumentPath,
  withSearchParams,
} from "@/lib/content-routes";
import { formatDate } from "@/lib/format";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { canEditContent } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { siteDescription, siteName } from "@/lib/site";
import {
  getBacklinkDocuments,
  getDocumentBySlug,
  getDocumentComments,
  getDocumentRevisions,
  getRelatedDocuments,
} from "@/lib/documents";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  DocumentContentType,
  DocumentDetail,
  RelatedDocument,
} from "@/types/devwiki";

export type DocumentSlugPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type DocumentDetailPageProps = DocumentSlugPageProps & {
  expectedContentType?: DocumentContentType;
};

function LinkedDocumentCard({ document }: { document: RelatedDocument }) {
  return (
    <li>
      <Link
        href={documentDetailPath(document)}
        className="block rounded-lg border bg-muted/35 px-3 py-2 transition hover:border-primary/25 hover:bg-accent/60"
      >
        <span className="block text-sm font-medium">{document.title}</span>
        {document.summary ? (
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
            {document.summary}
          </span>
        ) : (
          <span className="mt-1 block font-mono text-xs text-muted-foreground">
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

function requestedDocumentPath(
  encodedSlug: string,
  expectedContentType?: DocumentContentType,
) {
  return expectedContentType
    ? `${contentTypePath(expectedContentType)}/${encodedSlug}`
    : legacyDocumentPath(decodeURIComponent(encodedSlug));
}

export async function generateDocumentMetadata({
  expectedContentType,
  params,
}: DocumentDetailPageProps): Promise<Metadata> {
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
  const url = document
    ? documentDetailPath(document)
    : requestedDocumentPath(encodedSlug, expectedContentType);

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
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length ? (
          <ol className="space-y-2">
            {documents.map((document) => (
              <LinkedDocumentCard key={document.id} document={document} />
            ))}
          </ol>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/35 px-3 py-3">
            <p className="text-xs leading-5 text-muted-foreground">
              {emptyText}
            </p>
            {editHref ? (
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href={editHref}>
                  <Pencil size={13} aria-hidden />
                  편집에서 추가
                </Link>
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FavoriteButton({ document }: { document: DocumentDetail }) {
  const enabled = document.isFavorite;
  const label = enabled ? "즐겨찾기 해제" : "즐겨찾기";

  return (
    <form action={updateDocumentFavoriteState}>
      <input type="hidden" name="content_type" value={document.contentType} />
      <input type="hidden" name="document_id" value={document.id} />
      <input type="hidden" name="slug" value={document.slug} />
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
      <Button
        type="submit"
        variant={enabled ? "secondary" : "outline"}
        className={cn(
          enabled
            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "",
        )}
      >
        <Star size={16} className={enabled ? "fill-current" : ""} aria-hidden />
        {label}
      </Button>
    </form>
  );
}

export async function DocumentDetailPage({
  expectedContentType,
  params,
}: DocumentDetailPageProps) {
  const { slug: encodedSlug } = await params;
  const slug = decodeURIComponent(encodedSlug);
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const canReadPrivate = !configured || Boolean(member);
  const requestedPath = requestedDocumentPath(encodedSlug, expectedContentType);

  if (configured && !user) {
    redirect(loginHref(requestedPath));
  }

  if (configured && user && !member) {
    return (
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <MemberGate user={user} />
      </main>
    );
  }

  const document = await getDocumentBySlug(slug, {
    canReadPrivate,
    viewerId: user?.id,
  });

  if (!document) {
    notFound();
  }

  const canonicalPath = documentDetailPath(document);

  if (expectedContentType && document.contentType !== expectedContentType) {
    redirect(canonicalPath);
  }

  const [revisions, comments, relatedDocuments, backlinkDocuments] =
    await Promise.all([
      getDocumentRevisions(document.id, { canReadPrivate }),
      getDocumentComments(document.id, { canReadPrivate }),
      getRelatedDocuments(document.id, { canReadPrivate }),
      getBacklinkDocuments(document.id, { canReadPrivate }),
    ]);
  const canContribute = canEditContent(member);
  const canSaveFavorite = Boolean(configured && member);
  const shouldShowRelatedDocuments =
    relatedDocuments.length > 0 || canContribute;
  const commentStats = getDocumentCommentStats(comments);
  const editHref = documentEditPath(document.slug);
  const listHref = contentTypePath(document.contentType);

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-7 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
      <Card className="lg:col-span-2">
        <CardContent className="px-5 py-6 sm:px-7">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
            <Link href={listHref}>
              <ArrowLeft size={15} aria-hidden />
              {contentTypeLabels[document.contentType]} 목록
            </Link>
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={document.status} />
                <Badge variant="secondary" className="font-mono">
                  /{document.slug}
                </Badge>
              </div>
              <h1
                className="text-3xl font-semibold tracking-tight sm:text-4xl"
                data-testid="document-title"
              >
                {document.title}
              </h1>
              {document.summary ? (
                <p
                  className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground"
                  data-testid="document-summary"
                >
                  {document.summary}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {canSaveFavorite ? (
                <FavoriteButton document={document} />
              ) : null}
              <CopyLinkButton path={canonicalPath} />
              {canContribute ? (
                <Button asChild>
                  <Link href={editHref}>
                    <Pencil size={16} aria-hidden />
                    수정
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-muted px-3 py-2">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={14} aria-hidden />
                마지막 수정
              </span>
              <strong className="mt-1 block font-medium text-foreground">
                {formatDate(document.updatedAt)}
              </strong>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden />
                생성
              </span>
              <strong className="mt-1 block font-medium text-foreground">
                {formatDate(document.createdAt)}
              </strong>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <span className="inline-flex items-center gap-1.5">
                <Link2 size={14} aria-hidden />
                연결
              </span>
              <strong className="mt-1 block font-medium text-foreground">
                {relatedDocuments.length + backlinkDocuments.length}개
              </strong>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare size={14} aria-hidden />
                댓글
              </span>
              <strong className="mt-1 block font-medium text-foreground">
                {commentStats.totalCount}개
              </strong>
              {commentStats.replyCount ? (
                <span className="mt-0.5 block text-[11px]">
                  답글 {commentStats.replyCount}개 포함
                </span>
              ) : null}
            </div>
          </div>

          {document.tags.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {document.tags.map((tag) => (
                <Badge key={tag.id} asChild variant="secondary">
                  <Link href={withSearchParams("/search", { q: tag.name })}>
                    <Tags size={12} aria-hidden />
                    {tag.name}
                  </Link>
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-7">
        <article className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="p-5 sm:p-8">
            <MarkdownRenderer content={document.bodyMarkdown} />
          </div>
        </article>

        <DocumentComments
          comments={comments}
          configured={configured}
          contentType={document.contentType}
          currentUserId={user?.id}
          documentId={document.id}
          memberRole={member?.role}
          slug={document.slug}
        />
      </div>

      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <MarkdownToc content={document.bodyMarkdown} />

        <LinkSection
          documents={relatedDocuments}
          editHref={editHref}
          emptyText="아직 연결된 문서가 없습니다."
          icon={
            <ArrowRight
              size={16}
              className="text-muted-foreground"
              aria-hidden
            />
          }
          showEmptyState={shouldShowRelatedDocuments}
          title="연관 문서"
        />

        <LinkSection
          documents={backlinkDocuments}
          emptyText="아직 이 문서를 참조하는 문서가 없습니다."
          icon={
            <ArrowLeft
              size={16}
              className="text-muted-foreground"
              aria-hidden
            />
          }
          title="이 문서를 참조하는 문서"
        />

        <RevisionHistory
          currentBody={document.bodyMarkdown}
          documentId={document.id}
          revisions={revisions}
          canRestore={canContribute}
        />
      </aside>
    </main>
  );
}
