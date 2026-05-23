import { unstable_cache } from "next/cache";

import { demoDocumentDetails, demoDocuments } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  DocumentComment,
  DocumentContentType,
  DocumentDetail,
  DocumentLearningFilter,
  DocumentLearningState,
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
  is_completed: boolean;
  is_favorite: boolean;
};

const DOCUMENT_LIST_SELECT =
  "id, slug, title, summary, status, content_type, interview_category, created_at, updated_at, document_tags(tags(id, name, slug))";
const DOCUMENT_LIST_LIMIT = 100;
const DOCUMENT_SEARCH_PAGE_SIZE = 500;
const DOCUMENT_SEARCH_MAX_ROWS = 5000;
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
  interviewCategory?: InterviewCategory;
  learning?: DocumentLearningFilter;
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
  state: DocumentLearningState = {
    isCompleted: false,
    isFavorite: false,
  },
): DocumentSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status: row.status,
    contentType: row.content_type ?? "term",
    interviewCategory: row.interview_category ?? null,
    isCompleted: state.isCompleted,
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

function matchesLearningFilter(
  document: DocumentSummary,
  learning: DocumentLearningFilter = "all",
) {
  if (learning === "favorite") {
    return document.isFavorite;
  }

  if (learning === "completed") {
    return document.isCompleted;
  }

  if (learning === "todo") {
    return !document.isCompleted;
  }

  return true;
}

async function getDocumentStateMap(documentIds: string[], viewerId?: string | null) {
  const stateMap = new Map<string, DocumentLearningState>();

  if (!viewerId || !documentIds.length || !isSupabaseConfigured()) {
    return stateMap;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_member_states")
    .select("document_id, is_favorite, is_completed")
    .eq("user_id", viewerId)
    .in("document_id", documentIds);

  if (error) {
    throw new Error(error.message);
  }

  ((data ?? []) as RawDocumentMemberState[]).forEach((row) => {
    stateMap.set(row.document_id, {
      isCompleted: row.is_completed,
      isFavorite: row.is_favorite,
    });
  });

  return stateMap;
}

async function attachDocumentStates(
  rows: RawDocument[],
  viewerId?: string | null,
) {
  const stateMap = await getDocumentStateMap(
    rows.map((row) => row.id),
    viewerId,
  );

  return rows.map((row) => toDocumentSummary(row, stateMap.get(row.id)));
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
  interviewCategory,
  learning = "all",
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
        matchesLearningFilter(document, learning) &&
        matchesQuery(document, query),
    );
  }

  const normalizedQuery = query.trim();
  const rowQuery = {
    contentType,
    includeSearchRows: Boolean(normalizedQuery),
    interviewCategory,
    statuses,
  };
  const rows = canUseDocumentCache(canReadPrivate)
    ? await getCachedDocumentRows(rowQuery)
    : await selectDocumentRows(await createClient(), rowQuery);
  const documents = await attachDocumentStates(rows, viewerId);

  return documents.filter(
    (document) =>
      matchesLearningFilter(document, learning) &&
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
      isCompleted: false,
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

  if (!canReadPrivate) {
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
