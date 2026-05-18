import { FileText } from "lucide-react";
import Link from "next/link";

export function EmptyState({
  canCreate,
  query,
}: {
  canCreate: boolean;
  query?: string;
}) {
  const isSearchEmpty = Boolean(query?.trim());

  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white px-6 text-center">
      <FileText size={28} className="text-slate-400" aria-hidden />
      <h2 className="mt-3 text-base font-semibold text-slate-950">
        {isSearchEmpty ? "검색 결과가 없습니다" : "아직 문서가 없습니다"}
      </h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
        {isSearchEmpty
          ? "다른 개념명, 요약, 태그로 다시 검색해보세요."
          : "첫 문서로 멱등성, 트랜잭션, 인덱스 같은 핵심 개념을 정리해보세요."}
      </p>
      {canCreate && !isSearchEmpty ? (
        <Link
          href="/documents/new"
          className="mt-4 inline-flex h-9 items-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          새 문서 작성
        </Link>
      ) : null}
    </div>
  );
}
