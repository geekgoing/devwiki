import { createDocument } from "@/app/actions";
import { DocumentEditor } from "@/components/document-editor";
import { SetupNotice } from "@/components/setup-notice";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentMember } from "@/lib/auth";
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

export default async function NewDocumentPage({
  searchParams,
}: NewDocumentPageProps) {
  const params = await searchParams;
  const contentType = parseContentType(params.type);
  const interviewCategory = parseInterviewCategory(params.category);
  const configured = isSupabaseConfigured();
  const member = await getCurrentMember();
  const canEdit = !configured || canEditContent(member);
  const linkableDocuments = canEdit
    ? await getDocuments({
        canReadPrivate: canEdit,
        status: "active",
      })
    : [];

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="sr-only">새 문서 작성</h1>

      {!configured ? (
        <SetupNotice />
      ) : !canEdit ? (
        <Card className="border-amber-200 bg-amber-50 text-amber-950">
          <CardContent className="px-5 py-6">
            <h1 className="text-xl font-semibold">editor 권한이 필요합니다</h1>
            <p className="mt-2 text-sm leading-6">
              viewer는 문서를 읽고 댓글을 남길 수 있지만 새 문서 작성은 할 수
              없습니다.
            </p>
          </CardContent>
        </Card>
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
