CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exam_type') THEN
    CREATE TYPE public.exam_type AS ENUM ('quiz', 'midterm', 'final', 'assignment', 'practical');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'paid', 'overdue', 'cancelled', 'partial', 'unpaid');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE public.payment_method AS ENUM ('cash', 'bank_transfer', 'card', 'mobile_money', 'cheque');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'borrow_status') THEN
    CREATE TYPE public.borrow_status AS ENUM ('borrowed', 'returned', 'overdue', 'lost');
  END IF;
END
$$;
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'partial';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'unpaid';

CREATE TABLE IF NOT EXISTS public.terms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  term_number integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terms_dates_valid CHECK (start_date <= end_date),
  CONSTRAINT terms_number_valid CHECK (term_number > 0),
  CONSTRAINT terms_year_number_unique UNIQUE (academic_year_id, term_number),
  CONSTRAINT terms_year_name_unique UNIQUE (academic_year_id, name)
);
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.fee_structures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE CASCADE,
  fee_name varchar(100) NOT NULL,
  description text,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  due_date date,
  is_mandatory boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id),
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES public.terms(id),
  ADD COLUMN IF NOT EXISTS exam_date date,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS exam_type public.exam_type,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS passing_marks numeric,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'start_date'
  ) THEN
    EXECUTE 'UPDATE public.exams SET exam_date = start_date WHERE exam_date IS NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exam_questions' AND column_name = 'subject_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.exams AS exam
      SET subject_id = (
        SELECT question.subject_id
        FROM public.exam_questions AS question
        WHERE question.exam_id = exam.id AND question.subject_id IS NOT NULL
        ORDER BY question.created_at
        LIMIT 1
      )
      WHERE exam.subject_id IS NULL
    $sql$;
  END IF;
END
$$;

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id),
  ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.results AS result
SET school_id = COALESCE(
  (SELECT exam.school_id FROM public.exams AS exam WHERE exam.id = result.exam_id),
  (SELECT profile.school_id FROM public.profiles AS profile WHERE profile.id = result.student_id)
)
WHERE result.school_id IS NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id),
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES public.terms(id),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'paid_amount'
  ) THEN
    EXECUTE 'UPDATE public.invoices SET amount_paid = COALESCE(amount_paid, paid_amount, 0)';
  END IF;
END
$$;
UPDATE public.invoices AS invoice
SET school_id = profile.school_id
FROM public.profiles AS profile
WHERE invoice.school_id IS NULL AND profile.id = invoice.student_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name = 'status' AND udt_name <> 'invoice_status'
  ) THEN
    ALTER TABLE public.invoices
      ALTER COLUMN status TYPE public.invoice_status
      USING (
        CASE lower(status::text)
          WHEN 'paid' THEN 'paid'
          WHEN 'overdue' THEN 'overdue'
          WHEN 'cancelled' THEN 'cancelled'
          WHEN 'draft' THEN 'draft'
          ELSE 'issued'
        END
      )::public.invoice_status;
  END IF;
END
$$;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id),
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.payments AS payment
SET school_id = COALESCE(
  (SELECT invoice.school_id FROM public.invoices AS invoice WHERE invoice.id = payment.invoice_id),
  (SELECT profile.school_id FROM public.profiles AS profile WHERE profile.id = payment.student_id)
)
WHERE payment.school_id IS NULL;
UPDATE public.invoices AS invoice
SET amount_paid = COALESCE((
  SELECT sum(payment.amount)
  FROM public.payments AS payment
  WHERE payment.invoice_id = invoice.id AND payment.school_id = invoice.school_id
), 0);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments'
      AND column_name = 'payment_method' AND udt_name <> 'payment_method'
  ) THEN
    ALTER TABLE public.payments
      ALTER COLUMN payment_method TYPE public.payment_method
      USING (
        CASE lower(payment_method::text)
          WHEN 'bank' THEN 'bank_transfer'
          WHEN 'bank transfer' THEN 'bank_transfer'
          WHEN 'm-pesa' THEN 'mobile_money'
          WHEN 'mpesa' THEN 'mobile_money'
          WHEN 'mobile money' THEN 'mobile_money'
          WHEN 'card' THEN 'card'
          WHEN 'cheque' THEN 'cheque'
          ELSE 'cash'
        END
      )::public.payment_method;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'library_books' AND column_name = 'total_copies'
  ) THEN
    ALTER TABLE public.library_books ADD COLUMN total_copies integer;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'library_books' AND column_name = 'quantity'
    ) THEN
      EXECUTE 'UPDATE public.library_books SET total_copies = quantity';
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'library_books' AND column_name = 'available_copies'
  ) THEN
    ALTER TABLE public.library_books ADD COLUMN available_copies integer;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'library_books' AND column_name = 'available_quantity'
    ) THEN
      EXECUTE 'UPDATE public.library_books SET available_copies = available_quantity';
    END IF;
  END IF;
