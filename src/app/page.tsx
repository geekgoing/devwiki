import { FileText, Search } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { MemberGate } from "@/components/member-gate";
import { SetupNotice } from "@/components/setup-notice";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocuments } from "@/lib/documents";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type HomeProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const canRead = !configured || Boolean(user && member);
  const documents = canRead ? await getDocuments(query) : [];

  return (
    <>
      <AppHeader configured={configured} canCreate={Boolean(member)} user={user} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6">
          {!configured ? <SetupNotice /> : null}

          {configured && !user ? (
            <section className="rounded-md border border-slate-200 bg-white px-5 py-6">
              <h1 className="text-xl font-semibold text-slate-950">
                로그인 후 DevWiki를 사용할 수 있습니다
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Supabase의 study_members 테이블에 등록된 이메일만 문서를 읽고
                수정할 수 있습니다.
              </p>
              <Link
                href="/login"
                className="mt-4 inline-flex h-9 items-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                이메일로 로그인
              </Link>
            </section>
          ) : configured && user && !member ? (
            <MemberGate user={user} />
          ) : (
            <>
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                    백엔드 면접 개념 사전
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    스터디원이 함께 기술 개념, 면접 답변, 꼬리 질문, 시각
                    자료를 축적하는 협업형 위키입니다.
                  </p>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                      <FileText size={20} aria-hidden />
                    </span>
                    <div>
                      <p className="text-2xl font-semibold text-slate-950">
                        {documents.length}
                      </p>
                      <p className="text-xs text-slate-500">검색 결과 문서</p>
                    </div>
                  </div>
                </div>
              </section>

              <form action="/" className="relative max-w-xl">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="개념, 태그, 요약으로 검색"
                  className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </form>

              {documents.length ? (
                <section className="grid gap-3">
                  {documents.map((document) => (
                    <Link
                      key={document.id}
                      href={`/documents/${document.slug}`}
                      className="rounded-md border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold text-slate-950">
                              {document.title}
                            </h2>
                            <StatusBadge status={document.status} />
                          </div>
                          {document.summary ? (
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                              {document.summary}
                            </p>
                          ) : null}
                        </div>
                        <time className="text-xs text-slate-500">
                          {formatDate(document.updatedAt)}
                        </time>
                      </div>

                      {document.tags.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {document.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </Link>
                  ))}
                </section>
              ) : (
                <EmptyState canCreate={Boolean(member)} query={query} />
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
