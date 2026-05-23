"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedMember, requireEditorMember } from "@/lib/auth";
import { generateNickname } from "@/lib/nicknames";
import { slugify, toTagSlug } from "@/lib/slugify";
import type { Tag } from "@/types/devwiki";

const MAX_TAG_NAME_LENGTH = 40;

const documentSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "제목을 입력하세요.").max(120),
  slug: z.string().trim().max(90).optional(),
  summary: z.string().trim().max(300).optional(),
  bodyMarkdown: z.string().trim().min(1, "본문을 입력하세요."),
  status: z.enum(["draft", "published", "archived"]),
  contentType: z.enum(["term", "interview_qa", "scenario"]),
  interviewCategory: z.enum(["technical", "behavioral"]).optional(),
  tags: z.string().trim().optional(),
  editSummary: z.string().trim().max(160).optional(),
  relatedDocumentIds: z.string().trim().optional(),
});

const restoreRevisionSchema = z.object({
  documentId: z.string().uuid(),
  revisionId: z.string().uuid(),
});

const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "닉네임은 2자 이상이어야 합니다.")
    .max(40, "닉네임은 40자 이하로 입력하세요."),
});

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function documentPath(slug: string) {
  return `/documents/${encodeURIComponent(slug)}`;
}

function safeRedirectPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function loginPath(params: { error?: string; next?: string }) {
  const searchParams = new URLSearchParams();

  if (params.error) {
    searchParams.set("error", params.error);
  }

  if (params.next && params.next !== "/") {
    searchParams.set("next", safeRedirectPath(params.next));
  }

  const query = searchParams.toString();
  return query ? `/login?${query}` : "/login";
}

function normalizeDocumentContent(
  contentType: "term" | "interview_qa" | "scenario",
  interviewCategory?: "technical" | "behavioral",
) {
  return {
    contentType,
    interviewCategory:
      contentType === "interview_qa" ? (interviewCategory ?? "technical") : null,
  };
}

async function uniqueSlug(baseSlug: string, exceptId?: string) {
  const { supabase } = await requireAuthenticatedMember();
  const base = baseSlug || "document";

  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    let query = supabase
      .from("documents")
      .select("id")
      .eq("slug", candidate)
      .limit(1);

    if (exceptId) {
      query = query.neq("id", exceptId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.length) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}

function parseTagNames(value = "") {
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const invalidTag = tags.find((tag) => tag.length > MAX_TAG_NAME_LENGTH);

  if (invalidTag) {
    throw new Error(`태그는 ${MAX_TAG_NAME_LENGTH}자 이하로 입력하세요.`);
  }

  return Array.from(new Map(tags.map((tag) => [toTagSlug(tag), tag])).entries())
    .filter(([slug]) => slug)
    .map(([slug, name]) => ({ slug, name }));
}

function parseRelatedDocumentIds(value = "") {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((id) => id.trim())
        .filter((id) => z.string().uuid().safeParse(id).success),
    ),
  );
}

function isMissingDocumentLinksError(error?: { message?: string } | null) {
  if (!error?.message) {
    return false;
  }

  return (
    error.message.includes("document_links") &&
    /does not exist|could not find|schema cache|relation/i.test(error.message)
  );
}

async function syncTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  parsedTags: Array<{ slug: string; name: string }>,
) {
  const { error: deleteError } = await supabase
    .from("document_tags")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (!parsedTags.length) {
    return;
  }

  const { data: tags, error: tagsError } = await supabase
    .from("tags")
    .upsert(parsedTags, { onConflict: "slug" })
    .select("id, name, slug");

  if (tagsError) {
    throw new Error(tagsError.message);
  }

  const rows = ((tags ?? []) as Tag[]).map((tag) => ({
    document_id: documentId,
    tag_id: tag.id,
  }));

  const { error: relationError } = await supabase
    .from("document_tags")
    .insert(rows);

  if (relationError) {
    throw new Error(relationError.message);
  }
}

