import { LogOut } from "lucide-react";

import { signOut } from "@/app/actions";
import type { DevWikiUser } from "@/types/devwiki";

export function MemberGate({ user }: { user: DevWikiUser }) {
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50 px-5 py-6">
      <h1 className="text-xl font-semibold text-amber-950">
        멤버 등록이 필요합니다
      </h1>
      <p className="mt-2 text-sm leading-6 text-amber-900">
        현재 로그인한 계정 `{user.email}`은 `members`에 활성 멤버로
        등록되어 있지 않습니다. 관리자에게 이메일 등록을 요청한 뒤 다시
        시도하세요.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-950 transition hover:bg-amber-100"
        >
          <LogOut size={16} aria-hidden />
          로그아웃하고 다시 로그인
        </button>
      </form>
    </section>
  );
}
