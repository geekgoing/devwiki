"use server";

import { revalidatePath, updateTag } from "next/cache";
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
import { DEVWIKI_DOCUMENTS_CACHE_TAG } from "@/lib/documents";
import { generateNickname } from "@/lib/nicknames";
import { canEditContent } from "@/lib/permissions";
import {
  MAX_PASSWORD_LENGTH,
  PASSWORD_CHANGE_MIN_PASSWORD_LENGTH,
  SIGNUP_MIN_PASSWORD_LENGTH,
} from "@/lib/password-policy";
import { slugify, toTagSlug } from "@/lib/slugify";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tag } from "@/types/devwiki";

const MAX_TAG_NAME_LENGTH = 40;
const REMEMBER_EMAIL_COOKIE = "devwiki_remember_email";
const AUTH_USER_LOOKUP_PAGE_SIZE = 200;
const AUTH_USER_LOOKUP_MAX_PAGES = 10;

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
  lastKnownUpdatedAt: z.string().trim().optional(),
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

const signUpSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(SIGNUP_MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
    passwordConfirm: z.string().min(1),
  })
  .superRefine((value, context) => {
    if (value.password !== value.passwordConfirm) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirm"],
        message: "password_mismatch",
      });
    }
  });

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: z
      .string()
      .min(PASSWORD_CHANGE_MIN_PASSWORD_LENGTH)
      .max(MAX_PASSWORD_LENGTH),
    passwordConfirm: z.string().min(1),
  })
  .superRefine((value, context) => {
    if (value.password !== value.passwordConfirm) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirm"],
        message: "password_mismatch",
      });
    }

    if (value.currentPassword === value.password) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "password_unchanged",
      });
    }
  });

const documentLearningStateSchema = z.object({
  contentType: z.enum(["term", "interview_qa", "scenario"]),
  documentId: z.string().uuid(),
  enabled: z.boolean(),
  field: z.enum(["favorite", "completed"]),
  slug: z.string().trim().min(1),
});

const commentSchema = z.object({
  contentType: z.enum(["term", "interview_qa", "scenario"]),
  documentId: z.string().uuid(),
  parentCommentId: z.string().uuid().optional(),
  slug: z.string().trim().min(1),
});

const updateCommentSchema = commentSchema.extend({
  body: z.string().trim().min(1).max(2000),
  commentId: z.string().uuid(),
});

const deleteCommentSchema = commentSchema.extend({
  commentId: z.string().uuid(),
});

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function documentPath(
  slug: string,
  contentType: "term" | "interview_qa" | "scenario",
) {
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

function revalidateDocumentRows() {
  updateTag(DEVWIKI_DOCUMENTS_CACHE_TAG);
}

function safeRedirectPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function loginPath(params: { error?: string; next?: string; notice?: string }) {
  const searchParams = new URLSearchParams();

  if (params.error) {
    searchParams.set("error", params.error);
  }

  if (params.notice) {
    searchParams.set("notice", params.notice);
  }

  if (params.next && params.next !== "/") {
    searchParams.set("next", safeRedirectPath(params.next));
  }

  const query = searchParams.toString();
  return query ? `/login?${query}` : "/login";
}

function signUpPath(params: { error?: string; notice?: string }) {
  const searchParams = new URLSearchParams();

  if (params.error) {
    searchParams.set("error", params.error);
  }

  if (params.notice) {
    searchParams.set("notice", params.notice);
  }

  const query = searchParams.toString();
  return query ? `/signup?${query}` : "/signup";
}

function passwordChangePath(params: { error?: string; next?: string }) {
  const searchParams = new URLSearchParams();

  if (params.error) {
    searchParams.set("error", params.error);
  }

  if (params.next && params.next !== "/") {
    searchParams.set("next", safeRedirectPath(params.next));
  }

  const query = searchParams.toString();
  return query ? `/me/password?${query}` : "/me/password";
}

function signUpAuthErrorCode(error: {
  code?: string;
  message: string;
  status?: number;
}) {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message.toLowerCase();

  if (
    error.status === 429 ||
    code.includes("rate_limit") ||
    /rate limit|too many requests|security purposes|after \d+ seconds/.test(
      message,
    )
  ) {
    return "rate-limit";
  }

  if (
    code.includes("weak_password") ||
    /password|characters|weak|at least \d+/.test(message)
  ) {
    return "password";
  }

  if (code.includes("email") && /invalid|bad/.test(message)) {
    return "email";
  }

  if (
    code.includes("signup_disabled") ||
    /signup.*disabled|not allowed/.test(message)
  ) {
    return "disabled";
  }

  if (process.env.NODE_ENV !== "production") {
    console.error("Supabase signup failed", {
      code: error.code,
      message: error.message,
      status: error.status,
    });
  }

  return "auth";
}

async function authUserExistsByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= AUTH_USER_LOOKUP_MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: AUTH_USER_LOOKUP_PAGE_SIZE,
    });

    if (error) {
      return false;
    }

    if (
      data.users.some(
        (user) => user.email?.toLowerCase() === normalizedEmail,
      )
    ) {
      return true;
    }

    if (data.users.length < AUTH_USER_LOOKUP_PAGE_SIZE) {
      return false;
    }
  }

  return false;
}

