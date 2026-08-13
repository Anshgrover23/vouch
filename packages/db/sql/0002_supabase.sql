-- Apply after connecting a Supabase project. Maps app.current_user_id to auth.uid()
-- when the GUC is empty, and adds a storage bucket.

create or replace function app_current_user_id() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('app.current_user_id', true), '')::uuid,
    auth.uid()
  )
$$;

insert into storage.buckets (id, name, public)
values ('source-files', 'source-files', false)
on conflict (id) do nothing;

drop policy if exists source_files_member on storage.objects;
create policy source_files_member on storage.objects
  for all
  using (
    bucket_id = 'source-files'
    and (storage.foldername(name))[1] in (
      select workspace_id::text from memberships where user_id = auth.uid()
    )
  );
