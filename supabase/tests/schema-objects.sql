-- Names only. One line per object: policy, trigger, function.
--
-- Runs unchanged against the test project and against a database rebuilt from
-- 0000_baseline.sql, so the baseline job can prove that the rebuilt database has
-- the same OBJECTS as the project it claims to describe — not only the same
-- grants. The grants diff proves the privilege surface; this proves the surface
-- exists at all. A policy that is silently absent from the baseline has no
-- grants to differ on, and would pass the grants check unnoticed.
--
-- Extension members are excluded: citext's functions live in public on Supabase
-- but where they live is the platform's decision, not this schema's.
select 'policy|' || tablename || '.' || policyname
  from pg_policies
 where schemaname = 'public'

union all

select 'trigger|' || c.relname || '.' || t.tgname
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname in ('public', 'auth')
   and not t.tgisinternal

union all

select 'function|' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.prokind = 'f'
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')

order by 1;