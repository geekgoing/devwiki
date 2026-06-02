"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { DocumentDiscoveryBoard } from "@/components/document-discovery-board";
import { DocumentFilterToolbar } from "@/components/document-filter-toolbar";
import { DocumentListCard } from "@/components/document-list-card";
import { DocumentListSkeleton } from "@/components/document-list-skeleton";
import { DocumentSectionBoard } from "@/components/document-section-board";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { contentTypeLabels } from "@/lib/content-routes";
import {
  documentApiPath,
  documentQueryCacheKey,
  readDocumentQueryFilters,
  type DocumentQueryFilters,
} from "@/lib/document-query";
import type {
  DocumentContentType,
  DocumentSummary,
} from "@/types/devwiki";

async function fetchDocuments(filters: DocumentQueryFilters) {
  const response = await fetch(documentApiPath(filters), {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("문서 목록을 불러오지 못했습니다.");
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

function newDocumentHref(contentType: DocumentContentType, category?: string) {
  const params = new URLSearchParams({ type: contentType });

  if (category) {
    params.set("category", category);
  }

  return `/documents/new?${params.toString()}`;
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

export function DocumentCollectionClient({
  canCreate,
  contentType,
  initialDocuments,
  initialFilters,
  routePath,
}: {
  canCreate: boolean;
  contentType: DocumentContentType;
  initialDocuments: DocumentSummary[];
  initialFilters: DocumentQueryFilters;
  routePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilters = readDocumentQueryFilters(searchParams, contentType);
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
    initialData,
    placeholderData: keepPreviousData,
  });
  const documents = documentsQuery.data ?? [];
  const shouldShowDiscovery =
    contentType === "term" &&
    currentFilters.status === "active" &&
    !currentFilters.favoritesOnly &&
    !currentFilters.interviewCategory &&
    !currentFilters.query;
  const shouldShowSectionBoard =
    (contentType === "interview_qa" || contentType === "scenario") &&
    currentFilters.status === "active" &&
    !currentFilters.favoritesOnly &&
    !currentFilters.interviewCategory &&
    !currentFilters.query;
  const createHref = newDocumentHref(
    contentType,
    currentFilters.interviewCategory,
  );
  const showSkeleton = documentsQuery.isPending && !documents.length;
  const navigate = (href: string) => router.push(href, { scroll: false });

  return (
    <div className="grid gap-5">
      <section className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {contentTypeLabels[contentType]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {documents.length}개 문서
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DocumentFilterToolbar
            basePath={routePath}
            category={
              contentType === "interview_qa"
                ? currentFilters.interviewCategory
                : undefined
            }
            contentType={contentType}
            favoritesOnly={currentFilters.favoritesOnly}
            onNavigate={navigate}
            status={currentFilters.status}
          />
          {canCreate ? (
            <Button asChild size="lg">
              <Link href={createHref}>
                <Plus aria-hidden />
                새 문서
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <LoadingBar visible={documentsQuery.isFetching} />

      {documentsQuery.isError ? (
        <section
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive"
          role="alert"
        >
          문서 목록을 불러오지 못했습니다.
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
      ) : showSkeleton ? (
        <DocumentListSkeleton />
      ) : documents.length ? (
        shouldShowDiscovery ? (
          <DocumentDiscoveryBoard documents={documents} />
        ) : shouldShowSectionBoard ? (
          <DocumentSectionBoard
            contentType={contentType}
            documents={documents}
          />
        ) : (
          <section className="grid gap-4">
            {documents.map((document) => (
              <DocumentListCard key={document.id} document={document} />
            ))}
          </section>
        )
      ) : (
        <EmptyState canCreate={canCreate} createHref={createHref} />
      )}
    </div>
  );
}
