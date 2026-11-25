'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminSchoolContext } from '@/lib/admin-school-context';

const libraryPath = '/dashboard/admin/library';
const idSchema = z.object({ id: z.string().uuid() }).strict();
const bookFieldsSchema = z.object({
  title: z.string().trim().min(1).max(255),
  author: z.string().trim().max(100).nullable(),
  isbn: z.string().trim().max(20).nullable(),
  genre: z.string().trim().max(100).nullable(),
  location: z.string().trim().max(50).nullable(),
  publicationYear: z.number().int().min(1000).max(3000).nullable(),
  publisher: z.string().trim().max(255).nullable(),
  totalCopies: z.number().int().min(0).max(100000),
  isActive: z.boolean(),
}).strict();
const createBookSchema = bookFieldsSchema;
const updateBookSchema = bookFieldsSchema.extend({ id: z.string().uuid() }).strict();

const issueSchema = z.object({
  bookId: z.string().uuid(),
  studentId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(1000).nullable(),
}).strict().refine((value) => {
  const date = new Date(`${value.dueDate}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value.dueDate;
}, { message: 'Enter a valid due date.', path: ['dueDate'] });

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

async function ensureBookAvailable(
  context: Awaited<ReturnType<typeof requireAdminSchoolContext>>,
  value: z.infer<typeof bookFieldsSchema>,
  excludeId?: string
) {
  if (!value.isbn) return;
  let query = context.db
    .from('library_books')
    .select('id')
    .eq('school_id', context.schoolId)
    .eq('isbn', value.isbn)
    .limit(1);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not check the book code: ${error.message}`);
  if (data) throw new Error('A book with this ISBN/code already exists in your school.');
}

export async function createSchoolBook(input: z.infer<typeof createBookSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const value = createBookSchema.parse(input);
    await ensureBookAvailable(context, value);
    const { data, error } = await context.db
      .from('library_books')
      .insert({
        school_id: context.schoolId,
        title: value.title,
        author: value.author,
        isbn: value.isbn,
        genre: value.genre,
        location: value.location,
        publication_year: value.publicationYear,
        publisher: value.publisher,
        total_copies: value.totalCopies,
        available_copies: value.totalCopies,
        is_active: value.isActive,
      })
      .select('id, school_id, title, author, isbn, genre, location, publication_year, publisher, total_copies, available_copies, is_active')
      .single();
    if (error) throw new Error(`Could not add book: ${error.message}`);
    revalidatePath(libraryPath);
    return data;
  });
}

export async function updateSchoolBook(input: z.infer<typeof updateBookSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const value = updateBookSchema.parse(input);
    await ensureBookAvailable(context, value, value.id);
    const { data, error } = await context.db
      .from('library_books')
      .update({
        title: value.title,
        author: value.author,
        isbn: value.isbn,
        genre: value.genre,
        location: value.location,
        publication_year: value.publicationYear,
        publisher: value.publisher,
        total_copies: value.totalCopies,
        is_active: value.isActive,
      })
      .eq('id', value.id)
      .eq('school_id', context.schoolId)
      .select('id, school_id, title, author, isbn, genre, location, publication_year, publisher, total_copies, available_copies, is_active')
      .maybeSingle();
    if (error) {
      if (error.code === 'P0001') throw new Error(error.message);
      throw new Error(`Could not update book: ${error.message}`);
    }
    if (!data) throw new Error('Book not found in your school.');
    revalidatePath(libraryPath);
    return data;
  });
}

export async function deleteSchoolBook(input: z.infer<typeof idSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const { id } = idSchema.parse(input);
    const { count, error: dependencyError } = await context.db
      .from('borrow_records')
      .select('id', { count: 'exact', head: true })
      .eq('book_id', id)
      .eq('school_id', context.schoolId);
    if (dependencyError) throw new Error(`Could not check book loans: ${dependencyError.message}`);
    if ((count ?? 0) > 0) throw new Error('This book has borrowing history and cannot be deleted. Deactivate it instead.');
    const { data, error } = await context.db
      .from('library_books')
      .delete()
      .eq('id', id)
      .eq('school_id', context.schoolId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`Could not delete book: ${error.message}`);
    if (!data) throw new Error('Book not found in your school.');
    revalidatePath(libraryPath);
    return data;
  });
}

export async function issueSchoolBook(input: z.infer<typeof issueSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const value = issueSchema.parse(input);
    if (value.dueDate < new Date().toISOString().slice(0, 10)) {
      throw new Error('The due date cannot be before today.');
    }
    const [bookResult, studentResult] = await Promise.all([
      context.db
        .from('library_books')
        .select('id, available_copies, is_active')
        .eq('id', value.bookId)
        .eq('school_id', context.schoolId)
        .maybeSingle(),
      context.db
        .from('students')
        .select('id, status')
        .eq('id', value.studentId)
        .eq('school_id', context.schoolId)
        .maybeSingle(),
    ]);
    if (bookResult.error) throw new Error(`Could not verify the book: ${bookResult.error.message}`);
    if (studentResult.error) throw new Error(`Could not verify the student: ${studentResult.error.message}`);
    if (!bookResult.data) throw new Error('The selected book does not belong to your school.');
    if (!studentResult.data || studentResult.data.status !== 'active') {
      throw new Error('The selected student is not active in your school.');
    }
    if (!bookResult.data.is_active || bookResult.data.available_copies < 1) {
      throw new Error('No available copies of this book can be issued.');
    }

    const { data, error } = await context.db
      .from('borrow_records')
      .insert({
        book_id: value.bookId,
        student_id: value.studentId,
        school_id: context.schoolId,
        due_date: value.dueDate,
        notes: value.notes,
        status: 'borrowed',
      })
      .select('id, school_id, book_id, student_id, borrow_date, due_date, return_date, status, notes')
      .single();
    if (error) {
      if (error.code === 'P0001') throw new Error(error.message);
      throw new Error(`Could not issue book: ${error.message}`);
    }
    revalidatePath(libraryPath);
    return data;
  });
}

export async function returnSchoolBook(input: z.infer<typeof idSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const { id } = idSchema.parse(input);
    const { data, error } = await context.db
      .from('borrow_records')
      .update({
        status: 'returned',
        return_date: new Date().toISOString().slice(0, 10),
      })
      .eq('id', id)
      .eq('school_id', context.schoolId)
      .in('status', ['borrowed', 'overdue'])
      .select('id, school_id, book_id, student_id, borrow_date, due_date, return_date, status, notes')
      .maybeSingle();
    if (error) {
      if (error.code === 'P0001') throw new Error(error.message);
      throw new Error(`Could not return book: ${error.message}`);
    }
    if (!data) throw new Error('An active loan was not found in your school.');
    revalidatePath(libraryPath);
    return data;
  });
}
