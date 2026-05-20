create table if not exists public.document_links (
  source_document_id uuid not null references public.documents(id) on delete cascade,
  target_document_id uuid not null references public.documents(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (source_document_id, target_document_id),
  check (source_document_id <> target_document_id)
);

create index if not exists document_links_target_document_id_idx
on public.document_links (target_document_id);

alter table public.document_links enable row level security;

grant select, insert, delete on public.document_links to authenticated;
grant all privileges on table public.document_links to service_role;

create policy "Members can read document links"
on public.document_links
for select
to authenticated
using (private.is_devwiki_member());

create policy "Members can create document links"
on public.document_links
for insert
to authenticated
with check (
  private.is_devwiki_member()
  and created_by = auth.uid()
);

create policy "Members can delete document links"
on public.document_links
for delete
to authenticated
using (private.is_devwiki_member());
