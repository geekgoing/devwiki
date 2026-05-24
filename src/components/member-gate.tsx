import { LogOut } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DevWikiUser, Member } from "@/types/devwiki";

export function MemberGate({
  member,
  user,
}: {
  member?: Member | null;
  user: DevWikiUser;
}) {
  const isPending = member && !member.isActive;

  return (
    <Card className="border-amber-200 bg-amber-50 px-5 py-6 text-amber-950 shadow-none">
      <h1 className="text-xl font-semibold tracking-tight">
        {isPending ? "승인 대기 중입니다" : "회원가입이 필요합니다"}
      </h1>
      <p className="mt-2 text-sm leading-6">
        {isPending
          ? `현재 로그인한 계정 ${user.email}의 회원가입은 완료됐지만 아직 owner 승인이 완료되지 않았습니다.`
          : `현재 로그인한 계정 ${user.email}은 승인 대기 목록에 없습니다. 회원가입을 먼저 진행해주세요.`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {!isPending ? (
          <Button asChild variant="outline" className="bg-background">
            <Link href="/signup">회원가입</Link>
          </Button>
        ) : null}
        <form action={signOut}>
          <Button type="submit" variant="outline" className="bg-background">
            <LogOut aria-hidden />
            로그아웃
          </Button>
        </form>
      </div>
    </Card>
  );
}
