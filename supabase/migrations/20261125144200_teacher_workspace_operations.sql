ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.teachers AS teacher
SET school_id = profile.school_id
FROM public.profiles AS profile
WHERE teacher.id = profile.id AND teacher.school_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.teachers WHERE school_id IS NULL) THEN
    RAISE EXCEPTION 'Teacher profiles without a school must be assigned before applying the teacher workspace migration.';
  END IF;
  ALTER TABLE public.teachers ALTER COLUMN school_id SET NOT NULL;
END
$$;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.students AS student
SET school_id = profile.school_id
FROM public.profiles AS profile
WHERE student.id = profile.id AND student.school_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.students WHERE school_id IS NULL) THEN
    RAISE EXCEPTION 'Student profiles without a school must be assigned before applying the teacher workspace migration.';
  END IF;
  ALTER TABLE public.students ALTER COLUMN school_id SET NOT NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_assignments_teacher_class_subject_year_key
  ON public.teacher_assignments (teacher_id, class_id, subject_id, academic_year_id);
CREATE INDEX IF NOT EXISTS teacher_assignments_teacher_year_idx
  ON public.teacher_assignments (teacher_id, academic_year_id);

ALTER TABLE public.class_subjects
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'academic_year_id'
  ) THEN
    EXECUTE '
      UPDATE public.class_subjects AS class_subject
      SET academic_year_id = classroom.academic_year_id
      FROM public.classes AS classroom
      WHERE class_subject.class_id = classroom.id
        AND class_subject.academic_year_id IS NULL
        AND classroom.academic_year_id IS NOT NULL
    ';
  END IF;
END
$$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.class_subjects
    WHERE academic_year_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Class-subject rows without an academic year must be reconciled before applying the teacher workspace migration.';
  END IF;
  ALTER TABLE public.class_subjects ALTER COLUMN academic_year_id SET NOT NULL;
END
$$;

ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name varchar(255),
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lms_courses' AND column_name = 'title'
  ) THEN
    EXECUTE 'UPDATE public.lms_courses SET name = COALESCE(name, title)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lms_courses' AND column_name = 'teacher_id'
  ) THEN
    EXECUTE '
      UPDATE public.lms_courses
      SET created_by = COALESCE(created_by, teacher_id)
      WHERE created_by IS NULL
    ';
  END IF;
  EXECUTE '
    UPDATE public.lms_courses AS course
    SET school_id = classroom.school_id
    FROM public.classes AS classroom
    WHERE course.class_id = classroom.id AND course.school_id IS NULL
  ';
END
$$;
UPDATE public.lms_courses AS course
SET school_id = profile.school_id
FROM public.profiles AS profile
WHERE course.created_by = profile.id AND course.school_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.lms_courses
    WHERE name IS NULL OR school_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Learning courses without a name or school must be reconciled before applying the teacher workspace migration.';
  END IF;
  ALTER TABLE public.lms_courses
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN school_id SET NOT NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  content text,
  video_url text,
  order_index integer NOT NULL DEFAULT 0,
  is_published boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id uuid REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  title varchar(255) NOT NULL,
  description text,
  due_date date,
  max_score numeric NOT NULL CHECK (max_score > 0),
  is_published boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  title varchar(255) NOT NULL,
  description text,
  time_limit_minutes integer,
  passing_score numeric,
  is_published boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type varchar(50),
  options jsonb,
  correct_answer text,
  marks numeric NOT NULL CHECK (marks > 0),
  order_index integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.lms_assignments') IS NOT NULL THEN
    EXECUTE '
      INSERT INTO public.assignments
        (id, course_id, title, description, due_date, max_score, created_at)
      SELECT id, course_id, title, description, due_date, COALESCE(max_score, 100), created_at
      FROM public.lms_assignments
      ON CONFLICT (id) DO NOTHING
    ';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type AS type
    JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public' AND type.typname = 'submission_status'
  ) THEN
    CREATE TYPE public.submission_status AS ENUM ('draft', 'submitted', 'graded');
  END IF;
