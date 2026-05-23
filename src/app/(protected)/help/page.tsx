import {
  Archive,
  FilePenLine,
  Globe2,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";

import { SetupNotice } from "@/components/setup-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const contentSections = [
  {
    title: "기술 용어",
    body: "개념의 정의, 동작 방식, 실무 예시, 꼬리 질문을 정리합니다.",
  },
  {
    title: "면접 Q&A",
    body: "기술/인성 질문과 답변 Tip, 좋은 답변 흐름, 주의할 점을 남깁니다.",
  },
  {
    title: "상황 시뮬레이션",
    body: "서술형 상황 질문을 문제 이해, 해결 전략, 트레이드오프 중심으로 토론합니다.",
  },
];

const roleRows = [
  ["owner", "멤버 관리, 문서 작성/수정/복원, 이미지 업로드, 토론"],
  ["editor", "문서 작성/수정/복원, 이미지 업로드, 토론"],
  ["viewer", "문서 읽기와 토론 댓글 작성"],
];

export default async function HelpPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        {!configured ? <SetupNotice /> : null}

        <section>
          <h1 className="text-3xl font-semibold tracking-tight">
            DevWiki 도움말
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            DevWiki는 등록된 멤버만 접근하는 지식 베이스입니다. 공개 문서도
            인터넷에 공개되지 않고 전체 멤버에게만 보입니다.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {contentSections.map((section) => (
            <Card key={section.title}>
              <CardContent className="p-4">
                <h2 className="text-base font-semibold">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {section.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>문서 상태</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                <Globe2 size={18} className="text-teal-700" aria-hidden />
                <h3 className="mt-2 text-sm font-semibold text-teal-950">
                  공개
                </h3>
                <p className="mt-1 text-xs leading-5 text-teal-900">
                  전체 멤버의 기본 목록에 노출됩니다.
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <FilePenLine size={18} className="text-amber-700" aria-hidden />
                <h3 className="mt-2 text-sm font-semibold text-amber-950">
                  초안
                </h3>
                <p className="mt-1 text-xs leading-5 text-amber-900">
                  작성 중인 문서이며 멤버만 볼 수 있습니다.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/55 p-4">
                <Archive
                  size={18}
                  className="text-muted-foreground"
                  aria-hidden
                />
                <h3 className="mt-2 text-sm font-semibold">보관</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  기본 목록에서 숨기고 보관 필터에서만 확인합니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary" aria-hidden />
                권한 운영
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3">
                {roleRows.map(([role, description]) => (
                  <div
                    key={role}
                    className="grid gap-1 rounded-lg border bg-muted/35 p-3"
                  >
                    <dt className="font-mono text-sm font-semibold">{role}</dt>
                    <dd className="text-sm leading-6 text-muted-foreground">
                      {description}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare size={18} className="text-primary" aria-hidden />
                토론
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                문서마다 토론 영역이 있습니다. 질문의 의도, 더 좋은 답변 흐름,
                실제 면접에서 받은 꼬리 질문을 댓글로 남기고, 정리된 내용은
                editor 이상이 문서 본문에 반영합니다.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