END
$$;
ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS genre text,
  ADD COLUMN IF NOT EXISTS publication_year integer,
  ADD COLUMN IF NOT EXISTS publisher text,
  ADD COLUMN IF NOT EXISTS copy_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'library_books' AND column_name = 'category'
  ) THEN
    EXECUTE 'UPDATE public.library_books SET genre = COALESCE(genre, category)';
  END IF;
  EXECUTE 'UPDATE public.library_books SET total_copies = COALESCE(total_copies, 1), available_copies = COALESCE(available_copies, total_copies, 1)';
END
$$;
ALTER TABLE public.library_books
  ALTER COLUMN total_copies SET DEFAULT 1,
  ALTER COLUMN total_copies SET NOT NULL,
  ALTER COLUMN available_copies SET DEFAULT 1,
  ALTER COLUMN available_copies SET NOT NULL;

ALTER TABLE public.borrow_records
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id),
  ADD COLUMN IF NOT EXISTS fine_amount numeric(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.borrow_records AS borrow
SET school_id = book.school_id
FROM public.library_books AS book
WHERE borrow.school_id IS NULL AND book.id = borrow.book_id;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'borrow_records'
      AND column_name = 'status' AND udt_name <> 'borrow_status'
  ) THEN
    ALTER TABLE public.borrow_records
      ALTER COLUMN status TYPE public.borrow_status
      USING (
        CASE lower(status::text)
          WHEN 'returned' THEN 'returned'
          WHEN 'overdue' THEN 'overdue'
          WHEN 'lost' THEN 'lost'
          ELSE 'borrowed'
        END
      )::public.borrow_status;
  END IF;
END
$$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.library_books AS book
    WHERE book.total_copies < (
      SELECT count(*) FROM public.borrow_records AS borrow
      WHERE borrow.book_id = book.id AND borrow.status IN ('borrowed', 'overdue')
    )
  ) THEN
    RAISE EXCEPTION 'Library inventory has fewer copies than active loans; reconcile inventory before applying this migration.';
  END IF;
  UPDATE public.library_books AS book
  SET available_copies = book.total_copies - (
    SELECT count(*) FROM public.borrow_records AS borrow
    WHERE borrow.book_id = book.id AND borrow.status IN ('borrowed', 'overdue')
  );
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.library_books'::regclass
      AND conname = 'library_books_inventory_bounds'
  ) THEN
    ALTER TABLE public.library_books
      ADD CONSTRAINT library_books_inventory_bounds
      CHECK (total_copies >= 0 AND available_copies >= 0 AND available_copies <= total_copies);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_unique
  ON public.invoices(invoice_number);

CREATE OR REPLACE FUNCTION public.guard_school_admin_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role text;
  caller_school uuid;
  invoice_row public.invoices%ROWTYPE;
BEGIN
  SELECT role, school_id INTO caller_role, caller_school
  FROM public.profiles
  WHERE id = auth.uid();
  IF caller_role NOT IN ('admin', 'super_admin') OR caller_school IS NULL THEN
    RAISE EXCEPTION 'School administrator access is required.';
  END IF;

  SELECT * INTO invoice_row
  FROM public.invoices
  WHERE id = NEW.invoice_id AND school_id = caller_school
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found in your school.';
  END IF;
  IF invoice_row.status = 'cancelled' THEN
    RAISE EXCEPTION 'Payments cannot be recorded against a cancelled invoice.';
  END IF;
  IF invoice_row.total_amount IS NULL OR invoice_row.total_amount <= 0 THEN
    RAISE EXCEPTION 'Invoice total must be positive before accepting payments.';
  END IF;
  IF NEW.amount <= 0 OR COALESCE(invoice_row.amount_paid, 0) + NEW.amount > invoice_row.total_amount THEN
    RAISE EXCEPTION 'Payment exceeds the outstanding invoice balance.';
  END IF;
  NEW.school_id := caller_school;
  NEW.student_id := invoice_row.student_id;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.apply_school_admin_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  new_amount_paid numeric(12, 2);
