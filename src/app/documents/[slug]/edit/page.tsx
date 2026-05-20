import { notFound, redirect } from "next/navigation";

import { updateDocument } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { DocumentEditor } from "@/components/document-editor";
import { MemberGate } from "@/components/member-gate";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
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

  if (configured && !user) {
    redirect("/login");
  }

  if (configured && user && !member) {
    return (
      <>
        <AppHeader configured={configured} canCreate={false} user={user} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <MemberGate user={user} />
        </main>
      </>
    );
  }

  const document = await getDocumentBySlug(slug, {
    canReadPrivate: !configured || Boolean(member),
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
    <>
      <AppHeader
        configured={configured}
        canCreate={Boolean(member)}
        canManageMembers={member?.role === "owner"}
        user={user}
      />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="sr-only">문서 수정</h1>

        {!configured ? (
          <SetupNotice />
        ) : user && !member ? (
          <MemberGate user={user} />
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
              tags: document.tags.map((tag) => tag.name).join(", "),
              relatedDocumentIds,
            }}
          />
        )}
      </main>
    </>
  );
}
