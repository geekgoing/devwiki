import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { canEditContent } from "@/lib/permissions";
import type { DevWikiUser, Member } from "@/types/devwiki";

export const getCurrentUser = cache(async (): Promise<DevWikiUser | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : "",
  };
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user;
}

export const getCurrentMembership = cache(async (): Promise<Member | null> => {
  const user = await getCurrentUser();

  if (!user || !user.email) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("email, display_name, role, is_active, created_at")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    isActive: data.is_active,
    createdAt: data.created_at,
  };
});

export const getCurrentMember = cache(async (): Promise<Member | null> => {
  const member = await getCurrentMembership();

  return member?.isActive ? member : null;
});

export async function requireAuthenticatedMember() {
  const user = await requireCurrentUser();
  const member = await getCurrentMember();

  if (!member) {
    throw new Error("등록된 멤버 계정만 사용할 수 있습니다.");
  }

  return {
    supabase: await createClient(),
    user,
    member,
  };
}

export async function requireOwnerMember() {
  const auth = await requireAuthenticatedMember();

  if (auth.member.role !== "owner") {
    throw new Error("owner 권한이 필요합니다.");
  }

  return auth;
}

export async function requireEditorMember() {
  const auth = await requireAuthenticatedMember();

  if (!canEditContent(auth.member)) {
    throw new Error("editor 이상의 권한이 필요합니다.");
  }

  return auth;
}