async function createPendingMember(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  displayName: string,
) {
  return admin.from("members").insert({
    email,
    display_name: displayName,
    role: "viewer",
    is_active: false,
  });
}

function normalizeDocumentContent(
  contentType: "term" | "interview_qa" | "scenario",
  interviewCategory?: "technical" | "behavioral",
) {
  return {
    contentType,
    interviewCategory:
      contentType === "interview_qa"
        ? (interviewCategory ?? "technical")
        : null,
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

export async function signUpWithPassword(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    email: readString(formData, "email"),
    password: readString(formData, "password"),
    passwordConfirm: readString(formData, "password_confirm"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const error =
      issue?.message === "password_mismatch"
        ? "mismatch"
        : issue?.path[0] === "password"
          ? "password"
          : issue?.path[0] === "email"
            ? "email"
            : "invalid";

    redirect(signUpPath({ error }));
  }

  const { email, password } = parsed.data;
  const memberDisplayName = generateNickname();
  const admin = createAdminClient();
  const { data: existingMember, error: memberLookupError } = await admin
    .from("members")
    .select("email, is_active")
    .eq("email", email)
    .maybeSingle();

  if (memberLookupError) {
    redirect(signUpPath({ error: "server" }));
  }

  if (existingMember?.is_active) {
    redirect(loginPath({ notice: "already-approved" }));
  }

  if (existingMember) {
    redirect(loginPath({ notice: "signup-pending" }));
  }

  const { error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: memberDisplayName,
    },
  });

  if (signUpError) {
    const error = signUpAuthErrorCode(signUpError);

    if (
      /already|registered|exists/i.test(signUpError.message) &&
      (await authUserExistsByEmail(admin, email))
    ) {
      const { error: memberError } = await createPendingMember(
        admin,
        email,
        memberDisplayName,
      );

      if (memberError && memberError.code !== "23505") {
        redirect(signUpPath({ error: "member" }));
      }

      redirect(loginPath({ notice: "signup-pending" }));
    }

    redirect(signUpPath({ error }));
  }

  const { error: memberError } = await createPendingMember(
    admin,
    email,
    memberDisplayName,
  );

  if (memberError) {
    redirect(signUpPath({ error: "member" }));
  }

  redirect(loginPath({ notice: "signup-pending" }));
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
  const relatedDocumentIds = parseRelatedDocumentIds(parsed.relatedDocumentIds);
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
  revalidateDocumentRows();
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
    lastKnownUpdatedAt: readString(formData, "last_known_updated_at"),
  });
  const content = normalizeDocumentContent(
    parsed.contentType,
    parsed.interviewCategory,
  );
  const parsedTags = parseTagNames(parsed.tags);
  const relatedDocumentIds = parseRelatedDocumentIds(parsed.relatedDocumentIds);

  if (!parsed.id) {
    throw new Error("수정할 문서 ID가 없습니다.");
  }

  const { data: currentDocument, error: currentDocumentError } = await supabase
    .from("documents")
    .select("slug, content_type, updated_at")
    .eq("id", parsed.id)
    .single();

  if (currentDocumentError || !currentDocument) {
    throw new Error(
      currentDocumentError?.message ?? "수정할 문서를 찾을 수 없습니다.",
    );
  }

  if (
    parsed.lastKnownUpdatedAt &&
    currentDocument.updated_at !== parsed.lastKnownUpdatedAt
  ) {
    redirect(`${documentEditPath(currentDocument.slug)}?error=conflict`);
  }

  const slug = await uniqueSlug(
    slugify(parsed.slug || parsed.title),
    parsed.id,
  );
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
  revalidateDocumentRows();
  revalidatePath("/");
  revalidateDocumentPaths(
    currentDocument.slug,
    parseContentType(currentDocument.content_type ?? undefined),
  );
  revalidateDocumentPaths(
    slug,
    parseContentType(updatedDocument.content_type ?? undefined),
  );
  redirect(
    documentPath(
      slug,
      parseContentType(updatedDocument.content_type ?? undefined),
    ),
  );
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
    throw new Error(
      revisionError?.message ?? "복원할 변경 이력을 찾지 못했습니다.",
    );
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
  revalidateDocumentRows();
  const contentType = parseContentType(document.content_type ?? undefined);
  revalidateDocumentPaths(document.slug, contentType);
  redirect(documentPath(document.slug, contentType));
}

