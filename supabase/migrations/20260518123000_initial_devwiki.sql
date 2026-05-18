create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;

create table public.study_members (
  email text primary key,
  display_name text,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (position('@' in email) > 1)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (
    char_length(slug) between 1 and 90
    and slug !~ '(^-|-$|--|[[:space:]/?#]+)'
  ),
  title text not null check (char_length(title) between 1 and 120),
  summary text check (summary is null or char_length(summary) <= 300),
  body_markdown text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  edit_summary text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  title text not null,
  summary text,
  body_markdown text not null,
  edit_summary text,
  edited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  slug text not null unique check (
    char_length(slug) between 1 and 60
    and slug !~ '(^-|-$|--|[[:space:]/?#]+)'
  ),
  created_at timestamptz not null default now()
);

create table public.document_tags (
  document_id uuid not null references public.documents(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, tag_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_updated_at_idx on public.documents (updated_at desc);
create index documents_title_trgm_idx on public.documents using gin (title gin_trgm_ops);
create index documents_summary_trgm_idx on public.documents using gin (summary gin_trgm_ops);
create index documents_body_trgm_idx on public.documents using gin (body_markdown gin_trgm_ops);
create index document_revisions_document_id_idx on public.document_revisions (document_id, created_at desc);
create index comments_document_id_idx on public.comments (document_id, created_at);
create index tags_name_idx on public.tags (name);

create or replace function private.is_devwiki_member()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.study_members member
    where member.is_active
      and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.capture_document_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
    or old.title is distinct from new.title
    or old.summary is distinct from new.summary
    or old.body_markdown is distinct from new.body_markdown
    or old.status is distinct from new.status
  then
    insert into public.document_revisions (
      document_id,
      title,
      summary,
      body_markdown,
      edit_summary,
      edited_by
    )
    values (
      new.id,
      new.title,
      new.summary,
      new.body_markdown,
      new.edit_summary,
      new.updated_by
    );
  end if;

  return new;
end;
$$;

create trigger set_documents_updated_at
before update on public.documents
for each row execute function private.set_updated_at();

create trigger set_comments_updated_at
before update on public.comments
for each row execute function private.set_updated_at();

create trigger capture_document_revision
after insert or update of title, summary, body_markdown, status on public.documents
for each row execute function private.capture_document_revision();

alter table public.study_members enable row level security;
alter table public.documents enable row level security;
alter table public.document_revisions enable row level security;
alter table public.tags enable row level security;
alter table public.document_tags enable row level security;
alter table public.comments enable row level security;

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_devwiki_member() to authenticated;

grant select on public.study_members to authenticated;
grant select, insert, update on public.documents to authenticated;
grant select, insert on public.document_revisions to authenticated;
grant select, insert, update on public.tags to authenticated;
grant select, insert, delete on public.document_tags to authenticated;
grant select, insert, update, delete on public.comments to authenticated;

create policy "Users can read their own membership"
on public.study_members
for select
to authenticated
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "Members can read documents"
on public.documents
for select
to authenticated
using (private.is_devwiki_member());

create policy "Members can create documents"
on public.documents
for insert
to authenticated
with check (
  private.is_devwiki_member()
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "Members can update documents"
on public.documents
for update
to authenticated
using (private.is_devwiki_member())
with check (
  private.is_devwiki_member()
  and updated_by = auth.uid()
);

create policy "Members can read revisions"
on public.document_revisions
for select
to authenticated
using (private.is_devwiki_member());

create policy "Members can insert revisions"
on public.document_revisions
for insert
to authenticated
with check (
  private.is_devwiki_member()
  and edited_by = auth.uid()
);

create policy "Members can read tags"
on public.tags
for select
to authenticated
using (private.is_devwiki_member());

create policy "Members can create tags"
on public.tags
for insert
to authenticated
with check (private.is_devwiki_member());

create policy "Members can update tags"
on public.tags
for update
to authenticated
using (private.is_devwiki_member())
with check (private.is_devwiki_member());

create policy "Members can read document tags"
on public.document_tags
for select
to authenticated
using (private.is_devwiki_member());

create policy "Members can create document tags"
on public.document_tags
for insert
to authenticated
with check (private.is_devwiki_member());

create policy "Members can delete document tags"
on public.document_tags
for delete
to authenticated
using (private.is_devwiki_member());

create policy "Members can read comments"
on public.comments
for select
to authenticated
using (private.is_devwiki_member());

create policy "Members can create comments"
on public.comments
for insert
to authenticated
with check (
  private.is_devwiki_member()
  and created_by = auth.uid()
);

create policy "Comment authors can update comments"
on public.comments
for update
to authenticated
using (
  private.is_devwiki_member()
  and created_by = auth.uid()
)
with check (
  private.is_devwiki_member()
  and created_by = auth.uid()
);

create policy "Comment authors can delete comments"
on public.comments
for delete
to authenticated
using (
  private.is_devwiki_member()
  and created_by = auth.uid()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'devwiki-assets',
  'devwiki-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Members can read DevWiki assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'devwiki-assets'
  and private.is_devwiki_member()
);

create policy "Members can upload DevWiki assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'devwiki-assets'
  and private.is_devwiki_member()
);

create policy "Members can update their DevWiki assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'devwiki-assets'
  and private.is_devwiki_member()
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'devwiki-assets'
  and private.is_devwiki_member()
  and owner_id = (select auth.uid()::text)
);

create policy "Members can delete their DevWiki assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'devwiki-assets'
  and private.is_devwiki_member()
  and owner_id = (select auth.uid()::text)
);

-- Replace these with the five study member emails before real use.
-- insert into public.study_members (email, display_name, role)
-- values
--   ('you@example.com', 'You', 'owner'),
--   ('member1@example.com', 'Member 1', 'editor')
-- on conflict (email) do update
-- set display_name = excluded.display_name,
--     role = excluded.role,
--     is_active = true;
