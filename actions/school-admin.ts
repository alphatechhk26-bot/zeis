'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type SchoolAdminContext = {
  db: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  schoolId: string;
};

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const academicPath = '/dashboard/admin/settings';
const classesPath = '/dashboard/admin/classes';
const teachersPath = '/dashboard/admin/teachers';
const studentsPath = '/dashboard/admin/students';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.').refine(
  (value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  },
  'Enter a valid date.'
);

function messageFrom(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? 'Invalid input.';
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}

async function run<T>(action: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { success: true, data: await action() };
  } catch (error) {
    return { success: false, error: messageFrom(error) };
  }
}

function throwDatabaseError(error: { code?: string; message: string } | null, operation: string) {
  if (!error) return;
  if (error.code === '23505') {
    throw new Error('A record with these details already exists.');
  }
  if (error.code === '23503') {
    throw new Error('This record is still in use and cannot be changed or deleted.');
  }
  if (error.code === '42501' || error.code === 'PGRST301') {
    throw new Error('You do not have permission to change this school record.');
  }
  throw new Error(`${operation}: ${error.message}`);
}

async function requireSchoolAdmin(): Promise<SchoolAdminContext> {
  const db = await createClient();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();

  if (authError || !user) throw new Error('Unauthorized: please sign in.');

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id, role, school_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile) throw new Error('Unauthorized: profile not found.');
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    throw new Error('Forbidden: school administrator access is required.');
  }
  if (!profile.school_id) {
    throw new Error('Your administrator account must be assigned to a school.');
  }

  const { data: school, error: schoolError } = await db
    .from('schools')
    .select('id')
    .eq('id', profile.school_id)
    .maybeSingle();
  if (schoolError || !school) {
    throw new Error('Your assigned school could not be verified.');
  }

  return { db, userId: user.id, schoolId: school.id };
}

async function getAcademicYear(
  context: SchoolAdminContext,
  academicYearId: string
) {
  const { data, error } = await context.db
    .from('academic_years')
    .select('id, school_id, start_date, end_date')
    .eq('id', academicYearId)
    .eq('school_id', context.schoolId)
    .maybeSingle();
  if (error) throw new Error(`Could not verify the academic year: ${error.message}`);
  if (!data) throw new Error('The selected academic year does not belong to your school.');
  return data;
}

async function getClass(context: SchoolAdminContext, classId: string) {
  const { data, error } = await context.db
    .from('classes')
    .select('id, school_id')
    .eq('id', classId)
    .eq('school_id', context.schoolId)
    .maybeSingle();
  if (error) throw new Error(`Could not verify the class: ${error.message}`);
  if (!data) throw new Error('The selected class does not belong to your school.');
  return data;
}

async function getSubject(context: SchoolAdminContext, subjectId: string) {
  const { data, error } = await context.db
    .from('subjects')
    .select('id, school_id')
    .eq('id', subjectId)
    .eq('school_id', context.schoolId)
    .maybeSingle();
  if (error) throw new Error(`Could not verify the subject: ${error.message}`);
  if (!data) throw new Error('The selected subject does not belong to your school.');
  return data;
}

async function getTeacher(context: SchoolAdminContext, teacherId: string) {
  const { data, error } = await context.db
    .from('teachers')
    .select('id, school_id')
    .eq('id', teacherId)
    .eq('school_id', context.schoolId)
    .maybeSingle();
  if (error) throw new Error(`Could not verify the teacher: ${error.message}`);
  if (!data) throw new Error('The selected teacher does not belong to your school.');
  return data;
}

async function ensureSchoolDuplicate(
  query: PromiseLike<{ data: { id: string } | null; error: { message: string } | null }>,
  message: string
) {
  const { data, error } = await query;
  if (error) throw new Error(`Could not check for duplicate records: ${error.message}`);
  if (data) throw new Error(message);
}

async function ensureYearHasNoDependencies(
  context: SchoolAdminContext,
  id: string
) {
  const results = await Promise.all([
    context.db.from('terms').select('id', { count: 'exact', head: true }).eq('academic_year_id', id),
    context.db.from('student_enrollments').select('id', { count: 'exact', head: true }).eq('academic_year_id', id),
    context.db.from('teacher_assignments').select('id', { count: 'exact', head: true }).eq('academic_year_id', id),
    context.db.from('class_subjects').select('id', { count: 'exact', head: true }).eq('academic_year_id', id),
    context.db.from('attendance').select('id', { count: 'exact', head: true }).eq('academic_year_id', id),
    context.db.from('exams').select('id', { count: 'exact', head: true }).eq('academic_year_id', id),
    context.db.from('fee_structures').select('id', { count: 'exact', head: true }).eq('academic_year_id', id),
  ]);
  if (results.some((result) => result.error)) {
    const failed = results.find((result) => result.error);
    throw new Error(`Could not check academic-year dependencies: ${failed?.error?.message}`);
  }
  if (results.some((result) => (result.count ?? 0) > 0)) {
    throw new Error('This academic year is in use. Remove its terms, enrollments, and assignments before deleting it.');
  }
}

async function ensureClassHasNoDependencies(context: SchoolAdminContext, id: string) {
  const results = await Promise.all([
    context.db.from('teacher_assignments').select('id', { count: 'exact', head: true }).eq('class_id', id),
    context.db.from('class_subjects').select('id', { count: 'exact', head: true }).eq('class_id', id),
    context.db.from('student_enrollments').select('id', { count: 'exact', head: true }).eq('class_id', id),
    context.db.from('attendance').select('id', { count: 'exact', head: true }).eq('class_id', id),
    context.db.from('exams').select('id', { count: 'exact', head: true }).eq('class_id', id),
    context.db.from('fee_structures').select('id', { count: 'exact', head: true }).eq('class_id', id),
  ]);
  if (results.some((result) => result.error)) {
    const failed = results.find((result) => result.error);
    throw new Error(`Could not check class dependencies: ${failed?.error?.message}`);
  }
  if (results.some((result) => (result.count ?? 0) > 0)) {
    throw new Error('This class has linked academic records. Reassign or remove them before deleting the class.');
  }
}

const yearFieldsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  startDate: dateSchema,
  endDate: dateSchema,
  isActive: z.boolean(),
}).strict();
const yearSchema = yearFieldsSchema.refine((value) => value.startDate <= value.endDate, {
  message: 'The start date must be on or before the end date.',
  path: ['endDate'],
});
const yearUpdateSchema = yearFieldsSchema.extend({ id: z.string().uuid() }).strict().refine(
  (value) => value.startDate <= value.endDate,
  {
    message: 'The start date must be on or before the end date.',
    path: ['endDate'],
  }
);
const idSchema = z.object({ id: z.string().uuid() }).strict();

async function ensureYearNameAvailable(
  context: SchoolAdminContext,
  name: string,
  excludeId?: string
) {
  let query = context.db
    .from('academic_years')
    .select('id')
    .eq('school_id', context.schoolId)
    .ilike('name', name)
    .limit(1);
  if (excludeId) query = query.neq('id', excludeId);
  await ensureSchoolDuplicate(query.maybeSingle(), 'An academic year with this name already exists.');
}

async function ensureYearDatesContainDependencies(
  context: SchoolAdminContext,
  yearId: string,
  startDate: string,
  endDate: string
) {
  const [terms, enrollments] = await Promise.all([
    context.db
      .from('terms')
      .select('start_date, end_date')
      .eq('academic_year_id', yearId),
    context.db
      .from('student_enrollments')
      .select('enrollment_date')
      .eq('academic_year_id', yearId),
  ]);
  if (terms.error) throw new Error(`Could not validate terms: ${terms.error.message}`);
  if (enrollments.error) throw new Error(`Could not validate enrollments: ${enrollments.error.message}`);
  if ((terms.data ?? []).some((term) => term.start_date < startDate || term.end_date > endDate)) {
    throw new Error('Academic year dates cannot exclude an existing term.');
  }
  if (
    (enrollments.data ?? []).some(
      (enrollment) =>
        enrollment.enrollment_date !== null &&
        (enrollment.enrollment_date < startDate || enrollment.enrollment_date > endDate)
    )
  ) {
    throw new Error('Academic year dates cannot exclude an existing enrollment date.');
  }
}

export async function createAcademicYear(input: z.infer<typeof yearSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = yearSchema.parse(input);
    await ensureYearNameAvailable(context, value.name);
    const { data, error } = await context.db
      .from('academic_years')
      .insert({
        school_id: context.schoolId,
        name: value.name,
        start_date: value.startDate,
        end_date: value.endDate,
        is_active: value.isActive,
      })
      .select('id, name, start_date, end_date, is_active, status, school_id, created_at, updated_at')
      .single();
    throwDatabaseError(error, 'Could not create academic year');
    if (!data) throw new Error('No academic year was returned after creation.');
    revalidatePath(academicPath);
    revalidatePath(classesPath);
    revalidatePath(teachersPath);
    revalidatePath(studentsPath);
    return data;
  });
}

export async function updateAcademicYear(input: z.infer<typeof yearUpdateSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = yearUpdateSchema.parse(input);
    await getAcademicYear(context, value.id);
    await ensureYearNameAvailable(context, value.name, value.id);
    await ensureYearDatesContainDependencies(
      context,
      value.id,
      value.startDate,
      value.endDate
    );
    const { data, error } = await context.db
      .from('academic_years')
      .update({
        name: value.name,
        start_date: value.startDate,
        end_date: value.endDate,
        is_active: value.isActive,
      })
      .eq('id', value.id)
      .eq('school_id', context.schoolId)
      .select('id, name, start_date, end_date, is_active, status, school_id, created_at, updated_at')
      .maybeSingle();
    throwDatabaseError(error, 'Could not update academic year');
    if (!data) throw new Error('Academic year not found in your school.');
    revalidatePath(academicPath);
    revalidatePath(classesPath);
    revalidatePath(teachersPath);
    revalidatePath(studentsPath);
    return data;
  });
}

export async function deleteAcademicYear(input: z.infer<typeof idSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const { id } = idSchema.parse(input);
    await getAcademicYear(context, id);
    await ensureYearHasNoDependencies(context, id);
    const { data: deleted, error } = await context.db
      .from('academic_years')
      .delete()
      .eq('id', id)
      .eq('school_id', context.schoolId)
      .select('id')
      .maybeSingle();
    throwDatabaseError(error, 'Could not delete academic year');
    if (!deleted) throw new Error('Academic year not found in your school.');
    revalidatePath(academicPath);
    revalidatePath(classesPath);
    revalidatePath(teachersPath);
    revalidatePath(studentsPath);
    return { id };
  });
}

const termFieldsSchema = z.object({
  academicYearId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  termNumber: z.number().int().min(1).max(12),
  startDate: dateSchema,
  endDate: dateSchema,
  isActive: z.boolean(),
}).strict();
const termSchema = termFieldsSchema.refine((value) => value.startDate <= value.endDate, {
  message: 'The start date must be on or before the end date.',
  path: ['endDate'],
});
const termUpdateSchema = termFieldsSchema.extend({ id: z.string().uuid() }).strict().refine(
  (value) => value.startDate <= value.endDate,
  {
    message: 'The start date must be on or before the end date.',
    path: ['endDate'],
  }
);

