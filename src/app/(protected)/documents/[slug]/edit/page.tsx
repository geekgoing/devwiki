import { notFound } from "next/navigation";

import { updateDocument } from "@/app/actions";
import { DocumentEditor } from "@/components/document-editor";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { canEditContent } from "@/lib/permissions";
import {
  getDocumentBySlug,
  getDocuments,
  getRelatedDocumentIds,
} from "@/lib/documents";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type EditDocumentPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function EditDocumentPage({
  params,
}: EditDocumentPageProps) {
  const { slug: encodedSlug } = await params;
  const slug = decodeURIComponent(encodedSlug);
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const canEdit = !configured || canEditContent(member);

  const document = await getDocumentBySlug(slug, {
    canReadPrivate: !configured || Boolean(member),
    viewerId: user?.id,
  });

  if (!document) {
    notFound();
  }

  const [linkableDocuments, relatedDocumentIds] = await Promise.all([
    getDocuments({
      canReadPrivate: !configured || Boolean(member),
      status: "active",
    }),
    getRelatedDocumentIds(document.id, {
      canReadPrivate: !configured || Boolean(member),
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="sr-only">문서 수정</h1>

        {!configured ? (
          <SetupNotice />
        ) : !canEdit ? (
          <section className="rounded-md border border-amber-200 bg-amber-50 px-5 py-6">
            <h1 className="text-xl font-semibold text-amber-950">
              editor 권한이 필요합니다
            </h1>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              viewer는 문서를 읽고 토론할 수 있지만 문서 수정은 할 수 없습니다.
            </p>
          </section>
        ) : (
          <DocumentEditor
            action={updateDocument}
            linkableDocuments={linkableDocuments}
            mode="edit"
            initialDocument={{
              id: document.id,
              title: document.title,
              slug: document.slug,
              summary: document.summary,
              bodyMarkdown: document.bodyMarkdown,
              status: document.status,
              contentType: document.contentType,
              interviewCategory: document.interviewCategory ?? undefined,
              tags: document.tags.map((tag) => tag.name).join(", "),
              relatedDocumentIds,
            }}
          />
        )}
    </main>
  );
}
