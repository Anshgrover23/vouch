-- Group ledger: payer, notes, stars, settlements, activity. Idempotent.

alter table documents add column if not exists paid_by_name text;

update documents d
set paid_by_name = u.display_name
from users u
where d.uploaded_by = u.id
  and (d.paid_by_name is null or btrim(d.paid_by_name) = '');

update documents set paid_by_name = 'Host' where paid_by_name is null or btrim(paid_by_name) = '';

alter table documents alter column paid_by_name set default '';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'documents' and column_name = 'paid_by_name' and is_nullable = 'YES'
  ) then
    alter table documents alter column paid_by_name set not null;
  end if;
end $$;

alter table groups add column if not exists information text;

create table if not exists group_stars (
  user_id uuid not null,
  group_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

create index if not exists group_stars_group_idx on group_stars (group_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'group_stars_user_id_fkey') then
    alter table group_stars
      add constraint group_stars_user_id_fkey
      foreign key (user_id) references users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'group_stars_group_id_fkey') then
    alter table group_stars
      add constraint group_stars_group_id_fkey
      foreign key (group_id) references groups(id) on delete cascade;
  end if;
end $$;

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  workspace_id uuid not null,
  from_name text not null,
  to_name text not null,
  amount numeric(12,2) not null,
  note text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists settlements_group_idx on settlements (group_id);
create index if not exists settlements_workspace_idx on settlements (workspace_id);
create index if not exists settlements_created_by_idx on settlements (created_by);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settlements_group_id_fkey') then
    alter table settlements
      add constraint settlements_group_id_fkey
      foreign key (group_id) references groups(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settlements_workspace_id_fkey') then
    alter table settlements
      add constraint settlements_workspace_id_fkey
      foreign key (workspace_id) references workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settlements_created_by_fkey') then
    alter table settlements
      add constraint settlements_created_by_fkey
      foreign key (created_by) references users(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settlements_amount_positive') then
    alter table settlements
      add constraint settlements_amount_positive check (amount > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settlements_name_len') then
    alter table settlements
      add constraint settlements_name_len check (
        char_length(btrim(from_name)) between 1 and 48
        and char_length(btrim(to_name)) between 1 and 48
      );
  end if;
end $$;

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  group_id uuid,
  document_id uuid,
  actor_name text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_group_created_idx on activity_events (group_id, created_at desc);
create index if not exists activity_events_workspace_idx on activity_events (workspace_id);
create index if not exists activity_events_document_idx on activity_events (document_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'activity_events_workspace_id_fkey') then
    alter table activity_events
      add constraint activity_events_workspace_id_fkey
      foreign key (workspace_id) references workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activity_events_group_id_fkey') then
    alter table activity_events
      add constraint activity_events_group_id_fkey
      foreign key (group_id) references groups(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activity_events_document_id_fkey') then
    alter table activity_events
      add constraint activity_events_document_id_fkey
      foreign key (document_id) references documents(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activity_events_action_check') then
    alter table activity_events
      add constraint activity_events_action_check
      check (action in ('receipt', 'claimed', 'settled', 'invited', 'group_updated'));
  end if;
end $$;

alter table group_stars enable row level security;
alter table settlements enable row level security;
alter table activity_events enable row level security;

drop policy if exists group_stars_member on group_stars;
create policy group_stars_member on group_stars
  using (
    group_id in (
      select id from groups where workspace_id in (select app_user_workspace_ids())
    )
  );

drop policy if exists settlements_member on settlements;
create policy settlements_member on settlements
  using (workspace_id in (select app_user_workspace_ids()));

drop policy if exists activity_events_member on activity_events;
create policy activity_events_member on activity_events
  using (workspace_id in (select app_user_workspace_ids()));
