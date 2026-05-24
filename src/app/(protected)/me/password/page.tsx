import { KeyRound, Save } from "lucide-react";

import { updateMyPassword } from "@/app/actions";
import { SetupNotice } from "@/components/setup-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  length: "새 비밀번호는 4자 이상이어야 합니다.",
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
              <form action={updateMyPassword} className="grid gap-4">
                <input type="hidden" name="next" value={next} />

                <div className="grid gap-1.5">
                  <Label htmlFor="current_password">현재 비밀번호</Label>
                  <Input
                    id="current_password"
                    name="current_password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="h-11"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="password">새 비밀번호</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={4}
                    maxLength={72}
                    autoComplete="new-password"
                    className="h-11"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="password_confirm">새 비밀번호 확인</Label>
                  <Input
                    id="password_confirm"
                    name="password_confirm"
                    type="password"
                    required
                    minLength={4}
                    maxLength={72}
                    autoComplete="new-password"
                    className="h-11"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="lg">
                    <Save size={16} aria-hidden />
                    변경
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