async function validateTermDates(
  context: SchoolAdminContext,
  value: z.infer<typeof termSchema>
) {
  const year = await getAcademicYear(context, value.academicYearId);
  if (value.startDate < year.start_date || value.endDate > year.end_date) {
    throw new Error('Term dates must fall within the selected academic year.');
  }
}

async function ensureTermAvailable(
  context: SchoolAdminContext,
  academicYearId: string,
  termNumber: number,
  name: string,
  excludeId?: string
) {
  let numberQuery = context.db
    .from('terms')
    .select('id')
    .eq('academic_year_id', academicYearId)
    .eq('term_number', termNumber)
    .limit(1);
  if (excludeId) numberQuery = numberQuery.neq('id', excludeId);
  await ensureSchoolDuplicate(
    numberQuery.maybeSingle(),
    'This term number already exists in the selected academic year.'
  );
  let nameQuery = context.db
    .from('terms')
    .select('id')
    .eq('academic_year_id', academicYearId)
    .ilike('name', name)
    .limit(1);
  if (excludeId) nameQuery = nameQuery.neq('id', excludeId);
  const { data: duplicateName, error: nameError } = await nameQuery.maybeSingle();
  if (nameError) throw new Error(`Could not check term name: ${nameError.message}`);
  if (duplicateName) throw new Error('A term with this name already exists in the selected academic year.');
}

async function ensureTermDatesContainEnrollments(
  context: SchoolAdminContext,
  termId: string,
  academicYearId: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await context.db
    .from('student_enrollments')
    .select('academic_year_id, enrollment_date')
    .eq('term_id', termId);
  if (error) throw new Error(`Could not validate term enrollments: ${error.message}`);
  if ((data ?? []).some((row) => row.academic_year_id !== academicYearId)) {
    throw new Error('This term is used by enrollments in another academic year and cannot be moved.');
  }
  if (
    (data ?? []).some(
      (row) =>
        row.enrollment_date !== null &&
        (row.enrollment_date < startDate || row.enrollment_date > endDate)
    )
  ) {
    throw new Error('Term dates cannot exclude an existing student enrollment date.');
  }
}

export async function createTerm(input: z.infer<typeof termSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = termSchema.parse(input);
    await validateTermDates(context, value);
    await ensureTermAvailable(context, value.academicYearId, value.termNumber, value.name);
    const { data, error } = await context.db
      .from('terms')
      .insert({
        academic_year_id: value.academicYearId,
        name: value.name,
        term_number: value.termNumber,
        start_date: value.startDate,
        end_date: value.endDate,
        is_active: value.isActive,
      })
      .select('id, academic_year_id, name, term_number, start_date, end_date, is_active, created_at, updated_at')
      .single();
    throwDatabaseError(error, 'Could not create term');
    if (!data) throw new Error('No term was returned after creation.');
    revalidatePath(academicPath);
    revalidatePath(studentsPath);
    return data;
  });
}

export async function updateTerm(input: z.infer<typeof termUpdateSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = termUpdateSchema.parse(input);
    const { data: existing, error: readError } = await context.db
      .from('terms')
      .select('id, academic_year_id')
      .eq('id', value.id)
      .maybeSingle();
    if (readError) throw new Error(`Could not load term: ${readError.message}`);
    if (!existing) throw new Error('Term not found.');
    await getAcademicYear(context, existing.academic_year_id);
    await validateTermDates(context, value);
    await ensureTermAvailable(context, value.academicYearId, value.termNumber, value.name, value.id);
    await ensureTermDatesContainEnrollments(
      context,
      value.id,
      value.academicYearId,
      value.startDate,
      value.endDate
    );
    const { data, error } = await context.db
      .from('terms')
      .update({
        academic_year_id: value.academicYearId,
        name: value.name,
        term_number: value.termNumber,
        start_date: value.startDate,
        end_date: value.endDate,
        is_active: value.isActive,
      })
      .eq('id', value.id)
      .select('id, academic_year_id, name, term_number, start_date, end_date, is_active, created_at, updated_at')
      .maybeSingle();
    throwDatabaseError(error, 'Could not update term');
    if (!data) throw new Error('Term not found in your school.');
    revalidatePath(academicPath);
    revalidatePath(studentsPath);
    return data;
  });
}

export async function deleteTerm(input: z.infer<typeof idSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const { id } = idSchema.parse(input);
    const { data: term, error: readError } = await context.db
      .from('terms')
      .select('id, academic_year_id')
      .eq('id', id)
      .maybeSingle();
    if (readError) throw new Error(`Could not load term: ${readError.message}`);
    if (!term) throw new Error('Term not found.');
    await getAcademicYear(context, term.academic_year_id);
    const { count, error: dependencyError } = await context.db
      .from('student_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('term_id', id);
    throwDatabaseError(dependencyError, 'Could not check term dependencies');
    if ((count ?? 0) > 0) throw new Error('This term has student enrollments and cannot be deleted.');
    const { data: deleted, error } = await context.db
      .from('terms')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    throwDatabaseError(error, 'Could not delete term');
    if (!deleted) throw new Error('Term not found in your school.');
    revalidatePath(academicPath);
    revalidatePath(studentsPath);
    return { id };
  });
}

const subjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(20).nullable(),
  description: z.string().trim().max(2000).nullable(),
  isActive: z.boolean(),
}).strict();
const subjectUpdateSchema = subjectSchema.extend({ id: z.string().uuid() }).strict();

