import {
  ArrowRight,
  Database,
  FileText,
  Gauge,
  GitBranch,
  Network,
  Route,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { documentDetailPath } from "@/lib/content-routes";
import type { DocumentSummary } from "@/types/devwiki";

const discoverySections = [
  {
    id: "category-database",
    title: "DB / 트랜잭션",
    summary: "정합성, 락, 인덱스, 확장 전략",
    slugs: [
      "transaction",
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
    iconClassName: "bg-teal-50 text-teal-700",
    linkClassName: "hover:border-teal-200 hover:bg-teal-50",
  },
  {
    id: "category-distributed-system",
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
    id: "category-messaging",
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
    id: "category-cache-performance",
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
    id: "category-security-network",
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
    id: "category-operation",
    title: "운영 / 장애대응",
    summary: "타임아웃, 격리, 관측성",
    slugs: [
      "idempotency",
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
  id: string;
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

function documentHref(document: DocumentSummary) {
  return documentDetailPath({
    contentType: document.contentType,
    slug: document.slug,
  });
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

function getUncategorizedDocuments(documents: DocumentSummary[]) {
  const categorizedSlugs = new Set(
    discoverySections.flatMap((section) => section.slugs),
  );

  return documents.filter((document) => !categorizedSlugs.has(document.slug));
}

function TopicDocumentLink({
  document,
  linkClassName,
}: {
  document: DocumentSummary;
  linkClassName: string;
}) {
  return (
    <Link
      href={documentHref(document)}
      className={`group grid min-h-[74px] grid-cols-[minmax(0,1fr)_1rem] gap-3 rounded-lg border bg-background px-3 py-3 transition ${linkClassName}`}
      data-testid="document-card"
    >
      <span className="min-w-0">
        <span className="line-clamp-1 text-sm font-semibold transition group-hover:text-primary">
          {document.title}
        </span>
        {document.summary ? (
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
            {document.summary}
          </span>
        ) : null}
      </span>
      <ArrowRight
        size={14}
        className="mt-0.5 shrink-0 text-muted-foreground/55 transition group-hover:text-primary"
        aria-hidden
      />
    </Link>
  );
}

function TopicIndexLink({
  count,
  icon,
  iconClassName,
  id,
  title,
}: {
  count: number;
  icon: typeof FileText;
  iconClassName: string;
  id: string;
  title: string;
}) {
  const Icon = icon;

  return (
    <Link
      href={`#${id}`}
      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-accent/60"
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-md ${iconClassName}`}
      >
        <Icon size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium transition group-hover:text-primary">
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{count}개 문서</span>
      </span>
    </Link>
  );
}

function TopicSection({
  documents,
  icon,
  iconClassName,
  id,
  linkClassName,
  summary,
  title,
}: {
  documents: DocumentSummary[];
  icon: typeof FileText;
  iconClassName: string;
  id: string;
  linkClassName: string;
  summary: string;
  title: string;
}) {
  const Icon = icon;

  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-lg border bg-card p-4"
      aria-labelledby={`${id}-title`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
          >
            <Icon size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-base font-semibold">
              {title}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {summary}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {documents.length}개
        </span>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {documents.map((document) => (
          <TopicDocumentLink
            key={`${id}-${document.id}`}
            document={document}
            linkClassName={linkClassName}
          />
        ))}
      </div>
    </section>
  );
}

export function DocumentDiscoveryBoard({
  documents,
}: {
  documents: DocumentSummary[];
}) {
  const documentBySlug = getDocumentMap(documents);
  const topicGroups = discoverySections
    .map((section) => ({
      ...section,
      documents: pickDocuments(documentBySlug, section.slugs),
    }))
    .filter((section) => section.documents.length);
  const uncategorizedDocuments = getUncategorizedDocuments(documents);
  const visibleTopicGroups = uncategorizedDocuments.length
    ? [
        ...topicGroups,
        {
          id: "category-etc",
          title: "기타 문서",
          summary: "주요 묶음 밖에 있는 개별 개념",
          slugs: [],
          documents: uncategorizedDocuments,
          icon: FileText,
          iconClassName: "bg-slate-50 text-slate-700",
          linkClassName: "hover:border-slate-200 hover:bg-slate-50",
        },
      ]
    : topicGroups;

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="p-0 lg:sticky lg:top-24 lg:self-start">
          <CardContent className="p-4">
            <h2 className="text-base font-semibold">카테고리</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              주제별로 먼저 고르고, 바로 관련 문서를 이어서 봅니다.
            </p>
            <nav className="mt-4 grid gap-1" aria-label="기술 용어 카테고리">
              {visibleTopicGroups.map((section) => (
                <TopicIndexLink
                  key={section.id}
                  count={section.documents.length}
                  icon={section.icon}
                  iconClassName={section.iconClassName}
                  id={section.id}
                  title={section.title}
                />
              ))}
            </nav>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {visibleTopicGroups.map((section) => (
            <TopicSection
              key={section.id}
              documents={section.documents}
              icon={section.icon}
              iconClassName={section.iconClassName}
              id={section.id}
              linkClassName={section.linkClassName}
              summary={section.summary}
              title={section.title}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardContent className="p-5">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Route size={20} aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-semibold">추천 학습 루트</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              한 답변에서 다음 꼬리 질문으로 이어지는 순서형 묶음입니다.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          {learningPaths.map((path) => {
            const pathDocuments = pickDocuments(documentBySlug, path.slugs);

            if (!pathDocuments.length) {
              return null;
            }

            return (
              <Card key={path.title} className="p-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">{path.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {path.summary}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {pathDocuments.length}단계
                    </span>
                  </div>

                  <ol className="mt-4 grid gap-2">
                    {pathDocuments.map((document, index) => (
                      <li key={document.id}>
                        <Link
                          href={documentHref(document)}
                          className="group grid min-h-10 grid-cols-[1.75rem_minmax(0,1fr)_1rem] items-center gap-2 rounded-lg border bg-muted/35 px-2 py-2 transition hover:border-primary/25 hover:bg-accent/60"
                        >
                          <span className="flex size-7 items-center justify-center rounded-md bg-background text-xs font-semibold text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="truncate text-sm font-medium transition group-hover:text-primary">
                            {document.title}
                          </span>
                          <ArrowRight
                            size={14}
                            className="text-muted-foreground/55 transition group-hover:text-primary"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
