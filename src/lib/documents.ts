import { demoDocumentDetails, demoDocuments } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  DocumentComment,
  DocumentDetail,
  DocumentRevision,
  DocumentStatus,
  DocumentStatusFilter,
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
const DEFAULT_MEMBER_STATUSES: DocumentStatus[] = ["published", "draft"];
const DEFAULT_PUBLIC_STATUSES: DocumentStatus[] = ["published"];

type DocumentReadOptions = {
  canReadPrivate?: boolean;
};

type DocumentListOptions = DocumentReadOptions & {
  query?: string;
  status?: DocumentStatusFilter;
};

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

function visibleStatuses(
  status: DocumentStatusFilter = "active",
  canReadPrivate = false,
): DocumentStatus[] {
  if (status === "active") {
    return canReadPrivate ? DEFAULT_MEMBER_STATUSES : DEFAULT_PUBLIC_STATUSES;
  }

  if (status === "published") {
    return ["published"];
  }

  if (!canReadPrivate) {
    return [];
  }

  return [status];
}

function hasVisibleStatus(
  document: DocumentSummary,
  statuses: DocumentStatus[],
) {
  return statuses.includes(document.status);
}

function createReadClient(canReadPrivate: boolean) {
  return canReadPrivate ? createClient() : Promise.resolve(createAdminClient());
}

async function getCommentAuthorLabels(createdByIds: string[]) {
  const uniqueIds = Array.from(new Set(createdByIds.filter(Boolean)));
  const labels = new Map<string, string>();

  if (!uniqueIds.length || !isSupabaseConfigured()) {
    return labels;
  }

  const admin = createAdminClient();
  const userResults = await Promise.all(
    uniqueIds.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);

      if (error || !data.user?.email) {
        return { id, email: null };
      }

      return { id, email: data.user.email.toLowerCase() };
    }),
  );
  const emails = userResults
    .map((result) => result.email)
    .filter((email): email is string => Boolean(email));
  const memberNames = new Map<string, string>();

  if (emails.length) {
    const { data } = await admin
      .from("members")
      .select("email, display_name")
      .in("email", emails);

    (data ?? []).forEach((member) => {
      if (member.email) {
        memberNames.set(
          member.email.toLowerCase(),
          member.display_name || member.email,
        );
      }
    });
  }

  userResults.forEach((result) => {
    if (!result.email) {
      labels.set(result.id, result.id.slice(0, 8));
      return;
    }

    labels.set(result.id, memberNames.get(result.email) ?? result.email);
  });

  return labels;
}

export async function getDocuments({
  query = "",
  status = "active",
  canReadPrivate = false,
}: DocumentListOptions = {}): Promise<DocumentSummary[]> {
  const statuses = visibleStatuses(status, canReadPrivate);

  if (!statuses.length) {
    return [];
  }

  if (!isSupabaseConfigured()) {
    return demoDocuments.filter(
      (document) =>
        hasVisibleStatus(document, statuses) && matchesQuery(document, query),
    );
  }

  const supabase = await createReadClient(canReadPrivate);
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
        .in("status", statuses)
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
    .in("status", statuses)
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
  { canReadPrivate = false }: DocumentReadOptions = {},
): Promise<DocumentDetail | null> {
  if (!isSupabaseConfigured()) {
    const document = demoDocumentDetails[slug] ?? null;

    if (!document) {
      return null;
    }

    return hasVisibleStatus(
      document,
      visibleStatuses(document.status, canReadPrivate),
    )
      ? document
      : null;
  }

  const supabase = await createReadClient(canReadPrivate);
  let query = supabase
    .from("documents")
    .select(
      "id, slug, title, summary, body_markdown, status, created_at, updated_at, created_by, updated_by, document_tags(tags(id, name, slug))",
    )
    .eq("slug", slug);

  if (!canReadPrivate) {
    query = query.eq("status", "published");
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toDocumentDetail(data as RawDocument) : null;
}

export async function getDocumentRevisions(
  documentId: string,
  { canReadPrivate = false }: DocumentReadOptions = {},
): Promise<DocumentRevision[]> {
  if (!isSupabaseConfigured() || !canReadPrivate) {
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
  { canReadPrivate = false }: DocumentReadOptions = {},
): Promise<DocumentComment[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createReadClient(canReadPrivate);
  const { data, error } = await supabase
    .from("comments")
    .select("id, body, created_at, created_by")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const authorLabels = await getCommentAuthorLabels(
    rows.map((row) => row.created_by).filter(Boolean),
  );

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    createdBy: row.created_by,
    authorLabel: row.created_by
      ? (authorLabels.get(row.created_by) ?? row.created_by.slice(0, 8))
      : "알 수 없음",
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
