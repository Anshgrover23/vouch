-- Share links and per-line roommate claims. Idempotent.

alter table documents add column if not exists share_token text;

update documents
set share_token = gen_random_uuid()::text
where share_token is null;

alter table documents alter column share_token set default gen_random_uuid()::text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'documents' and column_name = 'share_token' and is_nullable = 'YES'
  ) then
    alter table documents alter column share_token set not null;
  end if;
end $$;

create unique index if not exists documents_share_token_idx on documents (share_token);

create table if not exists split_claims (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  field_id uuid not null references fields(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  display_name text not null,
  stance text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists split_claims_doc_field_name_idx
  on split_claims (document_id, field_id, display_name);
create index if not exists split_claims_document_idx on split_claims (document_id);
create index if not exists split_claims_field_idx on split_claims (field_id);
create index if not exists split_claims_workspace_idx on split_claims (workspace_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'split_claims_stance_check') then
    alter table split_claims
      add constraint split_claims_stance_check check (stance in ('owe', 'not_mine'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'split_claims_name_len') then
    alter table split_claims
      add constraint split_claims_name_len check (char_length(btrim(display_name)) between 1 and 48);
  end if;
end $$;

alter table split_claims enable row level security;

drop policy if exists split_claims_member on split_claims;
create policy split_claims_member on split_claims
  using (workspace_id in (select app_user_workspace_ids()));