END
$$;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS grade numeric,
  ADD COLUMN IF NOT EXISTS status public.submission_status DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS graded_at timestamptz,
  ADD COLUMN IF NOT EXISTS graded_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'score'
  ) THEN
    EXECUTE 'UPDATE public.submissions SET grade = COALESCE(grade, score)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.submissions'::regclass
      AND conname = 'submissions_assignment_id_fkey'
  ) THEN
    ALTER TABLE public.submissions DROP CONSTRAINT submissions_assignment_id_fkey;
  END IF;
  ALTER TABLE public.submissions
    ADD CONSTRAINT submissions_assignment_id_fkey
    FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'attendance_date'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'date'
  ) THEN
    ALTER TABLE public.attendance RENAME COLUMN date TO attendance_date;
  END IF;
END
$$;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS attendance_date date,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id),
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id),
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES public.terms(id),
  ADD COLUMN IF NOT EXISTS check_in_time timestamptz,
  ADD COLUMN IF NOT EXISTS check_out_time timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'date'
  ) THEN
    EXECUTE 'UPDATE public.attendance SET attendance_date = COALESCE(attendance_date, date)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'academic_year_id'
  ) THEN
    EXECUTE '
      UPDATE public.attendance AS record
      SET academic_year_id = classroom.academic_year_id
      FROM public.classes AS classroom
      WHERE record.class_id = classroom.id
        AND record.academic_year_id IS NULL
        AND classroom.academic_year_id IS NOT NULL
    ';
  END IF;
  EXECUTE '
    UPDATE public.attendance AS record
    SET school_id = classroom.school_id
    FROM public.classes AS classroom
    WHERE record.class_id = classroom.id AND record.school_id IS NULL
  ';
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE attendance_date IS NULL OR academic_year_id IS NULL OR school_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Attendance contains rows without a date, academic year, or school; reconcile these records before applying the teacher workspace migration.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.attendance
    GROUP BY student_id, class_id, attendance_date
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate student/class/date attendance rows exist; reconcile them before applying the teacher workspace migration.';
  END IF;
END
$$;

ALTER TABLE public.attendance
  ALTER COLUMN attendance_date SET NOT NULL,
  ALTER COLUMN academic_year_id SET NOT NULL,
  ALTER COLUMN school_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_class_date_key
  ON public.attendance (student_id, class_id, attendance_date);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.results
    GROUP BY student_id, exam_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate student/exam results exist; reconcile them before applying the teacher workspace migration.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS results_student_exam_key
  ON public.results (student_id, exam_id);

