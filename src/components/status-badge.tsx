import type { DocumentStatus } from "@/types/devwiki";

const labelByStatus: Record<DocumentStatus, string> = {
  draft: "초안",
  published: "공개",
  archived: "보관",
};

const classByStatus: Record<DocumentStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-800",
  published: "border-emerald-200 bg-emerald-50 text-emerald-800",
  archived: "border-slate-200 bg-slate-100 text-slate-600",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium ${classByStatus[status]}`}
    >
      {labelByStatus[status]}
    </span>
  );
}
