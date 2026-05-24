"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PASSWORD_LENGTH = 4;

const signupClientSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("올바른 이메일을 입력해주세요."),
    password: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
      )
      .max(72, "비밀번호는 72자 이하로 입력해주세요."),
    passwordConfirm: z.string().min(1, "비밀번호 확인을 입력해주세요."),
  })
  .superRefine((value, context) => {
    if (value.password !== value.passwordConfirm) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirm"],
        message: "비밀번호 확인이 일치하지 않습니다.",
      });
    }
  });

type SignUpField = "email" | "password" | "passwordConfirm";
type SignUpErrors = Partial<Record<SignUpField, string>>;

type SignUpFormProps = {
  disabled: boolean;
  signUpAction: (formData: FormData) => void | Promise<void>;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function errorId(field: SignUpField) {
  return `${field}-error`;
}

export function SignUpForm({ disabled, signUpAction }: SignUpFormProps) {
  const [errors, setErrors] = useState<SignUpErrors>({});

  function clearFieldError(field: SignUpField) {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const parsed = signupClientSchema.safeParse({
      email: readString(formData, "email"),
      password: readString(formData, "password"),
      passwordConfirm: readString(formData, "password_confirm"),
    });

    if (parsed.success) {
      setErrors({});
      return;
    }

    event.preventDefault();

    const nextErrors: SignUpErrors = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path[0];

      if (
        (field === "email" ||
          field === "password" ||
          field === "passwordConfirm") &&
        !nextErrors[field]
      ) {
        nextErrors[field] = issue.message;
      }
    }

    setErrors(nextErrors);
  }

  return (
    <form
      action={signUpAction}
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="grid gap-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="name@example.com"
          aria-describedby={errors.email ? errorId("email") : undefined}
          aria-invalid={Boolean(errors.email)}
          className="h-11"
          onInput={() => clearFieldError("email")}
        />
        {errors.email ? (
          <p id={errorId("email")} className="text-sm text-destructive">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          name="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={72}
          autoComplete="new-password"
          aria-describedby={errors.password ? errorId("password") : undefined}
          aria-invalid={Boolean(errors.password)}
          className="h-11"
          onInput={() => clearFieldError("password")}
        />
        {errors.password ? (
          <p id={errorId("password")} className="text-sm text-destructive">
            {errors.password}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password_confirm">비밀번호 확인</Label>
        <Input
          id="password_confirm"
          type="password"
          name="password_confirm"
          required
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={72}
          autoComplete="new-password"
          aria-describedby={
            errors.passwordConfirm ? errorId("passwordConfirm") : undefined
          }
          aria-invalid={Boolean(errors.passwordConfirm)}
          className="h-11"
          onInput={() => clearFieldError("passwordConfirm")}
        />
        {errors.passwordConfirm ? (
          <p
            id={errorId("passwordConfirm")}
            className="text-sm text-destructive"
          >
            {errors.passwordConfirm}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={disabled} className="h-11 w-full">
        회원가입
      </Button>
    </form>
  );
}
