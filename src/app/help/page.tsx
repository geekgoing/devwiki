import {
  Archive,
  FilePenLine,
  Globe2,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { redirect } from "next/navigation";

import { MemberGate } from "@/components/member-gate";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
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

function loginHref(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}

export default async function HelpPage() {
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();

  if (configured && !user) {
    redirect(loginHref("/help"));
  }

  if (configured && user && !member) {
    return (
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <MemberGate user={user} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6">
          {!configured ? <SetupNotice /> : null}

          <section>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              DevWiki 도움말
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              DevWiki는 등록된 멤버만 접근하는 지식 베이스입니다. 공개 문서도
              인터넷에 공개되지 않고 전체 멤버에게만 보입니다.
            </p>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            {contentSections.map((section) => (
              <article
                key={section.title}
                className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
              >
                <h2 className="text-base font-semibold text-slate-950">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {section.body}
                </p>
              </article>
            ))}
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
            <h2 className="text-lg font-semibold text-slate-950">문서 상태</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <Globe2 size={18} className="text-emerald-700" aria-hidden />
                <h3 className="mt-2 text-sm font-semibold text-emerald-950">
                  공개
                </h3>
                <p className="mt-1 text-xs leading-5 text-emerald-900">
                  전체 멤버의 기본 목록에 노출됩니다.
                </p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                <FilePenLine size={18} className="text-amber-700" aria-hidden />
                <h3 className="mt-2 text-sm font-semibold text-amber-950">
                  초안
                </h3>
                <p className="mt-1 text-xs leading-5 text-amber-900">
                  작성 중인 문서이며 멤버만 볼 수 있습니다.
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <Archive size={18} className="text-slate-600" aria-hidden />
                <h3 className="mt-2 text-sm font-semibold text-slate-950">
                  보관
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  기본 목록에서 숨기고 보관 필터에서만 확인합니다.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-600" aria-hidden />
                <h2 className="text-lg font-semibold text-slate-950">
                  권한 운영
                </h2>
              </div>
              <dl className="mt-4 grid gap-3">
                {roleRows.map(([role, description]) => (
                  <div
                    key={role}
                    className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-3"
                  >
                    <dt className="font-mono text-sm font-semibold text-slate-950">
                      {role}
                    </dt>
                    <dd className="text-sm leading-6 text-slate-600">
                      {description}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>

            <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-600" aria-hidden />
                <h2 className="text-lg font-semibold text-slate-950">토론</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                문서마다 토론 영역이 있습니다. 질문의 의도, 더 좋은 답변 흐름,
                실제 면접에서 받은 꼬리 질문을 댓글로 남기고, 정리된 내용은
                editor 이상이 문서 본문에 반영합니다.
              </p>
            </article>
          </section>
        </div>
    </main>
  );
}
