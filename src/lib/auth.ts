import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { DevWikiUser, StudyMember } from "@/types/devwiki";

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

export const getCurrentMember = cache(async (): Promise<StudyMember | null> => {
  const user = await getCurrentUser();

  if (!user || !user.email) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_members")
    .select("email, display_name, role, is_active")
    .eq("email", user.email.toLowerCase())
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    isActive: data.is_active,
  };
});

export async function requireAuthenticatedMember() {
  const user = await requireCurrentUser();
  const member = await getCurrentMember();

  if (!member) {
    throw new Error("스터디 멤버로 등록된 계정만 사용할 수 있습니다.");
  }

  return {
    supabase: await createClient(),
    user,
    member,
  };
}
