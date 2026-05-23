"use client";

import { BookOpen, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { contentRoutes } from "@/lib/content-routes";
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
      className="order-3 flex w-full justify-center gap-2 rounded-md bg-slate-100 p-1.5 sm:gap-3 md:order-none md:w-auto md:gap-4"
      aria-label="콘텐츠 영역"
    >
      {contentNavItems.map((item) => {
        const selected = isSelected(pathname, item.href);

        return (
          <Link
            key={item.type}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition sm:px-4 ${
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
          </Link>
        );
      })}
    </nav>
  );
}
