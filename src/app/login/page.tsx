import { Mail } from "lucide-react";
import { cookies } from "next/headers";

import { signInWithPassword } from "@/app/actions";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

const REMEMBER_EMAIL_COOKIE = "devwiki_remember_email";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const configured = isSupabaseConfigured();
  const rememberedEmail = cookieStore.get(REMEMBER_EMAIL_COOKIE)?.value ?? "";
  const next =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/";
  const errorMessage =
    params.error === "email"
      ? "이메일을 입력해주세요."
      : params.error === "password"
        ? "비밀번호를 입력해주세요."
        : params.error === "rate-limit"
          ? "로그인 요청이 잠시 제한되었습니다. 잠시 뒤 다시 시도해주세요."
          : params.error === "credentials"
            ? "이메일 또는 비밀번호를 확인해주세요."
            : params.error
              ? "로그인 처리 중 문제가 발생했습니다. 잠시 뒤 다시 시도해주세요."
              : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="space-y-5">
          {!configured ? <SetupNotice /> : null}

          <section className="rounded-md border border-slate-200 bg-white p-6">
            <div className="flex size-11 items-center justify-center rounded-md bg-slate-950 text-white">
              <Mail size={20} aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-semibold text-slate-950">
              이메일과 비밀번호로 로그인
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              등록된 멤버 계정으로 DevWiki에 로그인합니다.
            </p>

            {errorMessage ? (
              <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {errorMessage}
              </p>
            ) : null}

            <form action={signInWithPassword} className="mt-5 space-y-4">
              <input type="hidden" name="next" value={next} />
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  이메일
                </span>
                <input
                  type="email"
                  name="email"
                  defaultValue={rememberedEmail}
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  비밀번호
                </span>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="remember_email"
                  defaultChecked={Boolean(rememberedEmail)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                이메일 기억
              </label>
              <button
                type="submit"
                disabled={!configured}
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                로그인
              </button>
            </form>
          </section>
        </div>
    </main>
  );
}
