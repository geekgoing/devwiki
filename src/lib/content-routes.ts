import type {
  DocumentContentType,
  DocumentStatusFilter,
  InterviewCategory,
} from "@/types/devwiki";

export const contentTypeLabels: Record<DocumentContentType, string> = {
  term: "기술 용어",
  interview_qa: "면접 Q&A",
  scenario: "상황 시뮬레이션",
};

export const contentTypeSummaries: Record<DocumentContentType, string> = {
  term: "기술 개념, 실무 예시, 꼬리 질문을 빠르게 훑습니다.",
  interview_qa: "면접에서 받은 질문과 답변 Tip을 Q&A 형태로 정리합니다.",
  scenario: "서술형 상황 질문을 해결 흐름과 토론 중심으로 다룹니다.",
};

export const contentRoutes = {
  term: {
    href: "/terms",
    label: contentTypeLabels.term,
  },
  interview_qa: {
    href: "/interviews",
    label: contentTypeLabels.interview_qa,
  },
  scenario: {
    href: "/scenarios",
    label: contentTypeLabels.scenario,
  },
} satisfies Record<
  DocumentContentType,
  {
    href: string;
    label: string;
  }
>;

export function contentTypePath(contentType: DocumentContentType) {
  return contentRoutes[contentType].href;
}

export function documentDetailPath({
  contentType,
  slug,
}: {
  contentType: DocumentContentType;
  slug: string;
}) {
  return `${contentTypePath(contentType)}/${encodeURIComponent(slug)}`;
}

export function legacyDocumentPath(slug: string) {
  return `/documents/${encodeURIComponent(slug)}`;
}

export function documentEditPath(slug: string) {
  return `${legacyDocumentPath(slug)}/edit`;
}

export function parseStatusFilter(value?: string): DocumentStatusFilter {
  return value === "published" || value === "draft" || value === "archived"
    ? value
    : "active";
}

export function parseContentType(value?: string): DocumentContentType {
  return value === "interview_qa" || value === "scenario" ? value : "term";
}

export function parseInterviewCategory(
  value?: string,
): InterviewCategory | undefined {
  return value === "technical" || value === "behavioral" ? value : undefined;
}

export function parseFavoritesFilter(value?: string): boolean {
  return value === "1" || value === "true" || value === "favorite";
}

export function withSearchParams(
  path: string,
  entries: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();

  Object.entries(entries).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}
