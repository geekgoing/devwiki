import { BookOpen, LogIn, Users } from "lucide-react";
import Link from "next/link";

import { HeaderContentNav } from "@/components/header-content-nav";
import { ProfileMenu } from "@/components/profile-menu";
import { Button } from "@/components/ui/button";
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
    <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/78">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-foreground">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <BookOpen size={18} aria-hidden />
          </span>
          <span>
            <span className="block text-base font-semibold leading-5 tracking-tight">
              DevWiki
            </span>
            <span className="block text-xs text-muted-foreground">
              개발자 지식 베이스
            </span>
          </span>
        </Link>

        {configured && user && member ? <HeaderContentNav /> : null}

        <nav className="flex items-center justify-end gap-2">
          {configured && user ? (
            <>
              {canManageMembers ? (
                <Button asChild variant="outline" size="lg">
                  <Link href="/admin/members">
                    <Users aria-hidden />
                    멤버
                  </Link>
                </Button>
              ) : null}

              {member ? <ProfileMenu member={member} user={user} /> : null}
            </>
          ) : (
            <Button asChild size="lg">
              <Link href="/login">
                <LogIn aria-hidden />
                로그인
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
