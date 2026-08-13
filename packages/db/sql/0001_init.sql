-- Proofsheet init. Safe on local Postgres. On Supabase, auth.uid() policies are added
-- in 0002_supabase.sql when that project exists.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_email_idx on users (email);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references users(id),
  confidence_threshold numeric(4,3) not null default 0.920,
  stripe_customer_id text,
  stripe_subscription_id text,
  billing_status text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists memberships_workspace_user_idx on memberships (workspace_id, user_id);
create index if not exists memberships_user_idx on memberships (user_id);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  slug text not null,
  name text not null,
  modality text not null,
  json_schema jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists templates_workspace_slug_idx on templates (workspace_id, slug);
create index if not exists templates_workspace_idx on templates (workspace_id);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  template_id uuid not null references templates(id),
  uploaded_by uuid not null references users(id),
  title text not null,
  status text not null default 'uploaded',
  storage_path text not null,
  source_url text,
  mime_type text not null,
  page_count integer not null default 1,
  token_in integer not null default 0,
  token_out integer not null default 0,
  error text,
  provider_mode text not null default 'fixture',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_workspace_status_idx on documents (workspace_id, status);

create table if not exists document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  page_index integer not null,
  image_url text not null,
  width integer not null,
  height integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists document_pages_document_idx on document_pages (document_id);

create table if not exists fields (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key text not null,
  label text not null,
  model_value text,
  human_value text,
  confidence numeric(5,4),
  bounds jsonb,
  status text not null default 'needs_review',
  reviewed_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fields_document_idx on fields (document_id);

create table if not exists precontext_blobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  type text not null,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_queued_idx on jobs (status, created_at) where status = 'queued';

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  actor_id uuid references users(id),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document_id uuid references documents(id),
  pages integer not null default 1,
  token_in integer not null default 0,
  token_out integer not null default 0,
  stripe_meter_id text,
  created_at timestamptz not null default now()
);
create index if not exists usage_workspace_idx on usage_events (workspace_id);

create table if not exists stripe_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Session GUC used by the Next.js/worker app on local Postgres.
create or replace function app_current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

create or replace function app_user_workspace_ids() returns setof uuid
language sql stable as $$
  select workspace_id from memberships where user_id = app_current_user_id()
$$;

-- ENABLE without FORCE so the local table owner (docker user / worker) can
-- seed and process jobs. Supabase `authenticated` is not owner, so RLS applies.
alter table workspaces enable row level security;
alter table memberships enable row level security;
alter table templates enable row level security;
alter table documents enable row level security;
alter table document_pages enable row level security;
alter table fields enable row level security;
alter table precontext_blobs enable row level security;
alter table jobs enable row level security;
alter table audit_events enable row level security;
alter table usage_events enable row level security;
alter table users enable row level security;

drop policy if exists users_self on users;
create policy users_self on users
  using (id = app_current_user_id());

drop policy if exists workspaces_member on workspaces;
create policy workspaces_member on workspaces
  using (id in (select app_user_workspace_ids()));

drop policy if exists memberships_member on memberships;
create policy memberships_member on memberships
  using (workspace_id in (select app_user_workspace_ids()));

drop policy if exists templates_member on templates;
create policy templates_member on templates
  using (workspace_id in (select app_user_workspace_ids()));

drop policy if exists documents_member on documents;
create policy documents_member on documents
  using (workspace_id in (select app_user_workspace_ids()));

drop policy if exists document_pages_member on document_pages;
create policy document_pages_member on document_pages
  using (workspace_id in (select app_user_workspace_ids()));

drop policy if exists fields_member on fields;
create policy fields_member on fields
  using (workspace_id in (select app_user_workspace_ids()));

drop policy if exists precontext_member on precontext_blobs;
create policy precontext_member on precontext_blobs
  using (workspace_id in (select app_user_workspace_ids()));

drop policy if exists jobs_member on jobs;
create policy jobs_member on jobs
  using (workspace_id in (select app_user_workspace_ids()));

drop policy if exists audit_member on audit_events;
create policy audit_member on audit_events
  using (workspace_id in (select app_user_workspace_ids()));

drop policy if exists usage_member on usage_events;
create policy usage_member on usage_events
  using (workspace_id in (select app_user_workspace_ids()));
