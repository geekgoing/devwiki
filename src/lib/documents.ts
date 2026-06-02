import { unstable_cache } from "next/cache";

import { demoDocumentDetails, demoDocuments } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  DocumentComment,
  DocumentContentType,
  DocumentDetail,
  DocumentMemberState,
  InterviewCategory,
  DocumentRevision,
  DocumentStatus,
  DocumentStatusFilter,
  DocumentSummary,
  RelatedDocument,
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
  content_type?: DocumentContentType | null;
  interview_category?: InterviewCategory | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  document_tags?: RawTagRelation[] | null;
};

type RawDocumentLink = {
  source_document_id?: string;
  target_document_id: string;
};

type RawDocumentMemberState = {
  document_id: string;
  is_favorite: boolean;
};

type RawDocumentSearchHit = {
  document_id: string;
  search_rank: number | null;
  search_snippet: string | null;
};

type RawComment = {
  id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
};

const DOCUMENT_LIST_SELECT =
  "id, slug, title, summary, status, content_type, interview_category, created_at, updated_at, document_tags(tags(id, name, slug))";
const DOCUMENT_LIST_LIMIT = 100;
const DOCUMENT_SEARCH_PAGE_SIZE = 500;
const DOCUMENT_SEARCH_MAX_ROWS = 5000;
const DOCUMENT_SEARCH_LIMIT = 100;
const DEFAULT_MEMBER_STATUSES: DocumentStatus[] = ["published", "draft"];
const DOCUMENT_DETAIL_SELECT =
  "id, slug, title, summary, body_markdown, status, content_type, interview_category, created_at, updated_at, created_by, updated_by, document_tags(tags(id, name, slug))";
const DOCUMENT_CACHE_REVALIDATE_SECONDS = 300;

export const DEVWIKI_DOCUMENTS_CACHE_TAG = "devwiki:documents";

type DocumentReadOptions = {
  canReadPrivate?: boolean;
  viewerId?: string | null;
};

type DocumentListOptions = DocumentReadOptions & {
  contentType?: DocumentContentType;
  favoritesOnly?: boolean;
  interviewCategory?: InterviewCategory;
  query?: string;
  status?: DocumentStatusFilter;
};

type DocumentListRowQuery = {
  contentType?: DocumentContentType;
  interviewCategory?: InterviewCategory;
  includeSearchRows: boolean;
  statuses: DocumentStatus[];
};

type SupabaseReader =
  | Awaited<ReturnType<typeof createClient>>
  | ReturnType<typeof createAdminClient>;

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

function toDocumentSummary(
  row: RawDocument,
  state: DocumentMemberState = {
    isFavorite: false,
  },
  searchSnippet?: string | null,
): DocumentSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    searchSnippet,
    status: row.status,
    contentType: row.content_type ?? "term",
    interviewCategory: row.interview_category ?? null,
    isFavorite: state.isFavorite,
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
    return canReadPrivate ? DEFAULT_MEMBER_STATUSES : [];
  }

  if (status === "published") {
    return ["published"];
  }

  return canReadPrivate ? [status] : [];
}

