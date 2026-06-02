"use client";

import { redo, undo } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import dynamic from "next/dynamic";
import {
  Bold,
  Check,
  CirclePlay,
  Code2,
  Edit3,
  Eye,
  ExternalLink,
  FileText,
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
  Sparkles,
  SplitSquareHorizontal,
  Table2,
  Tags as TagsIcon,
  Trash2,
  Undo2,
  WandSparkles,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type ReactCodeMirror from "@uiw/react-codemirror";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { slugify, toTagSlug } from "@/lib/slugify";
import type {
  DocumentAiAssistKind,
  DocumentAiAssistResult,
  DocumentAiDraftSuggestion,
  DocumentAiTagSuggestion,
  DocumentAiYoutubeSuggestion,
} from "@/lib/ai/document-assist";
import type {
  DocumentContentType,
  DocumentStatus,
  InterviewCategory,
} from "@/types/devwiki";

type CodeMirrorProps = React.ComponentProps<typeof ReactCodeMirror>;
type EditorViewInstance = Parameters<
  NonNullable<CodeMirrorProps["onCreateEditor"]>
>[0];

const CodeMirror = dynamic<CodeMirrorProps>(
  () => import("@uiw/react-codemirror").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[760px] items-center justify-center bg-muted text-sm text-muted-foreground">
        에디터 로딩 중
      </div>
    ),
  },
);

type DocumentEditorProps = {
  action: (formData: FormData) => void | Promise<void>;
  mode: "create" | "edit";
  conflictDetected?: boolean;
  linkableDocuments?: {
    id: string;
    title: string;
    slug: string;
    summary?: string | null;
    status?: DocumentStatus;
    tags?: { name: string }[];
  }[];
  initialDocument?: {
    id?: string;
    title?: string;
    slug?: string;
    summary?: string | null;
    bodyMarkdown?: string;
    contentType?: DocumentContentType;
    interviewCategory?: InterviewCategory;
    status?: DocumentStatus;
    tags?: string;
    relatedDocumentIds?: string[];
    updatedAt?: string;
  };
};

