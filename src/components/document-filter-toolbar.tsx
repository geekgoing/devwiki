import { DocumentFilterPopover } from "@/components/document-filter-popover";
import {
  interviewCategoryFilterOptions,
  learningFilterOptions,
  statusFilterOptions,
} from "@/lib/document-filters";
import { withSearchParams } from "@/lib/content-routes";
import type {
  DocumentContentType,
  DocumentLearningFilter,
  DocumentStatusFilter,
  InterviewCategory,
} from "@/types/devwiki";

function sectionFilterHref({
  basePath,
  category,
  learning,
  status,
}: {
  basePath: string;
  category?: InterviewCategory;
  learning: DocumentLearningFilter;
  status: DocumentStatusFilter;
}) {
  return withSearchParams(basePath, {
    category,
    learning: learning === "all" ? undefined : learning,
    status: status === "active" ? undefined : status,
  });
}

function searchFilterHref({
  category,
  learning,
  query,
  status,
}: {
  category?: InterviewCategory;
  learning: DocumentLearningFilter;
  query: string;
  status: DocumentStatusFilter;
}) {
  return withSearchParams("/search", {
    category,
    learning: learning === "all" ? undefined : learning,
    q: query || undefined,
    status: status === "active" ? undefined : status,
  });
}

export function DocumentFilterToolbar({
  basePath,
  category,
  contentType,
  learning,
  onNavigate,
  query = "",
  status,
}: {
  basePath: string;
  category?: InterviewCategory;
  contentType?: DocumentContentType;
  learning: DocumentLearningFilter;
  onNavigate?: (href: string) => void;
  query?: string;
  status: DocumentStatusFilter;
}) {
  const isSearch = basePath === "/search";
  const makeHref = ({
    nextCategory = category,
    nextLearning = learning,
    nextStatus = status,
  }: {
    nextCategory?: InterviewCategory;
    nextLearning?: DocumentLearningFilter;
    nextStatus?: DocumentStatusFilter;
  }) =>
    isSearch
      ? searchFilterHref({
          category: nextCategory,
          learning: nextLearning,
          query,
          status: nextStatus,
        })
      : sectionFilterHref({
          basePath,
          category: nextCategory,
          learning: nextLearning,
          status: nextStatus,
        });

  const statusLinks = statusFilterOptions.map((option) => ({
    href: makeHref({ nextStatus: option.value }),
    label: option.label,
    selected: status === option.value,
  }));
  const learningLinks = learningFilterOptions.map((option) => ({
    href: makeHref({ nextLearning: option.value }),
    label: option.label,
    selected: learning === option.value,
  }));
  const shouldShowInterviewCategory =
    isSearch || contentType === "interview_qa";
  const interviewCategoryLinks = shouldShowInterviewCategory
    ? interviewCategoryFilterOptions.map((option) => ({
        href: makeHref({ nextCategory: option.value }),
        label: option.label,
        selected: category === option.value,
      }))
    : [];
  const activeFilterCount =
    Number(status !== "active") +
    Number(learning !== "all") +
    Number(Boolean(category));
  const resetHref = isSearch
    ? withSearchParams("/search", { q: query || undefined })
    : basePath;

  return (
    <DocumentFilterPopover
      activeCount={activeFilterCount}
      interviewCategoryLinks={interviewCategoryLinks}
      learningLinks={learningLinks}
      onNavigate={onNavigate}
      resetHref={resetHref}
      statusLinks={statusLinks}
    />
  );
}
