delete from public.document_member_states
where not is_favorite;

drop index if exists public.document_member_states_user_completed_idx;

alter table public.document_member_states
drop column if exists is_completed;
