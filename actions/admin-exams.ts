'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminSchoolContext } from '@/lib/admin-school-context';

const examsPath = '/dashboard/admin/exams';
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid date.');

const examFieldsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  academicYearId: z.string().uuid(),
  termId: z.string().uuid().nullable(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  examDate: dateSchema,
  maxMarks: z.number().positive().max(100000),
  examType: z.enum(['quiz', 'midterm', 'final', 'assignment', 'practical']),
  isActive: z.boolean(),
}).strict();
const createExamSchema = examFieldsSchema;
const updateExamSchema = examFieldsSchema.extend({ id: z.string().uuid() }).strict();
const idSchema = z.object({ id: z.string().uuid() }).strict();

function actionError(error: unknown) {
  return error instanceof z.ZodError
    ? error.issues[0]?.message ?? 'Invalid input.'
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.';
}

async function run<T>(operation: () => Promise<T>) {
  try {
    return { success: true as const, data: await operation() };
  } catch (error) {
    return { success: false as const, error: actionError(error) };
  }
}

async function validateExamRelations(
  context: Awaited<ReturnType<typeof requireAdminSchoolContext>>,
  value: z.infer<typeof examFieldsSchema>
) {
  const [yearResult, classResult, subjectResult] = await Promise.all([
    context.db
      .from('academic_years')
      .select('id, start_date, end_date')
      .eq('id', value.academicYearId)
      .eq('school_id', context.schoolId)
      .maybeSingle(),
    context.db
      .from('classes')
      .select('id')
      .eq('id', value.classId)
      .eq('school_id', context.schoolId)
      .maybeSingle(),
    context.db
      .from('subjects')
      .select('id')
      .eq('id', value.subjectId)
      .eq('school_id', context.schoolId)
      .maybeSingle(),
  ]);
  if (yearResult.error) throw new Error(`Could not verify the academic year: ${yearResult.error.message}`);
  if (classResult.error) throw new Error(`Could not verify the class: ${classResult.error.message}`);
  if (subjectResult.error) throw new Error(`Could not verify the subject: ${subjectResult.error.message}`);
  if (!yearResult.data) throw new Error('The selected academic year does not belong to your school.');
  if (!classResult.data) throw new Error('The selected class does not belong to your school.');
  if (!subjectResult.data) throw new Error('The selected subject does not belong to your school.');
  if (value.examDate < yearResult.data.start_date || value.examDate > yearResult.data.end_date) {
    throw new Error('The exam date must fall within the selected academic year.');
  }

  if (value.termId) {
    const { data: term, error } = await context.db
      .from('terms')
      .select('id, start_date, end_date')
      .eq('id', value.termId)
      .eq('academic_year_id', value.academicYearId)
      .maybeSingle();
    if (error) throw new Error(`Could not verify the selected term: ${error.message}`);
    if (!term) throw new Error('The selected term does not belong to the academic year.');
    if (value.examDate < term.start_date || value.examDate > term.end_date) {
      throw new Error('The exam date must fall within the selected term.');
    }
  }

  const { data: classSubject, error: classSubjectError } = await context.db
    .from('class_subjects')
    .select('id')
    .eq('class_id', value.classId)
    .eq('subject_id', value.subjectId)
    .eq('academic_year_id', value.academicYearId)
    .eq('is_active', true)
    .maybeSingle();
  if (classSubjectError) throw new Error(`Could not verify the class subject: ${classSubjectError.message}`);
  if (!classSubject) throw new Error('The subject is not assigned to this class for the selected academic year.');
}

