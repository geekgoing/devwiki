"use client";

import { BookOpen, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { contentRoutes } from "@/lib/content-routes";
import { cn } from "@/lib/utils";
import type { DocumentContentType } from "@/types/devwiki";

const contentNavItems = [
  {
    href: contentRoutes.term.href,
    label: contentRoutes.term.label,
    type: "term",
  },
  {
    href: contentRoutes.interview_qa.href,
    label: contentRoutes.interview_qa.label,
    type: "interview_qa",
  },
  {
    href: contentRoutes.scenario.href,
    label: "시뮬레이션",
    type: "scenario",
  },
] satisfies Array<{
  href: string;
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
              "px-3 sm:px-4",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {item.type === "term" ? (
              <BookOpen size={15} aria-hidden />
            ) : (
              <MessageSquareText size={15} aria-hidden />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
