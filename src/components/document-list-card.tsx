import { CheckCircle2, Star } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { contentTypeLabels, documentDetailPath } from "@/lib/content-routes";
import { formatDate } from "@/lib/format";
import type { DocumentSummary } from "@/types/devwiki";

function documentHref(document: DocumentSummary) {
  return documentDetailPath({
    contentType: document.contentType,
    slug: document.slug,
  });
}

export function DocumentListCard({
  document,
  showContentType = false,
}: {
  document: DocumentSummary;
  showContentType?: boolean;
}) {
  return (
    <Card
      className="group/card p-0 transition hover:-translate-y-0.5 hover:ring-primary/20"
      data-testid="document-card"
    >
      <Link href={documentHref(document)} className="block p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight transition group-hover/card:text-primary">
                {document.title}
              </h2>
              {showContentType ? (
                <Badge>{contentTypeLabels[document.contentType]}</Badge>
              ) : null}
              <StatusBadge status={document.status} />
              {document.isFavorite ? (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-700"
                >
                  <Star size={12} className="fill-current" aria-hidden />
                  즐겨찾기
                </Badge>
              ) : null}
              {document.isCompleted ? (
                <Badge
                  variant="outline"
                  className="border-teal-200 bg-teal-50 text-teal-700"
                >
                  <CheckCircle2 size={12} aria-hidden />
                  숙지함
                </Badge>
              ) : null}
            </div>
            {document.summary ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {document.summary}
              </p>
            ) : null}
          </div>
          <time className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
            {formatDate(document.updatedAt)}
          </time>
        </div>

        {document.tags.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {document.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : null}
      </Link>
    </Card>
  );
}
