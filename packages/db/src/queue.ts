/** Atomic claim using FOR UPDATE SKIP LOCKED (supabase-postgres-best-practices). */
export const claimNextJobSql = `
update jobs
set status = 'running',
    attempts = attempts + 1,
    locked_at = now(),
    updated_at = now()
where id = (
  select id from jobs
  where status = 'queued'
  order by created_at
  limit 1
  for update skip locked
)
returning *;
`;
