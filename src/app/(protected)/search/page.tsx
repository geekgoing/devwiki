import { DocumentSearchClient } from "@/components/document-search-client";
import { SetupNotice } from "@/components/setup-notice";
import {
  parseFavoritesFilter,
  parseInterviewCategory,
  parseStatusFilter,
} from "@/lib/content-routes";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocuments } from "@/lib/documents";
import { hasActiveDocumentQuery } from "@/lib/document-query";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type SearchPageProps = {
  searchParams: Promise<{
    category?: string;
    favorites?: string;
    q?: string;
    status?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const initialFilters = {
    favoritesOnly: parseFavoritesFilter(params.favorites),
    interviewCategory: parseInterviewCategory(params.category),
    query: params.q?.trim() ?? "",
    status: parseStatusFilter(params.status),
  };
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const canReadPrivate = !configured || Boolean(member);
  const documents = hasActiveDocumentQuery(initialFilters)
    ? await getDocuments({
        favoritesOnly: initialFilters.favoritesOnly,
        interviewCategory: initialFilters.interviewCategory,
        query: initialFilters.query,
        status: initialFilters.status,
        canReadPrivate,
        viewerId: user?.id,
      })
    : [];

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-5">
        {!configured ? <SetupNotice /> : null}
        <DocumentSearchClient
          initialDocuments={documents}
          initialFilters={initialFilters}
        />
      </div>
    </main>
  );
}
