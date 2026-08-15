-- One group name per workspace. Idempotent.

with ranked as (
  select
    id,
    row_number() over (
      partition by workspace_id, lower(btrim(name))
      order by created_at asc, id asc
    ) as n
  from groups
)
update groups g
set
  name = left(btrim(g.name) || ' (' || ranked.n::text || ')', 80),
  updated_at = now()
from ranked
where g.id = ranked.id
  and ranked.n > 1;

create unique index if not exists groups_workspace_name_idx
  on groups (workspace_id, lower(btrim(name)));
