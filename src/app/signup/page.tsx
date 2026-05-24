import { UserPlus } from "lucide-react";
import Link from "next/link";

import { signUpWithPassword } from "@/app/actions";
import { SetupNotice } from "@/components/setup-notice";
import { SignUpForm } from "@/components/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type SignUpPageProps = {
  searchParams: Promise<{
    error?: string;
    notice?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "already-approved": "이미 승인된 멤버입니다. 로그인해주세요.",
  auth: "가입을 처리하지 못했습니다. 이메일 또는 비밀번호를 확인해주세요.",
  disabled: "Supabase Auth에서 새 회원가입이 비활성화되어 있습니다.",
  email: "올바른 이메일을 입력해주세요.",
  invalid: "가입 정보를 확인해주세요.",
  member: "계정은 생성됐지만 회원 정보를 남기지 못했습니다. 다시 시도해주세요.",
  mismatch: "비밀번호 확인이 일치하지 않습니다.",
  password: "비밀번호는 4자 이상이어야 합니다.",
  "rate-limit": "회원가입 요청이 잠시 제한되었습니다. 잠시 뒤 다시 시도해주세요.",
  server: "회원가입 상태를 확인하지 못했습니다. 잠시 뒤 다시 시도해주세요.",
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <div className="space-y-5">
        {!configured ? <SetupNotice /> : null}

        <Card className="p-2">
          <CardHeader>
            <span className="mb-3 flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <UserPlus size={20} aria-hidden />
            </span>
            <CardTitle className="text-2xl tracking-tight">
              DevWiki 회원가입
            </CardTitle>
            <CardDescription className="leading-6">
              회원가입 후 owner 승인이 완료되면 문서에 접근할 수 있습니다.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {params.notice === "pending" ? (
              <p className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
                회원가입이 완료되었습니다. owner 승인 후 로그인해주세요.
              </p>
            ) : null}

            {params.error ? (
              <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessages[params.error] ?? errorMessages.invalid}
              </p>
            ) : null}

            <SignUpForm
              disabled={!configured}
              signUpAction={signUpWithPassword}
            />

            <p className="mt-4 text-center text-sm text-muted-foreground">
              이미 계정이 있다면{" "}
              <Link href="/login" className="font-medium text-primary">
                로그인
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
