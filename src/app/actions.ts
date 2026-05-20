"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedMember } from "@/lib/auth";
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
  tags: z.string().trim().optional(),
  editSummary: z.string().trim().max(160).optional(),
});

const restoreRevisionSchema = z.object({
  documentId: z.string().uuid(),
  revisionId: z.string().uuid(),
});

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function documentPath(slug: string) {
  return `/documents/${encodeURIComponent(slug)}`;
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

export async function signInWithPassword(formData: FormData) {
  const email = readString(formData, "email").trim().toLowerCase();
  const password = readString(formData, "password");

  if (!email) {
    redirect("/login?error=email");
  }

  if (!password) {
    redirect("/login?error=password");
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
    redirect(`/login?error=${reason}`);
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createDocument(formData: FormData) {
  const { supabase, user } = await requireAuthenticatedMember();
  const parsed = documentSchema.parse({
    title: readString(formData, "title"),
    slug: readString(formData, "slug"),
    summary: readString(formData, "summary"),
    bodyMarkdown: readString(formData, "body_markdown"),
    status: readString(formData, "status") || "draft",
    tags: readString(formData, "tags"),
    editSummary: readString(formData, "edit_summary"),
  });
  const parsedTags = parseTagNames(parsed.tags);
  const slug = await uniqueSlug(slugify(parsed.slug || parsed.title));

  const { data, error } = await supabase
    .from("documents")
    .insert({
      slug,
      title: parsed.title,
      summary: parsed.summary || null,
      body_markdown: parsed.bodyMarkdown,
      status: parsed.status,
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
  revalidatePath("/");
  redirect(documentPath(data.slug));
}

export async function updateDocument(formData: FormData) {
  const { supabase, user } = await requireAuthenticatedMember();
  const parsed = documentSchema.parse({
    id: readString(formData, "id"),
    title: readString(formData, "title"),
    slug: readString(formData, "slug"),
    summary: readString(formData, "summary"),
    bodyMarkdown: readString(formData, "body_markdown"),
    status: readString(formData, "status") || "draft",
    tags: readString(formData, "tags"),
    editSummary: readString(formData, "edit_summary"),
  });
  const parsedTags = parseTagNames(parsed.tags);

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
  revalidatePath("/");
  revalidatePath(documentPath(currentDocument.slug));
  revalidatePath(`${documentPath(currentDocument.slug)}/edit`);
  revalidatePath(documentPath(slug));
  revalidatePath(`${documentPath(slug)}/edit`);
  redirect(documentPath(slug));
}

export async function restoreDocumentRevision(formData: FormData) {
  const { supabase, user } = await requireAuthenticatedMember();
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
