create or replace function private.capture_document_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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

  return new;
end;
$$;

drop trigger if exists capture_document_revision on public.documents;

create trigger capture_document_revision
after insert or update on public.documents
for each row execute function private.capture_document_revision();