async function getCommentForAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  commentId: string,
  documentId: string,
) {
  const { data, error } = await supabase
    .from("comments")
    .select("id, created_by, parent_comment_id")
    .eq("id", commentId)
    .eq("document_id", documentId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "댓글을 찾을 수 없습니다.");
  }

  return data;
}

export async function addComment(formData: FormData) {
  const { supabase, user } = await requireAuthenticatedMember();
  const parsed = commentSchema.parse({
    contentType: readString(formData, "content_type") || "term",
    documentId: readString(formData, "document_id"),
    parentCommentId: readString(formData, "parent_comment_id") || undefined,
    slug: readString(formData, "slug"),
  });
  const body = readString(formData, "body").trim();

  if (!body) {
    return;
  }

  if (parsed.parentCommentId) {
    const parentComment = await getCommentForAction(
      supabase,
      parsed.parentCommentId,
      parsed.documentId,
    );

    if (parentComment.parent_comment_id) {
      throw new Error("대댓글에는 답글을 달 수 없습니다.");
    }
  }

  const { error } = await supabase.from("comments").insert({
    document_id: parsed.documentId,
    body,
    created_by: user.id,
    parent_comment_id: parsed.parentCommentId ?? null,
    updated_by: user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidateDocumentPaths(parsed.slug, parsed.contentType);
}

export async function updateComment(formData: FormData) {
  const { member, supabase, user } = await requireAuthenticatedMember();
  const parsed = updateCommentSchema.parse({
    body: readString(formData, "body"),
    commentId: readString(formData, "comment_id"),
    contentType: readString(formData, "content_type") || "term",
    documentId: readString(formData, "document_id"),
    slug: readString(formData, "slug"),
  });
  const comment = await getCommentForAction(
    supabase,
    parsed.commentId,
    parsed.documentId,
  );

  if (comment.created_by !== user.id && !canEditContent(member)) {
    throw new Error("댓글을 수정할 권한이 없습니다.");
  }

  const { error } = await supabase
    .from("comments")
    .update({
      body: parsed.body,
      updated_by: user.id,
    })
    .eq("id", parsed.commentId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateDocumentPaths(parsed.slug, parsed.contentType);
}

export async function deleteComment(formData: FormData) {
  const { member, supabase, user } = await requireAuthenticatedMember();
  const parsed = deleteCommentSchema.parse({
    commentId: readString(formData, "comment_id"),
    contentType: readString(formData, "content_type") || "term",
    documentId: readString(formData, "document_id"),
    slug: readString(formData, "slug"),
  });
  const comment = await getCommentForAction(
    supabase,
    parsed.commentId,
    parsed.documentId,
  );

  if (comment.created_by !== user.id && !canEditContent(member)) {
    throw new Error("댓글을 삭제할 권한이 없습니다.");
  }

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", parsed.commentId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateDocumentPaths(parsed.slug, parsed.contentType);
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

export async function updateMyPassword(formData: FormData) {
  const { supabase } = await requireAuthenticatedMember();
  const next = safeRedirectPath(readString(formData, "next") || "/me");
  const parsed = passwordSchema.safeParse({
    currentPassword: readString(formData, "current_password"),
    password: readString(formData, "password"),
    passwordConfirm: readString(formData, "password_confirm"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const error =
      issue?.message === "password_mismatch"
        ? "mismatch"
        : issue?.message === "password_unchanged"
          ? "unchanged"
          : issue?.path[0] === "password"
            ? "length"
            : "invalid";

    redirect(passwordChangePath({ error, next }));
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect(passwordChangePath({ error: "session", next }));
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
    current_password: parsed.data.currentPassword,
  });

  if (updateError) {
    const message = updateError.message.toLowerCase();
    const code = updateError.code?.toLowerCase() ?? "";
    const error =
      code.includes("weak_password") ||
      /weak|minimum|at least|characters/.test(message)
        ? "length"
        : /current|invalid|password/.test(message)
          ? "current"
          : "update";

    if (process.env.NODE_ENV !== "production") {
      console.error("Supabase password update failed", {
        code: updateError.code,
        message: updateError.message,
        status: updateError.status,
      });
    }

    redirect(
      passwordChangePath({
        error,
        next,
      }),
    );
  }

  revalidatePath("/", "layout");
  revalidatePath("/me");
  redirect(next === "/me" ? "/me?notice=password" : next);
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
