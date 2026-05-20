import { ShieldAlert, Users } from "lucide-react";
import { redirect } from "next/navigation";

import { createMember, updateMember } from "@/app/admin/members/actions";
import { AppHeader } from "@/components/app-header";
import { MemberGate } from "@/components/member-gate";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getAdminMembers } from "@/lib/admin-members";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AdminMember, MemberRole } from "@/types/devwiki";

type MembersAdminPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

const roles: Array<{ value: MemberRole; label: string }> = [
  { value: "owner", label: "owner" },
  { value: "editor", label: "editor" },
  { value: "viewer", label: "viewer" },
];

function RoleSelect({
  name,
  defaultValue = "editor",
}: {
  name: string;
  defaultValue?: MemberRole;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
    >
      {roles.map((role) => (
        <option key={role.value} value={role.value}>
          {role.label}
        </option>
      ))}
    </select>
  );
}

function StatusMessage({
  notice,
  error,
}: {
  notice?: string;
  error?: string;
}) {
  if (!notice && !error) {
    return null;
  }

  return (
    <p
      className={`rounded-md border px-3 py-2 text-sm ${
        error
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      {error ?? notice}
    </p>
  );
}

function MemberRow({ member }: { member: AdminMember }) {
  return (
    <form
      action={updateMember}
      className="grid gap-3 border-b border-slate-200 px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1.2fr)_minmax(160px,0.8fr)_130px_100px_minmax(150px,0.8fr)_minmax(150px,0.8fr)_90px]"
    >
      <input type="hidden" name="email" value={member.email} />

      <div>
        <p className="text-sm font-medium text-slate-950">{member.email}</p>
        <p className="mt-1 text-xs text-slate-500">
          Auth {member.authUserId ? "연결됨" : "없음"}
        </p>
      </div>

      <label>
        <span className="sr-only">표시 이름</span>
        <input
          name="display_name"
          defaultValue={member.displayName ?? ""}
          placeholder="표시 이름"
          className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
      </label>

      <RoleSelect name="role" defaultValue={member.role} />

      <label className="inline-flex h-10 items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={member.isActive}
          className="size-4 rounded border-slate-300"
        />
        활성
      </label>

      <div className="text-xs leading-5 text-slate-500">
        <p>생성 {formatDate(member.createdAt)}</p>
      </div>

      <div className="text-xs leading-5 text-slate-500">
        <p>
          확인{" "}
          {member.authConfirmedAt ? formatDate(member.authConfirmedAt) : "-"}
        </p>
        <p>
          로그인 {member.lastSignInAt ? formatDate(member.lastSignInAt) : "-"}
        </p>
      </div>

      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        저장
      </button>
    </form>
  );
}

export default async function MembersAdminPage({
  searchParams,
}: MembersAdminPageProps) {
  const params = await searchParams;
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

  const canManageMembers = member?.role === "owner";
  const members = canManageMembers ? await getAdminMembers() : [];

  return (
    <>
      <AppHeader
        configured={configured}
        canCreate={Boolean(member)}
        canManageMembers={canManageMembers}
        user={user}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6">
          {!configured ? <SetupNotice /> : null}

          {!canManageMembers ? (
            <section className="rounded-md border border-amber-200 bg-amber-50 px-5 py-6">
              <div className="flex items-center gap-3">
                <ShieldAlert size={22} className="text-amber-700" aria-hidden />
                <h1 className="text-xl font-semibold text-amber-950">
                  owner 권한이 필요합니다
                </h1>
              </div>
            </section>
          ) : (
            <>
              <section className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                    멤버 관리
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    {members.length}명
                  </p>
                </div>
                <span className="inline-flex size-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                  <Users size={20} aria-hidden />
                </span>
              </section>

              <StatusMessage notice={params.notice} error={params.error} />

              <section className="rounded-md border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-950">멤버 추가</h2>
                <form
                  action={createMember}
                  className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1.2fr)_minmax(160px,0.8fr)_130px_minmax(160px,0.8fr)_90px]"
                >
                  <label>
                    <span className="sr-only">이메일</span>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="member@example.com"
                      className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>
                  <label>
                    <span className="sr-only">표시 이름</span>
                    <input
                      name="display_name"
                      placeholder="표시 이름"
                      className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>
                  <RoleSelect name="role" />
                  <label>
                    <span className="sr-only">임시 비밀번호</span>
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="임시 비밀번호"
                      className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    추가
                  </button>
                </form>
              </section>

              <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
                <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 lg:grid lg:grid-cols-[minmax(220px,1.2fr)_minmax(160px,0.8fr)_130px_100px_minmax(150px,0.8fr)_minmax(150px,0.8fr)_90px]">
                  <span>이메일</span>
                  <span>이름</span>
                  <span>role</span>
                  <span>상태</span>
                  <span>멤버</span>
                  <span>Auth</span>
                  <span>저장</span>
                </div>
                {members.map((adminMember) => (
                  <MemberRow key={adminMember.email} member={adminMember} />
                ))}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
