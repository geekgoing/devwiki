import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  MessageSquareText,
  Route,
  Search,
  Star,
} from "lucide-react";
import Link from "next/link";

import { DocumentListCard } from "@/components/document-list-card";
import { SetupNotice } from "@/components/setup-notice";
import {
  contentRoutes,
  contentTypeLabels,
  documentDetailPath,
} from "@/lib/content-routes";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocuments } from "@/lib/documents";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DocumentContentType, DocumentSummary } from "@/types/devwiki";

const sectionCards = [
  {
    contentType: "term",
    icon: BookOpen,
    accentClassName: "bg-blue-50 text-blue-700",
  },
  {
    contentType: "interview_qa",
    icon: MessageSquareText,
    accentClassName: "bg-emerald-50 text-emerald-700",
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

function SmallDocumentLink({ document }: { document: DocumentSummary }) {
  return (
    <Link
      href={documentDetailPath({
        contentType: document.contentType,
        slug: document.slug,
      })}
      className="group grid gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50"
    >
      <span className="line-clamp-1 text-sm font-medium text-slate-950 transition group-hover:text-blue-700">
        {document.title}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <span>{contentTypeLabels[document.contentType]}</span>
        {document.isFavorite ? (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <Star size={11} className="fill-current" aria-hidden />
            즐겨찾기
          </span>
        ) : null}
        {document.isCompleted ? (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <CheckCircle2 size={11} aria-hidden />
            숙지함
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export default async function Home() {
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();

  const canReadPrivate = !configured || Boolean(member);
  const allDocuments = await getDocuments({
    status: "active",
    canReadPrivate,
    viewerId: user?.id,
  });
  const favoriteDocuments = allDocuments
    .filter((document) => document.isFavorite)
    .slice(0, 4);
  const completedDocuments = allDocuments
    .filter((document) => document.isCompleted)
    .slice(0, 4);
  const recentDocuments = allDocuments.slice(0, 6);
  const counts = getDocumentCounts(allDocuments);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6">
          {!configured ? <SetupNotice /> : null}

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                통합 검색
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                기술 용어, 면접 Q&A, 상황 시뮬레이션을 한 번에 찾습니다.
              </p>
              <form action="/search" className="relative mt-5">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  name="q"
                  placeholder="개념, 질문, 상황, 태그 검색"
                  className="h-12 w-full rounded-md border border-slate-300 bg-white pl-10 pr-24 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 inline-flex h-9 -translate-y-1/2 items-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  검색
                </button>
              </form>
            </div>

            <section className="grid gap-3 rounded-md border border-slate-200 bg-slate-950 p-5 text-white shadow-sm shadow-slate-200/50">
              <div>
                <h2 className="text-base font-semibold">내 학습 현황</h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  즐겨찾기와 숙지함을 기준으로 다시 볼 문서를 고릅니다.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/search?learning=favorite"
                  className="rounded-md bg-white/10 p-3 transition hover:bg-white/15"
                >
                  <span className="flex items-center gap-1.5 text-xs text-slate-300">
                    <Star size={13} aria-hidden />
                    즐겨찾기
                  </span>
                  <span className="mt-2 block text-2xl font-semibold">
                    {favoriteDocuments.length}
                  </span>
                </Link>
                <Link
                  href="/search?learning=completed"
                  className="rounded-md bg-white/10 p-3 transition hover:bg-white/15"
                >
                  <span className="flex items-center gap-1.5 text-xs text-slate-300">
                    <CheckCircle2 size={13} aria-hidden />
                    숙지함
                  </span>
                  <span className="mt-2 block text-2xl font-semibold">
                    {completedDocuments.length}
                  </span>
                </Link>
              </div>
            </section>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            {sectionCards.map((section) => {
              const Icon = section.icon;
              const route = contentRoutes[section.contentType];

              return (
                <Link
                  key={section.contentType}
                  href={route.href}
                  className="group rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md hover:shadow-slate-200/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`flex size-10 items-center justify-center rounded-md ${section.accentClassName}`}
                    >
                      <Icon size={20} aria-hidden />
                    </span>
                    <ArrowRight
                      size={16}
                      className="text-slate-300 transition group-hover:text-blue-500"
                      aria-hidden
                    />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-slate-950">
                    {route.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {counts[section.contentType]}개 문서
                  </p>
                </Link>
              );
            })}
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <article className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950">
                  최근 업데이트
                </h2>
                <Link
                  href="/terms"
                  className="text-sm font-medium text-slate-500 transition hover:text-slate-950"
                >
                  문서 둘러보기
                </Link>
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
              <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-950">
                    즐겨찾기
                  </h2>
                  <Link
                    href="/search?learning=favorite"
                    className="text-xs font-medium text-slate-500 transition hover:text-slate-950"
                  >
                    전체
                  </Link>
                </div>
                <div className="mt-3 grid gap-2">
                  {favoriteDocuments.length ? (
                    favoriteDocuments.map((document) => (
                      <SmallDocumentLink key={document.id} document={document} />
                    ))
                  ) : (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-500">
                      아직 즐겨찾기한 문서가 없습니다.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-950">
                    숙지함
                  </h2>
                  <Link
                    href="/search?learning=completed"
                    className="text-xs font-medium text-slate-500 transition hover:text-slate-950"
                  >
                    전체
                  </Link>
                </div>
                <div className="mt-3 grid gap-2">
                  {completedDocuments.length ? (
                    completedDocuments.map((document) => (
                      <SmallDocumentLink key={document.id} document={document} />
                    ))
                  ) : (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-500">
                      아직 숙지 완료한 문서가 없습니다.
                    </p>
                  )}
                </div>
              </section>
            </aside>
          </section>
        </div>
    </main>
  );
}
