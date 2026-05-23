"use client";

import { HelpCircle, LogOut, User } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="사용자 메뉴" className="outline-none">
        <Avatar size="lg" className="transition hover:opacity-90">
          <AvatarFallback className="bg-primary text-primary-foreground">
            {avatarLabel(member, user)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="px-2 py-2">
          <span className="block truncate text-sm font-medium text-foreground">
            {member.displayName ?? user.email}
          </span>
          <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/me">
            <User aria-hidden />
            마이페이지
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/help">
            <HelpCircle aria-hidden />
            도움말
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              로그아웃
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
