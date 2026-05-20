import { notFound, redirect } from "next/navigation";

import { updateDocument } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { DocumentEditor } from "@/components/document-editor";
import { MemberGate } from "@/components/member-gate";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocumentBySlug } from "@/lib/documents";
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

  const document = await getDocumentBySlug(slug);

  if (!document) {
    notFound();
  }

  return (
    <>
      <AppHeader
        configured={configured}
        canCreate={Boolean(member)}
        canManageMembers={member?.role === "owner"}
        user={user}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            문서 수정
          </h1>
          <p className="mt-2 text-sm text-slate-500">{document.title}</p>
        </div>

        {!configured ? (
          <SetupNotice />
        ) : user && !member ? (
          <MemberGate user={user} />
        ) : (
          <DocumentEditor
            action={updateDocument}
            mode="edit"
            initialDocument={{
              id: document.id,
              title: document.title,
              slug: document.slug,
              summary: document.summary,
              bodyMarkdown: document.bodyMarkdown,
              status: document.status,
              tags: document.tags.map((tag) => tag.name).join(", "),
            }}
          />
        )}
      </main>
    </>
  );
}
