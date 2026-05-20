import { GitCompareArrows, RotateCcw } from "lucide-react";

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
          : Math.max(table[oldIndex + 1][newIndex], table[oldIndex][newIndex + 1]);
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

function diffClassName(type: DiffLine["type"]) {
  if (type === "added") {
    return "border-l-2 border-emerald-500 bg-emerald-50 text-emerald-950";
  }

  if (type === "removed") {
    return "border-l-2 border-rose-500 bg-rose-50 text-rose-950";
  }

  return "border-l-2 border-transparent text-slate-500";
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

function diffStats(diff: DiffLine[]) {
  return diff.reduce(
    (stats, line) => ({
      added: stats.added + (line.type === "added" ? 1 : 0),
      removed: stats.removed + (line.type === "removed" ? 1 : 0),
    }),
    { added: 0, removed: 0 },
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
          {revisions.map((revision, index) => {
            const previousRevision = revisions[index + 1];
            const diff = lineDiff(
              previousRevision?.bodyMarkdown ?? "",
              revision.bodyMarkdown,
            );
            const stats = diffStats(diff);
            const isCurrentSnapshot = revision.bodyMarkdown === currentBody;

            return (
              <li
                key={revision.id}
                className="border-l border-slate-200 pl-3"
              >
                <p className="text-sm font-medium text-slate-800">
                  {revision.editSummary || revision.title}
                  {isCurrentSnapshot ? (
                    <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                      현재
                    </span>
                  ) : null}
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
                  <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium text-slate-700">
                    이 변경에서 바뀐 내용
                    <span className="ml-2 text-emerald-700">+{stats.added}</span>
                    <span className="ml-1 text-rose-700">-{stats.removed}</span>
                  </summary>
                  <div
                    className="max-h-72 overflow-auto border-t border-slate-200 bg-white py-2 font-mono text-xs leading-5"
                    data-testid="revision-diff"
                  >
                    <div className="grid grid-cols-[3rem_3rem_1.5rem_minmax(0,1fr)] gap-2 border-b border-slate-100 px-2 pb-1 text-[11px] font-medium text-slate-400">
                      <span>이전</span>
                      <span>이후</span>
                      <span />
                      <span>내용</span>
                    </div>
                    {diff.slice(0, 240).map((line) => (
                      <div
                        key={line.id}
                        className={`grid grid-cols-[3rem_3rem_1.5rem_minmax(0,1fr)] gap-2 px-2 ${diffClassName(
                          line.type,
                        )}`}
                      >
                        <span className="select-none text-right text-slate-400">
                          {line.oldLine ?? ""}
                        </span>
                        <span className="select-none text-right text-slate-400">
                          {line.newLine ?? ""}
                        </span>
                        <span className="font-semibold">
                          {diffPrefix(line.type)}
                        </span>
                        <span className="whitespace-pre-wrap break-words">
                          {line.text || " "}
                        </span>
                      </div>
                    ))}
                    {diff.length > 240 ? (
                      <p className="px-2 pt-2 text-xs text-slate-500">
                        큰 diff는 앞 240줄만 표시합니다.
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