function canUseDocumentCache(canReadPrivate: boolean) {
  return (
    canReadPrivate &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

async function selectDocumentRows(
  supabase: SupabaseReader,
  {
    contentType,
    includeSearchRows,
    interviewCategory,
    statuses,
  }: DocumentListRowQuery,
): Promise<RawDocument[]> {
  if (includeSearchRows) {
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
        .match({
          ...(contentType ? { content_type: contentType } : {}),
          ...(interviewCategory
            ? { interview_category: interviewCategory }
            : {}),
        })
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

    return rows;
  }

  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_LIST_SELECT)
    .in("status", statuses)
    .match({
      ...(contentType ? { content_type: contentType } : {}),
      ...(interviewCategory ? { interview_category: interviewCategory } : {}),
    })
    .order("updated_at", { ascending: false })
    .limit(DOCUMENT_LIST_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RawDocument[];
}

async function selectDocumentRowsByIds(
  supabase: SupabaseReader,
  documentIds: string[],
) {
  if (!documentIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_LIST_SELECT)
    .in("id", documentIds);

  if (error) {
    throw new Error(error.message);
  }

  const rowById = new Map(
    ((data ?? []) as RawDocument[]).map((row) => [row.id, row]),
  );

  return documentIds
    .map((id) => rowById.get(id))
    .filter((row): row is RawDocument => Boolean(row));
}

function isMissingSearchFunctionError(error?: { message?: string } | null) {
  if (!error?.message) {
    return false;
  }

  return (
    error.message.includes("search_documents") &&
    /does not exist|could not find|schema cache|function/i.test(error.message)
  );
}

async function searchDocumentRows(
  supabase: SupabaseReader,
  {
    contentType,
    interviewCategory,
    statuses,
  }: Omit<DocumentListRowQuery, "includeSearchRows">,
  query: string,
) {
  const { data, error } = await supabase.rpc("search_documents", {
    p_content_type: contentType ?? null,
    p_interview_category: interviewCategory ?? null,
    p_limit: DOCUMENT_SEARCH_LIMIT,
    p_query: query,
    p_statuses: statuses,
  });

  if (error) {
    if (isMissingSearchFunctionError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  const hits = (data ?? []) as RawDocumentSearchHit[];
  const rows = await selectDocumentRowsByIds(
    supabase,
    hits.map((hit) => hit.document_id),
  );
  const snippetById = new Map(
    hits.map((hit) => [hit.document_id, hit.search_snippet]),
  );

  return {
    rows,
    snippetById,
  };
}

const getCachedDocumentRows = unstable_cache(
  async (query: DocumentListRowQuery) => {
    const admin = createAdminClient();
    return selectDocumentRows(admin, query);
  },
  ["devwiki-document-list-rows"],
  {
    revalidate: DOCUMENT_CACHE_REVALIDATE_SECONDS,
    tags: [DEVWIKI_DOCUMENTS_CACHE_TAG],
  },
);

async function selectDocumentRowBySlug(
  supabase: SupabaseReader,
  slug: string,
) {
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_DETAIL_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as RawDocument | null;
}

const getCachedDocumentRowBySlug = unstable_cache(
  async (slug: string) => {
    const admin = createAdminClient();
    return selectDocumentRowBySlug(admin, slug);
  },
  ["devwiki-document-detail-row"],
  {
    revalidate: DOCUMENT_CACHE_REVALIDATE_SECONDS,
    tags: [DEVWIKI_DOCUMENTS_CACHE_TAG],
  },
);

function hasVisibleStatus(
  document: DocumentSummary,
  statuses: DocumentStatus[],
) {
  return statuses.includes(document.status);
}

function matchesFavoriteFilter(document: DocumentSummary, favoritesOnly = false) {
  return !favoritesOnly || document.isFavorite;
}

async function getDocumentStateMap(documentIds: string[], viewerId?: string | null) {
  const stateMap = new Map<string, DocumentMemberState>();

  if (!viewerId || !documentIds.length || !isSupabaseConfigured()) {
    return stateMap;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_member_states")
    .select("document_id, is_favorite")
    .eq("user_id", viewerId)
    .in("document_id", documentIds);

  if (error) {
    throw new Error(error.message);
  }

  ((data ?? []) as RawDocumentMemberState[]).forEach((row) => {
    stateMap.set(row.document_id, {
      isFavorite: row.is_favorite,
    });
  });

  return stateMap;
}

async function attachDocumentStates(
  rows: RawDocument[],
  viewerId?: string | null,
  snippetById: Map<string, string | null> = new Map(),
) {
  const stateMap = await getDocumentStateMap(
    rows.map((row) => row.id),
    viewerId,
  );

  return rows.map((row) =>
    toDocumentSummary(row, stateMap.get(row.id), snippetById.get(row.id)),
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
  contentType,
  favoritesOnly = false,
  interviewCategory,
  query = "",
  status = "active",
  canReadPrivate = false,
  viewerId = null,
}: DocumentListOptions = {}): Promise<DocumentSummary[]> {
  const statuses = visibleStatuses(status, canReadPrivate);

  if (!statuses.length) {
    return [];
  }

  if (!isSupabaseConfigured()) {
    return demoDocuments.filter(
      (document) =>
        hasVisibleStatus(document, statuses) &&
        (!contentType || document.contentType === contentType) &&
        (!interviewCategory ||
          document.interviewCategory === interviewCategory) &&
        matchesFavoriteFilter(document, favoritesOnly) &&
        matchesQuery(document, query),
    );
  }

  const normalizedQuery = query.trim();
  const supabase = canUseDocumentCache(canReadPrivate)
    ? createAdminClient()
    : await createClient();
  const rowQuery = {
    contentType,
    includeSearchRows: Boolean(normalizedQuery),
    interviewCategory,
    statuses,
  };

  if (normalizedQuery) {
    const searched = await searchDocumentRows(
      supabase,
      {
        contentType,
        interviewCategory,
        statuses,
      },
      normalizedQuery,
    );

    if (searched) {
      const documents = await attachDocumentStates(
        searched.rows,
        viewerId,
        searched.snippetById,
      );

      return documents.filter((document) =>
        matchesFavoriteFilter(document, favoritesOnly),
      );
    }
  }

  const rows =
    canUseDocumentCache(canReadPrivate) && !normalizedQuery
      ? await getCachedDocumentRows(rowQuery)
      : await selectDocumentRows(supabase, rowQuery);
  const documents = await attachDocumentStates(rows, viewerId);

  return documents.filter(
    (document) =>
      matchesFavoriteFilter(document, favoritesOnly) &&
      matchesQuery(document, normalizedQuery),
  );
}

export async function getDocumentBySlug(
  slug: string,
  { canReadPrivate = false, viewerId = null }: DocumentReadOptions = {},
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

  if (!canReadPrivate) {
    return null;
  }

  const data = canUseDocumentCache(canReadPrivate)
    ? await getCachedDocumentRowBySlug(slug)
    : await selectDocumentRowBySlug(await createClient(), slug);

  if (!data) {
    return null;
  }

  const stateMap = await getDocumentStateMap([data.id], viewerId);
  return {
    ...toDocumentDetail(data as RawDocument),
    ...(stateMap.get(data.id) ?? {
      isFavorite: false,
    }),
  };
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

  const rows = data ?? [];
  const editorLabels = await getCommentAuthorLabels(
    rows
      .map((row) => row.edited_by)
      .filter((id): id is string => Boolean(id)),
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    bodyMarkdown: row.body_markdown,
    editSummary: row.edit_summary,
    createdAt: row.created_at,
    editedBy: row.edited_by,
    editedByLabel: row.edited_by
      ? (editorLabels.get(row.edited_by) ?? row.edited_by.slice(0, 8))
      : null,
  }));
}

export async function getDocumentComments(
  documentId: string,
  { canReadPrivate = false }: DocumentReadOptions = {},
): Promise<DocumentComment[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  if (!canReadPrivate) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, body, created_at, created_by, updated_at, updated_by, resolved_at, resolved_by",
    )
    .eq("document_id", documentId)
    .order("resolved_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as RawComment[];
  const authorLabels = await getCommentAuthorLabels(
    rows
      .flatMap((row) => [row.created_by, row.updated_by, row.resolved_by])
      .filter((id): id is string => Boolean(id)),
  );

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    createdBy: row.created_by,
    authorLabel: row.created_by
      ? (authorLabels.get(row.created_by) ?? row.created_by.slice(0, 8))
      : "알 수 없음",
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    editorLabel: row.updated_by
      ? (authorLabels.get(row.updated_by) ?? row.updated_by.slice(0, 8))
      : null,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolvedByLabel: row.resolved_by
      ? (authorLabels.get(row.resolved_by) ?? row.resolved_by.slice(0, 8))
      : null,
  }));
}