async function ensureSubjectAvailable(
  context: SchoolAdminContext,
  value: z.infer<typeof subjectSchema>,
  excludeId?: string
) {
  let nameQuery = context.db
    .from('subjects')
    .select('id')
    .eq('school_id', context.schoolId)
    .ilike('name', value.name)
    .limit(1);
  if (excludeId) nameQuery = nameQuery.neq('id', excludeId);
  await ensureSchoolDuplicate(nameQuery.maybeSingle(), 'A subject with this name already exists.');

  if (value.code) {
    let codeQuery = context.db
      .from('subjects')
      .select('id')
      .eq('school_id', context.schoolId)
      .ilike('code', value.code)
      .limit(1);
    if (excludeId) codeQuery = codeQuery.neq('id', excludeId);
    await ensureSchoolDuplicate(codeQuery.maybeSingle(), 'A subject with this code already exists.');
  }
}

export async function createSubject(input: z.infer<typeof subjectSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = subjectSchema.parse(input);
    await ensureSubjectAvailable(context, value);
    const { data, error } = await context.db
      .from('subjects')
      .insert({
        school_id: context.schoolId,
        name: value.name,
        code: value.code || null,
        description: value.description || null,
        is_active: value.isActive,
      })
      .select('id, school_id, name, code, description, is_active, created_at, updated_at')
      .single();
    throwDatabaseError(error, 'Could not create subject');
    if (!data) throw new Error('No subject was returned after creation.');
    revalidatePath(academicPath);
    revalidatePath(classesPath);
    return data;
  });
}

export async function updateSubject(input: z.infer<typeof subjectUpdateSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = subjectUpdateSchema.parse(input);
    await getSubject(context, value.id);
    await ensureSubjectAvailable(context, value, value.id);
    const { data, error } = await context.db
      .from('subjects')
      .update({
        name: value.name,
        code: value.code || null,
        description: value.description || null,
        is_active: value.isActive,
      })
      .eq('id', value.id)
      .eq('school_id', context.schoolId)
      .select('id, school_id, name, code, description, is_active, created_at, updated_at')
      .maybeSingle();
    throwDatabaseError(error, 'Could not update subject');
    if (!data) throw new Error('Subject not found in your school.');
    revalidatePath(academicPath);
    revalidatePath(classesPath);
    return data;
  });
}

export async function deleteSubject(input: z.infer<typeof idSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const { id } = idSchema.parse(input);
    await getSubject(context, id);
    const results = await Promise.all([
      context.db.from('teacher_assignments').select('id', { count: 'exact', head: true }).eq('subject_id', id),
      context.db.from('class_subjects').select('id', { count: 'exact', head: true }).eq('subject_id', id),
    ]);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new Error(`Could not check subject dependencies: ${failed.error.message}`);
    if (results.some((result) => (result.count ?? 0) > 0)) {
      throw new Error('This subject is linked to classes or teachers and cannot be deleted.');
    }
    const { data: deleted, error } = await context.db
      .from('subjects')
      .delete()
      .eq('id', id)
      .eq('school_id', context.schoolId)
      .select('id')
      .maybeSingle();
    throwDatabaseError(error, 'Could not delete subject');
    if (!deleted) throw new Error('Subject not found in your school.');
    revalidatePath(academicPath);
    revalidatePath(classesPath);
    return { id };
  });
}

const classSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(50).nullable(),
  description: z.string().trim().max(2000).nullable(),
  isActive: z.boolean(),
  newStreamName: z.string().trim().max(100).nullable().optional(),
  newStreamCode: z.string().trim().max(50).nullable().optional(),
  newStreamDescription: z.string().trim().max(1000).nullable().optional(),
}).strict();
const classUpdateSchema = classSchema.omit({
  newStreamName: true,
  newStreamCode: true,
  newStreamDescription: true,
}).extend({ id: z.string().uuid() }).strict();

async function ensureClassAvailable(
  context: SchoolAdminContext,
  name: string,
  code: string | null,
  excludeId?: string
) {
  let nameQuery = context.db
    .from('classes')
    .select('id')
    .eq('school_id', context.schoolId)
    .ilike('name', name)
    .limit(1);
  if (excludeId) nameQuery = nameQuery.neq('id', excludeId);
  await ensureSchoolDuplicate(nameQuery.maybeSingle(), 'A class with this name already exists.');
  if (code) {
    let codeQuery = context.db
      .from('classes')
      .select('id')
      .eq('school_id', context.schoolId)
      .ilike('code', code)
      .limit(1);
    if (excludeId) codeQuery = codeQuery.neq('id', excludeId);
    await ensureSchoolDuplicate(codeQuery.maybeSingle(), 'A class with this code already exists.');
  }
}

async function ensureStreamNameAvailable(context: SchoolAdminContext, name: string) {
  await ensureSchoolDuplicate(
    context.db
      .from('streams')
      .select('id')
      .eq('school_id', context.schoolId)
      .ilike('name', name)
      .limit(1)
      .maybeSingle(),
    'A stream with this name already exists in your school.'
  );
}

