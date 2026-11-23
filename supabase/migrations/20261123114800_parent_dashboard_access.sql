-- Grant parents read-only access to linked students within their own school.
CREATE OR REPLACE FUNCTION public.parent_can_access_student(target_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students AS student
    JOIN public.profiles AS parent_profile
      ON parent_profile.id = auth.uid()
    JOIN public.profiles AS student_profile
      ON student_profile.id = student.id
    WHERE student.id = target_student_id
      AND student.parent_id = auth.uid()
      AND parent_profile.role = 'parent'
      AND student_profile.role = 'student'
      AND parent_profile.school_id IS NOT NULL
      AND student_profile.school_id = parent_profile.school_id
  )
$$;

REVOKE ALL ON FUNCTION public.parent_can_access_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parent_can_access_student(uuid) TO authenticated;

DROP POLICY IF EXISTS parent_student_school_restriction ON public.students;
CREATE POLICY parent_student_school_restriction
  ON public.students
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent'
    OR public.parent_can_access_student(id)
  );

DROP POLICY IF EXISTS parent_students_read_only_insert ON public.students;
CREATE POLICY parent_students_read_only_insert
  ON public.students
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_students_read_only_update ON public.students;
CREATE POLICY parent_students_read_only_update
  ON public.students
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_students_read_only_delete ON public.students;
CREATE POLICY parent_students_read_only_delete
  ON public.students
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_linked_student_profiles ON public.profiles;
CREATE POLICY parent_linked_student_profiles
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.parent_can_access_student(id));

DROP POLICY IF EXISTS parent_linked_classes ON public.classes;
CREATE POLICY parent_linked_classes
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.students AS student
      WHERE student.class_id = public.classes.id
        AND EXISTS (
          SELECT 1
          FROM public.profiles AS student_profile
          WHERE student_profile.id = student.id
            AND student_profile.school_id = public.classes.school_id
        )
        AND public.parent_can_access_student(student.id)
    )
  );

DROP POLICY IF EXISTS parent_linked_exams ON public.exams;
CREATE POLICY parent_linked_exams
  ON public.exams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.results AS result
      WHERE result.exam_id = public.exams.id
        AND EXISTS (
          SELECT 1
          FROM public.students AS student
          JOIN public.profiles AS student_profile
            ON student_profile.id = student.id
          WHERE student.id = result.student_id
            AND student_profile.school_id = public.exams.school_id
        )
        AND public.parent_can_access_student(result.student_id)
    )
  );

DROP POLICY IF EXISTS parent_attendance_read_only_insert ON public.attendance;
CREATE POLICY parent_attendance_read_only_insert
  ON public.attendance
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_attendance_read_only_update ON public.attendance;
CREATE POLICY parent_attendance_read_only_update
  ON public.attendance
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_attendance_read_only_delete ON public.attendance;
CREATE POLICY parent_attendance_read_only_delete
  ON public.attendance
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_results_read_only_insert ON public.results;
CREATE POLICY parent_results_read_only_insert
  ON public.results
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_results_read_only_update ON public.results;
CREATE POLICY parent_results_read_only_update
  ON public.results
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_results_read_only_delete ON public.results;
CREATE POLICY parent_results_read_only_delete
  ON public.results
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_invoices_read_only_insert ON public.invoices;
CREATE POLICY parent_invoices_read_only_insert
  ON public.invoices
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_invoices_read_only_update ON public.invoices;
CREATE POLICY parent_invoices_read_only_update
  ON public.invoices
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_invoices_read_only_delete ON public.invoices;
CREATE POLICY parent_invoices_read_only_delete
  ON public.invoices
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_linked_payments ON public.payments;
CREATE POLICY parent_linked_payments
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (public.parent_can_access_student(student_id));

DROP POLICY IF EXISTS parent_payments_read_only_insert ON public.payments;
CREATE POLICY parent_payments_read_only_insert
  ON public.payments
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_payments_read_only_update ON public.payments;
CREATE POLICY parent_payments_read_only_update
  ON public.payments
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DROP POLICY IF EXISTS parent_payments_read_only_delete ON public.payments;
CREATE POLICY parent_payments_read_only_delete
  ON public.payments
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'parent');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'public'
      AND relation.relname = 'lms_progress'
      AND relation.relrowsecurity
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS parent_linked_lms_progress ON public.lms_progress';
    EXECUTE '
      CREATE POLICY parent_linked_lms_progress
        ON public.lms_progress
        FOR SELECT
        TO authenticated
        USING (public.parent_can_access_student(student_id))
    ';
    EXECUTE 'DROP POLICY IF EXISTS parent_lms_progress_read_only_insert ON public.lms_progress';
    EXECUTE '
      CREATE POLICY parent_lms_progress_read_only_insert
        ON public.lms_progress
        AS RESTRICTIVE
        FOR INSERT
        TO authenticated
        WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> ''parent'')
    ';
    EXECUTE 'DROP POLICY IF EXISTS parent_lms_progress_read_only_update ON public.lms_progress';
    EXECUTE '
      CREATE POLICY parent_lms_progress_read_only_update
        ON public.lms_progress
        AS RESTRICTIVE
        FOR UPDATE
        TO authenticated
        USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> ''parent'')
        WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> ''parent'')
    ';
    EXECUTE 'DROP POLICY IF EXISTS parent_lms_progress_read_only_delete ON public.lms_progress';
    EXECUTE '
      CREATE POLICY parent_lms_progress_read_only_delete
        ON public.lms_progress
        AS RESTRICTIVE
        FOR DELETE
        TO authenticated
        USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> ''parent'')
    ';
  END IF;
END
$$;
