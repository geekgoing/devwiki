import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/types/devwiki";

const labelByStatus: Record<DocumentStatus, string> = {
  draft: "초안",
  published: "공개",
  archived: "보관",
};

const classByStatus: Record<DocumentStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-800",
  published: "border-teal-200 bg-teal-50 text-teal-800",
  archived: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge variant="outline" className={classByStatus[status]}>
      {labelByStatus[status]}
    </Badge>
  );
}
