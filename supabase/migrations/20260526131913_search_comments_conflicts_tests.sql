alter table public.documents
add column if not exists search_vector tsvector
generated always as (
  setweight(to_tsvector('simple', coalesce(title, '')), 'A')
  || setweight(to_tsvector('simple', coalesce(summary, '')), 'B')
  || setweight(to_tsvector('simple', coalesce(body_markdown, '')), 'C')
) stored;

create index if not exists documents_search_vector_idx
on public.documents using gin (search_vector);

create or replace function public.search_documents(
  p_query text,
  p_statuses text[],
  p_content_type text default null,
  p_interview_category text default null,
  p_limit integer default 100
)
returns table (
  document_id uuid,
  search_rank real,
  search_snippet text
)
language sql
stable
set search_path = public, extensions
as $$
  with prepared as (
    select
      nullif(btrim(p_query), '') as raw_query,
      websearch_to_tsquery('simple', nullif(btrim(p_query), '')) as ts_query
  ),
  ranked as (
    select
      documents.id as document_id,
      greatest(
        coalesce(ts_rank_cd(documents.search_vector, prepared.ts_query), 0),
        coalesce(similarity(lower(documents.title), lower(prepared.raw_query)), 0) * 0.8,
        coalesce(similarity(lower(coalesce(documents.summary, '')), lower(prepared.raw_query)), 0) * 0.5
      )::real as search_rank,
      case
        when documents.search_vector @@ prepared.ts_query then
          ts_headline(
            'simple',
            coalesce(nullif(documents.summary, ''), documents.body_markdown),
            prepared.ts_query,
            'StartSel=**, StopSel=**, MaxWords=32, MinWords=12, ShortWord=2, HighlightAll=false'
          )
        when nullif(documents.summary, '') is not null then documents.summary
        else left(regexp_replace(documents.body_markdown, '\s+', ' ', 'g'), 220)
      end as search_snippet,
      documents.updated_at
    from public.documents
    cross join prepared
    left join lateral (
      select string_agg(tags.name, ' ') as tag_names
      from public.document_tags
      join public.tags on tags.id = document_tags.tag_id
      where document_tags.document_id = documents.id
    ) tag_search on true
    where prepared.raw_query is not null
      and documents.status = any(p_statuses)
      and (p_content_type is null or documents.content_type = p_content_type)
      and (
        p_interview_category is null
        or documents.interview_category = p_interview_category
      )
      and (
        documents.search_vector @@ prepared.ts_query
        or position(
          lower(prepared.raw_query) in lower(concat_ws(
            ' ',
            documents.title,
            documents.summary,
            documents.body_markdown,
            tag_search.tag_names
          ))
        ) > 0
        or similarity(lower(documents.title), lower(prepared.raw_query)) > 0.2
        or similarity(lower(coalesce(documents.summary, '')), lower(prepared.raw_query)) > 0.2
      )
  )
  select ranked.document_id, ranked.search_rank, ranked.search_snippet
  from ranked
  order by ranked.search_rank desc, ranked.updated_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

grant execute on function public.search_documents(text, text[], text, text, integer)
to authenticated, service_role;

alter table public.comments
add column if not exists updated_by uuid references auth.users(id) on delete set null,
add column if not exists resolved_at timestamptz,
add column if not exists resolved_by uuid references auth.users(id) on delete set null;

update public.comments
set updated_by = created_by
where updated_by is null;

create index if not exists comments_document_resolved_created_idx
on public.comments (document_id, resolved_at, created_at);

drop policy if exists "Comment authors can update comments"
on public.comments;

create policy "Comment authors and editors can update comments"
on public.comments
for update
to authenticated
using (
  private.is_devwiki_member()
  and (
    created_by = auth.uid()
    or private.is_devwiki_editor()
  )
)
with check (
  private.is_devwiki_member()
  and (
    created_by = auth.uid()
    or private.is_devwiki_editor()
  )
);

drop policy if exists "Comment authors can delete comments"
on public.comments;

create policy "Comment authors and editors can delete comments"
on public.comments
for delete
to authenticated
using (
  private.is_devwiki_member()
  and (
    created_by = auth.uid()
    or private.is_devwiki_editor()
  )
);
