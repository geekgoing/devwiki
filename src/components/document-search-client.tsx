"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { DocumentFilterToolbar } from "@/components/document-filter-toolbar";
import { DocumentListCard } from "@/components/document-list-card";
import { DocumentListSkeleton } from "@/components/document-list-skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { withSearchParams } from "@/lib/content-routes";
import {
  documentApiPath,
  documentQueryCacheKey,
  hasActiveDocumentQuery,
  readDocumentQueryFilters,
  type DocumentQueryFilters,
} from "@/lib/document-query";
import type { DocumentSummary } from "@/types/devwiki";

const searchSuggestions = ["트랜잭션", "인덱스", "MSA", "피드백"];

async function fetchDocuments(filters: DocumentQueryFilters) {
  const response = await fetch(documentApiPath(filters), {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("검색 결과를 불러오지 못했습니다.");
  }

  const payload = (await response.json()) as { documents: DocumentSummary[] };
  return payload.documents;
}

function isInitialFilters(
  currentFilters: DocumentQueryFilters,
  initialFilters: DocumentQueryFilters,
) {
  return (
    JSON.stringify(documentQueryCacheKey(currentFilters)) ===
    JSON.stringify(documentQueryCacheKey(initialFilters))
  );
}

function searchHref(filters: DocumentQueryFilters) {
  return withSearchParams("/search", {
    category: filters.interviewCategory,
    favorites: filters.favoritesOnly ? "1" : undefined,
    q: filters.query || undefined,
    status: filters.status === "active" ? undefined : filters.status,
  });
}

function LoadingBar({ visible }: { visible: boolean }) {
  return (
    <div
      className="h-0.5 overflow-hidden rounded-full bg-transparent"
      aria-hidden={!visible}
    >
      <div
        className={`h-full bg-primary transition-all duration-300 ${
          visible ? "w-full opacity-70" : "w-0 opacity-0"
        }`}
      />
    </div>
  );
}

function SearchForm({
  onSubmit,
  query,
}: {
  onSubmit: (query: string) => void;
  query: string;
}) {
  const [inputValue, setInputValue] = useState(query);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(inputValue.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search
        size={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        name="q"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        placeholder="개념, 질문, 상황, 태그 검색"
        className="h-11 pl-10 pr-20"
      />
      <Button
        type="submit"
        className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2"
      >
        검색
      </Button>
    </form>
  );
}

export function DocumentSearchClient({
  initialDocuments,
  initialFilters,
}: {
  initialDocuments: DocumentSummary[];
  initialFilters: DocumentQueryFilters;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilters = readDocumentQueryFilters(searchParams);
  const hasAnyFilter = hasActiveDocumentQuery(currentFilters);
  const initialData = isInitialFilters(currentFilters, initialFilters)
    ? initialDocuments
    : undefined;
  const queryKey = useMemo(
    () => ["documents", documentQueryCacheKey(currentFilters)],
    [currentFilters],
  );
  const documentsQuery = useQuery({
    queryKey,
    queryFn: () => fetchDocuments(currentFilters),
    enabled: hasAnyFilter,
    initialData,
    placeholderData: keepPreviousData,
  });
  const documents = hasAnyFilter ? (documentsQuery.data ?? []) : [];
  const title = currentFilters.query
    ? `"${currentFilters.query}" 검색 결과`
    : "문서 검색";
  const navigate = (href: string) => router.push(href, { scroll: false });

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
            <CardDescription>
              {hasAnyFilter
                ? `${documents.length}개 문서`
                : "기술 용어, 면접 Q&A, 상황 시뮬레이션을 한 번에 검색합니다."}
            </CardDescription>
          </div>
          <DocumentFilterToolbar
            basePath="/search"
            category={currentFilters.interviewCategory}
            favoritesOnly={currentFilters.favoritesOnly}
            onNavigate={navigate}
            query={currentFilters.query}
            status={currentFilters.status}
          />
        </CardHeader>

        <CardContent>
          <SearchForm
            key={currentFilters.query}
            query={currentFilters.query}
            onSubmit={(query) =>
              navigate(
                searchHref({
                  ...currentFilters,
                  query,
                }),
              )
            }
          />
        </CardContent>
      </Card>

      <LoadingBar visible={documentsQuery.isFetching} />

      {!hasAnyFilter ? (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 text-center">
          <Search size={28} className="text-muted-foreground" aria-hidden />
          <h2 className="mt-3 text-base font-semibold">검색어를 입력하세요</h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            예: MSA, 트랜잭션, 브라우저 URL 입력, 피드백
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {searchSuggestions.map((query) => (
              <Button key={query} asChild variant="outline" size="sm">
                <Link href={searchHref({ ...currentFilters, query })}>
                  {query}
                </Link>
              </Button>
            ))}
          </div>
        </section>
      ) : documentsQuery.isError ? (
        <section
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive"
          role="alert"
        >
          검색 결과를 불러오지 못했습니다.
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-2 text-destructive hover:text-destructive"
            onClick={() => documentsQuery.refetch()}
          >
            다시 시도
          </Button>
        </section>
      ) : documentsQuery.isPending && !documents.length ? (
        <DocumentListSkeleton />
      ) : documents.length ? (
        <section className="grid gap-4">
          {documents.map((document) => (
            <DocumentListCard
              key={document.id}
              document={document}
              showContentType
            />
          ))}
        </section>
      ) : (
        <EmptyState canCreate={false} query={currentFilters.query || "filter"} />
      )}
    </div>
  );
}
