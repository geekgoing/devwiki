"use client";

import { useLinkStatus } from "next/link";

export function LinkPendingIndicator() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={`size-1.5 rounded-full bg-current transition ${
        pending ? "opacity-80 animate-pulse" : "opacity-0"
      }`}
    />
  );
}