BEGIN
  UPDATE public.invoices
  SET amount_paid = COALESCE(amount_paid, 0) + NEW.amount,
      status = CASE
        WHEN COALESCE(amount_paid, 0) + NEW.amount >= total_amount THEN 'paid'::public.invoice_status
        WHEN COALESCE(amount_paid, 0) + NEW.amount > 0 THEN 'partial'::public.invoice_status
        ELSE 'unpaid'::public.invoice_status
      END,
      updated_at = now()
  WHERE id = NEW.invoice_id AND school_id = NEW.school_id
  RETURNING amount_paid INTO new_amount_paid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found in your school.';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS payments_school_admin_guard ON public.payments;
CREATE TRIGGER payments_school_admin_guard
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_school_admin_payment();
DROP TRIGGER IF EXISTS payments_school_admin_apply ON public.payments;
CREATE TRIGGER payments_school_admin_apply
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.apply_school_admin_payment();

CREATE OR REPLACE FUNCTION public.guard_school_admin_book_inventory()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role text;
  caller_school uuid;
  active_loans integer;
BEGIN
  SELECT role, school_id INTO caller_role, caller_school
  FROM public.profiles
  WHERE id = auth.uid();
  IF caller_role NOT IN ('admin', 'super_admin') OR caller_school IS NULL THEN
    RAISE EXCEPTION 'School administrator access is required.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.school_id IS NOT NULL AND NEW.school_id <> caller_school THEN
      RAISE EXCEPTION 'The book must belong to your school.';
    END IF;
    IF NEW.total_copies < 0 THEN
      RAISE EXCEPTION 'Total copies cannot be negative.';
    END IF;
    NEW.school_id := caller_school;
    NEW.available_copies := NEW.total_copies;
    RETURN NEW;
  END IF;
  IF OLD.school_id <> caller_school THEN
    RAISE EXCEPTION 'School administrator access is required.';
  END IF;
  SELECT count(*) INTO active_loans
  FROM public.borrow_records
  WHERE book_id = OLD.id AND school_id = caller_school AND status IN ('borrowed', 'overdue');
  IF NEW.total_copies < active_loans THEN
    RAISE EXCEPTION 'Total copies cannot be lower than the number of books currently on loan.';
  END IF;
  NEW.available_copies := NEW.total_copies - active_loans;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS library_books_school_admin_inventory ON public.library_books;
CREATE TRIGGER library_books_school_admin_inventory
  BEFORE INSERT OR UPDATE OF total_copies ON public.library_books
  FOR EACH ROW EXECUTE FUNCTION public.guard_school_admin_book_inventory();

CREATE OR REPLACE FUNCTION public.guard_school_admin_borrow_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role text;
  caller_school uuid;
  book_row public.library_books%ROWTYPE;
  student_school uuid;
