"use client";

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import dynamic from "next/dynamic";
import { Edit3, Eye, Save, SplitSquareHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import type ReactCodeMirror from "@uiw/react-codemirror";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { slugify } from "@/lib/slugify";
import type { DocumentStatus } from "@/types/devwiki";

type CodeMirrorProps = React.ComponentProps<typeof ReactCodeMirror>;

const CodeMirror = dynamic<CodeMirrorProps>(
  () => import("@uiw/react-codemirror").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500">
        에디터 로딩 중
      </div>
    ),
  },
);

type DocumentEditorProps = {
  action: (formData: FormData) => void | Promise<void>;
  mode: "create" | "edit";
  initialDocument?: {
    id?: string;
    title?: string;
    slug?: string;
    summary?: string | null;
    bodyMarkdown?: string;
    status?: DocumentStatus;
    tags?: string;
  };
};

const starterMarkdown = `# 제목

## 한 줄 정의

## 면접 답변

## 핵심 개념

## 실무 예시

## 시각 자료
\`\`\`mermaid
flowchart LR
  A[개념] --> B[예시]
  B --> C[면접 답변]
\`\`\`

## 꼬리 질문

## 참고 자료
`;

export function DocumentEditor({
  action,
  mode,
  initialDocument,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(initialDocument?.title ?? "");
  const [slug, setSlug] = useState(initialDocument?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialDocument?.slug));
  const [body, setBody] = useState(
    initialDocument?.bodyMarkdown ?? starterMarkdown,
  );
  const [view, setView] = useState<"edit" | "preview" | "split">("split");
  const extensions = useMemo(
    () => [markdown({ base: markdownLanguage })],
    [],
  );

  return (
    <form action={action} className="space-y-5">
      {initialDocument?.id ? (
        <input type="hidden" name="id" value={initialDocument.id} />
      ) : null}
      <input type="hidden" name="body_markdown" value={body} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">제목</span>
            <input
              name="title"
              value={title}
              onChange={(event) => {
                const nextTitle = event.target.value;
                setTitle(nextTitle);

                if (!slugTouched) {
                  setSlug(slugify(nextTitle));
                }
              }}
              required
              className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="예: 멱등성"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">요약</span>
            <input
              name="summary"
              defaultValue={initialDocument?.summary ?? ""}
              className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="문서 목록에서 보일 짧은 설명"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">URL slug</span>
            <input
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
              className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="idempotency"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">상태</span>
            <select
              name="status"
              defaultValue={initialDocument?.status ?? "draft"}
              className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              <option value="draft">초안</option>
              <option value="published">공개</option>
              <option value="archived">보관</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">태그</span>
          <input
            name="tags"
            defaultValue={initialDocument?.tags ?? ""}
            className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            placeholder="HTTP, API 설계, 분산 시스템"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">수정 요약</span>
          <input
            name="edit_summary"
            className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            placeholder={mode === "create" ? "문서 생성" : "예: 예시 보강"}
          />
        </label>
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setView("edit")}
              className={`inline-flex h-8 items-center gap-2 rounded px-2 text-sm ${
                view === "edit"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <Edit3 size={15} aria-hidden />
              편집
            </button>
            <button
              type="button"
              onClick={() => setView("split")}
              className={`inline-flex h-8 items-center gap-2 rounded px-2 text-sm ${
                view === "split"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <SplitSquareHorizontal size={15} aria-hidden />
              분할
            </button>
            <button
              type="button"
              onClick={() => setView("preview")}
              className={`inline-flex h-8 items-center gap-2 rounded px-2 text-sm ${
                view === "preview"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <Eye size={15} aria-hidden />
              미리보기
            </button>
          </div>

          <button
            type="submit"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Save size={16} aria-hidden />
            저장
          </button>
        </div>

        <div
          className={
            view === "split"
              ? "grid min-h-[520px] lg:grid-cols-2"
              : "min-h-[520px]"
          }
        >
          {view !== "preview" ? (
            <div className="border-slate-200 lg:border-r">
              <CodeMirror
                value={body}
                height="520px"
                extensions={extensions}
                basicSetup={{
                  foldGutter: false,
                  highlightActiveLine: false,
                }}
                onChange={(value) => setBody(value)}
              />
            </div>
          ) : null}

          {view !== "edit" ? (
            <div className="max-h-[520px] overflow-auto p-5">
              <MarkdownRenderer content={body} />
            </div>
          ) : null}
        </div>
      </section>
    </form>
  );
}
