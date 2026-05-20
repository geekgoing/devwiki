"use client";

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { redo, undo } from "@codemirror/commands";
import dynamic from "next/dynamic";
import {
  Bold,
  Code2,
  Edit3,
  Eye,
  Heading2,
  ImagePlus,
  Link2,
  List,
  Loader2,
  Pilcrow,
  Quote,
  Redo2,
  RotateCcw,
  Save,
  Settings2,
  SplitSquareHorizontal,
  Table2,
  Trash2,
  Undo2,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type ReactCodeMirror from "@uiw/react-codemirror";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { slugify, toTagSlug } from "@/lib/slugify";
import type { DocumentStatus } from "@/types/devwiki";

type CodeMirrorProps = React.ComponentProps<typeof ReactCodeMirror>;
type EditorViewInstance = Parameters<
  NonNullable<CodeMirrorProps["onCreateEditor"]>
>[0];

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

type EditorDraft = {
  title: string;
  slug: string;
  summary: string;
  body: string;
  status: DocumentStatus;
  tags: string;
  editSummary: string;
  savedAt: number;
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

const quickSections = [
  {
    label: "정의",
    markdown: "## 한 줄 정의\n\n",
  },
  {
    label: "면접 답변",
    markdown: "## 면접 답변\n\n",
  },
  {
    label: "실무 예시",
    markdown: "## 실무 예시\n\n",
  },
  {
    label: "꼬리 질문",
    markdown: "## 꼬리 질문\n\n",
  },
];

const toolGroupClass =
  "flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1";
const toolButtonClass =
  "inline-flex size-8 items-center justify-center rounded text-slate-600 transition hover:bg-slate-100 hover:text-slate-950";

const statusDescriptions: Record<DocumentStatus, string> = {
  draft: "로그인한 멤버에게만 노출됩니다.",
  published: "비로그인 사용자도 읽을 수 있습니다.",
  archived: "기본 목록에서는 숨기고 보관 필터에서만 봅니다.",
};

function FieldLabel({
  children,
  optional = false,
}: {
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <span className="flex items-center justify-between gap-2 text-sm font-medium text-slate-700">
      <span>{children}</span>
      {optional ? (
        <span className="text-xs font-normal text-slate-400">선택</span>
      ) : null}
    </span>
  );
}

function parseTagNames(value = "") {
  const uniqueTags = new Map<string, string>();

  value
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .forEach((tag) => {
      const key = toTagSlug(tag);

      if (key && !uniqueTags.has(key)) {
        uniqueTags.set(key, tag);
      }
    });

  return Array.from(uniqueTags.values());
}

export function DocumentEditor({
  action,
  mode,
  initialDocument,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(initialDocument?.title ?? "");
  const [slug, setSlug] = useState(initialDocument?.slug ?? "");
  const [summary, setSummary] = useState(initialDocument?.summary ?? "");
  const [status, setStatus] = useState<DocumentStatus>(
    initialDocument?.status ?? "draft",
  );
  const [tags, setTags] = useState(initialDocument?.tags ?? "");
  const [tagInput, setTagInput] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [body, setBody] = useState(
    initialDocument?.bodyMarkdown ?? starterMarkdown,
  );
  const [view, setView] = useState<"edit" | "preview" | "split">("split");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [storedDraft, setStoredDraft] = useState<EditorDraft | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const editorViewRef = useRef<EditorViewInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftKey = useMemo(
    () =>
      `devwiki:draft:${mode}:${initialDocument?.id ?? initialDocument?.slug ?? "new"}`,
    [initialDocument?.id, initialDocument?.slug, mode],
  );
  const extensions = useMemo(
    () => [markdown({ base: markdownLanguage })],
    [],
  );
  const tagNames = useMemo(() => parseTagNames(tags), [tags]);
  const submittedTagNames = useMemo(
    () => parseTagNames([...tagNames, tagInput].join(",")),
    [tagInput, tagNames],
  );
  const submittedTags = useMemo(
    () => submittedTagNames.join(", "),
    [submittedTagNames],
  );

  function markDirty() {
    setIsDirty(true);
  }

  useEffect(() => {
    const rawDraft = window.localStorage.getItem(draftKey);
    let timeoutId: number | null = null;

    if (!rawDraft) {
      return;
    }

    try {
      const parsed = JSON.parse(rawDraft) as EditorDraft;

      if (parsed.body || parsed.title) {
        timeoutId = window.setTimeout(() => setStoredDraft(parsed), 0);
      }
    } catch {
      window.localStorage.removeItem(draftKey);
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [draftKey]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const draft: EditorDraft = {
        title,
        slug,
        summary,
        body,
        status,
        tags: submittedTags,
        editSummary,
        savedAt: Date.now(),
      };

      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      setStoredDraft(null);
      setDraftMessage(
        `로컬 초안 저장됨 ${new Intl.DateTimeFormat("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(draft.savedAt)}`,
      );
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [
    body,
    draftKey,
    editSummary,
    isDirty,
    slug,
    status,
    submittedTags,
    summary,
    title,
  ]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function insertMarkdown(markdownText: string) {
    const view = editorViewRef.current;
    markDirty();

    if (!view) {
      setBody((current) => `${current.trimEnd()}\n\n${markdownText}\n`);
      return;
    }

    const selection = view.state.selection.main;
    const current = view.state.doc.toString();
    const before = current.slice(0, selection.from);
    const after = current.slice(selection.to);
    const prefix = before.endsWith("\n") || before.length === 0 ? "" : "\n\n";
    const suffix = after.startsWith("\n") || after.length === 0 ? "" : "\n\n";
    const insertion = `${prefix}${markdownText}${suffix}`;

    view.dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: insertion,
      },
      selection: {
        anchor: selection.from + insertion.length,
      },
    });
    setBody(view.state.doc.toString());
    view.focus();
  }

  function replaceSelection(
    createText: (selected: string) => { text: string; cursorOffset?: number },
  ) {
    const view = editorViewRef.current;
    markDirty();

    if (!view) {
      const { text } = createText("");
      setBody((current) => `${current.trimEnd()}\n\n${text}\n`);
      return;
    }

    const selection = view.state.selection.main;
    const selected = view.state.sliceDoc(selection.from, selection.to);
    const { text, cursorOffset } = createText(selected);

    view.dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: text,
      },
      selection: {
        anchor: selection.from + (cursorOffset ?? text.length),
      },
    });
    setBody(view.state.doc.toString());
    view.focus();
  }

  function wrapSelection(prefix: string, suffix: string, fallback: string) {
    replaceSelection((selected) => {
      const value = selected || fallback;

      return {
        text: `${prefix}${value}${suffix}`,
        cursorOffset: selected ? undefined : prefix.length + value.length,
      };
    });
  }

  function runEditorCommand(
    command: (view: EditorViewInstance) => boolean,
  ) {
    const view = editorViewRef.current;

    if (!view) {
      return;
    }

    const handled = command(view);

    if (handled) {
      setBody(view.state.doc.toString());
      markDirty();
    }

    view.focus();
  }

  function setTagNames(nextTags: string[]) {
    setTags(nextTags.join(", "));
    markDirty();
  }

  function commitTagInput(rawValue = tagInput) {
    const nextTags = parseTagNames([...tagNames, rawValue].join(","));

    setTags(nextTags.join(", "));
    setTagInput("");

    if (rawValue.trim()) {
      markDirty();
    }
  }

  function removeTag(targetTag: string) {
    setTagNames(tagNames.filter((tag) => tag !== targetTag));
  }

  function handleTagInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;

    if (/[,，\n]/.test(nextValue)) {
      commitTagInput(nextValue.replace(/，/g, ","));
      return;
    }

    setTagInput(nextValue);

    if (nextValue.trim()) {
      markDirty();
    }
  }

  function handleTagInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitTagInput();
      return;
    }

    if (event.key === "Backspace" && !tagInput && tagNames.length) {
      event.preventDefault();
      setTagNames(tagNames.slice(0, -1));
    }
  }

  function restoreDraft(draft: EditorDraft) {
    setTitle(draft.title);
    setSlug(draft.slug);
    setSummary(draft.summary);
    setBody(draft.body);
    setStatus(draft.status);
    setTags(draft.tags);
    setEditSummary(draft.editSummary);
    setStoredDraft(null);
    setIsDirty(true);
    setDraftMessage("로컬 초안을 복원했습니다.");
  }

  function discardDraft() {
    window.localStorage.removeItem(draftKey);
    setStoredDraft(null);
    setDraftMessage("로컬 초안을 삭제했습니다.");
  }

  function firstImageFile(files: FileList | File[]) {
    return Array.from(files).find((file) => file.type.startsWith("image/"));
  }

  function handlePaste(event: React.ClipboardEvent) {
    const file = firstImageFile(event.clipboardData.files);

    if (!file) {
      return;
    }

    event.preventDefault();
    void uploadImage(file);
  }

  function handleDrop(event: React.DragEvent) {
    const file = firstImageFile(event.dataTransfer.files);

    if (!file) {
      return;
    }

    event.preventDefault();
    void uploadImage(file);
  }

  function handleDragOver(event: React.DragEvent) {
    const hasImage = Array.from(event.dataTransfer.items).some((item) =>
      item.type.startsWith("image/"),
    );

    if (hasImage) {
      event.preventDefault();
    }
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("alt", file.name.replace(/\.[^.]+$/, ""));

      const response = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        markdown?: string;
      };

      if (!response.ok || !payload.markdown) {
        throw new Error(payload.error ?? "이미지 업로드에 실패했습니다.");
      }

      insertMarkdown(payload.markdown);
      setUploadMessage("이미지를 Markdown에 삽입했습니다.");
    } catch (error) {
      setUploadMessage(
        error instanceof Error
          ? error.message
          : "이미지 업로드에 실패했습니다.",
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <form
      action={action}
      className="space-y-5"
      data-testid="document-editor"
      onSubmit={() => {
        window.localStorage.removeItem(draftKey);
        setIsDirty(false);
      }}
    >
      {initialDocument?.id ? (
        <input type="hidden" name="id" value={initialDocument.id} />
      ) : null}
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="body_markdown" value={body} />
      <input type="hidden" name="tags" value={submittedTags} />

      {storedDraft ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-950">
            저장되지 않은 로컬 초안이 있습니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => restoreDraft(storedDraft)}
              className="inline-flex h-8 items-center gap-2 rounded-md bg-amber-950 px-3 text-sm font-medium text-white transition hover:bg-amber-900"
            >
              <RotateCcw size={15} aria-hidden />
              복원
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-amber-300 px-3 text-sm font-medium text-amber-950 transition hover:bg-amber-100"
            >
              <Trash2 size={15} aria-hidden />
              삭제
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
            <label className="block">
              <FieldLabel>제목</FieldLabel>
              <input
                name="title"
                value={title}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  setTitle(nextTitle);
                  markDirty();

                  if (mode === "create") {
                    setSlug(slugify(nextTitle));
                  }
                }}
                required
                className="mt-2 h-12 w-full rounded-md border border-slate-300 px-3 text-xl font-semibold text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="예: 멱등성"
              />
            </label>

            <label className="mt-4 block">
              <FieldLabel optional>요약</FieldLabel>
              <input
                name="summary"
                value={summary}
                onChange={(event) => {
                  setSummary(event.target.value);
                  markDirty();
                }}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="문서 목록에서 보일 짧은 설명"
              />
            </label>
          </section>

          <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
            <div className="border-b border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-3 py-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    Markdown 에디터
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    이미지 붙여넣기, 드래그 업로드, Mermaid 미리보기를 지원합니다.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  data-testid="image-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file) {
                      void uploadImage(file);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {uploading ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus size={16} aria-hidden />
                  )}
                  이미지
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className={toolGroupClass}>
                  <button
                    type="button"
                    onClick={() => setView("edit")}
                    className={`inline-flex h-8 items-center gap-2 rounded px-2 text-sm ${
                      view === "edit"
                        ? "bg-slate-950 text-white shadow-sm"
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
                        ? "bg-slate-950 text-white shadow-sm"
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
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-950"
                    }`}
                  >
                    <Eye size={15} aria-hidden />
                    미리보기
                  </button>
                </div>

                <div className={toolGroupClass} aria-label="편집 기록">
                  <button
                    type="button"
                    onClick={() => runEditorCommand(undo)}
                    aria-label="되돌리기"
                    title="되돌리기"
                    className={toolButtonClass}
                  >
                    <Undo2 size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => runEditorCommand(redo)}
                    aria-label="다시 실행"
                    title="다시 실행"
                    className={toolButtonClass}
                  >
                    <Redo2 size={15} aria-hidden />
                  </button>
                </div>

                <div className={toolGroupClass} aria-label="서식">
                  <button
                    type="button"
                    onClick={() => wrapSelection("**", "**", "강조")}
                    aria-label="굵게"
                    title="굵게"
                    className={toolButtonClass}
                  >
                    <Bold size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown("## 새 섹션")}
                    aria-label="제목"
                    title="제목"
                    className={toolButtonClass}
                  >
                    <Heading2 size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapSelection("`", "`", "code")}
                    aria-label="인라인 코드"
                    title="인라인 코드"
                    className={toolButtonClass}
                  >
                    <Code2 size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown("> 핵심 인용")}
                    aria-label="인용"
                    title="인용"
                    className={toolButtonClass}
                  >
                    <Quote size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown("- 항목")}
                    aria-label="목록"
                    title="목록"
                    className={toolButtonClass}
                  >
                    <List size={15} aria-hidden />
                  </button>
                </div>

                <div className={toolGroupClass} aria-label="삽입">
                  <button
                    type="button"
                    onClick={() => wrapSelection("[", "](https://example.com)", "링크")}
                    aria-label="링크"
                    title="링크"
                    className={toolButtonClass}
                  >
                    <Link2 size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertMarkdown("| 항목 | 설명 |\n| --- | --- |\n| 예시 | 내용 |")
                    }
                    aria-label="표"
                    title="표"
                    className={toolButtonClass}
                  >
                    <Table2 size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertMarkdown("```mermaid\nflowchart LR\n  A --> B\n```")
                    }
                    aria-label="Mermaid"
                    title="Mermaid"
                    className={toolButtonClass}
                  >
                    <Workflow size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown("```\n// code\n```")}
                    aria-label="코드 블록"
                    title="코드 블록"
                    className={toolButtonClass}
                  >
                    <Pilcrow size={15} aria-hidden />
                  </button>
                </div>
              </div>
            </div>

            {(uploadMessage || draftMessage) ? (
              <div className="flex flex-wrap gap-3 border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
                {uploadMessage ? <p>{uploadMessage}</p> : null}
                {draftMessage ? <p>{draftMessage}</p> : null}
              </div>
            ) : null}

            <div
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className={
                view === "split"
                  ? "grid min-h-[580px] lg:grid-cols-2"
                  : "min-h-[580px]"
              }
            >
              {view !== "preview" ? (
                <div className="border-slate-200 lg:border-r">
                  <CodeMirror
                    value={body}
                    height="580px"
                    extensions={extensions}
                    basicSetup={{
                      foldGutter: false,
                      highlightActiveLine: false,
                    }}
                    onChange={(value) => {
                      setBody(value);
                      markDirty();
                    }}
                    onCreateEditor={(view) => {
                      editorViewRef.current = view;
                    }}
                  />
                </div>
              ) : null}

              {view !== "edit" ? (
                <div className="max-h-[580px] overflow-auto bg-white p-5 sm:p-6">
                  <MarkdownRenderer content={body} />
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-5">
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Settings2 size={16} className="text-slate-500" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-950">
                문서 설정
              </h2>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <FieldLabel>상태</FieldLabel>
                <select
                  name="status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as DocumentStatus);
                    markDirty();
                  }}
                  className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="draft">초안</option>
                  <option value="published">공개</option>
                  <option value="archived">보관</option>
                </select>
                <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                  {statusDescriptions[status]}
                </p>
              </label>

              <div>
                <FieldLabel optional>태그</FieldLabel>
                <div className="mt-2 flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 transition focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-200">
                  {tagNames.map((tag) => (
                    <span
                      key={tag}
                      data-testid="tag-chip"
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-slate-100 px-2 text-xs font-medium text-slate-700"
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={`${tag} 태그 삭제`}
                        data-testid="tag-chip-remove"
                        onClick={() => removeTag(tag)}
                        className="inline-flex size-4 items-center justify-center rounded text-slate-500 transition hover:bg-slate-200 hover:text-slate-950"
                      >
                        <X size={12} aria-hidden />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={handleTagInputChange}
                    onKeyDown={handleTagInputKeyDown}
                    onBlur={() => commitTagInput()}
                    data-testid="tag-input"
                    className="h-7 min-w-28 flex-1 border-0 bg-transparent px-1 text-sm text-slate-950 outline-none placeholder:text-slate-300"
                    placeholder={tagNames.length ? "" : "HTTP, API 설계"}
                  />
                </div>
              </div>

              <label className="block">
                <FieldLabel optional>수정 요약</FieldLabel>
                <input
                  name="edit_summary"
                  value={editSummary}
                  onChange={(event) => {
                    setEditSummary(event.target.value);
                    markDirty();
                  }}
                  className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder={mode === "create" ? "문서 생성" : "예: 예시 보강"}
                />
              </label>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700">빠른 섹션</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {quickSections.map((section) => (
                  <button
                    key={section.label}
                    type="button"
                    onClick={() => insertMarkdown(section.markdown)}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Save size={16} aria-hidden />
              저장
            </button>
          </section>

          <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">본문</dt>
                <dd className="font-medium text-slate-700">
                  {body.trim().length.toLocaleString("ko-KR")}자
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">태그</dt>
                <dd className="font-medium text-slate-700">
                  {submittedTagNames.length}
                  개
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">저장 상태</dt>
                <dd className="font-medium text-slate-700">
                  {isDirty ? "로컬 초안 있음" : "변경 없음"}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </form>
  );
}
