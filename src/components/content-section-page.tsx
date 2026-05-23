import { DocumentCollectionClient } from "@/components/document-collection-client";
import { SetupNotice } from "@/components/setup-notice";
import {
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

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-5">
        {!configured ? <SetupNotice /> : null}
        <DocumentCollectionClient
          canCreate={canCreate}
          contentType={contentType}
          initialDocuments={documents}
          initialFilters={{
            contentType,
            interviewCategory:
              contentType === "interview_qa" ? interviewCategory : undefined,
            learning,
            query: "",
            status,
          }}
          routePath={routePath}
        />
      </div>
    </main>
  );
}
