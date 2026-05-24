import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MemberGate } from "@/components/member-gate";
import {
  getCurrentMember,
  getCurrentMembership,
  getCurrentUser,
} from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function loginHref(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const membership = member ? member : await getCurrentMembership();
  const currentPath = safeNext((await headers()).get("x-devwiki-pathname"));

  if (configured && !user) {
    redirect(loginHref(currentPath));
  }

  if (configured && user && !member) {
    return (
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <MemberGate member={membership} user={user} />
      </main>
    );
  }

  return children;
}
