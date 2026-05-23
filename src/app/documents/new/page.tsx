import { redirect } from "next/navigation";

import { createDocument } from "@/app/actions";
import { DocumentEditor } from "@/components/document-editor";
import { MemberGate } from "@/components/member-gate";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocuments } from "@/lib/documents";
import { canEditContent } from "@/lib/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DocumentContentType, InterviewCategory } from "@/types/devwiki";

type NewDocumentPageProps = {
  searchParams: Promise<{
    category?: string;
    type?: string;
  }>;
};

function parseContentType(value?: string): DocumentContentType {
  return value === "interview_qa" || value === "scenario" ? value : "term";
}

function parseInterviewCategory(value?: string): InterviewCategory | undefined {
  return value === "technical" || value === "behavioral" ? value : undefined;
}

function loginHref(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}

export default async function NewDocumentPage({
  searchParams,
}: NewDocumentPageProps) {
  const params = await searchParams;
  const contentType = parseContentType(params.type);
  const interviewCategory = parseInterviewCategory(params.category);
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const canEdit = !configured || canEditContent(member);
  const linkableDocuments = canEdit
    ? await getDocuments({
        canReadPrivate: canEdit,
        status: "active",
      })
    : [];

  if (configured && !user) {
    redirect(loginHref("/documents/new"));
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="sr-only">새 문서 작성</h1>

        {!configured ? (
          <SetupNotice />
        ) : user && !member ? (
          <MemberGate user={user} />
        ) : !canEdit ? (
          <section className="rounded-md border border-amber-200 bg-amber-50 px-5 py-6">
            <h1 className="text-xl font-semibold text-amber-950">
              editor 권한이 필요합니다
            </h1>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              viewer는 문서를 읽고 토론할 수 있지만 새 문서 작성은 할 수 없습니다.
            </p>
          </section>
        ) : (
          <DocumentEditor
            action={createDocument}
            linkableDocuments={linkableDocuments}
            mode="create"
            initialDocument={{
              contentType,
              interviewCategory:
                contentType === "interview_qa" ? interviewCategory : undefined,
            }}
          />
        )}
    </main>
  );
}
