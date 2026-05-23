import {
  parseInterviewCategory,
  parseLearningFilter,
  parseStatusFilter,
} from "@/lib/content-routes";
import type {
  DocumentContentType,
  DocumentLearningFilter,
  DocumentStatusFilter,
  InterviewCategory,
} from "@/types/devwiki";

type SearchParamReader = {
  get: (name: string) => string | null;
};

export type DocumentQueryFilters = {
  contentType?: DocumentContentType;
  interviewCategory?: InterviewCategory;
  learning: DocumentLearningFilter;
  query: string;
  status: DocumentStatusFilter;
};

export function readDocumentQueryFilters(
  searchParams: SearchParamReader,
  contentType?: DocumentContentType,
): DocumentQueryFilters {
  const interviewCategory = parseInterviewCategory(
    searchParams.get("category") ?? undefined,
  );

  return {
    contentType,
    interviewCategory:
      contentType && contentType !== "interview_qa"
        ? undefined
        : interviewCategory,
    learning: parseLearningFilter(searchParams.get("learning") ?? undefined),
    query: searchParams.get("q")?.trim() ?? "",
    status: parseStatusFilter(searchParams.get("status") ?? undefined),
  };
}

export function documentQueryCacheKey(filters: DocumentQueryFilters) {
  return {
    category: filters.interviewCategory ?? null,
    contentType: filters.contentType ?? null,
    learning: filters.learning,
    query: filters.query,
    status: filters.status,
  };
}

export function documentApiPath(filters: DocumentQueryFilters) {
  const params = new URLSearchParams();

  if (filters.contentType) {
    params.set("content_type", filters.contentType);
  }

  if (filters.interviewCategory) {
    params.set("category", filters.interviewCategory);
  }

  if (filters.learning !== "all") {
    params.set("learning", filters.learning);
  }

  if (filters.status !== "active") {
    params.set("status", filters.status);
  }

  if (filters.query) {
    params.set("q", filters.query);
  }

  const queryString = params.toString();
  return queryString ? `/api/documents?${queryString}` : "/api/documents";
}

export function hasActiveDocumentQuery(filters: DocumentQueryFilters) {
  return (
    Boolean(filters.query) ||
    Boolean(filters.interviewCategory) ||
    filters.learning !== "all" ||
    filters.status !== "active"
  );
}