CREATE OR REPLACE FUNCTION public.teacher_has_assignment(
  requested_class uuid,
  requested_subject uuid,
  requested_year uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    JOIN public.teachers AS teacher
      ON teacher.id = profile.id AND teacher.school_id = profile.school_id
    JOIN public.teacher_assignments AS assignment
      ON assignment.teacher_id = teacher.id
    JOIN public.classes AS classroom
      ON classroom.id = assignment.class_id AND classroom.school_id = profile.school_id
    JOIN public.subjects AS subject
      ON subject.id = assignment.subject_id AND subject.school_id = profile.school_id
    JOIN public.academic_years AS academic_year
      ON academic_year.id = assignment.academic_year_id AND academic_year.school_id = profile.school_id
    JOIN public.class_subjects AS class_subject
      ON class_subject.class_id = assignment.class_id
      AND class_subject.subject_id = assignment.subject_id
      AND class_subject.academic_year_id = assignment.academic_year_id
    WHERE profile.id = auth.uid()
      AND profile.role = 'teacher'
      AND (requested_class IS NULL OR assignment.class_id = requested_class)
      AND (requested_subject IS NULL OR assignment.subject_id = requested_subject)
      AND (requested_year IS NULL OR assignment.academic_year_id = requested_year)
      AND class_subject.is_active IS DISTINCT FROM false
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_student(requested_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    JOIN public.student_enrollments AS enrollment
      ON enrollment.student_id = requested_student AND enrollment.status = 'active'
    JOIN public.students AS student
      ON student.id = enrollment.student_id
    JOIN public.profiles AS student_profile
      ON student_profile.id = student.id AND student_profile.school_id = profile.school_id
    JOIN public.classes AS classroom
      ON classroom.id = enrollment.class_id AND classroom.school_id = profile.school_id
    WHERE profile.id = auth.uid()
      AND profile.role = 'teacher'
      AND student.id = requested_student
      AND public.teacher_has_assignment(enrollment.class_id, NULL, enrollment.academic_year_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_exam(requested_exam uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.exams AS exam
    JOIN public.profiles AS profile ON profile.id = auth.uid()
    WHERE exam.id = requested_exam
      AND exam.school_id = profile.school_id
      AND profile.role = 'teacher'
      AND public.teacher_has_assignment(exam.class_id, exam.subject_id, exam.academic_year_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_result(requested_exam uuid, requested_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.teacher_can_access_exam(requested_exam)
    AND EXISTS (
      SELECT 1
      FROM public.exams AS exam
      JOIN public.student_enrollments AS enrollment
        ON enrollment.class_id = exam.class_id
        AND enrollment.academic_year_id = exam.academic_year_id
        AND enrollment.student_id = requested_student
        AND enrollment.status = 'active'
      JOIN public.students AS student ON student.id = enrollment.student_id
      JOIN public.profiles AS student_profile
        ON student_profile.id = student.id AND student_profile.school_id = exam.school_id
      WHERE exam.id = requested_exam
    );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_course(requested_course uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lms_courses AS course
    JOIN public.profiles AS profile
      ON profile.id = auth.uid()
      AND profile.id = course.created_by
      AND profile.school_id = course.school_id
      AND profile.role = 'teacher'
    WHERE course.id = requested_course
      AND course.class_id IS NOT NULL
      AND course.subject_id IS NOT NULL
      AND public.teacher_has_assignment(course.class_id, course.subject_id, NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_create_course(
  requested_creator uuid,
  requested_school uuid,
  requested_class uuid,
  requested_subject uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT requested_class IS NOT NULL
    AND requested_subject IS NOT NULL
    AND requested_creator = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.role = 'teacher'
        AND profile.school_id = requested_school
    )
    AND public.teacher_has_assignment(requested_class, requested_subject, NULL);
$$;

CREATE OR REPLACE FUNCTION public.school_admin_can_access_class(requested_class uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes AS classroom
    JOIN public.profiles AS profile ON profile.id = auth.uid()
    WHERE classroom.id = requested_class
      AND (
        profile.role = 'super_admin'
        OR (profile.role = 'admin' AND classroom.school_id = profile.school_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_assignment(requested_assignment uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments AS assignment
    WHERE assignment.id = requested_assignment
      AND assignment.course_id IS NOT NULL
      AND public.teacher_can_access_course(assignment.course_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_submission(
  requested_assignment uuid,
  requested_student uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assignments AS assignment
    JOIN public.lms_courses AS course ON course.id = assignment.course_id
    JOIN public.student_enrollments AS enrollment
      ON enrollment.class_id = course.class_id
      AND enrollment.student_id = requested_student
      AND enrollment.status = 'active'
    JOIN public.students AS student ON student.id = enrollment.student_id
    JOIN public.profiles AS student_profile
      ON student_profile.id = student.id AND student_profile.school_id = course.school_id
    WHERE assignment.id = requested_assignment
      AND public.teacher_can_access_course(course.id)
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_quiz(requested_quiz uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quizzes AS quiz
    WHERE quiz.id = requested_quiz
      AND public.teacher_can_access_course(quiz.course_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_question(requested_question uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quiz_questions AS question
    WHERE question.id = requested_question
      AND public.teacher_can_access_quiz(question.quiz_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.teacher_has_assignment(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_exam(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_result(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_create_course(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_admin_can_access_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_submission(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_quiz(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_question(uuid) TO authenticated;

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_admin_manage_teacher_assignments ON public.teacher_assignments
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
    AND public.school_admin_can_access_class(class_id)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
    AND public.school_admin_can_access_class(class_id)
  );
CREATE POLICY school_admin_manage_class_subjects ON public.class_subjects
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
    AND public.school_admin_can_access_class(class_id)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
    AND public.school_admin_can_access_class(class_id)
  );
CREATE POLICY teacher_self_read ON public.teachers
  FOR SELECT TO authenticated
  USING (id = auth.uid() AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY teacher_read_assigned_classes ON public.classes
  FOR SELECT TO authenticated
  USING (public.teacher_has_assignment(id, NULL, NULL));
CREATE POLICY teacher_read_assigned_subjects ON public.subjects
  FOR SELECT TO authenticated
  USING (public.teacher_has_assignment(NULL, id, NULL));
CREATE POLICY teacher_read_assigned_years ON public.academic_years
  FOR SELECT TO authenticated
  USING (public.teacher_has_assignment(NULL, NULL, id));
CREATE POLICY teacher_read_own_assignments ON public.teacher_assignments
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    AND public.teacher_has_assignment(class_id, subject_id, academic_year_id)
  );
CREATE POLICY teacher_assignment_scope ON public.teacher_assignments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR (
      teacher_id = auth.uid()
      AND public.teacher_has_assignment(class_id, subject_id, academic_year_id)
    )
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR (
      teacher_id = auth.uid()
      AND public.teacher_has_assignment(class_id, subject_id, academic_year_id)
    )
  );
CREATE POLICY teacher_read_assigned_class_subjects ON public.class_subjects
  FOR SELECT TO authenticated
  USING (public.teacher_has_assignment(class_id, subject_id, academic_year_id));
CREATE POLICY teacher_class_scope ON public.classes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_has_assignment(id, NULL, NULL)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_has_assignment(id, NULL, NULL)
  );
CREATE POLICY teacher_subject_scope ON public.subjects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_has_assignment(NULL, id, NULL)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_has_assignment(NULL, id, NULL)
  );
CREATE POLICY teacher_academic_year_scope ON public.academic_years
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_has_assignment(NULL, NULL, id)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_has_assignment(NULL, NULL, id)
  );
CREATE POLICY teacher_read_assigned_enrollments ON public.student_enrollments
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND public.teacher_has_assignment(class_id, NULL, academic_year_id)
  );
CREATE POLICY teacher_enrollment_scope ON public.student_enrollments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR (
      status = 'active'
      AND public.teacher_has_assignment(class_id, NULL, academic_year_id)
    )
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR (
      status = 'active'
      AND public.teacher_has_assignment(class_id, NULL, academic_year_id)
    )
  );
CREATE POLICY teacher_student_scope ON public.students
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_student(id)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_student(id)
  );
CREATE POLICY teacher_profile_scope ON public.profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR id = auth.uid()
    OR (role = 'student' AND public.teacher_can_access_student(id))
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR (id = auth.uid() AND role = 'teacher')
  );
CREATE POLICY teacher_class_subject_scope ON public.class_subjects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_has_assignment(class_id, subject_id, academic_year_id)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_has_assignment(class_id, subject_id, academic_year_id)
  );
CREATE POLICY teacher_read_assigned_student_profiles ON public.profiles
  FOR SELECT TO authenticated
  USING (
    role = 'student'
    AND public.teacher_can_access_student(id)
  );

CREATE POLICY teacher_attendance_scope ON public.attendance
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR (
      school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
      AND public.teacher_has_assignment(class_id, NULL, academic_year_id)
      AND EXISTS (
        SELECT 1 FROM public.student_enrollments AS enrollment
        JOIN public.students AS student ON student.id = enrollment.student_id
        JOIN public.profiles AS student_profile
          ON student_profile.id = student.id AND student_profile.school_id = attendance.school_id
        WHERE enrollment.student_id = attendance.student_id
          AND enrollment.class_id = attendance.class_id
          AND enrollment.academic_year_id = attendance.academic_year_id
      )
    )
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR (
      school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
      AND public.teacher_has_assignment(class_id, NULL, academic_year_id)
      AND EXISTS (
        SELECT 1 FROM public.student_enrollments AS enrollment
        JOIN public.students AS student ON student.id = enrollment.student_id
        JOIN public.profiles AS student_profile
          ON student_profile.id = student.id AND student_profile.school_id = attendance.school_id
        WHERE enrollment.student_id = attendance.student_id
          AND enrollment.class_id = attendance.class_id
          AND enrollment.academic_year_id = attendance.academic_year_id
          AND enrollment.status = 'active'
      )
    )
  );
CREATE POLICY teacher_results_scope ON public.results
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_result(exam_id, student_id)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR (
      school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
      AND public.teacher_can_access_result(exam_id, student_id)
    )
  );
CREATE POLICY teacher_read_assigned_exams ON public.exams
  FOR SELECT TO authenticated
  USING (public.teacher_can_access_exam(id));
CREATE POLICY teacher_exam_scope ON public.exams
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_exam(id)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_exam(id)
  );
CREATE POLICY teacher_manage_assigned_results ON public.results
  FOR ALL TO authenticated
  USING (public.teacher_can_access_result(exam_id, student_id))
  WITH CHECK (public.teacher_can_access_result(exam_id, student_id));

CREATE POLICY teacher_manage_own_courses ON public.lms_courses
  FOR ALL TO authenticated
  USING (public.teacher_can_access_course(id))
  WITH CHECK (public.teacher_can_create_course(created_by, school_id, class_id, subject_id));
CREATE POLICY teacher_course_scope ON public.lms_courses
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_course(id)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_create_course(created_by, school_id, class_id, subject_id)
  );
CREATE POLICY teacher_manage_own_lessons ON public.lessons
  FOR ALL TO authenticated
  USING (public.teacher_can_access_course(course_id))
  WITH CHECK (public.teacher_can_access_course(course_id));
CREATE POLICY teacher_lesson_scope ON public.lessons
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_course(course_id)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_course(course_id)
  );
CREATE POLICY teacher_manage_own_assignments ON public.assignments
  FOR ALL TO authenticated
  USING (course_id IS NOT NULL AND public.teacher_can_access_course(course_id))
  WITH CHECK (course_id IS NOT NULL AND public.teacher_can_access_course(course_id));
CREATE POLICY teacher_assignment_resource_scope ON public.assignments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR (course_id IS NOT NULL AND public.teacher_can_access_course(course_id))
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR (course_id IS NOT NULL AND public.teacher_can_access_course(course_id))
  );
CREATE POLICY teacher_read_course_submissions ON public.submissions
  FOR SELECT TO authenticated
  USING (public.teacher_can_access_submission(assignment_id, student_id));
CREATE POLICY teacher_grade_course_submissions ON public.submissions
  FOR UPDATE TO authenticated
  USING (public.teacher_can_access_submission(assignment_id, student_id))
  WITH CHECK (public.teacher_can_access_submission(assignment_id, student_id));
CREATE POLICY teacher_submission_scope ON public.submissions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_submission(assignment_id, student_id)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_submission(assignment_id, student_id)
  );
CREATE POLICY teacher_manage_own_quizzes ON public.quizzes
  FOR ALL TO authenticated
  USING (public.teacher_can_access_course(course_id))
  WITH CHECK (public.teacher_can_access_course(course_id));
CREATE POLICY teacher_quiz_scope ON public.quizzes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_course(course_id)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_course(course_id)
  );
CREATE POLICY teacher_manage_own_quiz_questions ON public.quiz_questions
  FOR ALL TO authenticated
  USING (public.teacher_can_access_quiz(quiz_id))
  WITH CHECK (public.teacher_can_access_quiz(quiz_id));
CREATE POLICY teacher_quiz_question_scope ON public.quiz_questions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_quiz(quiz_id)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'teacher'
    OR public.teacher_can_access_quiz(quiz_id)
  );

DO $$
DECLARE
  table_name text;
  was_enabled boolean;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['lessons', 'assignments', 'quizzes', 'quiz_questions'] LOOP
    SELECT relrowsecurity INTO was_enabled
    FROM pg_class
    WHERE oid = format('public.%I', table_name)::regclass;
    IF NOT was_enabled THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> ''teacher'') WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) <> ''teacher'')',
        table_name || '_legacy_non_teacher_access', table_name
      );
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.guard_teacher_exam_marks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  exam_max numeric;
BEGIN
  SELECT max_marks INTO exam_max
  FROM public.exams
  WHERE id = NEW.exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam does not exist.';
  END IF;
  IF NEW.marks_obtained IS NOT NULL
     AND (NEW.marks_obtained < 0 OR NEW.marks_obtained > exam_max) THEN
    RAISE EXCEPTION 'Marks must be between zero and the exam maximum (%).', exam_max;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_teacher_submission_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  assignment_max numeric;
BEGIN
  SELECT max_score INTO assignment_max
  FROM public.assignments
  WHERE id = NEW.assignment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment does not exist.';
  END IF;
  IF NEW.grade IS NOT NULL
     AND (NEW.grade < 0 OR NEW.grade > assignment_max) THEN
    RAISE EXCEPTION 'Grade must be between zero and the assignment maximum (%).', assignment_max;
  END IF;
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher' THEN
    NEW.graded_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS results_exam_max_marks_guard ON public.results;
CREATE TRIGGER results_exam_max_marks_guard
  BEFORE INSERT OR UPDATE OF exam_id, marks_obtained
  ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_teacher_exam_marks();

DROP TRIGGER IF EXISTS submissions_grade_max_guard ON public.submissions;
CREATE TRIGGER submissions_grade_max_guard
  BEFORE INSERT OR UPDATE OF assignment_id, grade
  ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_teacher_submission_grade();
