import { MessageSquare, RefreshCw, Save, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { updateMyProfile } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { MemberGate } from "@/components/member-gate";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { canEditContent, canManageMembers } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type MePageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

type RecentDocumentRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  updated_at: string;
};

type RecentCommentRow = {
  id: string;
  body: string;
  created_at: string;
  document: {
    slug: string;
    title: string;
  } | null;
};

type RawRecentCommentRow = Omit<RecentCommentRow, "document"> & {
  documents?:
    | {
        slug: string;
        title: string;
      }
    | {
        slug: string;
        title: string;
      }[]
    | null;
};

function loginHref(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}

async function getRecentDocuments(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, slug, title, status, updated_at")
    .or(`created_by.eq.${userId},updated_by.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RecentDocumentRow[];
}

async function getRecentComments(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, body, created_at, documents(slug, title)")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as RawRecentCommentRow[]).map((row) => ({
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    document: Array.isArray(row.documents)
      ? (row.documents[0] ?? null)
      : (row.documents ?? null),
  }));
}

export default async function MePage({ searchParams }: MePageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();

  if (configured && !user) {
    redirect(loginHref("/me"));
  }

  if (configured && user && !member) {
    return (
      <>
        <AppHeader configured={configured} canCreate={false} user={user} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <MemberGate user={user} />
        </main>
      </>
    );
  }

  const [recentDocuments, recentComments] =
    configured && user && member
      ? await Promise.all([
          getRecentDocuments(user.id),
          getRecentComments(user.id),
        ])
      : [[], []];

  return (
    <>
      <AppHeader
        configured={configured}
        canCreate={canEditContent(member)}
        canManageMembers={canManageMembers(member)}
        member={member}
        user={user}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6">
          {!configured ? <SetupNotice /> : null}

          <section>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              마이페이지
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              닉네임과 내 최근 활동을 확인합니다.
            </p>
          </section>

          {params.notice === "profile" ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              닉네임을 저장했습니다.
            </p>
          ) : null}

          {member && user ? (
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
                <div className="flex items-center gap-2">
                  <UserRound size={18} className="text-blue-600" aria-hidden />
                  <h2 className="text-lg font-semibold text-slate-950">
                    프로필
                  </h2>
                </div>

                <form action={updateMyProfile} className="mt-5 grid gap-3">
                  <label>
                    <span className="text-sm font-medium text-slate-700">
                      닉네임
                    </span>
                    <input
                      name="display_name"
                      defaultValue={member.displayName ?? ""}
                      required
                      minLength={2}
                      maxLength={40}
                      className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
                    >
                      <Save size={16} aria-hidden />
                      저장
                    </button>
                  </div>
                </form>

                <form action={updateMyProfile} className="mt-2">
                  <input type="hidden" name="randomize" value="1" />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <RefreshCw size={16} aria-hidden />
                    랜덤 닉네임으로 변경
                  </button>
                </form>
              </article>

              <aside className="rounded-md border border-slate-200 bg-white p-5 text-sm shadow-sm shadow-slate-200/50">
                <dl className="grid gap-3">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">이메일</dt>
                    <dd className="mt-1 text-slate-950">{user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">role</dt>
                    <dd className="mt-1 font-mono text-slate-950">
                      {member.role}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">멤버 등록</dt>
                    <dd className="mt-1 text-slate-950">
                      {formatDate(member.createdAt)}
                    </dd>
                  </div>
                </dl>
              </aside>
            </section>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
              <h2 className="text-lg font-semibold text-slate-950">
                최근 작성/수정 문서
              </h2>
              {recentDocuments.length ? (
                <ol className="mt-4 grid gap-2">
                  {recentDocuments.map((document) => (
                    <li key={document.id}>
                      <Link
                        href={`/documents/${encodeURIComponent(document.slug)}`}
                        className="block rounded-md border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <span className="block text-sm font-medium text-slate-950">
                          {document.title}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {document.status} · {formatDate(document.updated_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  아직 직접 작성하거나 수정한 문서가 없습니다.
                </p>
              )}
            </article>

            <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-600" aria-hidden />
                <h2 className="text-lg font-semibold text-slate-950">
                  최근 댓글
                </h2>
              </div>
              {recentComments.length ? (
                <ol className="mt-4 grid gap-2">
                  {recentComments.map((comment) => (
                    <li key={comment.id}>
                      <Link
                        href={
                          comment.document
                            ? `/documents/${encodeURIComponent(
                                comment.document.slug,
                              )}`
                            : "/"
                        }
                        className="block rounded-md border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <span className="line-clamp-2 block text-sm leading-6 text-slate-700">
                          {comment.body}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {comment.document?.title ?? "삭제된 문서"} ·{" "}
                          {formatDate(comment.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  아직 남긴 댓글이 없습니다.
                </p>
              )}
            </article>
          </section>
        </div>
      </main>
    </>
  );
}
