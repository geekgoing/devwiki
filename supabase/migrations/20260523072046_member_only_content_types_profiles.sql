alter table public.documents
add column if not exists content_type text not null default 'term'
  check (content_type in ('term', 'interview_qa', 'scenario')),
add column if not exists interview_category text
  check (interview_category in ('technical', 'behavioral'));

alter table public.documents
add constraint documents_interview_category_scope_check
check (
  (content_type = 'interview_qa' and interview_category is not null)
  or (content_type <> 'interview_qa' and interview_category is null)
)
not valid;

update public.documents
set interview_category = null
where content_type <> 'interview_qa'
  and interview_category is not null;

alter table public.documents
validate constraint documents_interview_category_scope_check;

create index if not exists documents_content_type_status_updated_at_idx
on public.documents (content_type, status, updated_at desc);

create index if not exists documents_interview_category_idx
on public.documents (interview_category)
where interview_category is not null;

create or replace function private.devwiki_member_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select member.role
  from public.members member
  where member.is_active
    and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

create or replace function private.is_devwiki_editor()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(private.devwiki_member_role() in ('owner', 'editor'), false);
$$;

grant execute on function private.devwiki_member_role() to authenticated;
grant execute on function private.is_devwiki_editor() to authenticated;
grant update (display_name) on public.members to authenticated;

drop policy if exists "Members can update their own display name"
on public.members;

create policy "Members can update their own display name"
on public.members
for update
to authenticated
using (
  is_active
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  is_active
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Members can create documents" on public.documents;
drop policy if exists "Members can update documents" on public.documents;

create policy "Editors can create documents"
on public.documents
for insert
to authenticated
with check (
  private.is_devwiki_editor()
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "Editors can update documents"
on public.documents
for update
to authenticated
using (private.is_devwiki_editor())
with check (
  private.is_devwiki_editor()
  and updated_by = auth.uid()
);

drop policy if exists "Members can insert revisions" on public.document_revisions;

create policy "Editors can insert revisions"
on public.document_revisions
for insert
to authenticated
with check (
  private.is_devwiki_editor()
  and edited_by = auth.uid()
);

drop policy if exists "Members can create tags" on public.tags;
drop policy if exists "Members can update tags" on public.tags;

create policy "Editors can create tags"
on public.tags
for insert
to authenticated
with check (private.is_devwiki_editor());

create policy "Editors can update tags"
on public.tags
for update
to authenticated
using (private.is_devwiki_editor())
with check (private.is_devwiki_editor());

drop policy if exists "Members can create document tags" on public.document_tags;
drop policy if exists "Members can delete document tags" on public.document_tags;

create policy "Editors can create document tags"
on public.document_tags
for insert
to authenticated
with check (private.is_devwiki_editor());

create policy "Editors can delete document tags"
on public.document_tags
for delete
to authenticated
using (private.is_devwiki_editor());

drop policy if exists "Members can create document links" on public.document_links;
drop policy if exists "Members can delete document links" on public.document_links;

create policy "Editors can create document links"
on public.document_links
for insert
to authenticated
with check (
  private.is_devwiki_editor()
  and created_by = auth.uid()
);

create policy "Editors can delete document links"
on public.document_links
for delete
to authenticated
using (private.is_devwiki_editor());

drop policy if exists "Members can upload DevWiki assets" on storage.objects;
drop policy if exists "Members can update their DevWiki assets" on storage.objects;
drop policy if exists "Members can delete their DevWiki assets" on storage.objects;

create policy "Editors can upload DevWiki assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'devwiki-assets'
  and private.is_devwiki_editor()
);

create policy "Editors can update their DevWiki assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'devwiki-assets'
  and private.is_devwiki_editor()
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'devwiki-assets'
  and private.is_devwiki_editor()
  and owner_id = (select auth.uid()::text)
);

create policy "Editors can delete their DevWiki assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'devwiki-assets'
  and private.is_devwiki_editor()
  and owner_id = (select auth.uid()::text)
);

update public.members
set display_name = trim(concat(
  (array[
    '부끄러운', '차분한', '꼼꼼한', '용감한',
    '느긋한', '명랑한', '성실한', '기민한'
  ])[floor(random() * 8 + 1)::int],
  ' ',
  (array[
    '원숭이', '고래', '여우', '판다',
    '수달', '참새', '고양이', '강아지'
  ])[floor(random() * 8 + 1)::int]
))
where display_name is null
   or btrim(display_name) = '';
