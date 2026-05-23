import {
  BookOpen,
  LogIn,
  MessageSquareText,
  Users,
} from "lucide-react";
import Link from "next/link";

import { LinkPendingIndicator } from "@/components/link-pending-indicator";
import { ProfileMenu } from "@/components/profile-menu";
import type { DevWikiUser, DocumentContentType, Member } from "@/types/devwiki";

type AppHeaderProps = {
  activeContentType?: DocumentContentType;
  canCreate?: boolean;
  canManageMembers?: boolean;
  configured: boolean;
  member?: Member | null;
  user: DevWikiUser | null;
};

const contentNavItems = [
  {
    href: "/",
    label: "기술 용어",
    type: "term",
  },
  {
    href: "/?type=interview_qa",
    label: "면접 Q&A",
    type: "interview_qa",
  },
  {
    href: "/?type=scenario",
    label: "시뮬레이션",
    type: "scenario",
  },
] satisfies Array<{
  href: string;
  label: string;
  type: DocumentContentType;
}>;

export function AppHeader({
  activeContentType,
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

        {configured && user && member ? (
          <nav
            className="order-3 flex w-full justify-center gap-1 rounded-md bg-slate-100 p-1 md:order-none md:w-auto"
            aria-label="콘텐츠 영역"
          >
            {contentNavItems.map((item) => {
              const selected = activeContentType === item.type;

              return (
                <Link
                  key={item.type}
                  href={item.href}
                  className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                    selected
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
                  }`}
                >
                  {item.type === "term" ? (
                    <BookOpen size={15} aria-hidden />
                  ) : (
                    <MessageSquareText size={15} aria-hidden />
                  )}
                  {item.label}
                  <LinkPendingIndicator />
                </Link>
              );
            })}
          </nav>
        ) : null}

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
