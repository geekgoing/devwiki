import { FileText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function EmptyState({
  canCreate,
  createHref = "/documents/new",
  query,
}: {
  canCreate: boolean;
  createHref?: string;
  query?: string;
}) {
  const isSearchEmpty = Boolean(query?.trim());

  return (
    <Card className="flex min-h-72 flex-col items-center justify-center border-dashed px-6 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileText size={20} aria-hidden />
      </span>
      <h2 className="mt-3 text-base font-semibold">
        {isSearchEmpty ? "검색 결과가 없습니다" : "아직 문서가 없습니다"}
      </h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {isSearchEmpty
          ? "다른 개념명, 요약, 태그로 다시 검색해보세요."
          : "첫 문서로 멱등성, 트랜잭션, 인덱스 같은 핵심 개념을 정리해보세요."}
      </p>
      {canCreate && !isSearchEmpty ? (
        <Button asChild className="mt-4" size="lg">
          <Link href={createHref}>새 문서 작성</Link>
        </Button>
      ) : null}
    </Card>
  );
}
