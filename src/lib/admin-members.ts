import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminMember, MemberRole } from "@/types/devwiki";

type AdminClient = ReturnType<typeof createAdminClient>;

type MemberRow = {
  email: string;
  display_name: string | null;
  role: MemberRole;
  is_active: boolean;
  created_at: string;
};

async function listAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const perPage = 100;

  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Auth user 목록을 불러오지 못했습니다: ${error.message}`);
    }

    const pageUsers = data?.users ?? [];
    users.push(...pageUsers);

    if (pageUsers.length < perPage) {
      return users;
    }
  }

  throw new Error("Auth user 목록 페이지 제한을 초과했습니다.");
}

export async function findAuthUserByEmail(
  admin: AdminClient,
  email: string,
): Promise<User | null> {
  const normalizedEmail = email.toLowerCase();
  const users = await listAuthUsers(admin);

  return (
    users.find((user) => user.email?.toLowerCase() === normalizedEmail) ?? null
  );
}

export async function getAdminMembers(): Promise<AdminMember[]> {
  const admin = createAdminClient();
  const [{ data, error }, authUsers] = await Promise.all([
    admin
      .from("members")
      .select("email, display_name, role, is_active, created_at")
      .order("is_active", { ascending: true })
      .order("created_at", { ascending: false }),
    listAuthUsers(admin),
  ]);

  if (error) {
    throw new Error(`멤버 목록을 불러오지 못했습니다: ${error.message}`);
  }

  const authUsersByEmail = new Map(
    authUsers
      .filter((user) => user.email)
      .map((user) => [user.email!.toLowerCase(), user]),
  );

  return ((data ?? []) as MemberRow[]).map((member) => {
    const authUser = authUsersByEmail.get(member.email.toLowerCase());

    return {
      email: member.email,
      displayName: member.display_name,
      role: member.role,
      isActive: member.is_active,
      createdAt: member.created_at,
      authUserId: authUser?.id ?? null,
      authConfirmedAt: authUser?.email_confirmed_at ?? null,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
    };
  });
}
