import {
  ArrowRight,
  BookOpen,
  Clock3,
  MessageSquare,
  MessageSquareText,
  Route,
  Search,
  Star,
} from "lucide-react";
import Link from "next/link";

import { DocumentListCard } from "@/components/document-list-card";
import { SetupNotice } from "@/components/setup-notice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  contentRoutes,
  contentTypeLabels,
  contentTypeSummaries,
  documentDetailPath,
} from "@/lib/content-routes";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocuments, getRecentCommentActivities } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  DocumentContentType,
  DocumentSummary,
  RecentCommentActivity,
} from "@/types/devwiki";

const sectionCards = [
  {
    contentType: "term",
    icon: BookOpen,
    accentClassName: "bg-sky-50 text-sky-700",
  },
  {
    contentType: "interview_qa",
    icon: MessageSquareText,
    accentClassName: "bg-teal-50 text-teal-700",
  },
  {
    contentType: "scenario",
    icon: Route,
    accentClassName: "bg-amber-50 text-amber-700",
  },
] satisfies Array<{
  contentType: DocumentContentType;
  icon: typeof BookOpen;
  accentClassName: string;
}>;

function getDocumentCounts(documents: DocumentSummary[]) {
  return documents.reduce(
    (counts, document) => ({
      ...counts,
      [document.contentType]: counts[document.contentType] + 1,
    }),
    {
      term: 0,
      interview_qa: 0,
      scenario: 0,
    } satisfies Record<DocumentContentType, number>,
  );
}

function getDocumentsByContentType(documents: DocumentSummary[]) {
  const grouped: Record<DocumentContentType, DocumentSummary[]> = {
    term: [],
    interview_qa: [],
    scenario: [],
  };

  documents.forEach((document) => {
    grouped[document.contentType].push(document);
  });

  return grouped;
}

function SectionDocumentPeek({ document }: { document: DocumentSummary }) {
  return (
    <Link
      href={documentDetailPath({
        contentType: document.contentType,
        slug: document.slug,
      })}
      className="group flex min-h-9 items-center justify-between gap-2 rounded-md px-2 py-1.5 transition hover:bg-accent/60"
    >
      <span className="min-w-0 truncate text-sm font-medium transition group-hover:text-primary">
        {document.title}
      </span>
      <ArrowRight
        size={13}
        className="shrink-0 text-muted-foreground/55 transition group-hover:text-primary"
        aria-hidden
      />
    </Link>
  );
}

