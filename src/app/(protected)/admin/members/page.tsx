import { ShieldAlert, Users } from "lucide-react";

import {
  approveMember,
  deleteMember,
  updateMember,
} from "@/app/admin/members/actions";
import { AdminMembersClient } from "@/components/admin-members-client";
import { SetupNotice } from "@/components/setup-notice";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getAdminMembers } from "@/lib/admin-members";
import { canManageMembers } from "@/lib/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type MembersAdminPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

function StatusMessage({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) {
    return null;
  }

  return (
    <p
      className={`rounded-lg border px-3 py-2 text-sm ${
        error
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-teal-200 bg-teal-50 text-teal-900"
      }`}
    >
      {error ?? notice}
    </p>
  );
}

export default async function MembersAdminPage({
  searchParams,
}: MembersAdminPageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const canManageMemberList = canManageMembers(member);
  const members = canManageMemberList ? await getAdminMembers() : [];

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        {!configured ? <SetupNotice /> : null}

        {!canManageMemberList || !user?.email ? (
          <Card className="border-amber-200 bg-amber-50 text-amber-950">
            <CardContent className="px-5 py-6">
              <div className="flex items-center gap-3">
                <ShieldAlert size={22} className="text-amber-700" aria-hidden />
                <h1 className="text-xl font-semibold">
                  owner 권한이 필요합니다
                </h1>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  멤버 관리
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  가입 요청, 권한, 최근 로그인 상태를 관리합니다.
                </p>
              </div>
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Users size={20} aria-hidden />
              </span>
            </section>

            <StatusMessage notice={params.notice} error={params.error} />

            <AdminMembersClient
              approveMemberAction={approveMember}
              currentEmail={user.email}
              deleteMemberAction={deleteMember}
              members={members}
              updateMemberAction={updateMember}
            />
          </>
        )}
      </div>
    </main>
  );
}
