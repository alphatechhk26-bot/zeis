'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminSchoolContext } from '@/lib/admin-school-context';

const financePath = '/dashboard/admin/finance';
const idSchema = z.object({ id: z.string().uuid() }).strict();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid date.');

const feeFieldsSchema = z.object({
  feeName: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).nullable(),
  amount: z.number().positive().max(1_000_000_000).multipleOf(0.01),
  academicYearId: z.string().uuid(),
  classId: z.string().uuid().nullable(),
  termId: z.string().uuid().nullable(),
  dueDate: dateSchema.nullable(),
  isMandatory: z.boolean(),
}).strict();
const createFeeSchema = feeFieldsSchema;
const updateFeeSchema = feeFieldsSchema.extend({ id: z.string().uuid() }).strict();

const invoiceSchema = z.object({
  classId: z.string().uuid(),
  studentId: z.string().uuid().nullable(),
  academicYearId: z.string().uuid(),
  termId: z.string().uuid().nullable(),
  feeStructureIds: z.array(z.string().uuid()).min(1).max(100),
  issueDate: dateSchema,
  dueDate: dateSchema,
}).strict().refine((value) => value.dueDate >= value.issueDate, {
  message: 'The due date must be on or after the issue date.',
  path: ['dueDate'],
});

const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000_000).multipleOf(0.01),
  paymentDate: dateSchema,
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque']),
  transactionId: z.string().trim().max(100).nullable(),
  reference: z.string().trim().max(100).nullable(),
  notes: z.string().trim().max(1000).nullable(),
}).strict();

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

async function validateFeeRelations(
  context: Awaited<ReturnType<typeof requireAdminSchoolContext>>,
  value: z.infer<typeof feeFieldsSchema>
) {
  const [yearResult, classResult] = await Promise.all([
    context.db
      .from('academic_years')
      .select('id, start_date, end_date')
      .eq('id', value.academicYearId)
      .eq('school_id', context.schoolId)
      .maybeSingle(),
    value.classId
      ? context.db
          .from('classes')
          .select('id')
          .eq('id', value.classId)
          .eq('school_id', context.schoolId)
          .maybeSingle()
      : Promise.resolve({ data: { id: null }, error: null }),
  ]);
  if (yearResult.error) throw new Error(`Could not verify the academic year: ${yearResult.error.message}`);
  if (classResult.error) throw new Error(`Could not verify the class: ${classResult.error.message}`);
  if (!yearResult.data) throw new Error('The selected academic year does not belong to your school.');
  if (value.classId && !classResult.data) throw new Error('The selected class does not belong to your school.');
  if (value.dueDate && (value.dueDate < yearResult.data.start_date || value.dueDate > yearResult.data.end_date)) {
    throw new Error('The due date must fall within the selected academic year.');
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
    if (value.dueDate && (value.dueDate < term.start_date || value.dueDate > term.end_date)) {
      throw new Error('The due date must fall within the selected term.');
    }
  }
}

async function ensureFeeAvailable(
  context: Awaited<ReturnType<typeof requireAdminSchoolContext>>,
  value: z.infer<typeof feeFieldsSchema>,
  excludeId?: string
) {
  let query = context.db
    .from('fee_structures')
    .select('id')
    .eq('school_id', context.schoolId)
    .eq('academic_year_id', value.academicYearId)
    .eq('fee_name', value.feeName);
  query = value.classId ? query.eq('class_id', value.classId) : query.is('class_id', null);
  query = value.termId ? query.eq('term_id', value.termId) : query.is('term_id', null);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(`Could not check for duplicate fee structures: ${error.message}`);
  if (data) throw new Error('A fee with this name is already configured for that class, year and term.');
}

export async function createSchoolFeeStructure(input: z.infer<typeof createFeeSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const value = createFeeSchema.parse(input);
    await validateFeeRelations(context, value);
    await ensureFeeAvailable(context, value);
    const { data, error } = await context.db
      .from('fee_structures')
      .insert({
        school_id: context.schoolId,
        fee_name: value.feeName,
        description: value.description,
        amount: value.amount,
        academic_year_id: value.academicYearId,
        class_id: value.classId,
        term_id: value.termId,
        due_date: value.dueDate,
        is_mandatory: value.isMandatory,
      })
      .select('id, school_id, fee_name, description, amount, academic_year_id, class_id, term_id, due_date, is_mandatory, created_at, updated_at')
      .single();
    if (error) throw new Error(`Could not create fee structure: ${error.message}`);
    revalidatePath(financePath);
    return data;
  });
}

