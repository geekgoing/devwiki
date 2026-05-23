import { CheckCircle2, Star } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
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
    <Link
      href={documentHref(document)}
      className="group rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md hover:shadow-slate-200/70"
      data-testid="document-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950 transition group-hover:text-blue-700">
              {document.title}
            </h2>
            {showContentType ? (
              <span className="rounded-md bg-slate-950 px-2 py-1 text-xs font-medium text-white">
                {contentTypeLabels[document.contentType]}
              </span>
            ) : null}
            <StatusBadge status={document.status} />
            {document.isFavorite ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                <Star size={12} className="fill-current" aria-hidden />
                즐겨찾기
              </span>
            ) : null}
            {document.isCompleted ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={12} aria-hidden />
                숙지함
              </span>
            ) : null}
          </div>
          {document.summary ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {document.summary}
            </p>
          ) : null}
        </div>
        <time className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-500">
          {formatDate(document.updatedAt)}
        </time>
      </div>

      {document.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {document.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 transition group-hover:bg-blue-50 group-hover:text-blue-700"
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
