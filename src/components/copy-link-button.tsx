"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

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
    const url = path ? new URL(path, window.location.origin).toString() : window.location.href;

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
    <button
      type="button"
      onClick={copyLink}
      className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
        copied
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
      } ${className}`}
    >
      <Icon size={16} aria-hidden />
      {copied ? "복사됨" : "링크 복사"}
    </button>
  );
}
