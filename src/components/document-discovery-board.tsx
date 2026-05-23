import {
  ArrowRight,
  BookOpen,
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

import type { DocumentSummary } from "@/types/devwiki";

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

export function DocumentDiscoveryBoard({
  documents,
}: {
  documents: DocumentSummary[];
}) {
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
