import {
  ArrowRight,
  BriefcaseBusiness,
  Code2,
  FileQuestion,
  Gauge,
  Globe2,
  MessagesSquare,
  Network,
  ServerCrash,
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { documentDetailPath } from "@/lib/content-routes";
import type {
  DocumentContentType,
  DocumentSummary,
  InterviewCategory,
} from "@/types/devwiki";

type BoardContentType = Extract<
  DocumentContentType,
  "interview_qa" | "scenario"
>;

type SectionCategory = {
  id: string;
  title: string;
  summary: string;
  icon: typeof FileQuestion;
  iconClassName: string;
  linkClassName: string;
  interviewCategory?: InterviewCategory;
  slugs?: string[];
  tagKeywords?: string[];
};

type SectionCategoryGroup = SectionCategory & {
  documents: DocumentSummary[];
};

const interviewCategories = [
  {
    id: "interview-technical",
    title: "기술 질문",
    summary: "개념, 설계, 운영 판단",
    interviewCategory: "technical",
    icon: Code2,
    iconClassName: "bg-sky-50 text-sky-700",
    linkClassName: "hover:border-sky-200 hover:bg-sky-50",
  },
  {
    id: "interview-behavioral",
    title: "인성 질문",
    summary: "협업, 회고, 우선순위",
    interviewCategory: "behavioral",
    icon: BriefcaseBusiness,
    iconClassName: "bg-teal-50 text-teal-700",
    linkClassName: "hover:border-teal-200 hover:bg-teal-50",
  },
] satisfies SectionCategory[];

const scenarioCategories = [
  {
    id: "scenario-distributed-consistency",
    title: "분산 정합성",
    summary: "MSA, Saga, 보상 처리",
    slugs: ["scenario-msa-order-payment-cancel"],
    tagKeywords: ["msa", "saga", "정합성"],
    icon: Network,
    iconClassName: "bg-sky-50 text-sky-700",
    linkClassName: "hover:border-sky-200 hover:bg-sky-50",
  },
  {
    id: "scenario-network-browser",
    title: "네트워크 / 브라우저",
    summary: "DNS, TLS, HTTP, 렌더링",
    slugs: ["scenario-browser-naver-flow"],
    tagKeywords: ["network", "browser"],
    icon: Globe2,
    iconClassName: "bg-cyan-50 text-cyan-700",
    linkClassName: "hover:border-cyan-200 hover:bg-cyan-50",
  },
  {
    id: "scenario-incident-response",
    title: "장애 대응",
    summary: "타임아웃, 재시도, 격리",
    slugs: ["scenario-retry-timeout-incident"],
    tagKeywords: ["장애대응", "timeout", "retry"],
    icon: ServerCrash,
    iconClassName: "bg-rose-50 text-rose-700",
    linkClassName: "hover:border-rose-200 hover:bg-rose-50",
  },
  {
    id: "scenario-cache-performance",
    title: "성능 / 캐시",
    summary: "캐시, 부하, 트래픽 제어",
    slugs: ["scenario-cache-stampede-hot-key"],
    tagKeywords: ["cache", "성능"],
    icon: Gauge,
    iconClassName: "bg-amber-50 text-amber-700",
    linkClassName: "hover:border-amber-200 hover:bg-amber-50",
  },
  {
    id: "scenario-messaging",
    title: "메시징 / 큐",
    summary: "DLQ, 실패 메시지, 재처리",
    slugs: ["scenario-dlq-poison-message"],
    tagKeywords: ["messaging", "dlq"],
    icon: MessagesSquare,
    iconClassName: "bg-violet-50 text-violet-700",
    linkClassName: "hover:border-violet-200 hover:bg-violet-50",
  },
] satisfies SectionCategory[];

const fallbackCategories = {
  interview_qa: {
    id: "interview-etc",
    title: "기타 질문",
    summary: "분류가 아직 없는 질문",
    icon: FileQuestion,
    iconClassName: "bg-slate-50 text-slate-700",
    linkClassName: "hover:border-slate-200 hover:bg-slate-50",
  },
  scenario: {
    id: "scenario-etc",
    title: "기타 상황",
    summary: "새로 추가된 상황 질문",
    icon: FileQuestion,
    iconClassName: "bg-slate-50 text-slate-700",
    linkClassName: "hover:border-slate-200 hover:bg-slate-50",
  },
} satisfies Record<BoardContentType, SectionCategory>;

function documentHref(document: DocumentSummary) {
  return documentDetailPath({
    contentType: document.contentType,
    slug: document.slug,
  });
}

function matchesTagKeyword(document: DocumentSummary, keywords: string[] = []) {
  if (!keywords.length) {
    return false;
  }

  const tagValues = document.tags.flatMap((tag) => [
    tag.name.toLowerCase(),
    tag.slug.toLowerCase(),
  ]);

  return keywords.some((keyword) => {
    const normalizedKeyword = keyword.toLowerCase();
    return tagValues.some((tagValue) => tagValue === normalizedKeyword);
  });
}

function matchesCategory(document: DocumentSummary, category: SectionCategory) {
  if (
    category.interviewCategory &&
    document.interviewCategory === category.interviewCategory
  ) {
    return true;
  }

  if (category.slugs?.includes(document.slug)) {
    return true;
  }

  return matchesTagKeyword(document, category.tagKeywords);
}

function groupDocuments(
  documents: DocumentSummary[],
  categories: SectionCategory[],
  contentType: BoardContentType,
) {
  const assignedDocumentIds = new Set<string>();
  const groups = categories
    .map((category) => {
      const categoryDocuments = documents.filter((document) => {
        if (assignedDocumentIds.has(document.id)) {
          return false;
        }

        return matchesCategory(document, category);
      });

      categoryDocuments.forEach((document) =>
        assignedDocumentIds.add(document.id),
      );

      return {
        ...category,
        documents: categoryDocuments,
      };
    })
    .filter((group) => group.documents.length);
  const uncategorizedDocuments = documents.filter(
    (document) => !assignedDocumentIds.has(document.id),
  );

  if (!uncategorizedDocuments.length) {
    return groups;
  }

  return [
    ...groups,
    {
      ...fallbackCategories[contentType],
      documents: uncategorizedDocuments,
    },
  ];
}

function SectionIndexLink({
  count,
  icon,
  iconClassName,
  id,
  title,
}: {
  count: number;
  icon: typeof FileQuestion;
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

function SectionDocumentLink({
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

function SectionCategoryPanel({ group }: { group: SectionCategoryGroup }) {
  const Icon = group.icon;

  return (
    <section
      id={group.id}
      className="scroll-mt-24 rounded-lg border bg-card p-4"
      aria-labelledby={`${group.id}-title`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${group.iconClassName}`}
          >
            <Icon size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id={`${group.id}-title`} className="text-base font-semibold">
              {group.title}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {group.summary}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {group.documents.length}개
        </span>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {group.documents.map((document) => (
          <SectionDocumentLink
            key={`${group.id}-${document.id}`}
            document={document}
            linkClassName={group.linkClassName}
          />
        ))}
      </div>
    </section>
  );
}

export function DocumentSectionBoard({
  contentType,
  documents,
}: {
  contentType: BoardContentType;
  documents: DocumentSummary[];
}) {
  const categories =
    contentType === "interview_qa" ? interviewCategories : scenarioCategories;
  const groups = groupDocuments(documents, categories, contentType);
  const title = contentType === "interview_qa" ? "면접 분류" : "상황 분류";
  const description =
    contentType === "interview_qa"
      ? "기술과 인성 질문을 분리해서 봅니다."
      : "상황 유형별로 답변 흐름을 묶어 봅니다.";

  return (
    <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="p-0 lg:sticky lg:top-24 lg:self-start">
        <CardContent className="p-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          <nav className="mt-4 grid gap-1" aria-label={title}>
            {groups.map((group) => (
              <SectionIndexLink
                key={group.id}
                count={group.documents.length}
                icon={group.icon}
                iconClassName={group.iconClassName}
                id={group.id}
                title={group.title}
              />
            ))}
          </nav>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {groups.map((group) => (
          <SectionCategoryPanel key={group.id} group={group} />
        ))}
      </div>
    </section>
  );
}
