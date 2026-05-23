import { Plus } from "lucide-react";
import Link from "next/link";

import { DocumentDiscoveryBoard } from "@/components/document-discovery-board";
import { DocumentFilterToolbar } from "@/components/document-filter-toolbar";
import { DocumentListCard } from "@/components/document-list-card";
import { EmptyState } from "@/components/empty-state";
import { SetupNotice } from "@/components/setup-notice";
import {
  contentTypeLabels,
  parseInterviewCategory,
  parseLearningFilter,
  parseStatusFilter,
} from "@/lib/content-routes";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocuments } from "@/lib/documents";
import { canEditContent } from "@/lib/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DocumentContentType } from "@/types/devwiki";

type SectionSearchParams = Promise<{
  category?: string;
  learning?: string;
  status?: string;
}>;

function newDocumentHref(contentType: DocumentContentType, category?: string) {
  const params = new URLSearchParams({ type: contentType });

  if (category) {
    params.set("category", category);
  }

  return `/documents/new?${params.toString()}`;
}

export async function ContentSectionPage({
  contentType,
  routePath,
  searchParams,
}: {
  contentType: DocumentContentType;
  routePath: string;
  searchParams: SectionSearchParams;
}) {
  const params = await searchParams;
  const interviewCategory = parseInterviewCategory(params.category);
  const learning = parseLearningFilter(params.learning);
  const status = parseStatusFilter(params.status);
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();

  const canReadPrivate = !configured || Boolean(member);
  const canCreate = canEditContent(member);
  const documents = await getDocuments({
    contentType,
    interviewCategory:
      contentType === "interview_qa" ? interviewCategory : undefined,
    learning,
    status,
    canReadPrivate,
    viewerId: user?.id,
  });
  const shouldShowDiscovery =
    contentType === "term" &&
    status === "active" &&
    learning === "all" &&
    !interviewCategory;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-5">
          {!configured ? <SetupNotice /> : null}

          <section className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                {contentTypeLabels[contentType]}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {documents.length}개 문서
              </p>
            </div>

            <div className="flex items-center gap-2">
              <DocumentFilterToolbar
                basePath={routePath}
                category={
                  contentType === "interview_qa" ? interviewCategory : undefined
                }
                contentType={contentType}
                learning={learning}
                status={status}
              />
              {canCreate ? (
                <Link
                  href={newDocumentHref(contentType, interviewCategory)}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  <Plus size={16} aria-hidden />
                  새 문서
                </Link>
              ) : null}
            </div>
          </section>

          {documents.length ? (
            shouldShowDiscovery ? (
              <DocumentDiscoveryBoard documents={documents} />
            ) : (
              <section className="grid gap-4">
                {documents.map((document) => (
                  <DocumentListCard key={document.id} document={document} />
                ))}
              </section>
            )
          ) : (
            <EmptyState
              canCreate={canCreate}
              createHref={newDocumentHref(contentType, interviewCategory)}
            />
          )}
        </div>
    </main>
  );
}
