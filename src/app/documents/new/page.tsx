import { redirect } from "next/navigation";

import { createDocument } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { DocumentEditor } from "@/components/document-editor";
import { MemberGate } from "@/components/member-gate";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocuments } from "@/lib/documents";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function NewDocumentPage() {
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const canEdit = !configured || Boolean(member);
  const linkableDocuments = canEdit
    ? await getDocuments({
        canReadPrivate: canEdit,
        status: "active",
      })
    : [];

  if (configured && !user) {
    redirect("/login");
  }

  return (
    <>
      <AppHeader
        configured={configured}
        canCreate={Boolean(member)}
        canManageMembers={member?.role === "owner"}
        user={user}
      />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="sr-only">새 문서 작성</h1>

        {!configured ? (
          <SetupNotice />
        ) : user && !member ? (
          <MemberGate user={user} />
        ) : (
          <DocumentEditor
            action={createDocument}
            linkableDocuments={linkableDocuments}
            mode="create"
          />
        )}
      </main>
    </>
  );
}
