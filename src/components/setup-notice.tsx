export function SetupNotice() {
  return (
    <section className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      <p className="font-medium">Supabase 연결 전 미리보기 모드입니다.</p>
      <p className="mt-1 text-sky-800">
        `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`과
        `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 넣고 SQL 마이그레이션을
        적용하면 실제 문서 저장이 활성화됩니다.
      </p>
    </section>
  );
}
