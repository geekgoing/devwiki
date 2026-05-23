"use client";

import { HelpCircle, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { signOut } from "@/app/actions";
import type { DevWikiUser, Member } from "@/types/devwiki";

type ProfileMenuProps = {
  member: Member;
  user: DevWikiUser;
};

function avatarLabel(member: Member, user: DevWikiUser) {
  const source = member.displayName || user.email || "U";
  return source.trim().slice(0, 1).toUpperCase();
}

export function ProfileMenu({ member, user }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="사용자 메뉴"
        onClick={() => setOpen((current) => !current)}
        className="flex size-10 items-center justify-center rounded-full border border-slate-200 bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        {avatarLabel(member, user)}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg shadow-slate-200/80"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-950">
              {member.displayName ?? user.email}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <div className="p-2">
            <Link
              href="/me"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <User size={16} aria-hidden />
              마이페이지
            </Link>
            <Link
              href="/help"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <HelpCircle size={16} aria-hidden />
              도움말
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
              >
                <LogOut size={16} aria-hidden />
                로그아웃
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
