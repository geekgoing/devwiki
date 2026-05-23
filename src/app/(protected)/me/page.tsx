import {
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  Save,
  Star,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { updateMyProfile } from "@/app/actions";
import { SetupNotice } from "@/components/setup-notice";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { documentDetailPath, parseContentType } from "@/lib/content-routes";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DocumentStatus } from "@/types/devwiki";

type MePageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

type RecentDocumentRow = {
  content_type: string | null;
  id: string;
  slug: string;
  title: string;
  status: DocumentStatus;
  updated_at: string;
};

type RecentCommentRow = {
  id: string;
  body: string;
  created_at: string;
  document: {
    content_type: string | null;
    slug: string;
    title: string;
  } | null;
};

type LearningDocumentRow = {
  document: {
    content_type: string;
    slug: string;
    title: string;
  } | null;
  document_id: string;
  is_completed: boolean;
  is_favorite: boolean;
  updated_at: string;
};

type RawRecentCommentRow = Omit<RecentCommentRow, "document"> & {
  documents?:
    | {
        content_type: string | null;
        slug: string;
        title: string;
      }
    | {
        content_type: string | null;
        slug: string;
        title: string;
      }[]
    | null;
};

type RawLearningDocumentRow = Omit<LearningDocumentRow, "document"> & {
  documents?:
    | {
        content_type: string;
        slug: string;
        title: string;
      }
    | {
        content_type: string;
        slug: string;
        title: string;
      }[]
    | null;
};

function documentHref(document: {
  content_type?: string | null;
  slug: string;
}) {
  return documentDetailPath({
    contentType: parseContentType(document.content_type ?? undefined),
    slug: document.slug,
  });
}

async function getRecentDocuments(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, slug, title, status, content_type, updated_at")
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
    .select("id, body, created_at, documents(slug, title, content_type)")
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

async function getLearningDocuments(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_member_states")
    .select(
      "document_id, is_favorite, is_completed, updated_at, documents(slug, title, content_type)",
    )
    .eq("user_id", userId)
    .or("is_favorite.eq.true,is_completed.eq.true")
    .order("updated_at", { ascending: false })
    .limit(8);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as RawLearningDocumentRow[]).map((row) => ({
    document: Array.isArray(row.documents)
      ? (row.documents[0] ?? null)
      : (row.documents ?? null),
    document_id: row.document_id,
    is_completed: row.is_completed,
    is_favorite: row.is_favorite,
    updated_at: row.updated_at,
  }));
}

export default async function MePage({ searchParams }: MePageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();

  const [recentDocuments, recentComments, learningDocuments] =
    configured && user && member
      ? await Promise.all([
          getRecentDocuments(user.id),
          getRecentComments(user.id),
          getLearningDocuments(user.id),
        ])
      : [[], [], []];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        {!configured ? <SetupNotice /> : null}

        <section>
          <h1 className="text-3xl font-semibold tracking-tight">마이페이지</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            닉네임과 내 최근 활동을 확인합니다.
          </p>
        </section>

        {params.notice === "profile" ? (
          <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
            닉네임을 저장했습니다.
          </p>
        ) : null}

        {member && user ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserRound size={18} className="text-primary" aria-hidden />
                  프로필
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={updateMyProfile} className="mt-5 grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="display_name">닉네임</Label>
                    <Input
                      id="display_name"
                      name="display_name"
                      defaultValue={member.displayName ?? ""}
                      required
                      minLength={2}
                      maxLength={40}
                      className="h-11"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit">
                      <Save size={16} aria-hidden />
                      저장
                    </Button>
                  </div>
                </form>

                <form action={updateMyProfile} className="mt-2">
                  <input type="hidden" name="randomize" value="1" />
                  <Button type="submit" variant="outline">
                    <RefreshCw size={16} aria-hidden />
                    랜덤 닉네임으로 변경
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <dl className="grid gap-3">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      이메일
                    </dt>
                    <dd className="mt-1">{user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      role
                    </dt>
                    <dd className="mt-1">
                      <Badge variant="secondary">{member.role}</Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      멤버 등록
                    </dt>
                    <dd className="mt-1">{formatDate(member.createdAt)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>내 학습 상태</CardTitle>
              <CardAction className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/search?learning=favorite">
                    <Star size={13} aria-hidden />
                    즐겨찾기
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/search?learning=completed">
                    <CheckCircle2 size={13} aria-hidden />
                    숙지함
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {learningDocuments.length ? (
                <ol className="grid gap-2 md:grid-cols-2">
                  {learningDocuments.map((item) => (
                    <li key={item.document_id}>
                      <Link
                        href={item.document ? documentHref(item.document) : "/"}
                        className="block rounded-lg border bg-muted/35 px-3 py-2 transition hover:border-primary/25 hover:bg-accent/60"
                      >
                        <span className="block text-sm font-medium">
                          {item.document?.title ?? "삭제된 문서"}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {item.is_favorite ? (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-700"
                            >
                              <Star
                                size={12}
                                className="fill-current"
                                aria-hidden
                              />
                              즐겨찾기
                            </Badge>
                          ) : null}
                          {item.is_completed ? (
                            <Badge
                              variant="outline"
                              className="border-teal-200 bg-teal-50 text-teal-700"
                            >
                              <CheckCircle2 size={12} aria-hidden />
                              숙지함
                            </Badge>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  아직 즐겨찾기하거나 숙지 완료한 문서가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>최근 작성/수정 문서</CardTitle>
            </CardHeader>
            <CardContent>
              {recentDocuments.length ? (
                <ol className="grid gap-2">
                  {recentDocuments.map((document) => (
                    <li key={document.id}>
                      <Link
                        href={documentHref(document)}
                        className="block rounded-lg border bg-muted/35 px-3 py-2 transition hover:border-primary/25 hover:bg-accent/60"
                      >
                        <span className="block text-sm font-medium">
                          {document.title}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <StatusBadge status={document.status} />
                          {formatDate(document.updated_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  아직 직접 작성하거나 수정한 문서가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare size={18} className="text-primary" aria-hidden />
                최근 댓글
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentComments.length ? (
                <ol className="grid gap-2">
                  {recentComments.map((comment) => (
                    <li key={comment.id}>
                      <Link
                        href={
                          comment.document
                            ? documentHref(comment.document)
                            : "/"
                        }
                        className="block rounded-lg border bg-muted/35 px-3 py-2 transition hover:border-primary/25 hover:bg-accent/60"
                      >
                        <span className="line-clamp-2 block text-sm leading-6">
                          {comment.body}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {comment.document?.title ?? "삭제된 문서"} ·{" "}
                          {formatDate(comment.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  아직 남긴 댓글이 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
