import { demoDocumentDetails, demoDocuments } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type {
  DocumentComment,
  DocumentDetail,
  DocumentRevision,
  DocumentSummary,
  Tag,
} from "@/types/devwiki";

type RawTagRelation = {
  tags?: Tag | Tag[] | null;
};

type RawDocument = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body_markdown?: string | null;
  status: DocumentSummary["status"];
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  document_tags?: RawTagRelation[] | null;
};

const DOCUMENT_LIST_SELECT =
  "id, slug, title, summary, status, created_at, updated_at, document_tags(tags(id, name, slug))";
const DOCUMENT_LIST_LIMIT = 100;
const DOCUMENT_SEARCH_PAGE_SIZE = 500;
const DOCUMENT_SEARCH_MAX_ROWS = 5000;

function flattenTags(relations?: RawTagRelation[] | null): Tag[] {
  if (!relations) {
    return [];
  }

  return relations.flatMap((relation) => {
    if (!relation.tags) {
      return [];
    }

    return Array.isArray(relation.tags) ? relation.tags : [relation.tags];
  });
}

function toDocumentSummary(row: RawDocument): DocumentSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: flattenTags(row.document_tags),
  };
}

function toDocumentDetail(row: RawDocument): DocumentDetail {
  return {
    ...toDocumentSummary(row),
    bodyMarkdown: row.body_markdown ?? "",
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
  };
}

function matchesQuery(document: DocumentSummary, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    document.title,
    document.summary ?? "",
    ...document.tags.map((tag) => tag.name),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export async function getDocuments(query = ""): Promise<DocumentSummary[]> {
  if (!isSupabaseConfigured()) {
    return demoDocuments.filter((document) => matchesQuery(document, query));
  }

  const supabase = await createClient();
  const normalizedQuery = query.trim();

  if (normalizedQuery) {
    const rows: RawDocument[] = [];

    for (
      let from = 0;
      from < DOCUMENT_SEARCH_MAX_ROWS;
      from += DOCUMENT_SEARCH_PAGE_SIZE
    ) {
      const to = from + DOCUMENT_SEARCH_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("documents")
        .select(DOCUMENT_LIST_SELECT)
        .order("updated_at", { ascending: false })
        .range(from, to);

      if (error) {
        throw new Error(error.message);
      }

      rows.push(...((data ?? []) as RawDocument[]));

      if (!data || data.length < DOCUMENT_SEARCH_PAGE_SIZE) {
        break;
      }
    }

    return rows.map(toDocumentSummary).filter((document) =>
      matchesQuery(document, normalizedQuery),
    );
  }

  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_LIST_SELECT)
    .order("updated_at", { ascending: false })
    .limit(DOCUMENT_LIST_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as RawDocument[])
    .map(toDocumentSummary)
    .filter((document) => matchesQuery(document, query));
}

export async function getDocumentBySlug(
  slug: string,
): Promise<DocumentDetail | null> {
  if (!isSupabaseConfigured()) {
    return demoDocumentDetails[slug] ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, slug, title, summary, body_markdown, status, created_at, updated_at, created_by, updated_by, document_tags(tags(id, name, slug))",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toDocumentDetail(data as RawDocument) : null;
}

export async function getDocumentRevisions(
  documentId: string,
): Promise<DocumentRevision[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_revisions")
    .select("id, title, summary, body_markdown, edit_summary, created_at, edited_by")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    bodyMarkdown: row.body_markdown,
    editSummary: row.edit_summary,
    createdAt: row.created_at,
    editedBy: row.edited_by,
  }));
}

export async function getDocumentComments(
  documentId: string,
): Promise<DocumentComment[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, body, created_at, created_by")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}

export async function slugExists(slug: string, exceptId?: string) {
  if (!isSupabaseConfigured()) {
    return Boolean(demoDocumentDetails[slug]);
  }

  const supabase = await createClient();
  let query = supabase.from("documents").select("id").eq("slug", slug).limit(1);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.length);
}
