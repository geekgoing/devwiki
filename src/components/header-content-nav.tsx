"use client";

import { BookOpen, MessageSquareText, Route } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { contentRoutes } from "@/lib/content-routes";
import { cn } from "@/lib/utils";
import type { DocumentContentType } from "@/types/devwiki";

const contentNavItems = [
  {
    href: contentRoutes.term.href,
    icon: BookOpen,
    label: contentRoutes.term.label,
    type: "term",
  },
  {
    href: contentRoutes.interview_qa.href,
    icon: MessageSquareText,
    label: contentRoutes.interview_qa.label,
    type: "interview_qa",
  },
  {
    href: contentRoutes.scenario.href,
    icon: Route,
    label: "시뮬레이션",
    type: "scenario",
  },
] satisfies Array<{
  href: string;
  icon: typeof BookOpen;
  label: string;
  type: DocumentContentType;
}>;

function isSelected(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderContentNav() {
  const pathname = usePathname();

  return (
    <nav
      className="order-3 flex w-full justify-center gap-1 rounded-lg bg-muted p-1 md:order-none md:w-auto"
      aria-label="콘텐츠 영역"
    >
      {contentNavItems.map((item) => {
        const selected = isSelected(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.type}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              buttonVariants({
                variant: selected ? "secondary" : "ghost",
                size: "lg",
              }),
              "flex-1 px-3 sm:px-4 md:flex-none",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            <Icon size={15} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
