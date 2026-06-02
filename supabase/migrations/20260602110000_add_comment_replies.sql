alter table public.comments
add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;

create index if not exists comments_document_parent_created_idx
on public.comments (document_id, parent_comment_id, created_at);

create or replace function private.ensure_comment_reply_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_record record;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  if new.parent_comment_id = new.id then
    raise exception 'A comment cannot reply to itself';
  end if;

  select document_id, parent_comment_id
  into parent_record
  from public.comments
  where id = new.parent_comment_id;

  if not found then
    raise exception 'Parent comment not found';
  end if;

  if parent_record.document_id <> new.document_id then
    raise exception 'Reply parent must belong to the same document';
  end if;

  if parent_record.parent_comment_id is not null then
    raise exception 'Replies cannot have nested replies';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_comment_reply_parent
on public.comments;

create trigger ensure_comment_reply_parent
before insert or update of parent_comment_id, document_id
on public.comments
for each row
execute function private.ensure_comment_reply_parent();