export async function updateSchoolFeeStructure(input: z.infer<typeof updateFeeSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const value = updateFeeSchema.parse(input);
    await validateFeeRelations(context, value);
    await ensureFeeAvailable(context, value, value.id);
    const { data, error } = await context.db
      .from('fee_structures')
      .update({
        fee_name: value.feeName,
        description: value.description,
        amount: value.amount,
        academic_year_id: value.academicYearId,
        class_id: value.classId,
        term_id: value.termId,
        due_date: value.dueDate,
        is_mandatory: value.isMandatory,
      })
      .eq('id', value.id)
      .eq('school_id', context.schoolId)
      .select('id, school_id, fee_name, description, amount, academic_year_id, class_id, term_id, due_date, is_mandatory, created_at, updated_at')
      .maybeSingle();
    if (error) throw new Error(`Could not update fee structure: ${error.message}`);
    if (!data) throw new Error('Fee structure not found in your school.');
    revalidatePath(financePath);
    return data;
  });
}

export async function deleteSchoolFeeStructure(input: z.infer<typeof idSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const { id } = idSchema.parse(input);
    const { data, error } = await context.db
      .from('fee_structures')
      .delete()
      .eq('id', id)
      .eq('school_id', context.schoolId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`Could not delete fee structure: ${error.message}`);
    if (!data) throw new Error('Fee structure not found in your school.');
    revalidatePath(financePath);
    return data;
  });
}

export async function generateSchoolInvoices(input: z.infer<typeof invoiceSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const value = invoiceSchema.parse(input);
    const { data: year, error: yearError } = await context.db
      .from('academic_years')
      .select('id, start_date, end_date')
      .eq('id', value.academicYearId)
      .eq('school_id', context.schoolId)
      .maybeSingle();
    if (yearError) throw new Error(`Could not verify the academic year: ${yearError.message}`);
    if (!year) throw new Error('The selected academic year does not belong to your school.');

    const { data: classroom, error: classError } = await context.db
      .from('classes')
      .select('id')
      .eq('id', value.classId)
      .eq('school_id', context.schoolId)
      .maybeSingle();
    if (classError) throw new Error(`Could not verify the class: ${classError.message}`);
    if (!classroom) throw new Error('The selected class does not belong to your school.');

    if (value.termId) {
      const { data: term, error } = await context.db
        .from('terms')
        .select('id, start_date, end_date')
        .eq('id', value.termId)
        .eq('academic_year_id', value.academicYearId)
        .maybeSingle();
      if (error) throw new Error(`Could not verify the selected term: ${error.message}`);
      if (!term) throw new Error('The selected term does not belong to the academic year.');
      if (value.issueDate < term.start_date || value.dueDate > term.end_date) {
        throw new Error('Invoice dates must fall within the selected term.');
      }
    } else if (value.issueDate < year.start_date || value.dueDate > year.end_date) {
      throw new Error('Invoice dates must fall within the selected academic year.');
    }

    let enrollmentsQuery = context.db
      .from('student_enrollments')
      .select('student_id')
      .eq('class_id', value.classId)
      .eq('academic_year_id', value.academicYearId)
      .eq('status', 'active');
    enrollmentsQuery = value.termId
      ? enrollmentsQuery.eq('term_id', value.termId)
      : enrollmentsQuery.is('term_id', null);
    if (value.studentId) enrollmentsQuery = enrollmentsQuery.eq('student_id', value.studentId);
    const { data: enrollmentRows, error: enrollmentError } = await enrollmentsQuery;
    if (enrollmentError) throw new Error(`Could not load active class enrollments: ${enrollmentError.message}`);
    const enrolledIds = [...new Set((enrollmentRows ?? []).map((row) => row.student_id))];
    if (value.studentId && !enrolledIds.includes(value.studentId)) {
      throw new Error('The selected student is not actively enrolled in this class and academic period.');
    }
    if (!enrolledIds.length) throw new Error('There are no active students to invoice for this selection.');

    const { data: students, error: studentError } = await context.db
      .from('students')
      .select('id')
      .in('id', enrolledIds)
      .eq('school_id', context.schoolId)
      .eq('status', 'active');
    if (studentError) throw new Error(`Could not verify enrolled students: ${studentError.message}`);
    const studentIds = (students ?? []).map((student) => student.id);
    if (!studentIds.length) throw new Error('No active students in this school match the selected class.');

    const { data: fees, error: feeError } = await context.db
      .from('fee_structures')
      .select('id, fee_name, amount, class_id, term_id')
      .eq('school_id', context.schoolId)
      .eq('academic_year_id', value.academicYearId)
      .in('id', value.feeStructureIds)
      .or(`class_id.is.null,class_id.eq.${value.classId}`)
      .order('fee_name');
    if (feeError) throw new Error(`Could not load fee structures: ${feeError.message}`);
    const applicableFees = (fees ?? []).filter((fee) => !fee.term_id || fee.term_id === value.termId);
    const requestedIds = new Set(value.feeStructureIds);
    if (applicableFees.length !== requestedIds.size) {
      throw new Error('One or more selected fees are unavailable or do not apply to this class and term.');
    }
    const totalAmount = Math.round(applicableFees.reduce((total, fee) => total + fee.amount, 0) * 100) / 100;
    if (totalAmount <= 0) throw new Error('The selected fees must have a positive total amount.');

    let existingQuery = context.db
      .from('invoices')
      .select('id, student_id')
      .eq('school_id', context.schoolId)
      .eq('academic_year_id', value.academicYearId)
      .in('student_id', studentIds);
    existingQuery = value.termId
      ? existingQuery.eq('term_id', value.termId)
      : existingQuery.is('term_id', null);
    const { data: existingInvoices, error: existingError } = await existingQuery;
    if (existingError) throw new Error(`Could not check for duplicate invoices: ${existingError.message}`);
    if (existingInvoices?.length) {
      throw new Error(`${existingInvoices.length} selected student(s) already have an invoice for this academic period.`);
    }

    const invoices = studentIds.map((studentId) => {
      const key = `${context.schoolId}:${studentId}:${value.academicYearId}:${value.termId ?? 'no-term'}`;
      const invoiceToken = createHash('sha256').update(key).digest('hex').slice(0, 32);
      return {
        school_id: context.schoolId,
        student_id: studentId,
        academic_year_id: value.academicYearId,
        term_id: value.termId,
        invoice_number: `INV-${invoiceToken}`,
        issue_date: value.issueDate,
        due_date: value.dueDate,
        total_amount: totalAmount,
        amount_paid: 0,
        status: 'unpaid' as const,
        notes: `Fee structures: ${applicableFees.map((fee) => fee.fee_name).join(', ')}`,
      };
    });

    const { data, error } = await context.db
      .from('invoices')
      .insert(invoices)
      .select('id, school_id, student_id, academic_year_id, term_id, invoice_number, issue_date, due_date, total_amount, amount_paid, status, notes');
    if (error?.code === '23505') {
      throw new Error('An invoice already exists for one or more selected students and academic periods.');
    }
    if (error) throw new Error(`Could not generate invoices: ${error.message}`);
    if (!data || data.length !== invoices.length) throw new Error('Invoice generation did not return all created records.');
    revalidatePath(financePath);
    return data;
  });
}

