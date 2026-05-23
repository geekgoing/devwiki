"use client";

import { Check, Filter, RotateCcw } from "lucide-react";
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
  resetHref: string;
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
    <section className="grid gap-2">
      <h2 className="text-xs font-semibold text-slate-500">{title}</h2>
      <div className="grid grid-cols-2 gap-1.5">
        {links.map((link) => (
          <Link
            key={`${title}-${link.label}`}
            href={link.href}
            onClick={onSelect}
            className={`flex h-8 items-center justify-between rounded-md px-2 text-xs font-medium transition ${
              link.selected
                ? "bg-slate-950 text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            {link.label}
            {link.selected ? <Check size={13} aria-hidden /> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function DocumentFilterPopover({
  interviewCategoryLinks = [],
  learningLinks,
  statusLinks,
  activeCount,
  resetHref,
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
        aria-label="필터"
        onClick={() => setOpen((current) => !current)}
        className={`relative inline-flex size-10 items-center justify-center rounded-md border transition ${
          activeCount
            ? "border-slate-950 bg-slate-950 text-white"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
        }`}
      >
        <Filter size={17} aria-hidden />
        {activeCount ? (
          <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 grid w-72 gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-950">필터</h2>
            <Link
              href={resetHref}
              onClick={() => setOpen(false)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition ${
                activeCount
                  ? "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  : "pointer-events-none text-slate-300"
              }`}
              aria-disabled={!activeCount}
            >
              <RotateCcw size={13} aria-hidden />
              초기화
            </Link>
          </div>
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
