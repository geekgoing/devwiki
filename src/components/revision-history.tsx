"use client";

import { GitCompareArrows, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { restoreDocumentRevision } from "@/app/actions";
import { formatDate } from "@/lib/format";
import type { DocumentRevision } from "@/types/devwiki";

type DiffLine = {
  id: string;
  type: "same" | "added" | "removed";
  text: string;
  oldLine?: number;
  newLine?: number;
};

type DiffSide = {
  line?: number;
  text: string;
  type: DiffLine["type"] | "blank";
};

type DiffRow = {
  id: string;
  before: DiffSide;
  after: DiffSide;
};

type RevisionComparison = {
  revision: DocumentRevision;
  diff: DiffLine[];
  rows: DiffRow[];
  stats: {
    added: number;
    removed: number;
  };
  isCurrentSnapshot: boolean;
};

function toLines(value: string) {
  return value ? value.split(/\r?\n/) : [];
}

function lineDiff(previous: string, current: string): DiffLine[] {
  const previousLines = toLines(previous);
  const currentLines = toLines(current);
  const previousLength = previousLines.length;
  const currentLength = currentLines.length;
  const table = Array.from({ length: previousLength + 1 }, () =>
    Array.from({ length: currentLength + 1 }, () => 0),
  );
  const lines: DiffLine[] = [];

  for (let oldIndex = previousLength - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = currentLength - 1; newIndex >= 0; newIndex -= 1) {
      table[oldIndex][newIndex] =
        previousLines[oldIndex] === currentLines[newIndex]
          ? table[oldIndex + 1][newIndex + 1] + 1
          : Math.max(
              table[oldIndex + 1][newIndex],
              table[oldIndex][newIndex + 1],
            );
    }
  }

  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < previousLength || newIndex < currentLength) {
    if (
      oldIndex < previousLength &&
      newIndex < currentLength &&
      previousLines[oldIndex] === currentLines[newIndex]
    ) {
      lines.push({
        id: `same-${oldIndex}-${newIndex}`,
        type: "same",
        text: previousLines[oldIndex],
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
      });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }

    if (
      newIndex >= currentLength ||
      (oldIndex < previousLength &&
        table[oldIndex + 1][newIndex] >= table[oldIndex][newIndex + 1])
    ) {
      lines.push({
        id: `removed-${oldIndex}-${newIndex}`,
        type: "removed",
        text: previousLines[oldIndex],
        oldLine: oldIndex + 1,
      });
      oldIndex += 1;
      continue;
    }

    lines.push({
      id: `added-${oldIndex}-${newIndex}`,
      type: "added",
      text: currentLines[newIndex],
      newLine: newIndex + 1,
    });
    newIndex += 1;
  }

  return lines;
}

function blankSide(): DiffSide {
  return {
    text: "",
    type: "blank",
  };
}

function buildSideBySideRows(diff: DiffLine[]) {
  const rows: DiffRow[] = [];
  let index = 0;

  while (index < diff.length) {
    const line = diff[index];

    if (line.type === "same") {
      rows.push({
        id: line.id,
        before: {
          line: line.oldLine,
          text: line.text,
          type: "same",
        },
        after: {
          line: line.newLine,
          text: line.text,
          type: "same",
        },
      });
      index += 1;
      continue;
    }

    const removedLines: DiffLine[] = [];
    const addedLines: DiffLine[] = [];

    while (diff[index]?.type === "removed") {
      removedLines.push(diff[index]);
      index += 1;
    }

    while (diff[index]?.type === "added") {
      addedLines.push(diff[index]);
      index += 1;
    }

    const rowCount = Math.max(removedLines.length, addedLines.length);

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const removed = removedLines[rowIndex];
      const added = addedLines[rowIndex];

      rows.push({
        id: `changed-${removed?.id ?? "none"}-${added?.id ?? "none"}`,
        before: removed
          ? {
              line: removed.oldLine,
              text: removed.text,
              type: "removed",
            }
          : blankSide(),
        after: added
          ? {
              line: added.newLine,
              text: added.text,
              type: "added",
            }
          : blankSide(),
      });
    }
  }

  return rows;
}

function diffStats(diff: DiffLine[]) {
  return diff.reduce(
    (stats, line) => ({
      added: stats.added + (line.type === "added" ? 1 : 0),
      removed: stats.removed + (line.type === "removed" ? 1 : 0),
    }),
    { added: 0, removed: 0 },
  );
}

function diffSideClassName(type: DiffSide["type"]) {
  if (type === "added") {
    return "bg-emerald-50 text-emerald-950";
  }

  if (type === "removed") {
    return "bg-rose-50 text-rose-950";
  }

  if (type === "blank") {
    return "bg-slate-50 text-slate-300";
  }

  return "bg-white text-slate-600";
}

