import { Mail } from "lucide-react";
import { cookies } from "next/headers";

import { signInWithPassword } from "@/app/actions";
import { SetupNotice } from "@/components/setup-notice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

        <Card className="p-2">
          <CardHeader>
            <span className="mb-3 flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Mail size={20} aria-hidden />
            </span>
            <CardTitle className="text-2xl tracking-tight">
              이메일과 비밀번호로 로그인
            </CardTitle>
            <CardDescription className="leading-6">
              등록된 멤버 계정으로 DevWiki에 로그인합니다.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {errorMessage ? (
              <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}

            <form action={signInWithPassword} className="space-y-4">
              <input type="hidden" name="next" value={next} />
              <div className="grid gap-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  defaultValue={rememberedEmail}
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  className="h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>
              <Label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  name="remember_email"
                  defaultChecked={Boolean(rememberedEmail)}
                  className="size-4 rounded border-input accent-primary"
                />
                이메일 기억
              </Label>
              <Button
                type="submit"
                disabled={!configured}
                className="h-11 w-full"
              >
                로그인
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