export async function createClass(input: z.infer<typeof classSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = classSchema.parse(input);
    await ensureClassAvailable(context, value.name, value.code);

    let createdStreamId: string | null = null;
    if (value.newStreamName) {
      await ensureStreamNameAvailable(context, value.newStreamName);
      const { data: stream, error: streamError } = await context.db
        .from('streams')
        .insert({
          school_id: context.schoolId,
          name: value.newStreamName,
          code: value.newStreamCode || null,
          description: value.newStreamDescription || null,
          is_active: true,
        })
        .select('id')
        .single();
      throwDatabaseError(streamError, 'Could not create stream');
      if (!stream) throw new Error('No stream was returned after creation.');
      createdStreamId = stream.id;
    }

    const { data, error } = await context.db
      .from('classes')
      .insert({
        school_id: context.schoolId,
        name: value.name,
        code: value.code || null,
        description: value.description || null,
        is_active: value.isActive,
      })
      .select('id, school_id, name, code, description, is_active, created_at, updated_at')
      .single();
    if (error) {
      let cleanupMessage = '';
      if (createdStreamId) {
        const { error: cleanupError } = await context.db
          .from('streams')
          .delete()
          .eq('id', createdStreamId)
          .eq('school_id', context.schoolId);
        if (cleanupError) cleanupMessage = ` Stream cleanup also failed: ${cleanupError.message}`;
      }
      throw new Error(`Could not create class: ${error.message}.${cleanupMessage}`);
    }
    if (!data) throw new Error('No class was returned after creation.');
    revalidatePath(classesPath);
    revalidatePath(academicPath);
    revalidatePath(studentsPath);
    revalidatePath(teachersPath);
    return data;
  });
}

export async function updateClass(input: z.infer<typeof classUpdateSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = classUpdateSchema.parse(input);
    await getClass(context, value.id);
    await ensureClassAvailable(context, value.name, value.code, value.id);
    const { data, error } = await context.db
      .from('classes')
      .update({
        name: value.name,
        code: value.code || null,
        description: value.description || null,
        is_active: value.isActive,
      })
      .eq('id', value.id)
      .eq('school_id', context.schoolId)
      .select('id, school_id, name, code, description, is_active, created_at, updated_at')
      .maybeSingle();
    throwDatabaseError(error, 'Could not update class');
    if (!data) throw new Error('Class not found in your school.');
    revalidatePath(classesPath);
    revalidatePath(studentsPath);
    revalidatePath(teachersPath);
    return data;
  });
}

export async function deleteClass(input: z.infer<typeof idSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const { id } = idSchema.parse(input);
    await getClass(context, id);
    await ensureClassHasNoDependencies(context, id);
    const { data: deleted, error } = await context.db
      .from('classes')
      .delete()
      .eq('id', id)
      .eq('school_id', context.schoolId)
      .select('id')
      .maybeSingle();
    throwDatabaseError(error, 'Could not delete class');
    if (!deleted) throw new Error('Class not found in your school.');
    revalidatePath(classesPath);
    revalidatePath(studentsPath);
    revalidatePath(teachersPath);
    return { id };
  });
}

const teacherAssignmentSchema = z.object({
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  academicYearId: z.string().uuid(),
}).strict();

export async function assignTeacherToClassSubject(input: z.infer<typeof teacherAssignmentSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = teacherAssignmentSchema.parse(input);
    await Promise.all([
      getTeacher(context, value.teacherId),
      getClass(context, value.classId),
      getSubject(context, value.subjectId),
      getAcademicYear(context, value.academicYearId),
    ]);

    const { data: duplicate, error: duplicateError } = await context.db
      .from('teacher_assignments')
      .select('id')
      .eq('teacher_id', value.teacherId)
      .eq('class_id', value.classId)
      .eq('subject_id', value.subjectId)
      .eq('academic_year_id', value.academicYearId)
      .limit(1)
      .maybeSingle();
    if (duplicateError) throw new Error(`Could not check teacher assignment: ${duplicateError.message}`);
    if (duplicate) throw new Error('This teacher is already assigned to this class and subject for the selected year.');

    const { data: classSubject, error: classSubjectError } = await context.db
      .from('class_subjects')
      .select('id')
      .eq('class_id', value.classId)
      .eq('subject_id', value.subjectId)
      .eq('academic_year_id', value.academicYearId)
      .limit(1)
      .maybeSingle();
    if (classSubjectError) throw new Error(`Could not check class subject: ${classSubjectError.message}`);

    let newClassSubjectId: string | null = null;
    if (!classSubject) {
      const { data: newClassSubject, error } = await context.db
        .from('class_subjects')
        .insert({
          class_id: value.classId,
          subject_id: value.subjectId,
          academic_year_id: value.academicYearId,
          is_active: true,
        })
        .select('id')
        .single();
      throwDatabaseError(error, 'Could not link subject to class');
      if (!newClassSubject) throw new Error('No class-subject link was returned after creation.');
      newClassSubjectId = newClassSubject.id;
    }

    const { data, error } = await context.db
      .from('teacher_assignments')
      .insert({
        teacher_id: value.teacherId,
        class_id: value.classId,
        subject_id: value.subjectId,
        academic_year_id: value.academicYearId,
      })
      .select('id, teacher_id, class_id, subject_id, academic_year_id, created_at, updated_at')
      .single();
    if (error) {
      if (newClassSubjectId) {
        const { error: rollbackError } = await context.db
          .from('class_subjects')
          .delete()
          .eq('id', newClassSubjectId);
        if (rollbackError) {
          throw new Error(`Could not assign teacher: ${error.message}. Subject-link rollback also failed: ${rollbackError.message}`);
        }
      }
      throwDatabaseError(error, 'Could not assign teacher');
    }
    if (!data) throw new Error('No teacher assignment was returned after creation.');
    revalidatePath(classesPath);
    revalidatePath(teachersPath);
    return data;
  });
}

