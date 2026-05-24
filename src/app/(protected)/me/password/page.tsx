import { KeyRound } from "lucide-react";

import { updateMyPassword } from "@/app/actions";
import { PasswordChangeForm } from "@/components/password-change-form";
import { SetupNotice } from "@/components/setup-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type PasswordPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  current: "현재 비밀번호를 확인해주세요.",
  invalid: "비밀번호 입력값을 확인해주세요.",
  length: "새 비밀번호는 6자 이상이어야 합니다.",
  mismatch: "새 비밀번호 확인이 일치하지 않습니다.",
  session: "로그인 세션을 확인하지 못했습니다. 다시 로그인해주세요.",
  unchanged: "새 비밀번호는 현재 비밀번호와 달라야 합니다.",
  update: "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.",
};

function safeNext(value?: string) {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/me";
  }

  return value.startsWith("/me/password") ? "/me" : value;
}

export default async function PasswordPage({ searchParams }: PasswordPageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const next = safeNext(params.next);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        {!configured ? <SetupNotice /> : null}

        <section>
          <h1 className="text-3xl font-semibold tracking-tight">
            비밀번호 변경
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            계정 보안을 위해 현재 비밀번호를 확인한 뒤 새 비밀번호로
            변경합니다.
          </p>
        </section>

        {params.error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {errorMessages[params.error] ?? errorMessages.update}
          </p>
        ) : null}

        {member && user ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <KeyRound size={18} className="text-primary" aria-hidden />
                로그인 비밀번호
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PasswordChangeForm
                next={next}
                updatePasswordAction={updateMyPassword}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
