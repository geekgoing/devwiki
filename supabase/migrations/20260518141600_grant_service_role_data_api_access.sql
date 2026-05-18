grant usage on schema public to service_role;
grant usage on schema private to service_role;

grant execute on function private.is_devwiki_member() to service_role;
grant execute on function private.set_updated_at() to service_role;
grant execute on function private.capture_document_revision() to service_role;

grant all privileges on table public.members to service_role;
grant all privileges on table public.documents to service_role;
grant all privileges on table public.document_revisions to service_role;
grant all privileges on table public.tags to service_role;
grant all privileges on table public.document_tags to service_role;
grant all privileges on table public.comments to service_role;
