/**
 * The exact policy definitions this suite depends on — copied from
 * supabase/migrations/0010 and 0011, including the `deleted_at is null` clause
 * on students. That clause is not decoration: without it a soft-deleted student
 * reappears in the roster, which is precisely the bug a careless canary restore
 * introduced once and the baseline run then caught.
 *
 * changes to the migrations must be mirrored here; tests/security/policies.test.mjs
 * checks that the two agree on the clause that matters.
 *
 * Shared by the canary (after every injected breach) and by a manual run
 * (`npm run security:restore`) so a crashed canary run can never leave the
 * database weaker than it was. Every statement is idempotent.
 */
const POLICY_SQL = `
drop policy if exists students_select_own on public.students;
create policy students_select_own on public.students
  for select to authenticated
  using (teacher_id = (select auth.uid()) and deleted_at is null);

drop policy if exists students_insert_own on public.students;
create policy students_insert_own on public.students
  for insert to authenticated with check (teacher_id = (select auth.uid()));

drop policy if exists students_update_own on public.students;
create policy students_update_own on public.students
  for update to authenticated
  using (teacher_id = (select auth.uid()) and deleted_at is null)
  with check (teacher_id = (select auth.uid()));

drop policy if exists canary_del_students on public.students;
revoke delete on public.students from authenticated;

drop policy if exists student_grades_select_own on public.student_grades;
create policy student_grades_select_own on public.student_grades
  for select to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

drop policy if exists student_grades_insert_own on public.student_grades;
create policy student_grades_insert_own on public.student_grades
  for insert to authenticated
  with check (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

drop policy if exists student_alerts_select_own on public.student_alerts;
create policy student_alerts_select_own on public.student_alerts
  for select to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

drop policy if exists canary_del_alerts on public.student_alerts;
revoke delete on public.student_alerts from authenticated;
`;

export const RESTORE_ALL = POLICY_SQL;

export const BREACHES = [
  {
    name: "students SELECT: A can read B's roster",
    expects: "A sees only their own roster",
    breach: `
      drop policy if exists students_select_own on public.students;
      create policy students_select_own on public.students
        for select to authenticated using (true);`,
  },
  {
    // NOT DEMONSTRABLE AS A POLICY BREACH. RLS UPDATE needs SELECT visibility of
    // the row, so dropping the victim's row-level SELECT hides it again. A
    // permissive SELECT would prove it, but the restore then also replaces the
    // victim's SELECT policies — doing that on a live database means an untested
    // definition decides what teachers can read. Measured attack path instead
    // (recorded in ADR-012): grant UPDATE on class_label + a policy with
    // `with check (true)` DID write the foreign row; with the real `with check`
    // the same client gets 403.
    unproven: "RLS UPDATE requires the row to be visible through the SELECT policy; a row-level breach cannot be injected without also replacing the victim's SELECT policies.",
    name: "students UPDATE: A can rename B's student (class changed)",
    expects: "A cannot update B's student (class unchanged)",
    breach: `
      drop policy if exists students_update_own on public.students;
      create policy students_update_own on public.students
        for update to authenticated using (true) with check (true);`,
  },
  {
    name: "students INSERT: A can create a student on B's account",
    expects: "A cannot create a student owned by B (explicit teacher_id refused)",
    // Measured: with `with check (true)` the explicit attack still returns 42501,
    // because PostgREST's INSERT path is not governed by the policy alone here
    // (see ADR-012). The breach is injected for the record, but this assertion is
    // not claimed as canary-proven.
    expectNoChange: "Even with a permissive INSERT policy the explicit attack is refused (42501) on this stack, so this assertion cannot be demonstrated to fail.",
    breach: `
      drop policy if exists students_insert_own on public.students;
      create policy students_insert_own on public.students
        for insert to authenticated with check (true);`,
  },
  {
    // If the grant exists, the row is destroyed and the suite must say so. If it
    // does not, the breach never fired and this case would prove nothing — see
    // open-cases.mjs.
    needsGrant: { table: "students", privilege: "DELETE" },
    name: "students DELETE: A can delete B's student",
    expects: "A cannot delete B's student (row survives)",
    breach: `
      grant delete on public.students to authenticated;
      drop policy if exists canary_del_students on public.students;
      create policy canary_del_students on public.students
        for delete to authenticated using (true);`,
  },
  {
    name: "grades SELECT: A can read B's marks",
    expects: "A cannot read B's grades",
    breach: `
      drop policy if exists student_grades_select_own on public.student_grades;
      create policy student_grades_select_own on public.student_grades
        for select to authenticated using (true);`,
  },
  {
    // Refused for the right reason: authenticated holds no INSERT privilege on
    // student_grades, so the request dies before RLS is consulted. Taking the
    // privilege away is therefore not a breach. The equivalent breach was
    // measured in a separate recorded run (ADR-012): servicing the insert with the
    // service role while the policy is permissive DID write the row (201); under
    // the real policy the same request is refused (403).
    needsGrant: { table: "student_grades", privilege: "INSERT" },
    name: "grades INSERT: A can plant a mark on B's student",
    expects: "A cannot attach a grade to B's student (refused, marker",
    marker: "X-",
    breach: `
      drop policy if exists student_grades_insert_own on public.student_grades;
      create policy student_grades_insert_own on public.student_grades
        for insert to authenticated with check (true);`,
  },
  {
    name: "alerts SELECT: A can read B's evidence trail",
    expects: "A cannot read B's alerts",
    breach: `
      drop policy if exists student_alerts_select_own on public.student_alerts;
      create policy student_alerts_select_own on public.student_alerts
        for select to authenticated using (true);`,
  },
  {
    needsGrant: { table: "student_alerts", privilege: "DELETE" },
    name: "alerts DELETE: A can destroy B's alert",
    expects: "A cannot delete B's alert (row survives)",
    breach: `
      grant delete on public.student_alerts to authenticated;
      drop policy if exists canary_del_alerts on public.student_alerts;
      create policy canary_del_alerts on public.student_alerts
        for delete to authenticated using (true);`,
  },
];