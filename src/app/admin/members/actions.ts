"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOwnerMember } from "@/lib/auth";
import { findAuthUserByEmail } from "@/lib/admin-members";
import { createAdminClient } from "@/lib/supabase/admin";

const memberRoleSchema = z.enum(["owner", "editor", "viewer"]);

const createMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일을 입력하세요."),
  displayName: z.string().trim().max(80, "이름은 80자 이하로 입력하세요."),
  role: memberRoleSchema,
  password: z.string().min(6, "임시 비밀번호는 6자 이상이어야 합니다."),
});

const updateMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  displayName: z.string().trim().max(80, "이름은 80자 이하로 입력하세요."),
  role: memberRoleSchema,
  isActive: z.boolean(),
});

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function membersAdminPath(params: { notice?: string; error?: string }) {
  const searchParams = new URLSearchParams();

  if (params.notice) {
    searchParams.set("notice", params.notice);
  }

  if (params.error) {
    searchParams.set("error", params.error);
  }

  const query = searchParams.toString();
  return query ? `/admin/members?${query}` : "/admin/members";
}

async function ensureOwnerCanChangeTarget({
  admin,
  currentEmail,
  targetEmail,
  nextRole,
  nextActive,
}: {
  admin: ReturnType<typeof createAdminClient>;
  currentEmail: string;
  targetEmail: string;
  nextRole: "owner" | "editor" | "viewer";
  nextActive: boolean;
}) {
  const { data: target, error } = await admin
    .from("members")
    .select("email, role, is_active")
    .eq("email", targetEmail)
    .maybeSingle();

  if (error || !target) {
    redirect(
      membersAdminPath({
        error: error?.message ?? "수정할 멤버를 찾지 못했습니다.",
      }),
    );
  }

  const isSelf = targetEmail === currentEmail;

  if (isSelf && (!nextActive || nextRole !== "owner")) {
    redirect(
      membersAdminPath({
        error: "자기 자신의 owner 권한은 제거하거나 비활성화할 수 없습니다.",
      }),
    );
  }

  if (target.role !== "owner" || (nextActive && nextRole === "owner")) {
    return;
  }

  const { count, error: ownerCountError } = await admin
    .from("members")
    .select("email", { count: "exact", head: true })
    .eq("role", "owner")
    .eq("is_active", true)
    .neq("email", targetEmail);

  if (ownerCountError) {
    redirect(membersAdminPath({ error: ownerCountError.message }));
  }

  if (!count) {
    redirect(
      membersAdminPath({
        error: "마지막 owner는 비활성화하거나 다른 role로 변경할 수 없습니다.",
      }),
    );
  }
}

export async function createMember(formData: FormData) {
  await requireOwnerMember();
  const parsed = createMemberSchema.safeParse({
    email: readString(formData, "email"),
    displayName: readString(formData, "display_name"),
    role: readString(formData, "role") || "editor",
    password: readString(formData, "password"),
  });

  if (!parsed.success) {
    redirect(
      membersAdminPath({
        error: parsed.error.issues[0]?.message ?? "멤버 정보를 확인해주세요.",
      }),
    );
  }

  const { email, displayName, role, password } = parsed.data;
  const admin = createAdminClient();
  const existingAuthUser = await findAuthUserByEmail(admin, email);
  let createdAuthUserId: string | null = null;

  if (!existingAuthUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: displayName || email,
      },
    });

    if (error || !data.user) {
      redirect(
        membersAdminPath({
          error: error?.message ?? "Auth user를 생성하지 못했습니다.",
        }),
      );
    }

    createdAuthUserId = data.user.id;
  }

  const { error: memberError } = await admin.from("members").upsert(
    {
      email,
      display_name: displayName || null,
      role,
      is_active: true,
    },
    { onConflict: "email" },
  );

  if (memberError) {
    if (createdAuthUserId) {
      await admin.auth.admin.deleteUser(createdAuthUserId);
    }

    redirect(membersAdminPath({ error: memberError.message }));
  }

  revalidatePath("/admin/members");
  redirect(membersAdminPath({ notice: "멤버를 추가했습니다." }));
}

export async function updateMember(formData: FormData) {
  const { user } = await requireOwnerMember();
  const parsed = updateMemberSchema.safeParse({
    email: readString(formData, "email"),
    displayName: readString(formData, "display_name"),
    role: readString(formData, "role") || "editor",
    isActive: formData.get("is_active") === "on",
  });

  if (!parsed.success) {
    redirect(
      membersAdminPath({
        error: parsed.error.issues[0]?.message ?? "멤버 정보를 확인해주세요.",
      }),
    );
  }

  const { email, displayName, role, isActive } = parsed.data;
  const admin = createAdminClient();

  await ensureOwnerCanChangeTarget({
    admin,
    currentEmail: user.email.toLowerCase(),
    targetEmail: email,
    nextRole: role,
    nextActive: isActive,
  });

  const { error } = await admin
    .from("members")
    .update({
      display_name: displayName || null,
      role,
      is_active: isActive,
    })
    .eq("email", email);

  if (error) {
    redirect(membersAdminPath({ error: error.message }));
  }

  revalidatePath("/admin/members");
  redirect(membersAdminPath({ notice: "멤버 정보를 저장했습니다." }));
}
