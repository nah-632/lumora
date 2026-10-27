-- Normalised privilege set for the public schema, one line per grant, sorted.
--
-- Runs unchanged against the test project and against a database rebuilt from
-- 0000_baseline.sql. If the two outputs differ, the baseline is not faithful —
-- which is the only claim worth making about it, and one a passing test suite
-- cannot make on its own: the suite proves behaviour it exercises, not the whole
-- privilege surface.
--
-- Names only. No row data, no keys, nothing environment-specific: ownership and
-- the postgres/supabase_admin grantees are excluded, because those differ between
-- a cloud project and a local stack for reasons unrelated to the schema.
with objs as (
  select c.relkind, c.relname,
         coalesce(g.rolname, 'PUBLIC') as grantee,
         case p.privilege_type
           when 'SELECT' then 'select' when 'INSERT' then 'insert'
           when 'UPDATE' then 'update' when 'DELETE' then 'delete'
           when 'TRUNCATE' then 'truncate' when 'REFERENCES' then 'references'
           when 'TRIGGER' then 'trigger' when 'MAINTAIN' then 'maintain'
           when 'EXECUTE' then 'execute' when 'USAGE' then 'usage'
           else lower(p.privilege_type) end as priv,
         null::text as col
  from pg_class c
  cross join lateral aclexplode(c.relacl) p
  left join pg_roles g on g.oid = p.grantee
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','S')

  union all

  select c.relkind, c.relname,
         coalesce(g.rolname, 'PUBLIC'),
         lower(x.privilege_type),
         a.attname
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  cross join lateral aclexplode(a.attacl) x
  left join pg_roles g on g.oid = x.grantee
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    and a.attacl is not null and a.attnum > 0 and not a.attisdropped

  union all

  select 'f', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         coalesce(g.rolname, 'PUBLIC'),
         lower(x.privilege_type),
         null
  from pg_proc p
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
  left join pg_roles g on g.oid = x.grantee
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
)
select distinct
       case relkind when 'r' then 'table' when 'S' then 'sequence' else 'function' end
       || '|' || relname || '|' || grantee || '|' || priv || '|' || coalesce(col, '-') as line
from objs
where grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by 1;