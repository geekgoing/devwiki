"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { findAuthUserByEmail } from "@/lib/admin-members";
import { requireOwnerMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const memberRoleSchema = z.enum(["owner", "editor", "viewer"]);

const updateMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: memberRoleSchema,
  isActive: z.boolean(),
});

const memberEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
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

async function ensureOwnerCanDeleteTarget({
  admin,
  currentEmail,
  targetEmail,
}: {
  admin: ReturnType<typeof createAdminClient>;
  currentEmail: string;
  targetEmail: string;
}) {
  const { data: target, error } = await admin
    .from("members")
    .select("email, role, is_active")
    .eq("email", targetEmail)
    .maybeSingle();

  if (error || !target) {
    redirect(
      membersAdminPath({
        error: error?.message ?? "삭제할 멤버를 찾지 못했습니다.",
      }),
    );
  }

  if (targetEmail === currentEmail) {
    redirect(membersAdminPath({ error: "자기 자신은 삭제할 수 없습니다." }));
  }

  if (target.role !== "owner" || !target.is_active) {
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
        error: "마지막 owner는 삭제할 수 없습니다.",
      }),
    );
  }
}

export async function updateMember(formData: FormData) {
  const { user } = await requireOwnerMember();
  const parsed = updateMemberSchema.safeParse({
    email: readString(formData, "email"),
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

  const { email, role, isActive } = parsed.data;
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

export async function approveMember(formData: FormData) {
  const { user } = await requireOwnerMember();
  const parsed = memberEmailSchema.safeParse({
    email: readString(formData, "email"),
  });

  if (!parsed.success) {
    redirect(membersAdminPath({ error: "승인할 멤버를 확인해주세요." }));
  }

  const { email } = parsed.data;
  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("members")
    .select("role")
    .eq("email", email)
    .maybeSingle();

  if (targetError || !target) {
    redirect(
      membersAdminPath({
        error: targetError?.message ?? "승인할 멤버를 찾지 못했습니다.",
      }),
    );
  }

  await ensureOwnerCanChangeTarget({
    admin,
    currentEmail: user.email.toLowerCase(),
    targetEmail: email,
    nextRole: target.role,
    nextActive: true,
  });

  const { error } = await admin
    .from("members")
    .update({ is_active: true })
    .eq("email", email);

  if (error) {
    redirect(membersAdminPath({ error: error.message }));
  }

  revalidatePath("/admin/members");
  redirect(membersAdminPath({ notice: "멤버를 승인했습니다." }));
}

export async function deleteMember(formData: FormData) {
  const { user } = await requireOwnerMember();
  const parsed = memberEmailSchema.safeParse({
    email: readString(formData, "email"),
  });

  if (!parsed.success) {
    redirect(membersAdminPath({ error: "삭제할 멤버를 확인해주세요." }));
  }

  const { email } = parsed.data;
  const admin = createAdminClient();

  await ensureOwnerCanDeleteTarget({
    admin,
    currentEmail: user.email.toLowerCase(),
    targetEmail: email,
  });

  let authUser: Awaited<ReturnType<typeof findAuthUserByEmail>> = null;

  try {
    authUser = await findAuthUserByEmail(admin, email);
  } catch (error) {
    redirect(
      membersAdminPath({
        error:
          error instanceof Error
            ? error.message
            : "Auth 계정 조회에 실패했습니다.",
      }),
    );
  }

  if (authUser) {
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(
      authUser.id,
      false,
    );

    if (authDeleteError) {
      redirect(
        membersAdminPath({
          error: `Auth 계정 삭제에 실패했습니다: ${authDeleteError.message}`,
        }),
      );
    }
  }

  const { error } = await admin.from("members").delete().eq("email", email);

  if (error) {
    redirect(membersAdminPath({ error: error.message }));
  }

  revalidatePath("/admin/members");
  redirect(
    membersAdminPath({
      notice: authUser
        ? "멤버와 Auth 계정을 삭제했습니다."
        : "멤버를 삭제했습니다. 연결된 Auth 계정은 없었습니다.",
    }),
  );
}
