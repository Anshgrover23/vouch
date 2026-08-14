-- Email/password users, onboarding flag, and groups. Idempotent.

alter table users add column if not exists password_hash text;
alter table users add column if not exists onboarded_at timestamptz;

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists groups_workspace_idx on groups (workspace_id);
create index if not exists groups_created_by_idx on groups (created_by);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'groups_workspace_id_fkey') then
    alter table groups
      add constraint groups_workspace_id_fkey
      foreign key (workspace_id) references workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_created_by_fkey') then
    alter table groups
      add constraint groups_created_by_fkey
      foreign key (created_by) references users(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_name_len') then
    alter table groups
      add constraint groups_name_len check (char_length(btrim(name)) between 1 and 80);
  end if;
end $$;

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  user_id uuid,
  display_name text not null,
  invite_token text not null default gen_random_uuid()::text,
  status text not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists group_members_invite_token_idx on group_members (invite_token);
create index if not exists group_members_group_idx on group_members (group_id);
create index if not exists group_members_user_idx on group_members (user_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'group_members_group_id_fkey') then
    alter table group_members
      add constraint group_members_group_id_fkey
      foreign key (group_id) references groups(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'group_members_user_id_fkey') then
    alter table group_members
      add constraint group_members_user_id_fkey
      foreign key (user_id) references users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'group_members_status_check') then
    alter table group_members
      add constraint group_members_status_check check (status in ('invited', 'joined'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'group_members_name_len') then
    alter table group_members
      add constraint group_members_name_len check (char_length(btrim(display_name)) between 1 and 48);
  end if;
end $$;

alter table documents add column if not exists group_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_group_id_fkey') then
    alter table documents
      add constraint documents_group_id_fkey
      foreign key (group_id) references groups(id) on delete set null;
  end if;
end $$;

create index if not exists documents_group_idx on documents (group_id);

alter table groups enable row level security;
alter table group_members enable row level security;

drop policy if exists groups_member on groups;
create policy groups_member on groups
  using (workspace_id in (select app_user_workspace_ids()));

drop policy if exists group_members_member on group_members;
create policy group_members_member on group_members
  using (
    group_id in (
      select id from groups where workspace_id in (select app_user_workspace_ids())
    )
  );
