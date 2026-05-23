import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  Gauge,
  GitBranch,
  Network,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { DocumentFilterPopover } from "@/components/document-filter-popover";
import {
  interviewCategoryFilterOptions,
  learningFilterOptions,
  statusFilterOptions,
} from "@/lib/document-filters";
import { EmptyState } from "@/components/empty-state";
import { MemberGate } from "@/components/member-gate";
import { SetupNotice } from "@/components/setup-notice";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocuments } from "@/lib/documents";
import { canEditContent, canManageMembers } from "@/lib/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  DocumentContentType,
  DocumentLearningFilter,
  DocumentStatusFilter,
  DocumentSummary,
  InterviewCategory,
} from "@/types/devwiki";

type HomeProps = {
  searchParams: Promise<{
    category?: string;
    learning?: string;
    q?: string;
    status?: string;
    type?: string;
  }>;
};

const contentTypeLabels: Record<DocumentContentType, string> = {
  term: "기술 용어",
  interview_qa: "면접 Q&A",
  scenario: "상황 시뮬레이션",
};

const contentTypeSummaries: Record<DocumentContentType, string> = {
  term: "기술 개념, 실무 예시, 꼬리 질문을 빠르게 훑습니다.",
  interview_qa: "면접에서 받은 질문과 답변 Tip을 Q&A 형태로 정리합니다.",
  scenario: "서술형 상황 질문을 해결 흐름과 토론 중심으로 다룹니다.",
};

const discoverySections = [
  {
    title: "DB / 트랜잭션",
    summary: "정합성, 락, 인덱스, 확장 전략",
    slugs: [
      "acid",
      "isolation",
      "locking",
      "deadlock",
      "index",
      "n-plus-one",
      "replication",
      "sharding",
      "normalization-denormalization",
      "connection-pool",
    ],
    icon: Database,
    iconClassName: "bg-emerald-50 text-emerald-700",
    linkClassName: "hover:border-emerald-200 hover:bg-emerald-50",
  },
  {
    title: "분산 시스템",
    summary: "MSA, 일관성, 이벤트 기반 설계",
    slugs: [
      "msa",
      "saga",
      "compensation",
      "eventual-consistency",
      "outbox",
      "cap-theorem",
      "cqrs",
      "event-sourcing",
    ],
    icon: Network,
    iconClassName: "bg-sky-50 text-sky-700",
    linkClassName: "hover:border-sky-200 hover:bg-sky-50",
  },
  {
    title: "메시징 / 비동기",
    summary: "큐, 전달 보장, 소비자 운영",
    slugs: [
      "message-queue",
      "pubsub",
      "delivery-semantics",
      "consumer-group",
      "dlq",
      "backpressure",
    ],
    icon: GitBranch,
    iconClassName: "bg-violet-50 text-violet-700",
    linkClassName: "hover:border-violet-200 hover:bg-violet-50",
  },
  {
    title: "캐시 / 성능",
    summary: "캐시 전략, 제한, 트래픽 분산",
    slugs: [
      "cache-aside",
      "cache-invalidation",
      "cache-stampede",
      "rate-limiting",
      "load-balancing",
      "http-keep-alive",
    ],
    icon: Gauge,
    iconClassName: "bg-amber-50 text-amber-700",
    linkClassName: "hover:border-amber-200 hover:bg-amber-50",
  },
  {
    title: "보안 / 네트워크",
    summary: "HTTP, 인증, 브라우저 보안",
    slugs: [
      "tcp-handshake",
      "cors",
      "jwt",
      "oauth2",
      "session-cookie",
      "api-gateway",
    ],
    icon: ShieldCheck,
    iconClassName: "bg-rose-50 text-rose-700",
    linkClassName: "hover:border-rose-200 hover:bg-rose-50",
  },
  {
    title: "운영 / 장애대응",
    summary: "타임아웃, 격리, 관측성",
    slugs: [
      "timeout-retry",
      "circuit-breaker",
      "observability",
      "backpressure",
      "dlq",
      "replication",
    ],
    icon: Wrench,
    iconClassName: "bg-cyan-50 text-cyan-700",
    linkClassName: "hover:border-cyan-200 hover:bg-cyan-50",
  },
] satisfies {
  title: string;
  summary: string;
  slugs: string[];
  icon: typeof FileText;
  iconClassName: string;
  linkClassName: string;
}[];

const learningPaths = [
  {
    title: "재시도에서 장애 격리까지",
    summary: "중복 요청, 타임아웃, 서킷, 압력 제어를 이어서 봅니다.",
    slugs: [
      "idempotency",
      "timeout-retry",
      "circuit-breaker",
      "backpressure",
      "rate-limiting",
      "observability",
    ],
  },
  {
    title: "분산 트랜잭션 답변 흐름",
    summary: "MSA의 정합성 문제를 Saga와 Outbox로 설명합니다.",
    slugs: [
      "msa",
      "saga",
      "compensation",
      "eventual-consistency",
      "outbox",
      "delivery-semantics",
    ],
  },
  {
    title: "DB 정합성과 확장",
    summary: "단일 트랜잭션부터 복제, 샤딩, CAP까지 확장합니다.",
    slugs: [
      "acid",
      "isolation",
      "locking",
      "replication",
      "sharding",
      "cap-theorem",
    ],
  },
  {
    title: "웹 API 인증 흐름",
    summary: "브라우저 요청에서 Gateway 인증까지 한 줄로 연결합니다.",
    slugs: ["cors", "session-cookie", "jwt", "oauth2", "api-gateway"],
  },
] satisfies {
  title: string;
  summary: string;
  slugs: string[];
}[];