export async function recordSchoolPayment(input: z.infer<typeof paymentSchema>) {
  return run(async () => {
    const context = await requireAdminSchoolContext();
    const value = paymentSchema.parse(input);
    const { data: invoice, error: invoiceError } = await context.db
      .from('invoices')
      .select('id, student_id, school_id, total_amount, amount_paid, status')
      .eq('id', value.invoiceId)
      .eq('school_id', context.schoolId)
      .maybeSingle();
    if (invoiceError) throw new Error(`Could not load invoice: ${invoiceError.message}`);
    if (!invoice) throw new Error('Invoice not found in your school.');
    if (invoice.status === 'cancelled') throw new Error('Payments cannot be recorded against a cancelled invoice.');
    const amountPaid = invoice.amount_paid ?? 0;
    if (value.amount > invoice.total_amount - amountPaid + 0.000001) {
      throw new Error('Payment exceeds the outstanding invoice balance.');
    }

    const { data: payment, error } = await context.db
      .from('payments')
      .insert({
        school_id: context.schoolId,
        student_id: invoice.student_id,
        invoice_id: invoice.id,
        amount: value.amount,
        payment_date: `${value.paymentDate}T12:00:00.000Z`,
        payment_method: value.paymentMethod,
        transaction_id: value.transactionId,
        reference: value.reference,
        notes: value.notes,
      })
      .select('id, school_id, student_id, invoice_id, amount, payment_date, payment_method, transaction_id, reference, notes')
      .single();
    if (error) {
      if (error.code === 'P0001') throw new Error(error.message);
      throw new Error(`Could not record payment: ${error.message}`);
    }
    const { data: updatedInvoice, error: updatedInvoiceError } = await context.db
      .from('invoices')
      .select('id, total_amount, amount_paid, status')
      .eq('id', invoice.id)
      .eq('school_id', context.schoolId)
      .single();
    if (updatedInvoiceError) throw new Error(`Payment was recorded, but the invoice balance could not be refreshed: ${updatedInvoiceError.message}`);
    revalidatePath(financePath);
    return { payment, invoice: updatedInvoice };
  });
}