export async function deleteTeacherAssignment(input: z.infer<typeof idSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const { id } = idSchema.parse(input);
    const { data: assignment, error: readError } = await context.db
      .from('teacher_assignments')
      .select('id, teacher_id, class_id, subject_id, academic_year_id')
      .eq('id', id)
      .maybeSingle();
    if (readError) throw new Error(`Could not load teacher assignment: ${readError.message}`);
    if (!assignment) throw new Error('Teacher assignment not found.');
    await Promise.all([
      getTeacher(context, assignment.teacher_id),
      getClass(context, assignment.class_id),
      getSubject(context, assignment.subject_id),
      getAcademicYear(context, assignment.academic_year_id),
    ]);
    const { data: deleted, error } = await context.db
      .from('teacher_assignments')
      .delete()
      .eq('id', id)
      .eq('teacher_id', assignment.teacher_id)
      .eq('class_id', assignment.class_id)
      .select('id')
      .maybeSingle();
    throwDatabaseError(error, 'Could not remove teacher assignment');
    if (!deleted) throw new Error('Teacher assignment not found in your school.');
    revalidatePath(classesPath);
    revalidatePath(teachersPath);
    return { id };
  });
}

const teacherSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  employeeId: z.string().trim().max(100).nullable(),
  hireDate: dateSchema.nullable(),
  status: z.enum(['active', 'inactive', 'archived']),
}).strict();

const teacherUpdateSchema = teacherSchema.omit({ email: true, password: true }).extend({
  teacherId: z.string().uuid(),
}).strict();

async function cleanupNewAuthUser(userId: string): Promise<string | null> {
  try {
    const { error } = await createAdminClient().auth.admin.deleteUser(userId);
    return error?.message ?? null;
  } catch (error) {
    return messageFrom(error);
  }
}

export async function createTeacher(input: z.infer<typeof teacherSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = teacherSchema.parse(input);
    if (value.employeeId) {
      await ensureSchoolDuplicate(
        context.db
          .from('teachers')
          .select('id')
          .eq('school_id', context.schoolId)
          .eq('employee_id', value.employeeId)
          .limit(1)
          .maybeSingle(),
        'A teacher with this employee ID already exists.'
      );
    }

    const adminClient = createAdminClient();
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: value.email,
      password: value.password,
      email_confirm: true,
      user_metadata: { full_name: value.fullName },
    });
    if (authError || !authData.user) {
      const message = authError?.message ?? 'No Auth user was returned.';
      if (/already registered|already exists|duplicate/i.test(message)) {
        throw new Error('An account with this email already exists.');
      }
      throw new Error(`Could not create Auth account: ${message}`);
    }

    const userId = authData.user.id;
    let creationError: string | null = null;
    try {
      const { error: profileError } = await context.db.from('profiles').insert({
        id: userId,
        full_name: value.fullName,
        role: 'teacher',
        school_id: context.schoolId,
      });
      if (profileError) throw new Error(`Could not create teacher profile: ${profileError.message}`);
      const { error: teacherError } = await context.db.from('teachers').insert({
        id: userId,
        school_id: context.schoolId,
        employee_id: value.employeeId || null,
        hire_date: value.hireDate,
        status: value.status,
      });
      if (teacherError) throw new Error(`Could not create teacher record: ${teacherError.message}`);
    } catch (error) {
      creationError = messageFrom(error);
    }
    if (creationError) {
      const cleanupError = await cleanupNewAuthUser(userId);
      throw new Error(
        cleanupError
          ? `${creationError} Auth account cleanup also failed: ${cleanupError}`
          : creationError
      );
    }

    revalidatePath(teachersPath);
    revalidatePath(classesPath);
    return { id: userId, schoolId: context.schoolId };
  });
}

export async function updateTeacher(input: z.infer<typeof teacherUpdateSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = teacherUpdateSchema.parse(input);
    await getTeacher(context, value.teacherId);
    if (value.employeeId) {
      await ensureSchoolDuplicate(
        context.db
          .from('teachers')
          .select('id')
          .eq('school_id', context.schoolId)
          .eq('employee_id', value.employeeId)
          .neq('id', value.teacherId)
          .limit(1)
          .maybeSingle(),
        'A teacher with this employee ID already exists.'
      );
    }

    const { data: previousProfile, error: profileReadError } = await context.db
      .from('profiles')
      .select('full_name')
      .eq('id', value.teacherId)
      .eq('school_id', context.schoolId)
      .maybeSingle();
    if (profileReadError || !previousProfile) {
      throw new Error('Teacher profile was not found in your school.');
    }

    const { data: previousTeacher, error: teacherReadError } = await context.db
      .from('teachers')
      .select('employee_id, hire_date, status')
      .eq('id', value.teacherId)
      .eq('school_id', context.schoolId)
      .maybeSingle();
    if (teacherReadError || !previousTeacher) {
      throw new Error('Teacher record was not found in your school.');
    }

    const { data: updatedProfile, error: profileError } = await context.db
      .from('profiles')
      .update({ full_name: value.fullName })
      .eq('id', value.teacherId)
      .eq('school_id', context.schoolId)
      .select('id')
      .maybeSingle();
    throwDatabaseError(profileError, 'Could not update teacher profile');
    if (!updatedProfile) throw new Error('Teacher profile was not updated in your school.');

    const { data: updatedTeacher, error: teacherError } = await context.db
      .from('teachers')
      .update({
        employee_id: value.employeeId || null,
        hire_date: value.hireDate,
        status: value.status,
      })
      .eq('id', value.teacherId)
      .eq('school_id', context.schoolId)
      .select('id')
      .maybeSingle();
    if (teacherError || !updatedTeacher) {
      const { error: rollbackError } = await context.db
        .from('profiles')
        .update({ full_name: previousProfile.full_name })
        .eq('id', value.teacherId)
        .eq('school_id', context.schoolId);
      throw new Error(
        `Could not update teacher record: ${teacherError?.message ?? 'Teacher record was not found in your school.'}${rollbackError ? `. Profile rollback failed: ${rollbackError.message}` : ''}`
      );
    }
    revalidatePath(teachersPath);
    revalidatePath(classesPath);
    return { id: value.teacherId };
  });
}

const studentSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  admissionNumber: z.string().trim().min(1).max(50).transform((value) => value.toUpperCase()),
  enrollmentDate: dateSchema,
  status: z.enum(['active', 'transferred', 'graduated', 'withdrawn', 'suspended']),
  classId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  termId: z.string().uuid().nullable(),
  streamId: z.string().uuid().nullable(),
}).strict();

const studentUpdateSchema = z.object({
  studentId: z.string().uuid(),
  fullName: z.string().trim().min(1).max(255),
  admissionNumber: z.string().trim().min(1).max(50).transform((value) => value.toUpperCase()),
  enrollmentDate: dateSchema,
  status: z.enum(['active', 'transferred', 'graduated', 'withdrawn', 'suspended']),
  enrollmentId: z.string().uuid().nullable(),
  classId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  termId: z.string().uuid().nullable(),
  streamId: z.string().uuid().nullable(),
}).strict();

async function ensureAdmissionNumberAvailable(
  context: SchoolAdminContext,
  admissionNumber: string,
  excludeId?: string
) {
  let query = context.db
    .from('students')
    .select('id')
    .eq('school_id', context.schoolId)
    .eq('admission_number', admissionNumber)
    .limit(1);
  if (excludeId) query = query.neq('id', excludeId);
  await ensureSchoolDuplicate(query.maybeSingle(), 'This admission number is already in use.');
}

async function validateEnrollment(
  context: SchoolAdminContext,
  value: {
    classId: string;
    academicYearId: string;
    termId: string | null;
    streamId: string | null;
    enrollmentDate: string;
  }
) {
  const [classroom, year] = await Promise.all([
    getClass(context, value.classId),
    getAcademicYear(context, value.academicYearId),
  ]);
  if (value.enrollmentDate < year.start_date || value.enrollmentDate > year.end_date) {
    throw new Error('Enrollment date must fall within the selected academic year.');
  }
  if (classroom.school_id !== year.school_id) {
    throw new Error('The class and academic year must belong to the same school.');
  }

  if (value.termId) {
    const { data: term, error } = await context.db
      .from('terms')
      .select('id, academic_year_id, start_date, end_date')
      .eq('id', value.termId)
      .eq('academic_year_id', value.academicYearId)
      .maybeSingle();
    if (error) throw new Error(`Could not verify the selected term: ${error.message}`);
    if (!term) throw new Error('The selected term does not belong to the academic year.');
    if (value.enrollmentDate < term.start_date || value.enrollmentDate > term.end_date) {
      throw new Error('Enrollment date must fall within the selected term.');
    }
  }

  if (value.streamId) {
    const { data: stream, error } = await context.db
      .from('streams')
      .select('id')
      .eq('id', value.streamId)
      .eq('school_id', context.schoolId)
      .maybeSingle();
    if (error) throw new Error(`Could not verify the selected stream: ${error.message}`);
    if (!stream) throw new Error('The selected stream does not belong to your school.');
  }
}

async function ensureEnrollmentAvailable(
  context: SchoolAdminContext,
  studentId: string,
  classId: string,
  academicYearId: string,
  excludeId?: string
) {
  let query = context.db
    .from('student_enrollments')
    .select('id')
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .eq('academic_year_id', academicYearId)
    .limit(1);
  if (excludeId) query = query.neq('id', excludeId);
  await ensureSchoolDuplicate(query.maybeSingle(), 'This student is already enrolled in this class for that academic year.');
}

export async function createStudent(input: z.infer<typeof studentSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = studentSchema.parse(input);
    await ensureAdmissionNumberAvailable(context, value.admissionNumber);
    await validateEnrollment(context, value);

    const adminClient = createAdminClient();
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: value.email,
      password: value.password,
      email_confirm: true,
      user_metadata: { full_name: value.fullName },
    });
    if (authError || !authData.user) {
      const message = authError?.message ?? 'No Auth user was returned.';
      if (/already registered|already exists|duplicate/i.test(message)) {
        throw new Error('An account with this email already exists.');
      }
      throw new Error(`Could not create Auth account: ${message}`);
    }

    const userId = authData.user.id;
    let creationError: string | null = null;
    let createdEnrollmentId: string | null = null;
    try {
      const { error: profileError } = await context.db.from('profiles').insert({
        id: userId,
        full_name: value.fullName,
        role: 'student',
        school_id: context.schoolId,
      });
      if (profileError) throw new Error(`Could not create student profile: ${profileError.message}`);

      const { error: studentError } = await context.db.from('students').insert({
        id: userId,
        school_id: context.schoolId,
        admission_number: value.admissionNumber,
        enrollment_date: value.enrollmentDate,
        status: value.status,
      });
      if (studentError) throw new Error(`Could not create student record: ${studentError.message}`);

      const { data: enrollment, error: enrollmentError } = await context.db
        .from('student_enrollments')
        .insert({
          student_id: userId,
          class_id: value.classId,
          academic_year_id: value.academicYearId,
          term_id: value.termId,
          stream_id: value.streamId,
          enrollment_date: value.enrollmentDate,
          status: value.status,
        })
        .select('id')
        .single();
      if (enrollmentError) throw new Error(`Could not create initial class enrollment: ${enrollmentError.message}`);
      if (!enrollment) throw new Error('No initial class enrollment was returned.');
      createdEnrollmentId = enrollment.id;
    } catch (error) {
      creationError = messageFrom(error);
    }

    if (creationError) {
      const cleanupError = await cleanupNewAuthUser(userId);
      throw new Error(
        cleanupError
          ? `${creationError} Auth account cleanup also failed: ${cleanupError}`
          : creationError
      );
    }
    if (!createdEnrollmentId) {
      const cleanupError = await cleanupNewAuthUser(userId);
      throw new Error(
        cleanupError
          ? `Initial class enrollment was not created. Auth account cleanup also failed: ${cleanupError}`
          : 'Initial class enrollment was not created.'
      );
    }

    revalidatePath(studentsPath);
    revalidatePath(classesPath);
    return {
      id: userId,
      admissionNumber: value.admissionNumber,
      schoolId: context.schoolId,
      enrollmentId: createdEnrollmentId,
    };
  });
}