type EditorDraft = {
  title: string;
  slug: string;
  summary: string;
  body: string;
  contentType: DocumentContentType;
  interviewCategory: InterviewCategory | "";
  status: DocumentStatus;
  tags: string;
  editSummary: string;
  relatedDocumentIds: string[];
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
  A["개념"] --> B["예시"]
  B --> C["면접 답변"]
\`\`\`

## 꼬리 질문

## 참고 자료
`;

const interviewQaStarterMarkdown = `# 질문

## 질문 의도

## 답변 Tip

## 좋은 답변 흐름

## 답변 예시

## 주의할 점

## 꼬리 질문
`;

const scenarioStarterMarkdown = `# 상황

## 문제 이해

## 해결 전략

## 트레이드오프

## 답변 예시

## 토론 포인트
`;

const starterMarkdownByType: Record<DocumentContentType, string> = {
  term: starterMarkdown,
  interview_qa: interviewQaStarterMarkdown,
  scenario: scenarioStarterMarkdown,
};

const statusDescriptions: Record<DocumentStatus, string> = {
  draft: "로그인한 멤버에게만 노출됩니다.",
  published: "전체 멤버의 기본 목록에 노출됩니다.",
  archived: "기본 목록에서는 숨기고 보관 필터에서만 봅니다.",
};

const toolGroupClass =
  "inline-flex items-center gap-1 rounded-lg border bg-muted/45 p-1";
const toolButtonClass = buttonVariants({
  variant: "ghost",
  size: "icon-sm",
});

function FieldLabel({
  children,
  optional = false,
}: {
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <span className="flex items-center justify-between gap-2 text-sm font-medium">
      <span>{children}</span>
      {optional ? (
        <span className="text-xs font-normal text-muted-foreground">선택</span>
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

function escapeMarkdownLinkText(value: string) {
  return value.replace(/[\\[\]]/g, "\\$&");
}

export function DocumentEditor({
  action,
  conflictDetected = false,
  linkableDocuments = [],
  mode,
  initialDocument,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(initialDocument?.title ?? "");
  const [slug, setSlug] = useState(initialDocument?.slug ?? "");
  const [summary, setSummary] = useState(initialDocument?.summary ?? "");
  const [contentType, setContentType] = useState<DocumentContentType>(
    initialDocument?.contentType ?? "term",
  );
  const [interviewCategory, setInterviewCategory] = useState<
    InterviewCategory | ""
  >(initialDocument?.interviewCategory ?? "technical");
  const [status, setStatus] = useState<DocumentStatus>(
    initialDocument?.status ?? "draft",
  );
  const [tags, setTags] = useState(initialDocument?.tags ?? "");
  const [tagInput, setTagInput] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [body, setBody] = useState(
    initialDocument?.bodyMarkdown ??
      starterMarkdownByType[initialDocument?.contentType ?? "term"],
  );
  const [view, setView] = useState<"edit" | "preview" | "split">("split");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [aiBusyKind, setAiBusyKind] = useState<DocumentAiAssistKind | null>(
    null,
  );
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<DocumentAiDraftSuggestion | null>(
    null,
  );
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiTags, setAiTags] = useState<DocumentAiTagSuggestion[]>([]);
  const [aiVideos, setAiVideos] = useState<DocumentAiYoutubeSuggestion[]>([]);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [storedDraft, setStoredDraft] = useState<EditorDraft | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [documentLinkQuery, setDocumentLinkQuery] = useState("");
  const [relatedDocumentIds, setRelatedDocumentIds] = useState<string[]>(
    initialDocument?.relatedDocumentIds ?? [],
  );
  const formRef = useRef<HTMLFormElement | null>(null);
  const editorViewRef = useRef<EditorViewInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftKey = useMemo(
    () =>
      `devwiki:draft:${mode}:${initialDocument?.id ?? initialDocument?.slug ?? "new"}`,
    [initialDocument?.id, initialDocument?.slug, mode],
  );
  const extensions = useMemo(() => [markdown({ base: markdownLanguage })], []);
  const tagNames = useMemo(() => parseTagNames(tags), [tags]);
  const submittedTagNames = useMemo(
    () => parseTagNames([...tagNames, tagInput].join(",")),
    [tagInput, tagNames],
  );
  const submittedTags = useMemo(
    () => submittedTagNames.join(", "),
    [submittedTagNames],
  );
  const knownTagNames = useMemo(
    () =>
      parseTagNames(
        [
          ...tagNames,
          ...linkableDocuments.flatMap((document) =>
            document.tags?.map((tag) => tag.name) ?? [],
          ),
        ].join(","),
      ),
    [linkableDocuments, tagNames],
  );
  const submittedRelatedDocumentIds = useMemo(
    () => relatedDocumentIds.join(","),
    [relatedDocumentIds],
  );
  const selectedRelatedDocuments = useMemo(
    () =>
      relatedDocumentIds
        .map((id) => linkableDocuments.find((document) => document.id === id))
        .filter(
          (
            document,
          ): document is NonNullable<(typeof linkableDocuments)[number]> =>
            Boolean(document),
        ),
    [linkableDocuments, relatedDocumentIds],
  );
  const filteredLinkableDocuments = useMemo(() => {
    const normalizedQuery = documentLinkQuery.trim().toLowerCase();

    return linkableDocuments
      .filter((document) => document.id !== initialDocument?.id)
      .filter((document) => !relatedDocumentIds.includes(document.id))
      .filter((document) => {
        if (!normalizedQuery) {
          return true;
        }

        return [
          document.title,
          document.slug,
          document.summary ?? "",
          document.status ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [
    documentLinkQuery,
    initialDocument?.id,
    linkableDocuments,
    relatedDocumentIds,
  ]);

  function markDirty() {
    setIsDirty(true);
  }

  function setTitleFromSuggestion(nextTitle: string) {
    setTitle(nextTitle);

    if (mode === "create") {
      setSlug(slugify(nextTitle));
    }

    markDirty();
  }

  function handleContentTypeChange(nextContentType: DocumentContentType) {
    const shouldReplaceStarter =
      mode === "create" &&
      !isDirty &&
      body === starterMarkdownByType[contentType];

    setContentType(nextContentType);

    if (nextContentType !== "interview_qa") {
      setInterviewCategory("");
    } else if (!interviewCategory) {
      setInterviewCategory("technical");
    }

    if (shouldReplaceStarter) {
      setBody(starterMarkdownByType[nextContentType]);
    }

    markDirty();
  }

  useEffect(() => {
    const rawDraft = window.localStorage.getItem(draftKey);
    let timeoutId: number | null = null;

    if (!rawDraft) {
      return;
    }

    try {
      const parsed = JSON.parse(rawDraft) as EditorDraft;
      const initialUpdatedAt = initialDocument?.updatedAt
        ? Date.parse(initialDocument.updatedAt)
        : null;

      if (
        !conflictDetected &&
        initialUpdatedAt &&
        parsed.savedAt <= initialUpdatedAt
      ) {
        window.localStorage.removeItem(draftKey);
        return;
      }

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
  }, [conflictDetected, draftKey, initialDocument?.updatedAt]);

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
        contentType,
        interviewCategory,
        status,
        tags: submittedTags,
        editSummary,
        relatedDocumentIds,
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
    contentType,
    interviewCategory,
    isDirty,
    slug,
    status,
    submittedTags,
    relatedDocumentIds,
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

  useEffect(() => {
    function handleSetMarkdown(event: Event) {
      const markdownText = (event as CustomEvent<unknown>).detail;

      if (typeof markdownText !== "string") {
        return;
      }

      const view = editorViewRef.current;

      if (view) {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: markdownText,
          },
        });
      }

      setBody(markdownText);
      setIsDirty(true);
    }

    window.addEventListener("devwiki:set-markdown", handleSetMarkdown);
    return () =>
      window.removeEventListener("devwiki:set-markdown", handleSetMarkdown);
  }, []);

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

  function replaceMarkdown(markdownText: string) {
    const view = editorViewRef.current;
    markDirty();

    if (!view) {
      setBody(markdownText);
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: markdownText,
      },
    });
    setBody(markdownText);
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

  function runEditorCommand(command: (view: EditorViewInstance) => boolean) {
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

  function handleEditorShortcut(event: React.KeyboardEvent<HTMLFormElement>) {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") {
      return;
    }

    event.preventDefault();
    formRef.current?.requestSubmit();
  }

  function addRelatedDocument(documentId: string) {
    setRelatedDocumentIds((current) =>
      current.includes(documentId) ? current : [...current, documentId],
    );
    markDirty();
  }

  function removeRelatedDocument(documentId: string) {
    setRelatedDocumentIds((current) =>
      current.filter((id) => id !== documentId),
    );
    markDirty();
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
    setContentType(draft.contentType ?? "term");
    setInterviewCategory(draft.interviewCategory ?? "");
    setStatus(draft.status);
    setTags(draft.tags);
    setEditSummary(draft.editSummary);
    setRelatedDocumentIds(draft.relatedDocumentIds ?? []);
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

  async function uploadImageAsset(file: File) {
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
      src?: string;
    };

    if (!response.ok || !payload.markdown || !payload.src) {
      throw new Error(payload.error ?? "이미지 업로드에 실패했습니다.");
    }

    return {
      markdown: payload.markdown,
      src: payload.src,
    };
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setUploadMessage(null);

    try {
      const payload = await uploadImageAsset(file);

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

  async function requestAiAssist(kind: DocumentAiAssistKind) {
    const hasContext = title.trim() || summary.trim() || body.trim();

    if (!hasContext) {
      setAiError("제목이나 본문을 먼저 입력하세요.");
      return;
    }

    setAiBusyKind(kind);
    setAiError(null);
    setAiMessage(null);

    try {
      const response = await fetch("/api/ai/document-assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind,
          title,
          summary,
          bodyMarkdown: body,
          contentType,
          interviewCategory:
            contentType === "interview_qa" ? interviewCategory : null,
          currentTags: submittedTagNames,
          knownTags: knownTagNames,
        }),
      });
      const payload = (await response.json()) as
        | DocumentAiAssistResult
        | { error?: string };

      if (!response.ok) {
        const errorMessage =
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "AI 보조 요청에 실패했습니다.";

        throw new Error(errorMessage);
      }

      if ("error" in payload) {
        throw new Error(payload.error ?? "AI 보조 요청에 실패했습니다.");
      }

      const result = payload as DocumentAiAssistResult;

      if (result.kind === "draft") {
        setAiDraft(result.draft);
        setAiMessage("초안을 생성했습니다.");
      } else if (result.kind === "summary") {
        setAiSummary(result.summary);
        setAiMessage("요약을 생성했습니다.");
      } else if (result.kind === "tags") {
        setAiTags(result.tags);
        setAiMessage("태그 후보를 생성했습니다.");
      } else {
        setAiVideos(result.videos);
        setAiMessage("YouTube 링크 후보를 생성했습니다.");
      }
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : "AI 보조 요청을 처리하지 못했습니다.",
      );
    } finally {
      setAiBusyKind(null);
    }
  }

  function applyAiSummary(value = aiSummary) {
    if (!value) {
      return;
    }

    setSummary(value);
    markDirty();
    setAiMessage("요약을 적용했습니다.");
  }

  function applyAiTags(suggestions = aiTags) {
    if (!suggestions.length) {
      return;
    }

    setTagNames(
      parseTagNames(
        [...tagNames, ...suggestions.map((suggestion) => suggestion.name)].join(
          ",",
        ),
      ),
    );
    setAiMessage("태그를 적용했습니다.");
  }

  function applyAiDraft(replaceBody: boolean) {
    if (!aiDraft) {
      return;
    }

    if (aiDraft.title && !title.trim()) {
      setTitleFromSuggestion(aiDraft.title);
    }

    if (aiDraft.summary && !summary.trim()) {
      setSummary(aiDraft.summary);
      markDirty();
    }

    if (aiDraft.tags.length) {
      applyAiTags(aiDraft.tags);
    }

    if (replaceBody) {
      replaceMarkdown(aiDraft.bodyMarkdown);
    } else {
      insertMarkdown(aiDraft.bodyMarkdown);
    }

    setAiMessage(replaceBody ? "초안으로 본문을 교체했습니다." : "초안을 삽입했습니다.");
  }

  function insertYoutubeReferences() {
    if (!aiVideos.length) {
      return;
    }

    const markdown = [
      "## 참고 영상",
      ...aiVideos.map(
        (video) =>
          `- [${escapeMarkdownLinkText(video.title)}](${video.url})${
            video.reason ? ` - ${video.reason}` : ""
          }`,
      ),
    ].join("\n");

    insertMarkdown(markdown);
    setAiMessage("참고 영상 링크를 삽입했습니다.");
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-4"
      data-testid="document-editor"
      onKeyDown={handleEditorShortcut}
      onSubmit={() => {
        setIsDirty(false);
      }}
    >
      {initialDocument?.id ? (
        <input type="hidden" name="id" value={initialDocument.id} />
      ) : null}
      <input type="hidden" name="slug" value={slug} />
      {initialDocument?.updatedAt ? (
        <input
          type="hidden"
          name="last_known_updated_at"
          value={initialDocument.updatedAt}
        />
      ) : null}
      <input type="hidden" name="body_markdown" value={body} />
      <input type="hidden" name="content_type" value={contentType} />
      <input
        type="hidden"
        name="interview_category"
        value={contentType === "interview_qa" ? interviewCategory : ""}
      />
      <input type="hidden" name="tags" value={submittedTags} />
      <input
        type="hidden"
        name="related_document_ids"
        value={submittedRelatedDocumentIds}
      />
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

      {conflictDetected ? (
        <section
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
          role="alert"
        >
          다른 멤버가 먼저 저장한 변경이 있어 덮어쓰기를 막았습니다. 로컬
          초안이 남아 있으면 복원해서 최신 문서와 비교한 뒤 다시 저장하세요.
        </section>
      ) : null}

      {storedDraft ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-950">
            저장되지 않은 로컬 초안이 있습니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => restoreDraft(storedDraft)}
              size="sm"
              className="bg-amber-950 text-white hover:bg-amber-900"
            >
              <RotateCcw size={15} aria-hidden />
              복원
            </Button>
            <Button
              type="button"
              onClick={discardDraft}
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-950 hover:bg-amber-100"
            >
              <Trash2 size={15} aria-hidden />
              삭제
            </Button>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="sticky top-0 z-20 border-b bg-card/95 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <label className="sr-only" htmlFor="document-title-input">
                제목
              </label>
              <input
                id="document-title-input"
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
                className="h-10 w-full border-0 bg-transparent px-0 text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground focus:ring-0"
                placeholder="문서 제목"
              />
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <Select
                  name="status"
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value as DocumentStatus);
                    markDirty();
                  }}
                >
                  <SelectTrigger className="h-8 w-[92px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">초안</SelectItem>
                    <SelectItem value="published">공개</SelectItem>
                    <SelectItem value="archived">보관</SelectItem>
                  </SelectContent>
                </Select>
                <span className="font-mono text-muted-foreground">
                  /{slug || slugify(title) || "document"}
                </span>
                <span>{body.trim().length.toLocaleString("ko-KR")}자</span>
                <span>{submittedTagNames.length}개 태그</span>
                <span
                  className={
                    isDirty ? "text-amber-600" : "text-muted-foreground"
                  }
                >
                  {isDirty ? "로컬 초안 있음" : "변경 없음"}
                </span>
                {uploading ? <span>이미지 업로드 중</span> : null}
                {uploadMessage ? <span>{uploadMessage}</span> : null}
                {draftMessage ? <span>{draftMessage}</span> : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/45 p-1">
                <Button
                  type="button"
                  onClick={() => setView("edit")}
                  variant={view === "edit" ? "secondary" : "ghost"}
                  size="sm"
                >
                  <Edit3 size={15} aria-hidden />
                  편집
                </Button>
                <Button
                  type="button"
                  onClick={() => setView("split")}
                  variant={view === "split" ? "secondary" : "ghost"}
                  size="sm"
                >
                  <SplitSquareHorizontal size={15} aria-hidden />
                  분할
                </Button>
                <Button
                  type="button"
                  onClick={() => setView("preview")}
                  variant={view === "preview" ? "secondary" : "ghost"}
                  size="sm"
                >
                  <Eye size={15} aria-hidden />
                  미리보기
                </Button>
              </div>

              <Button type="submit" size="lg">
                <Save size={16} aria-hidden />
                저장
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
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
                onClick={() =>
                  wrapSelection("[", "](https://example.com)", "링크")
                }
                aria-label="링크"
                title="링크"
                className={toolButtonClass}
              >
                <Link2 size={15} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() =>
                  insertMarkdown(
                    "| 항목 | 설명 |\n| --- | --- |\n| 예시 | 내용 |",
                  )
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
                  insertMarkdown(
                    '```mermaid\nflowchart LR\n  A["개념"] --> B["예시"]\n```',
                  )
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
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                aria-label="이미지 업로드"
                title="이미지 업로드"
                className={toolButtonClass}
              >
                {uploading ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                ) : (
                  <ImagePlus size={15} aria-hidden />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className={
                view === "split"
                  ? "grid min-h-[760px] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                  : "min-h-[760px]"
              }
            >
              <div
                className={
                  view === "preview"
                    ? "hidden"
                    : view === "split"
                      ? "min-w-0 border-b 2xl:border-b-0 2xl:border-r"
                      : "min-w-0"
                }
              >
                <CodeMirror
                  value={body}
                  height="760px"
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

              <div
                className={
                  view === "edit"
                    ? "hidden"
                    : "min-h-[760px] overflow-auto bg-background p-5 sm:p-7 2xl:max-h-[860px]"
                }
              >
                <MarkdownRenderer content={body} />
              </div>
            </div>
          </div>

          <aside className="border-t bg-muted/35 p-4 xl:border-l xl:border-t-0">
            <div className="space-y-5 xl:sticky xl:top-20">
              <section>
                <div className="flex items-center gap-2">
                  <Settings2
                    size={16}
                    className="text-muted-foreground"
                    aria-hidden
                  />
                  <h2 className="text-sm font-semibold">문서 설정</h2>
                </div>

                <label className="mt-4 block">
                  <FieldLabel>콘텐츠 유형</FieldLabel>
                  <Select
                    value={contentType}
                    onValueChange={(value) =>
                      handleContentTypeChange(value as DocumentContentType)
                    }
                  >
                    <SelectTrigger className="mt-2 h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="term">기술 용어</SelectItem>
                      <SelectItem value="interview_qa">면접 Q&A</SelectItem>
                      <SelectItem value="scenario">상황 시뮬레이션</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                {contentType === "interview_qa" ? (
                  <label className="mt-4 block">
                    <FieldLabel>면접 분류</FieldLabel>
                    <Select
                      value={interviewCategory || "technical"}
                      onValueChange={(value) => {
                        setInterviewCategory(value as InterviewCategory);
                        markDirty();
                      }}
                    >
                      <SelectTrigger className="mt-2 h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">기술</SelectItem>
                        <SelectItem value="behavioral">인성</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                ) : null}

                <label className="mt-4 block">
                  <FieldLabel optional>요약</FieldLabel>
                  <Textarea
                    name="summary"
                    value={summary}
                    onChange={(event) => {
                      setSummary(event.target.value);
                      markDirty();
                    }}
                    rows={3}
                    className="mt-2 resize-y"
                    placeholder="문서 목록에서 보일 짧은 설명"
                  />
                </label>

                <div className="mt-4">
                  <FieldLabel optional>태그</FieldLabel>
                  <div className="mt-2 flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-input bg-background px-2 py-1.5 transition focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                    {tagNames.map((tag) => (
                      <Badge
                        key={tag}
                        data-testid="tag-chip"
                        variant="secondary"
                        className="h-7 gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          aria-label={`${tag} 태그 삭제`}
                          data-testid="tag-chip-remove"
                          onClick={() => removeTag(tag)}
                          className="inline-flex size-4 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <X size={12} aria-hidden />
                        </button>
                      </Badge>
                    ))}
                    <input
                      value={tagInput}
                      onChange={handleTagInputChange}
                      onKeyDown={handleTagInputKeyDown}
                      onBlur={() => commitTagInput()}
                      data-testid="tag-input"
                      className="h-7 min-w-28 flex-1 border-0 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                      placeholder={tagNames.length ? "" : "HTTP, API 설계"}
                    />
                  </div>
                </div>

                <label className="mt-4 block">
                  <FieldLabel optional>수정 요약</FieldLabel>
                  <Input
                    name="edit_summary"
                    value={editSummary}
                    onChange={(event) => {
                      setEditSummary(event.target.value);
                      markDirty();
                    }}
                    className="mt-2 h-10"
                    placeholder={
                      mode === "create" ? "문서 생성" : "예: 예시 보강"
                    }
                  />
                </label>

                <p className="mt-3 rounded-lg bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
                  {statusDescriptions[status]}
                </p>
              </section>

              <section className="border-t pt-5">
                <div className="flex items-center gap-2">
                  <Sparkles
                    size={16}
                    className="text-muted-foreground"
                    aria-hidden
                  />
                  <h2 className="text-sm font-semibold">AI 보조</h2>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={Boolean(aiBusyKind)}
                    onClick={() => void requestAiAssist("draft")}
                  >
                    {aiBusyKind === "draft" ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : (
                      <WandSparkles size={14} aria-hidden />
                    )}
                    초안
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={Boolean(aiBusyKind)}
                    onClick={() => void requestAiAssist("summary")}
                  >
                    {aiBusyKind === "summary" ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : (
                      <FileText size={14} aria-hidden />
                    )}
                    요약
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={Boolean(aiBusyKind)}
                    onClick={() => void requestAiAssist("tags")}
                  >
                    {aiBusyKind === "tags" ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : (
                      <TagsIcon size={14} aria-hidden />
                    )}
                    태그
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={Boolean(aiBusyKind)}
                    onClick={() => void requestAiAssist("youtube")}
                  >
                    {aiBusyKind === "youtube" ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : (
                      <CirclePlay size={14} aria-hidden />
                    )}
                    영상
                  </Button>
                </div>

                {aiError ? (
                  <p
                    className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive"
                    role="alert"
                  >
                    {aiError}
                  </p>
                ) : null}

                {aiMessage ? (
                  <p className="mt-3 rounded-lg bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
                    {aiMessage}
                  </p>
                ) : null}

                {aiSummary ? (
                  <div className="mt-3 rounded-lg border bg-background p-3">
                    <p className="text-sm leading-6">{aiSummary}</p>
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => applyAiSummary()}
                      >
                        <Check size={14} aria-hidden />
                        적용
                      </Button>
                    </div>
                  </div>
                ) : null}

                {aiTags.length ? (
                  <div className="mt-3 rounded-lg border bg-background p-3">
                    <div className="flex flex-wrap gap-2">
                      {aiTags.map((tag) => (
                        <Badge
                          key={tag.name}
                          variant={tag.isExisting ? "secondary" : "outline"}
                          className="h-auto gap-1 py-1"
                          title={tag.reason || undefined}
                        >
                          {tag.name}
                          <span className="text-[10px] text-muted-foreground">
                            {tag.isExisting ? "기존" : "신규"}
                          </span>
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => applyAiTags()}
                      >
                        <Check size={14} aria-hidden />
                        적용
                      </Button>
                    </div>
                  </div>
                ) : null}

                {aiDraft ? (
                  <div className="mt-3 space-y-3 rounded-lg border bg-background p-3">
                    <div>
                      <p className="text-sm font-medium">{aiDraft.title}</p>
                      {aiDraft.summary ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {aiDraft.summary}
                        </p>
                      ) : null}
                    </div>
                    <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs leading-5 whitespace-pre-wrap">
                      {aiDraft.bodyMarkdown}
                    </pre>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!aiDraft.bodyMarkdown}
                        onClick={() => applyAiDraft(false)}
                      >
                        삽입
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!aiDraft.bodyMarkdown}
                        onClick={() => applyAiDraft(true)}
                      >
                        교체
                      </Button>
                    </div>
                  </div>
                ) : null}

                {aiVideos.length ? (
                  <div className="mt-3 space-y-2 rounded-lg border bg-background p-3">
                    {aiVideos.map((video) => (
                      <a
                        key={`${video.title}-${video.url}`}
                        href={video.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-md border px-3 py-2 transition hover:border-primary/25 hover:bg-accent/60"
                      >
                        <span className="flex items-start gap-2 text-sm font-medium">
                          <ExternalLink
                            size={14}
                            className="mt-0.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            {video.title}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {video.isSearchLink ? "검색 링크" : "영상 링크"}
                          {video.reason ? ` · ${video.reason}` : ""}
                        </span>
                      </a>
                    ))}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={insertYoutubeReferences}
                      >
                        <Check size={14} aria-hidden />
                        삽입
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="border-t pt-5">
                <div className="flex items-center gap-2">
                  <Link2
                    size={16}
                    className="text-muted-foreground"
                    aria-hidden
                  />
                  <h2 className="text-sm font-semibold">연관 문서</h2>
                </div>

                {selectedRelatedDocuments.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedRelatedDocuments.map((document) => (
                      <Badge
                        key={document.id}
                        variant="secondary"
                        className="h-auto max-w-full gap-2 py-1.5 text-sm"
                      >
                        <span className="truncate">{document.title}</span>
                        <button
                          type="button"
                          onClick={() => removeRelatedDocument(document.id)}
                          className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          aria-label={`${document.title} 연관 문서 제거`}
                        >
                          <X size={13} aria-hidden />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <Input
                  value={documentLinkQuery}
                  onChange={(event) => setDocumentLinkQuery(event.target.value)}
                  className="mt-3 h-9"
                  placeholder="연관 문서 검색"
                />
                {filteredLinkableDocuments.length ? (
                  <div className="mt-3 space-y-2">
                    {filteredLinkableDocuments.map((document) => (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => addRelatedDocument(document.id)}
                        className="block w-full rounded-lg border bg-background px-3 py-2 text-left transition hover:border-primary/25 hover:bg-accent/60"
                      >
                        <span className="block truncate text-sm font-medium">
                          {document.title}
                        </span>
                        {document.summary ? (
                          <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                            {document.summary}
                          </span>
                        ) : (
                          <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                            /{document.slug}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
                    추가할 문서가 없습니다.
                  </p>
                )}
              </section>
            </div>
          </aside>
        </div>
      </section>
    </form>
  );
}
