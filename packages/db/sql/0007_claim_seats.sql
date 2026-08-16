-- Hang line claims on a group seat (member id), not only a display-name string. Idempotent.

alter table split_claims add column if not exists member_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'split_claims_member_id_fkey') then
    alter table split_claims
      add constraint split_claims_member_id_fkey
      foreign key (member_id) references group_members(id) on delete cascade;
  end if;
end $$;

create index if not exists split_claims_member_idx on split_claims (member_id);

create unique index if not exists split_claims_doc_field_member_idx
  on split_claims (document_id, field_id, member_id)
  where member_id is not null;

create unique index if not exists group_members_group_user_idx
  on group_members (group_id, user_id)
  where user_id is not null;

update split_claims c
set member_id = m.id
from documents d
join group_members m
  on m.group_id = d.group_id
where c.document_id = d.id
  and c.member_id is null
  and d.group_id is not null
  and m.display_name = c.display_name;
