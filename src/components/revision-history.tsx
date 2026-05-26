"use client";

import { GitCompareArrows, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { restoreDocumentRevision } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import {
  buildSideBySideRows,
  diffStats,
  lineDiff,
  type DiffLine,
  type DiffRow,
  type DiffSide,
} from "@/lib/revision-diff";
import type { DocumentRevision } from "@/types/devwiki";

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

function diffSideClassName(type: DiffSide["type"]) {
  if (type === "added") {
    return "bg-teal-50 text-teal-950";
  }

  if (type === "removed") {
    return "bg-rose-50 text-rose-950";
  }

  if (type === "blank") {
    return "bg-muted/55 text-muted-foreground/55";
  }

  return "bg-background text-foreground";
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/55 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revision-diff-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="revision-diff-title" className="text-base font-semibold">
                {comparison.revision.editSummary || "변경 내용 비교"}
              </h3>
              {comparison.isCurrentSnapshot ? (
                <Badge variant="secondary">현재</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(comparison.revision.createdAt)} · 제목 스냅샷:{" "}
              {comparison.revision.title}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-teal-50 text-teal-700" variant="outline">
              +{comparison.stats.added}
            </Badge>
            <Badge className="bg-rose-50 text-rose-700" variant="outline">
              -{comparison.stats.removed}
            </Badge>
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              size="icon"
              aria-label="닫기"
            >
              <X size={16} aria-hidden />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b bg-muted/55 px-4 py-2 text-xs font-semibold text-muted-foreground">
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
              className="grid min-w-[920px] grid-cols-2 border-b"
            >
              {[row.before, row.after].map((side, sideIndex) => (
                <div
                  key={`${row.id}-${sideIndex}`}
                  className={`grid grid-cols-[3.75rem_minmax(0,1fr)] ${diffSideClassName(
                    side.type,
                  )}`}
                >
                  <span className="select-none border-r border-border px-2 py-1 text-right text-muted-foreground">
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
            <p className="px-4 py-3 text-xs text-muted-foreground">
              큰 diff는 앞 {visibleRows.length.toLocaleString("ko-KR")}줄만
              표시합니다.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/55 px-4 py-3 sm:px-5">
          <p className="text-xs text-muted-foreground">
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
              <Button type="submit">
                <RotateCcw size={15} aria-hidden />이 버전으로 복원
              </Button>
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
  const revisionItems = useMemo(
    () =>
      revisions.map((revision, index) => ({
        revision,
        previousBody: revisions[index + 1]?.bodyMarkdown ?? "",
        isCurrentSnapshot: revision.bodyMarkdown === currentBody,
      })),
    [currentBody, revisions],
  );
  const selectedRevisionItem = revisionItems.find(
    (item) => item.revision.id === selectedRevisionId,
  );
  const selectedComparison = useMemo<RevisionComparison | null>(() => {
    if (!selectedRevisionItem) {
      return null;
    }

    const diff = lineDiff(
      selectedRevisionItem.previousBody,
      selectedRevisionItem.revision.bodyMarkdown,
    );

    return {
      revision: selectedRevisionItem.revision,
      diff,
      rows: buildSideBySideRows(diff),
      stats: diffStats(diff),
      isCurrentSnapshot: selectedRevisionItem.isCurrentSnapshot,
    };
  }, [selectedRevisionItem]);

  return (
    <Card size="sm" data-testid="revision-history">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompareArrows
            size={16}
            className="text-muted-foreground"
            aria-hidden
          />
          변경 이력
        </CardTitle>
        {revisionItems.length ? (
          <CardAction>
            <Badge variant="secondary">{revisionItems.length}개</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {revisionItems.length ? (
          <ol className="space-y-3">
            {revisionItems.map((item) => (
              <li
                key={item.revision.id}
                className="rounded-lg border bg-muted/35 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {item.revision.editSummary || item.revision.title}
                      {item.isCurrentSnapshot ? (
                        <Badge
                          variant="secondary"
                          className="ml-2 h-5 align-middle text-[11px]"
                        >
                          현재
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      제목 스냅샷: {item.revision.title}
                    </p>
                  </div>
                </div>

                {item.revision.summary ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {item.revision.summary}
                  </p>
                ) : null}
                <time className="mt-2 block text-xs text-muted-foreground">
                  {formatDate(item.revision.createdAt)}
                </time>
                <p className="mt-1 text-xs text-muted-foreground">
                  수정자: {item.revision.editedByLabel ?? "알 수 없음"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => setSelectedRevisionId(item.revision.id)}
                    variant="outline"
                    size="sm"
                  >
                    <GitCompareArrows size={14} aria-hidden />
                    비교
                  </Button>
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
                        value={item.revision.id}
                      />
                      <Button type="submit" variant="outline" size="sm">
                        <RotateCcw size={14} aria-hidden />
                        복원
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            Supabase 연결 후 수정 이력이 쌓입니다.
          </p>
        )}
      </CardContent>

      {selectedComparison ? (
        <RevisionDiffModal
          canRestore={canRestore}
          comparison={selectedComparison}
          documentId={documentId}
          onClose={() => setSelectedRevisionId(null)}
        />
      ) : null}
    </Card>
  );
}
