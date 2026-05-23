"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyLinkButtonProps = {
  className?: string;
  path?: string;
};

export function CopyLinkButton({ className = "", path }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  async function copyLink() {
    const url = path
      ? new URL(path, window.location.origin).toString()
      : window.location.href;

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    setCopied(true);
  }

  const Icon = copied ? Check : Copy;

  return (
    <Button
      type="button"
      onClick={copyLink}
      variant={copied ? "secondary" : "outline"}
      size="lg"
      className={cn(copied && "text-teal-700", className)}
    >
      <Icon aria-hidden />
      {copied ? "복사됨" : "링크 복사"}
    </Button>
  );
}
