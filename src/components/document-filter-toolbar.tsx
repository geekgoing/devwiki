import { DocumentFilterPopover } from "@/components/document-filter-popover";
import {
  favoriteFilterOptions,
  interviewCategoryFilterOptions,
  statusFilterOptions,
} from "@/lib/document-filters";
import { withSearchParams } from "@/lib/content-routes";
import type {
  DocumentContentType,
  DocumentStatusFilter,
  InterviewCategory,
} from "@/types/devwiki";

function sectionFilterHref({
  basePath,
  category,
  favoritesOnly,
  status,
}: {
  basePath: string;
  category?: InterviewCategory;
  favoritesOnly: boolean;
  status: DocumentStatusFilter;
}) {
  return withSearchParams(basePath, {
    category,
    favorites: favoritesOnly ? "1" : undefined,
    status: status === "active" ? undefined : status,
  });
}

function searchFilterHref({
  category,
  favoritesOnly,
  query,
  status,
}: {
  category?: InterviewCategory;
  favoritesOnly: boolean;
  query: string;
  status: DocumentStatusFilter;
}) {
  return withSearchParams("/search", {
    category,
    favorites: favoritesOnly ? "1" : undefined,
    q: query || undefined,
    status: status === "active" ? undefined : status,
  });
}

export function DocumentFilterToolbar({
  basePath,
  category,
  contentType,
  favoritesOnly,
  onNavigate,
  query = "",
  status,
}: {
  basePath: string;
  category?: InterviewCategory;
  contentType?: DocumentContentType;
  favoritesOnly: boolean;
  onNavigate?: (href: string) => void;
  query?: string;
  status: DocumentStatusFilter;
}) {
  const isSearch = basePath === "/search";
  const makeHref = ({
    nextCategory = category,
    nextFavoritesOnly = favoritesOnly,
    nextStatus = status,
  }: {
    nextCategory?: InterviewCategory;
    nextFavoritesOnly?: boolean;
    nextStatus?: DocumentStatusFilter;
  }) =>
    isSearch
      ? searchFilterHref({
          category: nextCategory,
          favoritesOnly: nextFavoritesOnly,
          query,
          status: nextStatus,
        })
      : sectionFilterHref({
          basePath,
          category: nextCategory,
          favoritesOnly: nextFavoritesOnly,
          status: nextStatus,
        });

  const statusLinks = statusFilterOptions.map((option) => ({
    href: makeHref({ nextStatus: option.value }),
    label: option.label,
    selected: status === option.value,
  }));
  const favoriteLinks = favoriteFilterOptions.map((option) => ({
    href: makeHref({ nextFavoritesOnly: option.value }),
    label: option.label,
    selected: favoritesOnly === option.value,
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
  const statusLabel = statusFilterOptions.find(
    (option) => option.value === status,
  )?.label;
  const favoriteLabel = favoriteFilterOptions.find(
    (option) => option.value === favoritesOnly,
  )?.label;
  const categoryLabel = category
    ? interviewCategoryFilterOptions.find((option) => option.value === category)
        ?.label
    : undefined;
  const activeFilterLabels = [
    status !== "active" && statusLabel ? `상태: ${statusLabel}` : undefined,
    favoritesOnly && favoriteLabel ? favoriteLabel : undefined,
    categoryLabel ? `분류: ${categoryLabel}` : undefined,
  ].filter((label): label is string => Boolean(label));
  const activeFilterCount =
    Number(status !== "active") +
    Number(favoritesOnly) +
    Number(Boolean(category));
  const resetHref = isSearch
    ? withSearchParams("/search", { q: query || undefined })
    : basePath;

  return (
    <DocumentFilterPopover
      activeCount={activeFilterCount}
      activeLabels={activeFilterLabels}
      favoriteLinks={favoriteLinks}
      interviewCategoryLinks={interviewCategoryLinks}
      onNavigate={onNavigate}
      resetHref={resetHref}
      statusLinks={statusLinks}
    />
  );
}