function SmallDocumentLink({ document }: { document: DocumentSummary }) {
  return (
    <Link
      href={documentDetailPath({
        contentType: document.contentType,
        slug: document.slug,
      })}
      className="group grid gap-1 rounded-lg border bg-muted/35 px-3 py-2 transition hover:border-primary/25 hover:bg-accent/60"
    >
      <span className="line-clamp-1 text-sm font-medium transition group-hover:text-primary">
        {document.title}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>{contentTypeLabels[document.contentType]}</span>
        {document.isFavorite ? (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <Star size={11} className="fill-current" aria-hidden />
            즐겨찾기
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function RecentCommentActivityLink({
  activity,
}: {
  activity: RecentCommentActivity;
}) {
  const href = `${documentDetailPath(activity.document)}#comments`;

  return (
    <Link
      href={href}
      className="group block rounded-lg border bg-muted/35 px-3 py-2 transition hover:border-primary/25 hover:bg-accent/60"
    >
      <span className="line-clamp-1 text-sm font-medium transition group-hover:text-primary">
        {activity.document.title}
      </span>
      <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {activity.latestCommentBody}
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{contentTypeLabels[activity.document.contentType]}</span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={11} aria-hidden />
          {activity.totalCommentCount}개
        </span>
        {activity.replyCount ? (
          <span>답글 {activity.replyCount}개</span>
        ) : null}
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Clock3 size={11} aria-hidden />
        {activity.latestCommentAuthorLabel} ·{" "}
        {formatDate(activity.latestCommentAt)}
      </span>
    </Link>
  );
}

export default async function Home() {
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();

  const canReadPrivate = !configured || Boolean(member);
  const [allDocuments, recentCommentActivities] = await Promise.all([
    getDocuments({
      status: "active",
      canReadPrivate,
      viewerId: user?.id,
    }),
    getRecentCommentActivities({
      canReadPrivate,
      viewerId: user?.id,
    }),
  ]);
  const allFavoriteDocuments = allDocuments.filter(
    (document) => document.isFavorite,
  );
  const favoriteDocuments = allFavoriteDocuments.slice(0, 4);
  const favoriteDocumentCount = allFavoriteDocuments.length;
  const recentDocuments = allDocuments.slice(0, 6);
  const counts = getDocumentCounts(allDocuments);
  const documentsByContentType = getDocumentsByContentType(allDocuments);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        {!configured ? <SetupNotice /> : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl tracking-tight">
                통합 검색
              </CardTitle>
              <CardDescription>
                기술 용어, 면접 Q&A, 상황 시뮬레이션을 한 번에 찾습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action="/search" className="relative">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  name="q"
                  placeholder="개념, 질문, 상황, 태그 검색"
                  className="h-12 pl-10 pr-24"
                />
                <Button
                  type="submit"
                  className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2"
                >
                  검색
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle>즐겨찾기</CardTitle>
              <CardDescription className="text-primary-foreground/75">
                다시 볼 문서를 빠르게 모아둡니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/search?favorites=1"
                className="block rounded-lg bg-primary-foreground/10 p-3 transition hover:bg-primary-foreground/15"
              >
                <span className="flex items-center gap-1.5 text-xs text-primary-foreground/75">
                  <Star size={13} aria-hidden />
                  저장한 문서
                </span>
                <span className="mt-2 block text-2xl font-semibold">
                  {favoriteDocumentCount}
                </span>
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {sectionCards.map((section) => {
            const Icon = section.icon;
            const route = contentRoutes[section.contentType];
            const previewDocuments = documentsByContentType[
              section.contentType
            ].slice(0, 2);

            return (
              <Card
                key={section.contentType}
                className="p-0 transition hover:-translate-y-0.5 hover:ring-primary/20"
              >
                <div className="p-4">
                  <Link href={route.href} className="group block">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`flex size-10 items-center justify-center rounded-lg ${section.accentClassName}`}
                      >
                        <Icon size={20} aria-hidden />
                      </span>
                      <ArrowRight
                        size={16}
                        className="text-muted-foreground/55 transition group-hover:text-primary"
                        aria-hidden
                      />
                    </div>
                    <h2 className="mt-4 text-base font-semibold transition group-hover:text-primary">
                      {route.label}
                    </h2>
                  </Link>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {contentTypeSummaries[section.contentType]}
                  </p>
                  <p className="mt-3 text-xs font-medium text-muted-foreground">
                    {counts[section.contentType]}개 문서
                  </p>
                </div>
                {previewDocuments.length ? (
                  <div className="border-t bg-muted/25 px-2 py-2">
                    {previewDocuments.map((document) => (
                      <SectionDocumentPeek
                        key={document.id}
                        document={document}
                      />
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <article className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">최근 업데이트</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/terms">문서 둘러보기</Link>
              </Button>
            </div>
            <div className="grid gap-4">
              {recentDocuments.slice(0, 4).map((document) => (
                <DocumentListCard
                  key={document.id}
                  document={document}
                  showContentType
                />
              ))}
            </div>
          </article>

          <aside className="grid content-start gap-4">
            <Card size="sm">
              <CardHeader>
                <CardTitle>즐겨찾기</CardTitle>
                <CardAction>
                  <Button asChild variant="ghost" size="xs">
                    <Link href="/search?favorites=1">전체</Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-2">
                {favoriteDocuments.length ? (
                  favoriteDocuments.map((document) => (
                    <SmallDocumentLink key={document.id} document={document} />
                  ))
                ) : (
                  <p className="rounded-lg bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
                    아직 즐겨찾기한 문서가 없습니다.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare
                    size={16}
                    className="text-primary"
                    aria-hidden
                  />
                  최근 댓글
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {recentCommentActivities.length ? (
                  recentCommentActivities.map((activity) => (
                    <RecentCommentActivityLink
                      key={activity.document.id}
                      activity={activity}
                    />
                  ))
                ) : (
                  <p className="rounded-lg bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
                    아직 최근 댓글이 없습니다.
                  </p>
                )}
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
