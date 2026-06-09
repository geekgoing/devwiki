"use client";

import { GitCompareArrows, RotateCcw, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import {
  buildSideBySideRows,
  diffStats,
  lineDiff,
  type DiffRow,
  type DiffSide,
} from "@/lib/revision-diff";
import { cn } from "@/lib/utils";
import type { DocumentRevision } from "@/types/devwiki";

type RevisionComparison = {
  revision: DocumentRevision;
  rows: DiffRow[];
  stats: {
    added: number;
    removed: number;
  };
  isCurrentSnapshot: boolean;
};

type RevisionItem = {
  revision: DocumentRevision;
  previousBody: string;
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

function RestoreRevisionForm({
  documentId,
  revision,
}: {
  documentId: string;
  revision: DocumentRevision;
}) {
  function confirmRestore(event: FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `"${revision.title}" 스냅샷으로 문서를 복원할까요?\n\n현재 제목, 요약, 본문이 선택한 이력의 내용으로 바뀝니다.`,
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form action={restoreDocumentRevision} onSubmit={confirmRestore}>
      <input type="hidden" name="document_id" value={documentId} />
      <input type="hidden" name="revision_id" value={revision.id} />
      <Button type="submit">
        <RotateCcw size={15} aria-hidden />
        복원
      </Button>
    </form>
  );
}

function RevisionDiffDialog({
  canRestore,
  comparison,
  documentId,
  onOpenChange,
  open,
}: {
  canRestore: boolean;
  comparison: RevisionComparison | null;
  documentId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  if (!comparison) {
    return null;
  }

  const visibleRows = comparison.rows.slice(0, 700);
  const currentLabel = comparison.isCurrentSnapshot ? "현재 문서" : "선택 스냅샷";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[80] max-h-[84vh] w-[min(1120px,calc(100vw-2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:p-0"
        data-testid="revision-diff-dialog"
        showCloseButton={false}
      >
        <DialogHeader className="border-b bg-card px-4 py-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="min-w-0">
              <DialogTitle className="line-clamp-2 text-base">
                {comparison.revision.editSummary || "변경 내용 비교"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-5">
                {formatDate(comparison.revision.createdAt)} · 제목 스냅샷:{" "}
                {comparison.revision.title} · 수정자:{" "}
                {comparison.revision.editedByLabel ?? "알 수 없음"}
              </DialogDescription>
            </div>

            <div className="flex shrink-0 items-start justify-between gap-2 sm:justify-end">
              <div className="flex flex-wrap justify-end gap-1.5">
                <Badge
                  className="border-teal-200 bg-teal-50 text-teal-700"
                  variant="outline"
                >
                  +{comparison.stats.added}줄
                </Badge>
                <Badge
                  className="border-rose-200 bg-rose-50 text-rose-700"
                  variant="outline"
                >
                  -{comparison.stats.removed}줄
                </Badge>
              </div>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="닫기"
                >
                  <X size={15} aria-hidden />
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-auto bg-background" data-testid="revision-diff">
          <div className="min-w-[980px] font-mono text-xs leading-5">
            <div className="sticky top-0 z-10 grid grid-cols-2 border-b font-sans text-xs font-semibold">
              <div className="bg-rose-50/80 px-4 py-2 text-rose-800">
                Before
                <span className="ml-2 font-normal text-rose-700/80">
                  이전 스냅샷
                </span>
              </div>
              <div className="border-l-2 border-l-foreground/25 bg-teal-50/80 px-4 py-2 text-teal-800">
                After
                <span className="ml-2 font-normal text-teal-700/80">
                  {currentLabel}
                </span>
              </div>
            </div>

            {visibleRows.map((row) => (
              <div key={row.id} className="grid grid-cols-2 border-b">
                {[row.before, row.after].map((side, sideIndex) => (
                  <div
                    key={`${row.id}-${sideIndex}`}
                    className={cn(
                      "grid grid-cols-[3.75rem_minmax(0,1fr)]",
                      sideIndex === 1 && "border-l-2 border-l-foreground/25",
                      diffSideClassName(side.type),
                    )}
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
          </div>
        </div>

        <DialogFooter className="items-center justify-between border-t bg-muted/35 px-4 py-3 sm:flex-row sm:px-5">
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
            붉은 줄은 이전 스냅샷에서 제거된 내용, 초록 줄은 선택한 스냅샷에
            추가된 내용입니다.
            {comparison.rows.length > visibleRows.length
              ? ` 큰 diff는 앞 ${visibleRows.length.toLocaleString("ko-KR")}줄만 표시합니다.`
              : ""}
          </p>
          {canRestore && !comparison.isCurrentSnapshot ? (
            <RestoreRevisionForm
              documentId={documentId}
              revision={comparison.revision}
            />
          ) : comparison.isCurrentSnapshot ? (
            <p className="text-xs text-muted-foreground">
              현재 문서와 같은 스냅샷이라 복원할 필요가 없습니다.
            </p>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevisionListItem({
  item,
  onCompare,
}: {
  item: RevisionItem;
  onCompare: () => void;
}) {
  return (
    <li className="rounded-lg border bg-muted/35 p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="line-clamp-2 text-sm font-medium">
            {item.revision.editSummary || item.revision.title}
          </p>
          {item.isCurrentSnapshot ? (
            <Badge variant="secondary">현재</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDate(item.revision.createdAt)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          수정자: {item.revision.editedByLabel ?? "알 수 없음"}
        </p>
      </div>

      {item.revision.summary ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {item.revision.summary}
        </p>
      ) : null}

      <Button
        type="button"
        onClick={onCompare}
        variant="outline"
        size="sm"
        className="mt-3 w-full"
      >
        <GitCompareArrows size={14} aria-hidden />
        비교
      </Button>
    </li>
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
  const currentRevisionId = useMemo(
    () =>
      revisions.find((revision) => revision.bodyMarkdown === currentBody)?.id ??
      null,
    [currentBody, revisions],
  );
  const revisionItems = useMemo(
    () =>
      revisions.map((revision, index) => ({
        revision,
        previousBody: revisions[index + 1]?.bodyMarkdown ?? "",
        isCurrentSnapshot: revision.id === currentRevisionId,
      })),
    [currentRevisionId, revisions],
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
          <ol className="grid max-h-[560px] gap-3 overflow-auto pr-1">
            {revisionItems.map((item) => (
              <RevisionListItem
                key={item.revision.id}
                item={item}
                onCompare={() => setSelectedRevisionId(item.revision.id)}
              />
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            Supabase 연결 후 수정 이력이 쌓입니다.
          </p>
        )}
      </CardContent>

      <RevisionDiffDialog
        canRestore={canRestore}
        comparison={selectedComparison}
        documentId={documentId}
        open={Boolean(selectedComparison)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRevisionId(null);
          }
        }}
      />
    </Card>
  );
}