export async function getRelatedDocuments(
  documentId: string,
  { canReadPrivate = false }: DocumentReadOptions = {},
): Promise<RelatedDocument[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  if (!canReadPrivate) {
    return [];
  }

  const supabase = await createClient();
  const { data: linkRows, error: linkError } = await supabase
    .from("document_links")
    .select("target_document_id")
    .eq("source_document_id", documentId);

  if (linkError) {
    if (isMissingDocumentLinksError(linkError)) {
      return [];
    }

    throw new Error(linkError.message);
  }

  const targetIds = ((linkRows ?? []) as RawDocumentLink[]).map(
    (row) => row.target_document_id,
  );

  if (!targetIds.length) {
    return [];
  }

  const query = supabase
    .from("documents")
    .select(DOCUMENT_LIST_SELECT)
    .in("id", targetIds);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const documentById = new Map(
    ((data ?? []) as RawDocument[]).map((document) => [
      document.id,
      toDocumentSummary(document),
    ]),
  );

  return targetIds
    .map((id) => documentById.get(id))
    .filter((document): document is RelatedDocument => Boolean(document));
}

export async function getBacklinkDocuments(
  documentId: string,
  { canReadPrivate = false }: DocumentReadOptions = {},
): Promise<RelatedDocument[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  if (!canReadPrivate) {
    return [];
  }

  const supabase = await createClient();
  const { data: linkRows, error: linkError } = await supabase
    .from("document_links")
    .select("source_document_id")
    .eq("target_document_id", documentId);

  if (linkError) {
    if (isMissingDocumentLinksError(linkError)) {
      return [];
    }

    throw new Error(linkError.message);
  }

  const sourceIds = ((linkRows ?? []) as RawDocumentLink[])
    .map((row) => row.source_document_id)
    .filter((id): id is string => Boolean(id));

  if (!sourceIds.length) {
    return [];
  }

  const query = supabase
    .from("documents")
    .select(DOCUMENT_LIST_SELECT)
    .in("id", sourceIds);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const documentById = new Map(
    ((data ?? []) as RawDocument[]).map((document) => [
      document.id,
      toDocumentSummary(document),
    ]),
  );

  return sourceIds
    .map((id) => documentById.get(id))
    .filter((document): document is RelatedDocument => Boolean(document));
}

export async function getRelatedDocumentIds(
  documentId: string,
  { canReadPrivate = false }: DocumentReadOptions = {},
): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  if (!canReadPrivate) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_links")
    .select("target_document_id")
    .eq("source_document_id", documentId);

  if (error) {
    if (isMissingDocumentLinksError(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  return ((data ?? []) as RawDocumentLink[]).map(
    (row) => row.target_document_id,
  );
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
