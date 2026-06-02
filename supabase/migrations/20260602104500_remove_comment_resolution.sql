drop index if exists public.comments_document_resolved_created_idx;

alter table public.comments
drop column if exists resolved_by,
drop column if exists resolved_at;
