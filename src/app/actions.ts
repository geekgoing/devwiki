"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedMember, requireEditorMember } from "@/lib/auth";
import {
  contentTypePath,
  documentDetailPath,
  documentEditPath,
  legacyDocumentPath,
  parseContentType,
} from "@/lib/content-routes";
import { generateNickname } from "@/lib/nicknames";
import { slugify, toTagSlug } from "@/lib/slugify";
import type { Tag } from "@/types/devwiki";

const MAX_TAG_NAME_LENGTH = 40;
const REMEMBER_EMAIL_COOKIE = "devwiki_remember_email";

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

const documentLearningStateSchema = z.object({
  contentType: z.enum(["term", "interview_qa", "scenario"]),
  documentId: z.string().uuid(),
  enabled: z.boolean(),
  field: z.enum(["favorite", "completed"]),
  slug: z.string().trim().min(1),
});

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function documentPath(slug: string, contentType: "term" | "interview_qa" | "scenario") {
  return documentDetailPath({ contentType, slug });
}

function revalidateDocumentPaths(
  slug: string,
  contentType: "term" | "interview_qa" | "scenario",
) {
  revalidatePath(legacyDocumentPath(slug));
  revalidatePath(documentEditPath(slug));
  revalidatePath(documentPath(slug, contentType));
  revalidatePath(contentTypePath(contentType));
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
  const rememberEmail = readString(formData, "remember_email") === "on";
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

  const cookieStore = await cookies();

  if (rememberEmail) {
    cookieStore.set(REMEMBER_EMAIL_COOKIE, email, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 180,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    cookieStore.delete(REMEMBER_EMAIL_COOKIE);
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
  revalidatePath(contentTypePath(content.contentType));
  redirect(documentPath(data.slug, content.contentType));
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
    .select("slug, content_type")
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
    .select("slug, content_type")
    .single();

  if (error || !updatedDocument) {
    throw new Error(error?.message ?? "문서를 수정하지 못했습니다.");
  }

  await syncTags(supabase, parsed.id, parsedTags);
  await syncRelatedDocuments(supabase, parsed.id, relatedDocumentIds, user.id);
  revalidatePath("/");
  revalidateDocumentPaths(
    currentDocument.slug,
    parseContentType(currentDocument.content_type ?? undefined),
  );
  revalidateDocumentPaths(
    slug,
    parseContentType(updatedDocument.content_type ?? undefined),
  );
  redirect(documentPath(slug, parseContentType(updatedDocument.content_type ?? undefined)));
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
    .select("slug, content_type")
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
  const contentType = parseContentType(document.content_type ?? undefined);
  revalidateDocumentPaths(document.slug, contentType);
  redirect(documentPath(document.slug, contentType));
}

export async function addComment(formData: FormData) {
  const { supabase, user } = await requireAuthenticatedMember();
  const contentType = parseContentType(readString(formData, "content_type"));
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

  revalidateDocumentPaths(slug, contentType);
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

export async function updateDocumentLearningState(formData: FormData) {
  const { supabase, user } = await requireAuthenticatedMember();
  const parsed = documentLearningStateSchema.parse({
    contentType: readString(formData, "content_type") || "term",
    documentId: readString(formData, "document_id"),
    enabled: readString(formData, "enabled") === "1",
    field: readString(formData, "field"),
    slug: readString(formData, "slug"),
  });
  const nextState =
    parsed.field === "favorite"
      ? { is_favorite: parsed.enabled }
      : { is_completed: parsed.enabled };

  const { data: currentState, error: currentStateError } = await supabase
    .from("document_member_states")
    .select("is_favorite, is_completed")
    .eq("document_id", parsed.documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentStateError) {
    throw new Error(currentStateError.message);
  }

  const { error } = await supabase.from("document_member_states").upsert(
    {
      document_id: parsed.documentId,
      user_id: user.id,
      is_favorite: currentState?.is_favorite ?? false,
      is_completed: currentState?.is_completed ?? false,
      ...nextState,
    },
    { onConflict: "document_id,user_id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/me");
  revalidateDocumentPaths(parsed.slug, parsed.contentType);
}
