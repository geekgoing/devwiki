create table if not exists public.document_member_states (
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_favorite boolean not null default false,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create index if not exists document_member_states_user_favorite_idx
on public.document_member_states (user_id, is_favorite, updated_at desc)
where is_favorite;

create index if not exists document_member_states_user_completed_idx
on public.document_member_states (user_id, is_completed, updated_at desc)
where is_completed;

drop trigger if exists set_document_member_states_updated_at
on public.document_member_states;

create trigger set_document_member_states_updated_at
before update on public.document_member_states
for each row execute function private.set_updated_at();

alter table public.document_member_states enable row level security;

grant select, insert, update, delete
on public.document_member_states
to authenticated;

grant all privileges on table public.document_member_states
to service_role;

drop policy if exists "Members can read their own document states"
on public.document_member_states;

create policy "Members can read their own document states"
on public.document_member_states
for select
to authenticated
using (
  private.is_devwiki_member()
  and user_id = auth.uid()
);

drop policy if exists "Members can create their own document states"
on public.document_member_states;

create policy "Members can create their own document states"
on public.document_member_states
for insert
to authenticated
with check (
  private.is_devwiki_member()
  and user_id = auth.uid()
);

drop policy if exists "Members can update their own document states"
on public.document_member_states;

create policy "Members can update their own document states"
on public.document_member_states
for update
to authenticated
using (
  private.is_devwiki_member()
  and user_id = auth.uid()
)
with check (
  private.is_devwiki_member()
  and user_id = auth.uid()
);

drop policy if exists "Members can delete their own document states"
on public.document_member_states;

create policy "Members can delete their own document states"
on public.document_member_states
for delete
to authenticated
using (
  private.is_devwiki_member()
  and user_id = auth.uid()
);
