"use client";

import { Check, Filter } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type FilterLink = {
  href: string;
  label: string;
  selected: boolean;
};

type DocumentFilterPopoverProps = {
  interviewCategoryLinks?: FilterLink[];
  learningLinks: FilterLink[];
  statusLinks: FilterLink[];
  activeCount: number;
};

function FilterSection({
  links,
  onSelect,
  title,
}: {
  links: FilterLink[];
  onSelect: () => void;
  title: string;
}) {
  return (
    <section className="grid gap-1">
      <h2 className="px-2 text-xs font-semibold text-slate-500">{title}</h2>
      {links.map((link) => (
        <Link
          key={`${title}-${link.label}`}
          href={link.href}
          onClick={onSelect}
          className={`flex h-9 items-center justify-between rounded-md px-2 text-sm font-medium transition ${
            link.selected
              ? "bg-blue-50 text-blue-700"
              : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
          }`}
        >
          {link.label}
          {link.selected ? <Check size={15} aria-hidden /> : null}
        </Link>
      ))}
    </section>
  );
}

export function DocumentFilterPopover({
  interviewCategoryLinks = [],
  learningLinks,
  statusLinks,
  activeCount,
}: DocumentFilterPopoverProps) {
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
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
          activeCount
            ? "border-blue-600 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
        }`}
      >
        <Filter size={17} aria-hidden />
        필터
        {activeCount ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 grid w-72 gap-4 rounded-md border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/80"
        >
          <FilterSection
            links={statusLinks}
            onSelect={() => setOpen(false)}
            title="문서 상태"
          />
          {interviewCategoryLinks.length ? (
            <FilterSection
              links={interviewCategoryLinks}
              onSelect={() => setOpen(false)}
              title="면접 분류"
            />
          ) : null}
          <FilterSection
            links={learningLinks}
            onSelect={() => setOpen(false)}
            title="학습 상태"
          />
        </div>
      ) : null}
    </div>
  );
}
