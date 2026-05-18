"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedMember } from "@/lib/auth";
import { slugify, toTagSlug } from "@/lib/slugify";
import type { Tag } from "@/types/devwiki";

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

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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

  return Array.from(new Map(tags.map((tag) => [toTagSlug(tag), tag])).entries())
    .filter(([slug]) => slug)
    .map(([slug, name]) => ({ slug, name }));
}

async function syncTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  tagsValue: string | undefined,
) {
  const parsedTags = parseTagNames(tagsValue);

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

export async function signInWithEmail(formData: FormData) {
  const email = readString(formData, "email").trim().toLowerCase();

  if (!email) {
    redirect("/login?error=email");
  }

  const supabase = await createClient();
  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/login?sent=1");
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

  await syncTags(supabase, data.id, parsed.tags);
  revalidatePath("/");
  redirect(`/documents/${data.slug}`);
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

  if (!parsed.id) {
    throw new Error("수정할 문서 ID가 없습니다.");
  }

  const slug = await uniqueSlug(slugify(parsed.slug || parsed.title), parsed.id);
  const { error } = await supabase
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
    .eq("id", parsed.id);

  if (error) {
    throw new Error(error.message);
  }

  await syncTags(supabase, parsed.id, parsed.tags);
  revalidatePath("/");
  revalidatePath(`/documents/${slug}`);
  redirect(`/documents/${slug}`);
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

  revalidatePath(`/documents/${slug}`);
}
