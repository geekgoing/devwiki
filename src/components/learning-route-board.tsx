import { ArrowRight, CheckCircle2, GraduationCap } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { contentTypeLabels, documentDetailPath } from "@/lib/content-routes";
import type { DocumentSummary } from "@/types/devwiki";

const learningRoutes = [
  {
    title: "분산 트랜잭션 답변 루트",
    summary: "MSA 정합성 문제를 개념에서 상황 답변까지 이어갑니다.",
    slugs: [
      "msa",
      "saga",
      "compensation",
      "eventual-consistency",
      "outbox",
      "qa-api-gateway",
      "scenario-msa-order-payment-cancel",
    ],
  },
  {
    title: "장애 대응 면접 루트",
    summary: "중복 요청, 재시도, 격리, 큐 실패까지 운영 관점으로 봅니다.",
    slugs: [
      "idempotency",
      "timeout-retry",
      "circuit-breaker",
      "backpressure",
      "qa-message-queue-retry",
      "scenario-retry-timeout-incident",
      "scenario-dlq-poison-message",
    ],
  },
  {
    title: "캐시 / 성능 운영 루트",
    summary: "캐시 전략과 부하 제어를 실제 장애 시나리오로 연결합니다.",
    slugs: [
      "cache-aside",
      "cache-invalidation",
      "cache-stampede",
      "rate-limiting",
      "qa-cache-invalidation",
      "scenario-cache-stampede-hot-key",
    ],
  },
  {
    title: "웹 요청 흐름 루트",
    summary: "브라우저 요청부터 인증, Gateway까지 한 번에 정리합니다.",
    slugs: [
      "tcp-handshake",
      "http-keep-alive",
      "cors",
      "session-cookie",
      "jwt",
      "oauth2",
      "api-gateway",
      "qa-api-gateway",
      "scenario-browser-naver-flow",
    ],
  },
] satisfies Array<{
  title: string;
  summary: string;
  slugs: string[];
}>;

function documentHref(document: DocumentSummary) {
  return documentDetailPath({
    contentType: document.contentType,
    slug: document.slug,
  });
}

function pickRouteDocuments(
  documentBySlug: Map<string, DocumentSummary>,
  slugs: string[],
) {
  return slugs
    .map((slug) => documentBySlug.get(slug))
    .filter((document): document is DocumentSummary => Boolean(document));
}

function RouteStep({
  document,
  index,
}: {
  document: DocumentSummary;
  index: number;
}) {
  return (
    <li>
      <Link
        href={documentHref(document)}
        className="group grid min-h-10 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border bg-muted/35 px-2 py-2 transition hover:border-primary/25 hover:bg-accent/60"
      >
        <span className="flex size-7 items-center justify-center rounded-md bg-background text-xs font-semibold text-muted-foreground">
          {index + 1}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium transition group-hover:text-primary">
            {document.title}
          </span>
          <span className="text-xs text-muted-foreground">
            {contentTypeLabels[document.contentType]}
          </span>
        </span>
        {document.isCompleted ? (
          <CheckCircle2
            size={15}
            className="text-teal-700"
            aria-label="숙지함"
          />
        ) : (
          <ArrowRight
            size={14}
            className="text-muted-foreground/55 transition group-hover:text-primary"
            aria-hidden
          />
        )}
      </Link>
    </li>
  );
}

export function LearningRouteBoard({
  documents,
}: {
  documents: DocumentSummary[];
}) {
  const documentBySlug = new Map(
    documents.map((document) => [document.slug, document]),
  );
  const routes = learningRoutes
    .map((route) => ({
      ...route,
      documents: pickRouteDocuments(documentBySlug, route.slugs),
    }))
    .filter((route) => route.documents.length);

  if (!routes.length) {
    return null;
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">추천 학습 루트</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            개념, 면접 답변, 상황 적용을 한 흐름으로 이어서 봅니다.
          </p>
        </div>
        <Badge variant="secondary">교육 루트</Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {routes.map((route) => {
          const completedCount = route.documents.filter(
            (document) => document.isCompleted,
          ).length;
          const nextDocument =
            route.documents.find((document) => !document.isCompleted) ??
            route.documents[0];
          const progressText = `${completedCount}/${route.documents.length} 완료`;

          return (
            <Card key={route.title} className="p-0">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold">{route.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {route.summary}
                    </p>
                  </div>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <GraduationCap size={20} aria-hidden />
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    {progressText}
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link href={documentHref(nextDocument)}>
                      이어서 보기
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </div>

                <ol className="mt-3 grid gap-2">
                  {route.documents.slice(0, 5).map((document, index) => (
                    <RouteStep
                      key={`${route.title}-${document.id}`}
                      document={document}
                      index={index}
                    />
                  ))}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
