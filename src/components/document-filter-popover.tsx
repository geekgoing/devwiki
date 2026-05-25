"use client";

import { Check, Filter, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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
  activeLabels?: string[];
  onNavigate?: (href: string) => void;
  resetHref: string;
};

function FilterSection({
  links,
  onNavigate,
  onSelect,
  title,
}: {
  links: FilterLink[];
  onNavigate?: (href: string) => void;
  onSelect: () => void;
  title: string;
}) {
  return (
    <section className="grid gap-2">
      <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-2 gap-1.5">
        {links.map((link) => (
          <Button
            key={`${title}-${link.label}`}
            asChild={!onNavigate}
            type="button"
            variant={link.selected ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "justify-between px-2",
              link.selected
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground",
            )}
            onClick={
              onNavigate
                ? () => {
                    onNavigate(link.href);
                    onSelect();
                  }
                : undefined
            }
          >
            {onNavigate ? (
              <>
                {link.label}
                {link.selected ? <Check size={13} aria-hidden /> : null}
              </>
            ) : (
              <Link href={link.href} onClick={onSelect}>
                {link.label}
                {link.selected ? <Check size={13} aria-hidden /> : null}
              </Link>
            )}
          </Button>
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
  activeLabels = [],
  onNavigate,
  resetHref,
}: DocumentFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const handleReset = () => {
    if (onNavigate) {
      onNavigate(resetHref);
    }

    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          aria-label={activeCount ? `필터 ${activeCount}개 적용됨` : "필터"}
          variant={activeCount ? "default" : "outline"}
          size="lg"
        >
          <Filter aria-hidden />
          필터
          {activeCount ? (
            <Badge className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px]">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-4 p-4">
        <PopoverHeader className="flex-row items-center justify-between gap-3">
          <PopoverTitle>필터</PopoverTitle>
          <Button
            asChild={!onNavigate}
            variant="ghost"
            size="sm"
            className={cn(!activeCount && "pointer-events-none opacity-40")}
            aria-disabled={!activeCount}
            onClick={onNavigate ? handleReset : undefined}
          >
            {onNavigate ? (
              <>
                <RotateCcw aria-hidden />
                초기화
              </>
            ) : (
              <Link href={resetHref} onClick={() => setOpen(false)}>
                <RotateCcw aria-hidden />
                초기화
              </Link>
            )}
          </Button>
        </PopoverHeader>
        {activeLabels.length ? (
          <div className="flex flex-wrap gap-1.5">
            {activeLabels.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
        ) : null}
        <Separator />
        <FilterSection
          links={statusLinks}
          onNavigate={onNavigate}
          onSelect={() => setOpen(false)}
          title="문서 상태"
        />
        {interviewCategoryLinks.length ? (
          <FilterSection
            links={interviewCategoryLinks}
            onNavigate={onNavigate}
            onSelect={() => setOpen(false)}
            title="면접 분류"
          />
        ) : null}
        <FilterSection
          links={learningLinks}
          onNavigate={onNavigate}
          onSelect={() => setOpen(false)}
          title="학습 상태"
        />
      </PopoverContent>
    </Popover>
  );
}
