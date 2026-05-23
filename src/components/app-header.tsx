import { BookOpen, LogIn, Users } from "lucide-react";
import Link from "next/link";

import { HeaderContentNav } from "@/components/header-content-nav";
import { ProfileMenu } from "@/components/profile-menu";
import type { DevWikiUser, Member } from "@/types/devwiki";

type AppHeaderProps = {
  canManageMembers?: boolean;
  configured: boolean;
  member?: Member | null;
  user: DevWikiUser | null;
};

export function AppHeader({
  canManageMembers = false,
  configured,
  member = null,
  user,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-slate-950">
          <span className="flex size-9 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm shadow-blue-600/20">
            <BookOpen size={18} aria-hidden />
          </span>
          <span>
            <span className="block text-base font-semibold leading-5">
              DevWiki
            </span>
            <span className="block text-xs text-slate-500">
              개발자 지식 베이스
            </span>
          </span>
        </Link>

        {configured && user && member ? <HeaderContentNav /> : null}

        <nav className="flex items-center justify-end gap-2">
          {configured && user ? (
            <>
              {canManageMembers ? (
                <Link
                  href="/admin/members"
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Users size={16} aria-hidden />
                  멤버
                </Link>
              ) : null}

              {member ? <ProfileMenu member={member} user={user} /> : null}
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <LogIn size={16} aria-hidden />
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
