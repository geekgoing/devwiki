import { Search } from "lucide-react";

import { DocumentFilterToolbar } from "@/components/document-filter-toolbar";
import { DocumentListCard } from "@/components/document-list-card";
import { EmptyState } from "@/components/empty-state";
import { SetupNotice } from "@/components/setup-notice";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  parseInterviewCategory,
  parseLearningFilter,
  parseStatusFilter,
} from "@/lib/content-routes";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocuments } from "@/lib/documents";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type SearchPageProps = {
  searchParams: Promise<{
    category?: string;
    learning?: string;
    q?: string;
    status?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const interviewCategory = parseInterviewCategory(params.category);
  const learning = parseLearningFilter(params.learning);
  const status = parseStatusFilter(params.status);
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();
  const canReadPrivate = !configured || Boolean(member);
  const hasAnyFilter =
    Boolean(query) ||
    Boolean(interviewCategory) ||
    learning !== "all" ||
    status !== "active";
  const documents = hasAnyFilter
    ? await getDocuments({
        interviewCategory,
        learning,
        query,
        status,
        canReadPrivate,
        viewerId: user?.id,
      })
    : [];
  const title = query ? `"${query}" 검색 결과` : "문서 검색";

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-5">
        {!configured ? <SetupNotice /> : null}

        <Card>
          <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
              <CardDescription>
                {hasAnyFilter
                  ? `${documents.length}개 문서`
                  : "기술 용어, 면접 Q&A, 상황 시뮬레이션을 한 번에 검색합니다."}
              </CardDescription>
            </div>
            <DocumentFilterToolbar
              basePath="/search"
              category={interviewCategory}
              learning={learning}
              query={query}
              status={status}
            />
          </CardHeader>

          <CardContent>
            <form action="/search" className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              {interviewCategory ? (
                <input
                  type="hidden"
                  name="category"
                  value={interviewCategory}
                />
              ) : null}
              {learning !== "all" ? (
                <input type="hidden" name="learning" value={learning} />
              ) : null}
              {status !== "active" ? (
                <input type="hidden" name="status" value={status} />
              ) : null}
              <Input
                name="q"
                defaultValue={query}
                placeholder="개념, 질문, 상황, 태그 검색"
                className="h-11 pl-10"
              />
            </form>
          </CardContent>
        </Card>

        {hasAnyFilter ? (
          documents.length ? (
            <section className="grid gap-4">
              {documents.map((document) => (
                <DocumentListCard
                  key={document.id}
                  document={document}
                  showContentType
                />
              ))}
            </section>
          ) : (
            <EmptyState canCreate={false} query={query || "filter"} />
          )
        ) : (
          <section className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 text-center">
            <Search size={28} className="text-muted-foreground" aria-hidden />
            <h2 className="mt-3 text-base font-semibold">
              검색어를 입력하세요
            </h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              예: MSA, 트랜잭션, 브라우저 URL 입력, 피드백
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
