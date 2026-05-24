"use client";

import { Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_PASSWORD_LENGTH,
  PASSWORD_CHANGE_MIN_PASSWORD_LENGTH,
} from "@/lib/password-policy";

const passwordChangeClientSchema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요."),
    password: z
      .string()
      .min(
        PASSWORD_CHANGE_MIN_PASSWORD_LENGTH,
        `새 비밀번호는 ${PASSWORD_CHANGE_MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
      )
      .max(
        MAX_PASSWORD_LENGTH,
        `새 비밀번호는 ${MAX_PASSWORD_LENGTH}자 이하로 입력해주세요.`,
      ),
    passwordConfirm: z.string().min(1, "새 비밀번호 확인을 입력해주세요."),
  })
  .superRefine((value, context) => {
    if (value.password !== value.passwordConfirm) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirm"],
        message: "새 비밀번호 확인이 일치하지 않습니다.",
      });
    }

    if (value.currentPassword === value.password) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "새 비밀번호는 현재 비밀번호와 달라야 합니다.",
      });
    }
  });

type PasswordField = "currentPassword" | "password" | "passwordConfirm";
type PasswordErrors = Partial<Record<PasswordField, string>>;

type PasswordChangeFormProps = {
  next: string;
  updatePasswordAction: (formData: FormData) => void | Promise<void>;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function errorId(field: PasswordField) {
  return `${field}-error`;
}

export function PasswordChangeForm({
  next,
  updatePasswordAction,
}: PasswordChangeFormProps) {
  const [errors, setErrors] = useState<PasswordErrors>({});

  function clearFieldError(field: PasswordField) {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const parsed = passwordChangeClientSchema.safeParse({
      currentPassword: readString(formData, "current_password"),
      password: readString(formData, "password"),
      passwordConfirm: readString(formData, "password_confirm"),
    });

    if (parsed.success) {
      setErrors({});
      return;
    }

    event.preventDefault();

    const nextErrors: PasswordErrors = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path[0];

      if (
        (field === "currentPassword" ||
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
      action={updatePasswordAction}
      className="grid gap-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="next" value={next} />

      <div className="grid gap-1.5">
        <Label htmlFor="current_password">현재 비밀번호</Label>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
          aria-describedby={
            errors.currentPassword ? errorId("currentPassword") : undefined
          }
          aria-invalid={Boolean(errors.currentPassword)}
          className="h-11"
          onInput={() => clearFieldError("currentPassword")}
        />
        {errors.currentPassword ? (
          <p id={errorId("currentPassword")} className="text-sm text-destructive">
            {errors.currentPassword}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="password">새 비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={PASSWORD_CHANGE_MIN_PASSWORD_LENGTH}
          maxLength={MAX_PASSWORD_LENGTH}
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

      <div className="grid gap-1.5">
        <Label htmlFor="password_confirm">새 비밀번호 확인</Label>
        <Input
          id="password_confirm"
          name="password_confirm"
          type="password"
          required
          minLength={PASSWORD_CHANGE_MIN_PASSWORD_LENGTH}
          maxLength={MAX_PASSWORD_LENGTH}
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

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg">
          <Save size={16} aria-hidden />
          변경
        </Button>
      </div>
    </form>
  );
}
