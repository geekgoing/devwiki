import { GitCompareArrows, RotateCcw } from "lucide-react";

import { restoreDocumentRevision } from "@/app/actions";
import { formatDate } from "@/lib/format";
import type { DocumentRevision } from "@/types/devwiki";

type DiffLine = {
  id: string;
  type: "same" | "added" | "removed";
  text: string;
};

function simpleDiff(previous: string, current: string): DiffLine[] {
  const previousLines = previous.split(/\r?\n/);
  const currentLines = current.split(/\r?\n/);
  const lines: DiffLine[] = [];
  let start = 0;

  while (
    start < previousLines.length &&
    start < currentLines.length &&
    previousLines[start] === currentLines[start]
  ) {
    lines.push({
      id: `same-start-${start}`,
      type: "same",
      text: previousLines[start],
    });
    start += 1;
  }

  let previousEnd = previousLines.length - 1;
  let currentEnd = currentLines.length - 1;
  const suffix: DiffLine[] = [];

  while (
    previousEnd >= start &&
    currentEnd >= start &&
    previousLines[previousEnd] === currentLines[currentEnd]
  ) {
    suffix.unshift({
      id: `same-end-${previousEnd}-${currentEnd}`,
      type: "same",
      text: previousLines[previousEnd],
    });
    previousEnd -= 1;
    currentEnd -= 1;
  }

  for (let index = start; index <= previousEnd; index += 1) {
    lines.push({
      id: `removed-${index}`,
      type: "removed",
      text: previousLines[index],
    });
  }

  for (let index = start; index <= currentEnd; index += 1) {
    lines.push({
      id: `added-${index}`,
      type: "added",
      text: currentLines[index],
    });
  }

  return [...lines, ...suffix];
}

function diffClassName(type: DiffLine["type"]) {
  if (type === "added") {
    return "bg-emerald-50 text-emerald-900";
  }

  if (type === "removed") {
    return "bg-rose-50 text-rose-900";
  }

  return "text-slate-500";
}

function diffPrefix(type: DiffLine["type"]) {
  if (type === "added") {
    return "+";
  }

  if (type === "removed") {
    return "-";
  }

  return " ";
}

export function RevisionHistory({
  currentBody,
  documentId,
  revisions,
  canRestore,
}: {
  currentBody: string;
  documentId: string;
  revisions: DocumentRevision[];
  canRestore: boolean;
}) {
  return (
    <section
      className="rounded-md border border-slate-200 bg-white p-4"
      data-testid="revision-history"
    >
      <div className="flex items-center gap-2">
        <GitCompareArrows size={16} className="text-slate-500" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-950">변경 이력</h2>
      </div>
      {revisions.length ? (
        <ol className="mt-3 space-y-3">
          {revisions.map((revision) => {
            const diff = simpleDiff(revision.bodyMarkdown, currentBody);

            return (
              <li
                key={revision.id}
                className="border-l border-slate-200 pl-3"
              >
                <p className="text-sm font-medium text-slate-800">
                  {revision.editSummary || revision.title}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  제목 스냅샷: {revision.title}
                </p>
                {revision.summary ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                    {revision.summary}
                  </p>
                ) : null}
                <time className="mt-2 block text-xs text-slate-500">
                  {formatDate(revision.createdAt)}
                </time>
                <p className="mt-1 text-xs text-slate-400">
                  수정자:{" "}
                  {revision.editedBy
                    ? revision.editedBy.slice(0, 8)
                    : "알 수 없음"}
                </p>
                <details className="mt-2 rounded-md border border-slate-200 bg-slate-50">
                  <summary className="cursor-pointer px-2 py-1 text-xs font-medium text-slate-600">
                    현재 문서와 비교
                  </summary>
                  <div className="max-h-56 overflow-auto border-t border-slate-200 bg-white py-2 font-mono text-xs leading-5">
                    {diff.slice(0, 160).map((line) => (
                      <div
                        key={line.id}
                        className={`grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 px-2 ${diffClassName(
                          line.type,
                        )}`}
                      >
                        <span>{diffPrefix(line.type)}</span>
                        <span className="whitespace-pre-wrap break-words">
                          {line.text || " "}
                        </span>
                      </div>
                    ))}
                    {diff.length > 160 ? (
                      <p className="px-2 pt-2 text-xs text-slate-500">
                        큰 diff는 앞 160줄만 표시합니다.
                      </p>
                    ) : null}
                  </div>
                </details>
                {canRestore ? (
                  <form action={restoreDocumentRevision} className="mt-2">
                    <input
                      type="hidden"
                      name="document_id"
                      value={documentId}
                    />
                    <input
                      type="hidden"
                      name="revision_id"
                      value={revision.id}
                    />
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <RotateCcw size={14} aria-hidden />
                      이 버전으로 복원
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Supabase 연결 후 수정 이력이 쌓입니다.
        </p>
      )}
    </section>
  );
}