function parseStatusFilter(value?: string): DocumentStatusFilter {
  return value === "published" || value === "draft" || value === "archived"
    ? value
    : "active";
}

function parseContentType(value?: string): DocumentContentType {
  return value === "interview_qa" || value === "scenario" ? value : "term";
}

function parseInterviewCategory(value?: string): InterviewCategory | undefined {
  return value === "technical" || value === "behavioral" ? value : undefined;
}

function parseLearningFilter(value?: string): DocumentLearningFilter {
  return value === "favorite" || value === "completed" || value === "todo"
    ? value
    : "all";
}

function loginHref(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}

function filterHref({
  category,
  contentType,
  query,
  learning,
  status,
}: {
  category?: InterviewCategory;
  contentType: DocumentContentType;
  learning: DocumentLearningFilter;
  query: string;
  status: DocumentStatusFilter;
}) {
  const params = new URLSearchParams();

  if (!query && contentType !== "term") {
    params.set("type", contentType);
  }

  if (category && (!query || contentType === "interview_qa")) {
    params.set("category", category);
  }

  if (query) {
    params.set("q", query);
  }

  if (learning !== "all") {
    params.set("learning", learning);
  }

  if (status !== "active") {
    params.set("status", status);
  }

  const queryString = params.toString();
  return queryString ? `/?${queryString}` : "/";
}

function documentHref(document: DocumentSummary) {
  return `/documents/${encodeURIComponent(document.slug)}`;
}

function getDocumentMap(documents: DocumentSummary[]) {
  return new Map(documents.map((document) => [document.slug, document]));
}

function pickDocuments(
  documentBySlug: Map<string, DocumentSummary>,
  slugs: string[],
  limit = slugs.length,
) {
  return slugs
    .map((slug) => documentBySlug.get(slug))
    .filter((document): document is DocumentSummary => Boolean(document))
    .slice(0, limit);
}

function DocumentListCard({ document }: { document: DocumentSummary }) {
  return (
    <Link
      href={documentHref(document)}
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
            {document.isFavorite ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                <Star size={12} className="fill-current" aria-hidden />
                즐겨찾기
              </span>
            ) : null}
            {document.isCompleted ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={12} aria-hidden />
                숙지함
              </span>
            ) : null}
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
  );
}

function CompactDocumentLink({
  document,
  linkClassName,
}: {
  document: DocumentSummary;
  linkClassName: string;
}) {
  return (
    <Link
      href={documentHref(document)}
      className={`group block min-h-[86px] rounded-md border border-slate-200 bg-white px-3 py-3 transition ${linkClassName}`}
      data-testid="document-card"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-semibold text-slate-950 transition group-hover:text-slate-900">
          {document.title}
        </span>
        <ArrowRight
          size={14}
          className="mt-0.5 shrink-0 text-slate-300 transition group-hover:text-slate-500"
          aria-hidden
        />
      </span>
      {document.summary ? (
        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">
          {document.summary}
        </span>
      ) : null}
    </Link>
  );
}

function SearchAndFilterBar({
  category,
  contentType,
  learning,
  query,
  status,
}: {
  category?: InterviewCategory;
  contentType: DocumentContentType;
  learning: DocumentLearningFilter;
  query: string;
  status: DocumentStatusFilter;
}) {
  const statusLinks = statusFilterOptions.map((option) => ({
    href: filterHref({
      category,
      contentType,
      learning,
      query,
      status: option.value,
    }),
    label: option.label,
    selected: status === option.value,
  }));
  const learningLinks = learningFilterOptions.map((option) => ({
    href: filterHref({
      category,
      contentType,
      learning: option.value,
      query,
      status,
    }),
    label: option.label,
    selected: learning === option.value,
  }));
  const interviewCategoryLinks =
    contentType === "interview_qa"
      ? interviewCategoryFilterOptions.map((option) => ({
          href: filterHref({
            category: option.value,
            contentType,
            learning,
            query,
            status,
          }),
          label: option.label,
          selected: category === option.value,
        }))
      : [];
  const activeFilterCount =
    Number(status !== "active") +
    Number(learning !== "all") +
    Number(Boolean(category));

  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/50 lg:flex-row lg:items-center">
      <form action="/" className="relative flex-1">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        {learning !== "all" ? (
          <input type="hidden" name="learning" value={learning} />
        ) : null}
        {status !== "active" ? (
          <input type="hidden" name="status" value={status} />
        ) : null}
        <input
          name="q"
          defaultValue={query}
          placeholder="3개 영역 전체에서 개념, 질문, 태그 검색"
          className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </form>

      <DocumentFilterPopover
        activeCount={activeFilterCount}
        interviewCategoryLinks={interviewCategoryLinks}
        learningLinks={learningLinks}
        statusLinks={statusLinks}
      />
    </div>
  );
}