export async function updateStudent(input: z.infer<typeof studentUpdateSchema>) {
  return run(async () => {
    const context = await requireSchoolAdmin();
    const value = studentUpdateSchema.parse(input);
    const { data: previousStudent, error: studentReadError } = await context.db
      .from('students')
      .select('id, admission_number, enrollment_date, status')
      .eq('id', value.studentId)
      .eq('school_id', context.schoolId)
      .maybeSingle();
    if (studentReadError || !previousStudent) throw new Error('Student was not found in your school.');

    const { data: previousProfile, error: profileReadError } = await context.db
      .from('profiles')
      .select('full_name')
      .eq('id', value.studentId)
      .eq('school_id', context.schoolId)
      .maybeSingle();
    if (profileReadError || !previousProfile) throw new Error('Student profile was not found in your school.');

    await ensureAdmissionNumberAvailable(context, value.admissionNumber, value.studentId);
    await validateEnrollment(context, value);

    if (value.enrollmentId) {
      const { data, error } = await context.db
        .from('student_enrollments')
        .select('id, class_id, academic_year_id')
        .eq('id', value.enrollmentId)
        .eq('student_id', value.studentId)
        .maybeSingle();
      if (error) throw new Error(`Could not load student enrollment: ${error.message}`);
      if (!data) throw new Error('Enrollment not found for this student.');
      await getAcademicYear(context, data.academic_year_id);
      await getClass(context, data.class_id);
    }
    await ensureEnrollmentAvailable(
      context,
      value.studentId,
      value.classId,
      value.academicYearId,
      value.enrollmentId ?? undefined
    );

    const { data: updatedProfile, error: profileUpdateError } = await context.db
      .from('profiles')
      .update({ full_name: value.fullName })
      .eq('id', value.studentId)
      .eq('school_id', context.schoolId)
      .select('id')
      .maybeSingle();
    throwDatabaseError(profileUpdateError, 'Could not update student profile');
    if (!updatedProfile) throw new Error('Student profile was not updated in your school.');

    const { data: updatedStudent, error: studentUpdateError } = await context.db
      .from('students')
      .update({
        admission_number: value.admissionNumber,
        enrollment_date: value.enrollmentDate,
        status: value.status,
      })
      .eq('id', value.studentId)
      .eq('school_id', context.schoolId)
      .select('id')
      .maybeSingle();
    if (studentUpdateError || !updatedStudent) {
      const { error: rollbackError } = await context.db
        .from('profiles')
        .update({ full_name: previousProfile.full_name })
        .eq('id', value.studentId)
        .eq('school_id', context.schoolId);
      throw new Error(
        `Could not update student record: ${studentUpdateError?.message ?? 'Student record was not found in your school.'}${rollbackError ? `. Profile rollback failed: ${rollbackError.message}` : ''}`
      );
    }

    const enrollmentValues = {
      class_id: value.classId,
      academic_year_id: value.academicYearId,
      term_id: value.termId,
      stream_id: value.streamId,
      enrollment_date: value.enrollmentDate,
      status: value.status,
    };
    let enrollmentError: string | null = null;
    let savedEnrollmentId = value.enrollmentId;
    try {
      const enrollmentResult = value.enrollmentId
        ? await context.db
            .from('student_enrollments')
            .update(enrollmentValues)
            .eq('id', value.enrollmentId)
            .eq('student_id', value.studentId)
            .select('id')
            .maybeSingle()
        : await context.db
            .from('student_enrollments')
            .insert({ ...enrollmentValues, student_id: value.studentId })
            .select('id')
            .single();
      enrollmentError = enrollmentResult.error?.message ?? null;
      if (enrollmentResult.data) {
        savedEnrollmentId = enrollmentResult.data.id;
      } else if (!enrollmentError) {
        enrollmentError = 'Enrollment was not found or saved.';
      }
    } catch (error) {
      enrollmentError = messageFrom(error);
    }

    if (enrollmentError) {
      const [profileRollback, studentRollback] = await Promise.all([
        context.db.from('profiles')
          .update({ full_name: previousProfile.full_name })
          .eq('id', value.studentId)
          .eq('school_id', context.schoolId),
        context.db.from('students')
          .update({
            admission_number: previousStudent.admission_number,
            enrollment_date: previousStudent.enrollment_date,
            status: previousStudent.status,
          })
          .eq('id', value.studentId)
          .eq('school_id', context.schoolId),
      ]);
      const rollbackErrors = [profileRollback.error, studentRollback.error]
        .filter((error) => error !== null)
        .map((error) => error.message);
      throw new Error(
        `Could not update student enrollment: ${enrollmentError}${rollbackErrors.length ? `. Rollback failed: ${rollbackErrors.join('; ')}` : ''}`
      );
    }

    revalidatePath(studentsPath);
    revalidatePath(classesPath);
    if (!savedEnrollmentId) throw new Error('No enrollment was returned after the update.');
    return { id: value.studentId, enrollmentId: savedEnrollmentId };
  });
}