function RevisionDiffModal({
  canRestore,
  comparison,
  documentId,
  onClose,
}: {
  canRestore: boolean;
  comparison: RevisionComparison;
  documentId: string;
  onClose: () => void;
}) {
  const visibleRows = comparison.rows.slice(0, 600);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revision-diff-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-md bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id="revision-diff-title"
                className="text-base font-semibold text-slate-950"
              >
                {comparison.revision.editSummary || "변경 내용 비교"}
              </h3>
              {comparison.isCurrentSnapshot ? (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                  현재
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {formatDate(comparison.revision.createdAt)} · 제목 스냅샷:{" "}
              {comparison.revision.title}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              +{comparison.stats.added}
            </span>
            <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
              -{comparison.stats.removed}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
              aria-label="닫기"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
          <span>Before</span>
          <span>After</span>
        </div>

        <div
          className="min-h-0 flex-1 overflow-auto font-mono text-xs leading-5"
          data-testid="revision-diff"
        >
          {visibleRows.map((row) => (
            <div
              key={row.id}
              className="grid min-w-[920px] grid-cols-2 border-b border-slate-100"
            >
              {[row.before, row.after].map((side, sideIndex) => (
                <div
                  key={`${row.id}-${sideIndex}`}
                  className={`grid grid-cols-[3.75rem_minmax(0,1fr)] ${diffSideClassName(
                    side.type,
                  )}`}
                >
                  <span className="select-none border-r border-black/5 px-2 py-1 text-right text-slate-400">
                    {side.line ?? ""}
                  </span>
                  <span className="whitespace-pre-wrap break-words px-3 py-1">
                    {side.text || " "}
                  </span>
                </div>
              ))}
            </div>
          ))}
          {comparison.rows.length > visibleRows.length ? (
            <p className="px-4 py-3 text-xs text-slate-500">
              큰 diff는 앞 {visibleRows.length.toLocaleString("ko-KR")}줄만
              표시합니다.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <p className="text-xs text-slate-500">
            붉은 줄은 이전 버전에서 제거된 내용, 초록 줄은 이후 버전에 추가된
            내용입니다.
          </p>
          {canRestore ? (
            <form action={restoreDocumentRevision}>
              <input type="hidden" name="document_id" value={documentId} />
              <input
                type="hidden"
                name="revision_id"
                value={comparison.revision.id}
              />
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <RotateCcw size={15} aria-hidden />
                이 버전으로 복원
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
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
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(
    null,
  );
  const comparisons = useMemo<RevisionComparison[]>(
    () =>
      revisions.map((revision, index) => {
        const previousRevision = revisions[index + 1];
        const diff = lineDiff(
          previousRevision?.bodyMarkdown ?? "",
          revision.bodyMarkdown,
        );

        return {
          revision,
          diff,
          rows: buildSideBySideRows(diff),
          stats: diffStats(diff),
          isCurrentSnapshot: revision.bodyMarkdown === currentBody,
        };
      }),
    [currentBody, revisions],
  );
  const selectedComparison = comparisons.find(
    (comparison) => comparison.revision.id === selectedRevisionId,
  );

  return (
    <section
      className="rounded-md border border-slate-200 bg-white p-4"
      data-testid="revision-history"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitCompareArrows size={16} className="text-slate-500" aria-hidden />
          <h2 className="text-sm font-semibold text-slate-950">변경 이력</h2>
        </div>
        {comparisons.length ? (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
            {comparisons.length}개
          </span>
        ) : null}
      </div>

      {comparisons.length ? (
        <ol className="mt-3 space-y-3">
          {comparisons.map((comparison) => (
            <li
              key={comparison.revision.id}
              className="rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {comparison.revision.editSummary ||
                      comparison.revision.title}
                    {comparison.isCurrentSnapshot ? (
                      <span className="ml-2 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                        현재
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    제목 스냅샷: {comparison.revision.title}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    +{comparison.stats.added}
                  </span>
                  <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    -{comparison.stats.removed}
                  </span>
                </div>
              </div>

              {comparison.revision.summary ? (
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                  {comparison.revision.summary}
                </p>
              ) : null}
              <time className="mt-2 block text-xs text-slate-500">
                {formatDate(comparison.revision.createdAt)}
              </time>
              <p className="mt-1 text-xs text-slate-400">
                수정자:{" "}
                {comparison.revision.editedBy
                  ? comparison.revision.editedBy.slice(0, 8)
                  : "알 수 없음"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedRevisionId(comparison.revision.id)
                  }
                  className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <GitCompareArrows size={14} aria-hidden />
                  비교
                </button>
                {canRestore ? (
                  <form action={restoreDocumentRevision}>
                    <input
                      type="hidden"
                      name="document_id"
                      value={documentId}
                    />
                    <input
                      type="hidden"
                      name="revision_id"
                      value={comparison.revision.id}
                    />
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <RotateCcw size={14} aria-hidden />
                      복원
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Supabase 연결 후 수정 이력이 쌓입니다.
        </p>
      )}

      {selectedComparison ? (
        <RevisionDiffModal
          canRestore={canRestore}
          comparison={selectedComparison}
          documentId={documentId}
          onClose={() => setSelectedRevisionId(null)}
        />
      ) : null}
    </section>
  );
}