BEGIN
  SELECT role, school_id INTO caller_role, caller_school
  FROM public.profiles
  WHERE id = auth.uid();
  IF caller_role NOT IN ('admin', 'super_admin') OR caller_school IS NULL THEN
    RAISE EXCEPTION 'School administrator access is required.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO book_row
    FROM public.library_books
    WHERE id = NEW.book_id AND school_id = caller_school
    FOR UPDATE;
    IF NOT FOUND OR NOT book_row.is_active OR book_row.available_copies < 1 THEN
      RAISE EXCEPTION 'No available copies of this book can be issued.';
    END IF;
    SELECT school_id INTO student_school
    FROM public.students
    WHERE id = NEW.student_id AND school_id = caller_school AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The selected student is not active in your school.';
    END IF;
    IF NEW.due_date < COALESCE(NEW.borrow_date, CURRENT_DATE) THEN
      RAISE EXCEPTION 'The due date cannot be before the borrow date.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.borrow_records
      WHERE book_id = NEW.book_id AND student_id = NEW.student_id
        AND school_id = caller_school AND status IN ('borrowed', 'overdue')
    ) THEN
      RAISE EXCEPTION 'This student already has an active loan for this book.';
    END IF;
    UPDATE public.library_books
    SET available_copies = available_copies - 1, updated_at = now()
    WHERE id = NEW.book_id AND school_id = caller_school AND available_copies > 0;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No available copies of this book can be issued.';
    END IF;
    NEW.school_id := caller_school;
    NEW.borrow_date := COALESCE(NEW.borrow_date, CURRENT_DATE);
    NEW.status := 'borrowed';
    NEW.return_date := NULL;
    RETURN NEW;
  END IF;

  IF OLD.school_id <> caller_school OR NEW.book_id <> OLD.book_id OR NEW.student_id <> OLD.student_id THEN
    RAISE EXCEPTION 'A loan cannot be moved outside its school, book, or student.';
  END IF;
  IF OLD.status NOT IN ('borrowed', 'overdue') OR NEW.status <> 'returned' THEN
    RAISE EXCEPTION 'Only an active loan can be returned.';
  END IF;
  SELECT * INTO book_row
  FROM public.library_books
  WHERE id = OLD.book_id AND school_id = caller_school
  FOR UPDATE;
  IF NOT FOUND OR book_row.available_copies >= book_row.total_copies THEN
    RAISE EXCEPTION 'Book inventory cannot be increased for this return.';
  END IF;
  UPDATE public.library_books
  SET available_copies = available_copies + 1, updated_at = now()
  WHERE id = OLD.book_id AND school_id = caller_school;
  NEW.return_date := COALESCE(NEW.return_date, CURRENT_DATE);
  NEW.school_id := caller_school;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS borrow_records_school_admin_guard ON public.borrow_records;
CREATE TRIGGER borrow_records_school_admin_guard
  BEFORE INSERT OR UPDATE ON public.borrow_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_school_admin_borrow_record();

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['exams', 'results', 'fee_structures', 'invoices', 'payments', 'library_books', 'borrow_records']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS school_admin_manage_%I ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY school_admin_manage_%I ON public.%I FOR ALL TO authenticated
       USING (EXISTS (SELECT 1 FROM public.profiles AS profile
         WHERE profile.id = auth.uid() AND profile.role IN (''admin'', ''super_admin'')
           AND profile.school_id = %I.school_id))
       WITH CHECK (EXISTS (SELECT 1 FROM public.profiles AS profile
         WHERE profile.id = auth.uid() AND profile.role IN (''admin'', ''super_admin'')
           AND profile.school_id = %I.school_id))',
      table_name, table_name, table_name, table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS school_admin_scope_%I ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY school_admin_scope_%I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
       USING ((SELECT profile.role FROM public.profiles AS profile WHERE profile.id = auth.uid())
          NOT IN (''admin'', ''super_admin'')
          OR school_id = (SELECT profile.school_id FROM public.profiles AS profile WHERE profile.id = auth.uid()))
       WITH CHECK ((SELECT profile.role FROM public.profiles AS profile WHERE profile.id = auth.uid())
          NOT IN (''admin'', ''super_admin'')
          OR school_id = (SELECT profile.school_id FROM public.profiles AS profile WHERE profile.id = auth.uid()))',
      table_name, table_name
    );
  END LOOP;
END
$$;

DROP POLICY IF EXISTS school_admin_manage_terms ON public.terms;
CREATE POLICY school_admin_manage_terms ON public.terms
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles AS profile
    JOIN public.academic_years AS year ON year.school_id = profile.school_id
    WHERE profile.id = auth.uid() AND profile.role IN ('admin', 'super_admin')
      AND year.id = terms.academic_year_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles AS profile
    JOIN public.academic_years AS year ON year.school_id = profile.school_id
    WHERE profile.id = auth.uid() AND profile.role IN ('admin', 'super_admin')
      AND year.id = terms.academic_year_id
  ));
DROP POLICY IF EXISTS school_admin_scope_terms ON public.terms;
CREATE POLICY school_admin_scope_terms ON public.terms
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT profile.role FROM public.profiles AS profile WHERE profile.id = auth.uid())
      NOT IN ('admin', 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles AS profile
      JOIN public.academic_years AS year ON year.school_id = profile.school_id
      WHERE profile.id = auth.uid() AND year.id = terms.academic_year_id
    )
  )
  WITH CHECK (
    (SELECT profile.role FROM public.profiles AS profile WHERE profile.id = auth.uid())
      NOT IN ('admin', 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles AS profile
      JOIN public.academic_years AS year ON year.school_id = profile.school_id
      WHERE profile.id = auth.uid() AND year.id = terms.academic_year_id
    )
  );
