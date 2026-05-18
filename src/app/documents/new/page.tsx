import { redirect } from "next/navigation";

import { createDocument } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { DocumentEditor } from "@/components/document-editor";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function NewDocumentPage() {
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();

  if (configured && !user) {
    redirect("/login");
  }

  return (
    <>
      <AppHeader configured={configured} user={user} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            새 문서 작성
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            면접 답변과 깊게 이해하기를 함께 담을 수 있도록 Markdown으로
            작성합니다.
          </p>
        </div>

        {!configured ? <SetupNotice /> : <DocumentEditor action={createDocument} mode="create" />}
      </main>
    </>
  );
}