async function ensureExamAvailable(
  context: Awaited<ReturnType<typeof requireAdminSchoolContext>>,
  value: z.infer<typeof examFieldsSchema>,
  excludeId?: string
) {
  let query = context.db
    .from('exams')
    .select('id')
    .eq('school_id', context.schoolId)
    .eq('name', value.name)
    .eq('academic_year_id', value.academicYearId)
    .eq('class_id', value.classId)
    .eq('subject_id', value.subjectId)
    .eq('exam_date', value.examDate)
    .limit(1);
  query = value.termId ? query.eq('term_id', value.termId) : query.is('term_id', null);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not check for duplicate exams: ${error.message}`);
  if (data) throw new Error('An exam with these details is already scheduled.');
}

export async function createSchoolExam(input: z.infer<typeof createExamSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const value = createExamSchema.parse(input);
    await validateExamRelations(context, value);
    await ensureExamAvailable(context, value);

    const { data, error } = await context.db
      .from('exams')
      .insert({
        school_id: context.schoolId,
        name: value.name,
        academic_year_id: value.academicYearId,
        term_id: value.termId,
        class_id: value.classId,
        subject_id: value.subjectId,
        exam_date: value.examDate,
        max_marks: value.maxMarks,
        exam_type: value.examType,
        is_active: value.isActive,
      })
      .select('id, school_id, name, academic_year_id, term_id, class_id, subject_id, exam_date, max_marks, exam_type, is_active')
      .single();
    if (error) throw new Error(`Could not schedule exam: ${error.message}`);
    revalidatePath(examsPath);
    return data;
  });
}

export async function updateSchoolExam(input: z.infer<typeof updateExamSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const value = updateExamSchema.parse(input);
    const { data: existing, error: readError } = await context.db
      .from('exams')
      .select('id, class_id, subject_id, academic_year_id, term_id')
      .eq('id', value.id)
      .eq('school_id', context.schoolId)
      .maybeSingle();
    if (readError) throw new Error(`Could not load exam: ${readError.message}`);
    if (!existing) throw new Error('Exam not found in your school.');

    const { count, error: resultsError } = await context.db
      .from('results')
      .select('id', { count: 'exact', head: true })
      .eq('exam_id', value.id)
      .eq('school_id', context.schoolId);
    if (resultsError) throw new Error(`Could not check submitted results: ${resultsError.message}`);
    if (
      (count ?? 0) > 0 &&
      (existing.class_id !== value.classId ||
        existing.subject_id !== value.subjectId ||
        existing.academic_year_id !== value.academicYearId ||
        existing.term_id !== value.termId)
    ) {
      throw new Error('Class, subject, year, or term cannot be changed after results have been submitted.');
    }

    await validateExamRelations(context, value);
    await ensureExamAvailable(context, value, value.id);
    const { data, error } = await context.db
      .from('exams')
      .update({
        name: value.name,
        academic_year_id: value.academicYearId,
        term_id: value.termId,
        class_id: value.classId,
        subject_id: value.subjectId,
        exam_date: value.examDate,
        max_marks: value.maxMarks,
        exam_type: value.examType,
        is_active: value.isActive,
      })
      .eq('id', value.id)
      .eq('school_id', context.schoolId)
      .select('id, school_id, name, academic_year_id, term_id, class_id, subject_id, exam_date, max_marks, exam_type, is_active')
      .maybeSingle();
    if (error) throw new Error(`Could not update exam: ${error.message}`);
    if (!data) throw new Error('Exam not found in your school.');
    revalidatePath(examsPath);
    return data;
  });
}

export async function deleteSchoolExam(input: z.infer<typeof idSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const { id } = idSchema.parse(input);
    const { count, error: resultsError } = await context.db
      .from('results')
      .select('id', { count: 'exact', head: true })
      .eq('exam_id', id)
      .eq('school_id', context.schoolId);
    if (resultsError) throw new Error(`Could not check submitted results: ${resultsError.message}`);
    if ((count ?? 0) > 0) throw new Error('This exam has submitted results and cannot be deleted.');

    const { data, error } = await context.db
      .from('exams')
      .delete()
      .eq('id', id)
      .eq('school_id', context.schoolId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`Could not delete exam: ${error.message}`);
    if (!data) throw new Error('Exam not found in your school.');
    revalidatePath(examsPath);
    return data;
  });
}