async function syncRelatedDocuments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  targetDocumentIds: string[],
  userId: string,
) {
  const targetIds = targetDocumentIds.filter((id) => id !== documentId);
  const { error: deleteError } = await supabase
    .from("document_links")
    .delete()
    .eq("source_document_id", documentId);

  if (deleteError) {
    if (isMissingDocumentLinksError(deleteError)) {
      return;
    }

    throw new Error(deleteError.message);
  }

  if (!targetIds.length) {
    return;
  }

  const { error: insertError } = await supabase.from("document_links").insert(
    targetIds.map((targetId) => ({
      source_document_id: documentId,
      target_document_id: targetId,
      created_by: userId,
    })),
  );

  if (insertError) {
    if (isMissingDocumentLinksError(insertError)) {
      return;
    }

    throw new Error(insertError.message);
  }
}

export async function signInWithPassword(formData: FormData) {
  const email = readString(formData, "email").trim().toLowerCase();
  const password = readString(formData, "password");
  const next = safeRedirectPath(readString(formData, "next") || "/");

  if (!email) {
    redirect(loginPath({ error: "email", next }));
  }

  if (!password) {
    redirect(loginPath({ error: "password", next }));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const reason = /rate limit|too many requests/i.test(error.message)
      ? "rate-limit"
      : "credentials";
    redirect(loginPath({ error: reason, next }));
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createDocument(formData: FormData) {
  const { supabase, user } = await requireEditorMember();
  const parsed = documentSchema.parse({
    title: readString(formData, "title"),
    slug: readString(formData, "slug"),
    summary: readString(formData, "summary"),
    bodyMarkdown: readString(formData, "body_markdown"),
    status: readString(formData, "status") || "draft",
    contentType: readString(formData, "content_type") || "term",
    interviewCategory: readString(formData, "interview_category") || undefined,
    tags: readString(formData, "tags"),
    editSummary: readString(formData, "edit_summary"),
    relatedDocumentIds: readString(formData, "related_document_ids"),
  });
  const content = normalizeDocumentContent(
    parsed.contentType,
    parsed.interviewCategory,
  );
  const parsedTags = parseTagNames(parsed.tags);
  const relatedDocumentIds = parseRelatedDocumentIds(
    parsed.relatedDocumentIds,
  );
  const slug = await uniqueSlug(slugify(parsed.slug || parsed.title));

  const { data, error } = await supabase
    .from("documents")
    .insert({
      slug,
      title: parsed.title,
      summary: parsed.summary || null,
      body_markdown: parsed.bodyMarkdown,
      status: parsed.status,
      content_type: content.contentType,
      interview_category: content.interviewCategory,
      created_by: user.id,
      updated_by: user.id,
      edit_summary: parsed.editSummary || "문서 생성",
    })
    .select("id, slug")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await syncTags(supabase, data.id, parsedTags);
  await syncRelatedDocuments(supabase, data.id, relatedDocumentIds, user.id);
  revalidatePath("/");
  redirect(documentPath(data.slug));
}

export async function updateDocument(formData: FormData) {
  const { supabase, user } = await requireEditorMember();
  const parsed = documentSchema.parse({
    id: readString(formData, "id"),
    title: readString(formData, "title"),
    slug: readString(formData, "slug"),
    summary: readString(formData, "summary"),
    bodyMarkdown: readString(formData, "body_markdown"),
    status: readString(formData, "status") || "draft",
    contentType: readString(formData, "content_type") || "term",
    interviewCategory: readString(formData, "interview_category") || undefined,
    tags: readString(formData, "tags"),
    editSummary: readString(formData, "edit_summary"),
    relatedDocumentIds: readString(formData, "related_document_ids"),
  });
  const content = normalizeDocumentContent(
    parsed.contentType,
    parsed.interviewCategory,
  );
  const parsedTags = parseTagNames(parsed.tags);
  const relatedDocumentIds = parseRelatedDocumentIds(
    parsed.relatedDocumentIds,
  );

  if (!parsed.id) {
    throw new Error("수정할 문서 ID가 없습니다.");
  }

  const { data: currentDocument, error: currentDocumentError } = await supabase
    .from("documents")
    .select("slug")
    .eq("id", parsed.id)
    .single();

  if (currentDocumentError || !currentDocument) {
    throw new Error(
      currentDocumentError?.message ?? "수정할 문서를 찾을 수 없습니다.",
    );
  }

  const slug = await uniqueSlug(slugify(parsed.slug || parsed.title), parsed.id);
  const { data: updatedDocument, error } = await supabase
    .from("documents")
    .update({
      slug,
      title: parsed.title,
      summary: parsed.summary || null,
      body_markdown: parsed.bodyMarkdown,
      status: parsed.status,
      content_type: content.contentType,
      interview_category: content.interviewCategory,
      updated_by: user.id,
      edit_summary: parsed.editSummary || "문서 수정",
    })
    .eq("id", parsed.id)
    .select("slug")
    .single();

  if (error || !updatedDocument) {
    throw new Error(error?.message ?? "문서를 수정하지 못했습니다.");
  }

  await syncTags(supabase, parsed.id, parsedTags);
  await syncRelatedDocuments(supabase, parsed.id, relatedDocumentIds, user.id);
  revalidatePath("/");
  revalidatePath(documentPath(currentDocument.slug));
  revalidatePath(`${documentPath(currentDocument.slug)}/edit`);
  revalidatePath(documentPath(slug));
  revalidatePath(`${documentPath(slug)}/edit`);
  redirect(documentPath(slug));
}

export async function restoreDocumentRevision(formData: FormData) {
  const { supabase, user } = await requireEditorMember();
  const parsed = restoreRevisionSchema.parse({
    documentId: readString(formData, "document_id"),
    revisionId: readString(formData, "revision_id"),
  });

  const { data: revision, error: revisionError } = await supabase
    .from("document_revisions")
    .select("title, summary, body_markdown, created_at")
    .eq("id", parsed.revisionId)
    .eq("document_id", parsed.documentId)
    .single();

  if (revisionError || !revision) {
    throw new Error(revisionError?.message ?? "복원할 변경 이력을 찾지 못했습니다.");
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("slug")
    .eq("id", parsed.documentId)
    .single();

  if (documentError || !document) {
    throw new Error(documentError?.message ?? "복원할 문서를 찾지 못했습니다.");
  }

  const { error } = await supabase
    .from("documents")
    .update({
      title: revision.title,
      summary: revision.summary,
      body_markdown: revision.body_markdown,
      updated_by: user.id,
      edit_summary: `이전 버전 복원: ${new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(revision.created_at))}`,
    })
    .eq("id", parsed.documentId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath(documentPath(document.slug));
  revalidatePath(`${documentPath(document.slug)}/edit`);
  redirect(documentPath(document.slug));
}

export async function addComment(formData: FormData) {
  const { supabase, user } = await requireAuthenticatedMember();
  const documentId = readString(formData, "document_id");
  const slug = readString(formData, "slug");
  const body = readString(formData, "body").trim();

  if (!documentId || !body) {
    return;
  }

  const { error } = await supabase.from("comments").insert({
    document_id: documentId,
    body,
    created_by: user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(documentPath(slug));
}

export async function updateMyProfile(formData: FormData) {
  const { supabase, user } = await requireAuthenticatedMember();
  const randomize = readString(formData, "randomize") === "1";
  const parsed = profileSchema.parse({
    displayName: randomize
      ? generateNickname()
      : readString(formData, "display_name"),
  });

  const { error } = await supabase
    .from("members")
    .update({ display_name: parsed.displayName })
    .eq("email", user.email.toLowerCase());

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
  revalidatePath("/me");
  redirect("/me?notice=profile");
}
