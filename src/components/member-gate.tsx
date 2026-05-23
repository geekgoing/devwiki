import { LogOut } from "lucide-react";

import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DevWikiUser } from "@/types/devwiki";

export function MemberGate({ user }: { user: DevWikiUser }) {
  return (
    <Card className="border-amber-200 bg-amber-50 px-5 py-6 text-amber-950 shadow-none">
      <h1 className="text-xl font-semibold tracking-tight">
        멤버 등록이 필요합니다
      </h1>
      <p className="mt-2 text-sm leading-6">
        현재 로그인한 계정 `{user.email}`은 `members`에 활성 멤버로 등록되어
        있지 않습니다. 관리자에게 이메일 등록을 요청한 뒤 다시 시도하세요.
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline" className="mt-4 bg-background">
          <LogOut aria-hidden />
          로그아웃하고 다시 로그인
        </Button>
      </form>
    </Card>
  );
}
