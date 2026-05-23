import { ShieldAlert, Users } from "lucide-react";

import { createMember, updateMember } from "@/app/admin/members/actions";
import { SetupNotice } from "@/components/setup-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrentMember } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getAdminMembers } from "@/lib/admin-members";
import { canManageMembers } from "@/lib/permissions";
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
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger className="h-10 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            {role.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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

function MemberRow({ member }: { member: AdminMember }) {
  return (
    <form
      action={updateMember}
      className="grid gap-3 border-b px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1.2fr)_minmax(150px,0.8fr)_130px_100px_minmax(150px,0.8fr)_minmax(150px,0.8fr)_90px]"
    >
      <input type="hidden" name="email" value={member.email} />

      <div>
        <p className="text-sm font-medium">{member.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Auth {member.authUserId ? "연결됨" : "없음"}
        </p>
      </div>

      <div className="text-sm">
        <p className="font-medium">{member.displayName ?? "닉네임 없음"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          마이페이지에서 수정
        </p>
      </div>

      <RoleSelect name="role" defaultValue={member.role} />

      <Label className="inline-flex h-10 items-center gap-2">
        <Checkbox name="is_active" defaultChecked={member.isActive} />
        활성
      </Label>

      <div className="text-xs leading-5 text-muted-foreground">
        <p>생성 {formatDate(member.createdAt)}</p>
      </div>

      <div className="text-xs leading-5 text-muted-foreground">
        <p>
          확인{" "}
          {member.authConfirmedAt ? formatDate(member.authConfirmedAt) : "-"}
        </p>
        <p>
          로그인 {member.lastSignInAt ? formatDate(member.lastSignInAt) : "-"}
        </p>
      </div>

      <Button type="submit" variant="outline">
        저장
      </Button>
    </form>
  );
}

export default async function MembersAdminPage({
  searchParams,
}: MembersAdminPageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const member = await getCurrentMember();

  const canManageMemberList = canManageMembers(member);
  const members = canManageMemberList ? await getAdminMembers() : [];

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        {!configured ? <SetupNotice /> : null}

        {!canManageMemberList ? (
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
                  <Badge variant="secondary">{members.length}명</Badge>
                </p>
              </div>
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Users size={20} aria-hidden />
              </span>
            </section>

            <StatusMessage notice={params.notice} error={params.error} />

            <Card>
              <CardHeader>
                <CardTitle>멤버 추가</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action={createMember}
                  className="grid gap-3 lg:grid-cols-[minmax(220px,1.2fr)_130px_minmax(160px,0.8fr)_90px]"
                >
                  <Label>
                    <span className="sr-only">이메일</span>
                    <Input
                      type="email"
                      name="email"
                      required
                      placeholder="member@example.com"
                      className="h-10"
                    />
                  </Label>
                  <RoleSelect name="role" />
                  <Label>
                    <span className="sr-only">임시 비밀번호</span>
                    <Input
                      type="password"
                      name="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="임시 비밀번호"
                      className="h-10"
                    />
                  </Label>
                  <Button type="submit" className="h-10">
                    추가
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="p-0">
              <div className="hidden border-b bg-muted/45 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(220px,1.2fr)_minmax(150px,0.8fr)_130px_100px_minmax(150px,0.8fr)_minmax(150px,0.8fr)_90px]">
                <span>이메일</span>
                <span>닉네임</span>
                <span>role</span>
                <span>상태</span>
                <span>멤버</span>
                <span>Auth</span>
                <span>저장</span>
              </div>
              {members.map((adminMember) => (
                <MemberRow key={adminMember.email} member={adminMember} />
              ))}
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
