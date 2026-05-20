import { Archive, FileText, FilePenLine, Globe2, Search } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { SetupNotice } from "@/components/setup-notice";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocuments } from "@/lib/documents";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DocumentStatusFilter } from "@/types/devwiki";

type HomeProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

const statusLabels: Record<DocumentStatusFilter, string> = {
  active: "공개+초안",
  published: "공개",
  draft: "초안",
  archived: "보관",
};

const statusIcons = {
  active: FileText,
  published: Globe2,
  draft: FilePenLine,
  archived: Archive,
} satisfies Record<DocumentStatusFilter, typeof FileText>;

function parseStatusFilter(value?: string): DocumentStatusFilter {
  return value === "published" || value === "draft" || value === "archived"
    ? value
    : "active";
}

function filterHref(query: string, status: DocumentStatusFilter) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (status !== "active") {
    params.set("status", status);
  }

  const queryString = params.toString();
  return queryString ? `/?${queryString}` : "/";
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = parseStatusFilter(params.status);
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const canReadPrivate = !configured || Boolean(member);
  const documents = await getDocuments({
    query,
    status,
    canReadPrivate,
  });
  const filters: DocumentStatusFilter[] = canReadPrivate
    ? ["active", "published", "draft", "archived"]
    : ["active"];

  return (
    <>
      <AppHeader
        configured={configured}
        canCreate={Boolean(member)}
        canManageMembers={member?.role === "owner"}
        user={user}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-7">
          {!configured ? <SetupNotice /> : null}

          <>
            {configured && user && !member ? (
              <section className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 shadow-sm shadow-amber-200/40">
                공개 문서는 읽을 수 있지만 작성, 수정, 초안 열람은 멤버 등록이
                필요합니다.
              </section>
            ) : null}

              <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                    백엔드 면접 개념 사전
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    개발자들이 백엔드 면접 개념, 꼬리 질문, 예시, 시각 자료를
                    함께 정리하는 협업형 위키입니다.
                  </p>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                      <FileText size={20} aria-hidden />
                    </span>
                    <div>
                      <p className="text-2xl font-semibold text-slate-950">
                        {documents.length}
                      </p>
                      <p className="text-xs text-slate-500">검색 결과 문서</p>
                    </div>
                  </div>
                </div>
              </section>

              <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/50 lg:flex-row lg:items-center lg:justify-between">
                <form action="/" className="relative w-full max-w-xl">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input type="hidden" name="status" value={status} />
                  <input
                    name="q"
                    defaultValue={query}
                    placeholder="개념, 태그, 요약으로 검색"
                    className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </form>

                <nav className="flex flex-wrap gap-2" aria-label="문서 상태 필터">
                  {filters.map((filter) => {
                    const Icon = statusIcons[filter];
                    const selected = status === filter;
                    const label =
                      filter === "active" && !canReadPrivate
                        ? "공개"
                        : statusLabels[filter];

                    return (
                      <Link
                        key={filter}
                        href={filterHref(query, filter)}
                        className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
                          selected
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                        }`}
                      >
                        <Icon size={15} aria-hidden />
                        {label}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {documents.length ? (
                <section className="grid gap-4">
                  {documents.map((document) => (
                    <Link
                      key={document.id}
                      href={`/documents/${encodeURIComponent(document.slug)}`}
                      className="group rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md hover:shadow-slate-200/70"
                      data-testid="document-card"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold text-slate-950 transition group-hover:text-blue-700">
                              {document.title}
                            </h2>
                            <StatusBadge status={document.status} />
                          </div>
                          {document.summary ? (
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                              {document.summary}
                            </p>
                          ) : null}
                        </div>
                        <time className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-500">
                          {formatDate(document.updatedAt)}
                        </time>
                      </div>

                      {document.tags.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {document.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 transition group-hover:bg-blue-50 group-hover:text-blue-700"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </Link>
                  ))}
                </section>
              ) : (
                <EmptyState canCreate={Boolean(member)} query={query} />
              )}
          </>
        </div>
      </main>
    </>
  );
}
