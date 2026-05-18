import { Mail } from "lucide-react";
import Link from "next/link";

import { signInWithEmail } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type LoginPageProps = {
  searchParams: Promise<{
    sent?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const errorMessage =
    params.error === "email"
      ? "이메일을 입력해주세요."
      : params.error === "callback"
        ? "로그인 링크를 확인하지 못했습니다. 새 링크를 다시 요청해주세요."
        : params.error
          ? "로그인 처리 중 문제가 발생했습니다. 잠시 뒤 다시 시도해주세요."
          : null;

  return (
    <>
      <AppHeader configured={configured} canCreate={Boolean(member)} user={user} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="space-y-5">
          {!configured ? <SetupNotice /> : null}

          <section className="rounded-md border border-slate-200 bg-white p-6">
            <div className="flex size-11 items-center justify-center rounded-md bg-slate-950 text-white">
              <Mail size={20} aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-semibold text-slate-950">
              이메일로 로그인
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              등록된 스터디원 이메일로 로그인 링크를 받습니다.
            </p>

            {params.sent ? (
              <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                로그인 링크를 보냈습니다. 메일함에서 DevWiki 링크를 열어주세요.
              </p>
            ) : null}

            {errorMessage ? (
              <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {errorMessage}
              </p>
            ) : null}

            <form action={signInWithEmail} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  이메일
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="name@example.com"
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <button
                type="submit"
                disabled={!configured}
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                로그인 링크 받기
              </button>
            </form>

            <Link
              href="/"
              className="mt-4 inline-flex text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              문서 목록으로 돌아가기
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
