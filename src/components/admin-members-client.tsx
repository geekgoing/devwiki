"use client";

import type { ReactNode } from "react";
import {
  CheckCircle2,
  Clock3,
  Mail,
  MoreHorizontal,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function getInitial(member: AdminMember) {
  return (member.displayName ?? member.email).trim().charAt(0).toUpperCase();
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
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
        <Clock3 size={12} aria-hidden />
        승인 대기
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">
      <CheckCircle2 size={12} aria-hidden />
      활성
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
              <SelectTrigger id={`role-${member.email}`} className="h-10 w-full">
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
            멤버 목록에서 제거합니다. Auth 계정은 삭제하지 않지만, 멤버 권한은
            즉시 사라집니다.
          </DialogDescription>
        </DialogHeader>

        <form action={deleteMemberAction} className="grid gap-5">
          <input type="hidden" name="email" value={member.email} />
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3">
            <p className="text-sm font-medium text-destructive">
              {member.email}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              삭제 후 다시 접근하려면 회원가입과 owner 승인이 다시 필요합니다.
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

function MemberCard({
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
  const isPending = !member.isActive;

  return (
    <Card className={isPending ? "p-0 ring-1 ring-amber-200" : "p-0"}>
      <CardContent className="grid gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              {getInitial(member)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold">
                  {member.displayName ?? "닉네임 없음"}
                </h2>
                {isSelf ? <Badge variant="secondary">나</Badge> : null}
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail size={14} aria-hidden />
                <span className="truncate">{member.email}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <MemberStatusBadge member={member} />
            <Badge variant="secondary">
              <Shield size={12} aria-hidden />
              {roleLabel(member.role)}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-muted/45 px-3 py-2">
            <span className="text-xs text-muted-foreground">가입 요청</span>
            <strong className="mt-1 block font-medium">
              {formatDate(member.createdAt)}
            </strong>
          </div>
          <div className="rounded-lg bg-muted/45 px-3 py-2">
            <span className="text-xs text-muted-foreground">이메일 확인</span>
            <strong className="mt-1 block font-medium">
              {member.authConfirmedAt ? formatDate(member.authConfirmedAt) : "-"}
            </strong>
          </div>
          <div className="rounded-lg bg-muted/45 px-3 py-2">
            <span className="text-xs text-muted-foreground">최근 로그인</span>
            <strong className="mt-1 block font-medium">
              {member.lastSignInAt ? formatDate(member.lastSignInAt) : "-"}
            </strong>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="text-xs text-muted-foreground">
            Auth {member.authUserId ? "연결됨" : "계정 없음"}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {isPending ? (
              <form action={approveMemberAction}>
                <input type="hidden" name="email" value={member.email} />
                <Button type="submit" size="sm">
                  <UserCheck aria-hidden />
                  승인
                </Button>
              </form>
            ) : null}
            <MemberEditDialog
              member={member}
              updateMemberAction={updateMemberAction}
            />
            <MemberDeleteDialog
              deleteMemberAction={deleteMemberAction}
              disabled={isSelf}
              member={member}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminMembersClient({
  approveMemberAction,
  currentEmail,
  deleteMemberAction,
  members,
  updateMemberAction,
}: AdminMembersClientProps) {
  const activeCount = members.filter((member) => member.isActive).length;
  const pendingCount = members.length - activeCount;
  const ownerCount = members.filter(
    (member) => member.role === "owner" && member.isActive,
  ).length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-3">
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
          icon={<Shield size={18} aria-hidden />}
          label="활성 owner"
          value={ownerCount}
        />
      </section>

      <section className="grid gap-3">
        {members.map((member) => (
          <MemberCard
            key={member.email}
            approveMemberAction={approveMemberAction}
            currentEmail={currentEmail}
            deleteMemberAction={deleteMemberAction}
            member={member}
            updateMemberAction={updateMemberAction}
          />
        ))}
      </section>
    </div>
  );
}
