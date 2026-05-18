import Link from "next/link";

import type { DevWikiUser } from "@/types/devwiki";

export function MemberGate({ user }: { user: DevWikiUser }) {
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50 px-5 py-6">
      <h1 className="text-xl font-semibold text-amber-950">
        스터디 멤버 등록이 필요합니다
      </h1>
      <p className="mt-2 text-sm leading-6 text-amber-900">
        현재 로그인한 계정 `{user.email}`은 `study_members`에 활성 멤버로
        등록되어 있지 않습니다. Supabase SQL Editor에서 이메일을 등록한 뒤
        다시 시도하세요.
      </p>
      <Link
        href="/login"
        className="mt-4 inline-flex h-9 items-center rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-950 transition hover:bg-amber-100"
      >
        다른 이메일로 로그인
      </Link>
    </section>
  );
}