function DiscoveryBoard({ documents }: { documents: DocumentSummary[] }) {
  const documentBySlug = getDocumentMap(documents);

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 lg:grid-cols-3">
        {discoverySections.map((section) => {
          const Icon = section.icon;
          const sectionDocuments = pickDocuments(documentBySlug, section.slugs, 5);

          if (!sectionDocuments.length) {
            return null;
          }

          return (
            <article
              key={section.title}
              className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-md ${section.iconClassName}`}
                >
                  <Icon size={20} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-950">
                    {section.title}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {section.summary}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {sectionDocuments.map((document) => (
                  <CompactDocumentLink
                    key={document.id}
                    document={document}
                    linkClassName={section.linkClassName}
                  />
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <span className="flex size-10 items-center justify-center rounded-md bg-slate-950 text-white">
            <Route size={20} aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-950">
            자주 이어지는 학습 경로
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            면접 답변에서 꼬리 질문으로 이어지기 쉬운 개념 묶음입니다.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {learningPaths.map((path) => {
            const pathDocuments = pickDocuments(documentBySlug, path.slugs);

            if (!pathDocuments.length) {
              return null;
            }

            return (
              <article
                key={path.title}
                className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      {path.title}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {path.summary}
                    </p>
                  </div>
                  <BookOpen
                    size={18}
                    className="shrink-0 text-blue-500"
                    aria-hidden
                  />
                </div>

                <ol className="mt-4 grid gap-2">
                  {pathDocuments.map((document, index) => (
                    <li key={document.id}>
                      <Link
                        href={documentHref(document)}
                        className="group grid min-h-10 grid-cols-[1.75rem_minmax(0,1fr)_1rem] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <span className="flex size-7 items-center justify-center rounded-md bg-white text-xs font-semibold text-slate-500">
                          {index + 1}
                        </span>
                        <span className="truncate text-sm font-medium text-slate-700 transition group-hover:text-blue-700">
                          {document.title}
                        </span>
                        <ArrowRight
                          size={14}
                          className="text-slate-300 transition group-hover:text-blue-500"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const contentType = parseContentType(params.type);
  const interviewCategory = parseInterviewCategory(params.category);
  const learning = parseLearningFilter(params.learning);
  const query = params.q?.trim() ?? "";
  const status = parseStatusFilter(params.status);
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();

  if (configured && !user) {
    redirect(loginHref("/"));
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

  const canReadPrivate = !configured || Boolean(member);
  const isGlobalSearch = Boolean(query);
  const queriedContentType = isGlobalSearch ? undefined : contentType;
  const documents = await getDocuments({
    contentType: queriedContentType,
    interviewCategory:
      contentType === "interview_qa" || isGlobalSearch
        ? interviewCategory
        : undefined,
    learning,
    query,
    status,
    canReadPrivate,
    viewerId: user?.id,
  });
  const showDiscovery =
    !query &&
    status === "active" &&
    learning === "all" &&
    !interviewCategory &&
    contentType === "term";
  const canCreate = canEditContent(member);
  const pageTitle = query ? "통합 검색" : contentTypeLabels[contentType];
  const pageSummary = query
    ? "기술 용어, 면접 Q&A, 상황 시뮬레이션을 한 번에 검색합니다."
    : `${contentTypeSummaries[contentType]} 공개 문서는 전체 멤버에게 공개되는 문서입니다.`;

  return (
    <>
      <AppHeader
        configured={configured}
        activeContentType={query ? undefined : contentType}
        canCreate={canCreate}
        canManageMembers={canManageMembers(member)}
        member={member}
        user={user}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-7">
          {!configured ? <SetupNotice /> : null}

          <>
              <section className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                    {pageTitle}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    {pageSummary}
                  </p>
                </div>

                {canCreate ? (
                  <Link
                    href={`/documents/new?type=${contentType}${
                      interviewCategory ? `&category=${interviewCategory}` : ""
                    }`}
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    <Plus size={16} aria-hidden />
                    새 문서
                  </Link>
                ) : null}
              </section>

              <SearchAndFilterBar
                category={interviewCategory}
                contentType={contentType}
                learning={learning}
                query={query}
                status={status}
              />

              {documents.length ? (
                showDiscovery ? (
                  <DiscoveryBoard documents={documents} />
                ) : (
                  <section className="grid gap-4">
                    {documents.map((document) => (
                      <DocumentListCard key={document.id} document={document} />
                    ))}
                  </section>
                )
              ) : (
                <EmptyState
                  canCreate={canCreate}
                  createHref={`/documents/new?type=${contentType}${
                    interviewCategory ? `&category=${interviewCategory}` : ""
                  }`}
                  query={query}
                />
              )}
          </>
        </div>
      </main>
    </>
  );
}
