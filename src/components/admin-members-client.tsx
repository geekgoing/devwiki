"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  Search,
  Shield,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { AdminMember, MemberRole } from "@/types/devwiki";

type MemberAction = (formData: FormData) => void | Promise<void>;

type AdminMembersClientProps = {
  approveMemberAction: MemberAction;
  currentEmail: string;
  deleteMemberAction: MemberAction;
  members: AdminMember[];
  updateMemberAction: MemberAction;
};

const roles: Array<{
  label: string;
  value: MemberRole;
}> = [
  {
    value: "owner",
    label: "Owner",
  },
  {
    value: "editor",
    label: "Editor",
  },
  {
    value: "viewer",
    label: "Viewer",
  },
];

function roleLabel(role: MemberRole) {
  return roles.find((item) => item.value === role)?.label ?? role;
}

function roleBadgeClass(role: MemberRole) {
  if (role === "owner") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  if (role === "editor") {
    return "border-violet-200 bg-violet-50 text-violet-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="p-0">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </span>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MemberStatusBadge({ member }: { member: AdminMember }) {
  if (!member.isActive) {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-800"
      >
        승인 대기
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-teal-200 bg-teal-50 text-teal-700"
    >
      활성
    </Badge>
  );
}

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <Badge variant="outline" className={roleBadgeClass(role)}>
      <Shield size={12} aria-hidden />
      {roleLabel(role)}
    </Badge>
  );
}

function MemberEditDialog({
  member,
  updateMemberAction,
}: {
  member: AdminMember;
  updateMemberAction: MemberAction;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal aria-hidden />
          수정
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>멤버 정보 수정</DialogTitle>
          <DialogDescription>
            role과 승인 상태를 조정한 뒤 저장합니다.
          </DialogDescription>
        </DialogHeader>

        <form action={updateMemberAction} className="grid gap-5">
          <input type="hidden" name="email" value={member.email} />

          <div className="rounded-lg border bg-muted/35 px-3 py-3">
            <p className="text-sm font-medium">{member.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {member.displayName ?? "닉네임 없음"}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`role-${member.email}`}>Role</Label>
            <Select name="role" defaultValue={member.role}>
              <SelectTrigger
                id={`role-${member.email}`}
                className="h-10 w-full"
              >
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
            <p className="text-xs leading-5 text-muted-foreground">
              owner는 멤버와 문서를 관리하고, editor는 문서를 수정하며, viewer는
              읽기와 학습 기록만 사용할 수 있습니다.
            </p>
          </div>

          <Label className="flex items-start gap-3 rounded-lg border px-3 py-3">
            <Checkbox
              name="is_active"
              defaultChecked={member.isActive}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium">활성 멤버</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                비활성 상태에서는 로그인해도 멤버 전용 문서를 볼 수 없습니다.
              </span>
            </span>
          </Label>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                취소
              </Button>
            </DialogClose>
            <Button type="submit">저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberDeleteDialog({
  deleteMemberAction,
  disabled,
  member,
}: {
  deleteMemberAction: MemberAction;
  disabled: boolean;
  member: AdminMember;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={disabled}>
          <Trash2 aria-hidden />
          삭제
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>멤버 삭제</DialogTitle>
          <DialogDescription>
            멤버 권한과 Supabase Auth 계정을 함께 삭제합니다.
          </DialogDescription>
        </DialogHeader>

        <form action={deleteMemberAction} className="grid gap-5">
          <input type="hidden" name="email" value={member.email} />
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3">
            <p className="text-sm font-medium text-destructive">
              {member.email}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              삭제 후 다시 접근하려면 새 Auth 계정 생성과 owner 승인이 다시
              필요합니다.
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                취소
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive">
              삭제
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberActions({
  approveMemberAction,
  currentEmail,
  deleteMemberAction,
  member,
  updateMemberAction,
}: {
  approveMemberAction: MemberAction;
  currentEmail: string;
  deleteMemberAction: MemberAction;
  member: AdminMember;
  updateMemberAction: MemberAction;
}) {
  const isSelf = member.email.toLowerCase() === currentEmail.toLowerCase();

  return (
    <div className="flex justify-end gap-2">
      {!member.isActive ? (
        <form action={approveMemberAction}>
          <input type="hidden" name="email" value={member.email} />
          <Button type="submit" size="sm">
            <UserCheck aria-hidden />
            승인
          </Button>
        </form>
      ) : null}
      <MemberEditDialog member={member} updateMemberAction={updateMemberAction} />
      <MemberDeleteDialog
        deleteMemberAction={deleteMemberAction}
        disabled={isSelf}
        member={member}
      />
    </div>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

export function AdminMembersClient({
  approveMemberAction,
  currentEmail,
  deleteMemberAction,
  members,
  updateMemberAction,
}: AdminMembersClientProps) {
  const [emailQuery, setEmailQuery] = useState("");
  const activeCount = members.filter((member) => member.isActive).length;
  const pendingCount = members.length - activeCount;
  const ownerCount = members.filter(
    (member) => member.role === "owner" && member.isActive,
  ).length;
  const normalizedQuery = emailQuery.trim().toLowerCase();
  const filteredMembers = useMemo(() => {
    if (!normalizedQuery) {
      return members;
    }

    return members.filter((member) =>
      member.email.toLowerCase().includes(normalizedQuery),
    );
  }, [members, normalizedQuery]);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users size={18} aria-hidden />}
          label="전체 멤버"
          value={members.length}
        />
        <StatCard
          icon={<Clock3 size={18} aria-hidden />}
          label="승인 대기"
          value={pendingCount}
        />
        <StatCard
          icon={<CheckCircle2 size={18} aria-hidden />}
          label="활성 멤버"
          value={activeCount}
        />
        <StatCard
          icon={<Shield size={18} aria-hidden />}
          label="활성 owner"
          value={ownerCount}
        />
      </section>

      <Card className="p-0">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={emailQuery}
              onChange={(event) => setEmailQuery(event.target.value)}
              className="h-10 pl-9"
              placeholder="이메일 검색"
              aria-label="이메일 검색"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {filteredMembers.length}명 표시
          </p>
        </CardContent>
      </Card>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/45 hover:bg-muted/45">
              <TableHead className="min-w-72 px-4">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="min-w-44">최근 로그인일시</TableHead>
              <TableHead className="min-w-44">가입요청일시</TableHead>
              <TableHead className="min-w-48 pr-4 text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length ? (
              filteredMembers.map((member) => {
                const isSelf =
                  member.email.toLowerCase() === currentEmail.toLowerCase();

                return (
                  <TableRow
                    key={member.email}
                    className={!member.isActive ? "bg-amber-50/40" : undefined}
                  >
                    <TableCell className="px-4">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium">
                            {member.email}
                          </span>
                          {isSelf ? <Badge variant="secondary">나</Badge> : null}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <MemberStatusBadge member={member} />
                          {!member.authUserId ? (
                            <Badge variant="outline">Auth 계정 없음</Badge>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={member.role} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.lastSignInAt
                        ? formatDate(member.lastSignInAt)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </TableCell>
                    <TableCell className="pr-4">
                      <MemberActions
                        approveMemberAction={approveMemberAction}
                        currentEmail={currentEmail}
                        deleteMemberAction={deleteMemberAction}
                        member={member}
                        updateMemberAction={updateMemberAction}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <EmptyRow>
                {members.length ? "검색 결과가 없습니다." : "멤버가 없습니다."}
              </EmptyRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
