// actions/finance.ts
'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ----------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------

const generateInvoiceSchema = z.object({
  class_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  term_id: z.string().uuid().optional(),
  // Optionally specify which fee structures to use; if not, use all mandatory for that class/academic year.
  fee_structure_ids: z.array(z.string().uuid()).optional(),
});

const paymentSchema = z.object({
  student_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: z.enum(['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque']),
  transaction_id: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  invoice_id: z.string().uuid().optional(), // if not provided, we'll apply to oldest unpaid invoice
});

const balanceQuerySchema = z.object({
  student_id: z.string().uuid(),
  academic_year_id: z.string().uuid().optional(),
});

// ----------------------------------------------------------------------
// 1. Generate invoices for all students in a class
// ----------------------------------------------------------------------

export async function generateInvoices(input: z.infer<typeof generateInvoiceSchema>) {
  const { class_id, academic_year_id, term_id, fee_structure_ids } =
    generateInvoiceSchema.parse(input);

  const supabase = await createClient();

  // 1. Get all active students enrolled in this class for the academic year
  let enrollmentQuery = supabase
    .from('student_enrollments')
    .select('student_id')
    .eq('class_id', class_id)
    .eq('academic_year_id', academic_year_id)
    .eq('status', 'active');

  if (term_id) {
    enrollmentQuery = enrollmentQuery.eq('term_id', term_id);
  }

  const { data: enrollments, error: enrollError } = await enrollmentQuery;
  if (enrollError) throw new Error(`Failed to fetch enrollments: ${enrollError.message}`);

  if (!enrollments || enrollments.length === 0) {
    return { success: true, message: 'No students found for this class/year.' };
  }

  // 2. Fetch fee structures
  let feeQuery = supabase
    .from('fee_structures')
    .select('*')
    .eq('academic_year_id', academic_year_id)
    .eq('is_mandatory', true);

  if (fee_structure_ids && fee_structure_ids.length > 0) {
    feeQuery = feeQuery.in('id', fee_structure_ids);
  } else {
    // If no specific fee structures, use those applicable to the class or school-wide
    feeQuery = feeQuery.or(`class_id.eq.${class_id},class_id.is.null`);
  }

  if (term_id) {
    feeQuery = feeQuery.or(`term_id.eq.${term_id},term_id.is.null`);
  }

  const { data: feeStructures, error: feeError } = await feeQuery;
  if (feeError) throw new Error(`Failed to fetch fee structures: ${feeError.message}`);

  if (!feeStructures || feeStructures.length === 0) {
    return { success: true, message: 'No fee structures found.' };
  }

  // 3. For each student, create an invoice (if not already existing for same structure/year/term)
  const invoices = [];
  for (const enrollment of enrollments) {
    const studentId = enrollment.student_id;

    // Check if invoice already exists for this student for these fee structures (optional)
    for (const fee of feeStructures) {
      // Check existing invoice for this fee structure (or we can combine into one invoice per student)
      // To avoid duplicates, we'll check if an invoice with same fee structure already exists.
      // We'll group by fee structure but we can also combine all fees into one invoice.
      // For simplicity, we'll create one invoice per student covering all fees.
      // So we need to compute total amount and generate one invoice.
      // We'll also check if an invoice already exists for this student and academic year (and term if provided)
      // that covers these fees. We'll skip if exists.

      // Build a check for existing invoice that has total amount equal to sum of fees?
      // Better: we can store a metadata field "fee_structure_ids" to avoid duplicates.
      // For this implementation, we'll skip duplicate generation by checking if an invoice already has the same total.
      // Simpler: we'll just create a new invoice each time; but we want to avoid duplicates.
      // We'll check if an invoice already exists for this student/academic year/term with total amount matching sum.
      // We'll sum the amounts of all fee structures.

      // Sum all fee amounts
      const totalAmount = feeStructures.reduce((sum, f) => sum + f.amount, 0);

      // Check if there's already an invoice with this total and same student/academic_year/term
      let existingQuery = supabase
        .from('invoices')
        .select('id')
        .eq('student_id', studentId)
        .eq('academic_year_id', academic_year_id)
        .eq('total_amount', totalAmount);

      if (term_id) {
        existingQuery = existingQuery.eq('term_id', term_id);
      } else {
        existingQuery = existingQuery.is('term_id', null);
      }

      const { data: existing, error: existError } = await existingQuery;
      if (existError) throw new Error(`Failed to check existing invoices: ${existError.message}`);

      if (existing && existing.length > 0) {
        // Already exists, skip
        continue;
      }

      // Generate invoice number: INV-YYYY-XXXXXX
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;

      // Get school_id from class
      const { data: classData } = await supabase
        .from('classes')
        .select('school_id')
        .eq('id', class_id)
        .single();
      if (!classData) throw new Error('Class not found.');

      // Insert invoice
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          school_id: classData.school_id,
          student_id: studentId,
          invoice_number: invoiceNumber,
          academic_year_id: academic_year_id,
          term_id: term_id || null,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          total_amount: totalAmount,
          amount_paid: 0,
          status: 'issued',
          notes: `Auto-generated from fee structures: ${feeStructures.map(f => f.fee_name).join(', ')}`,
        })
        .select()
        .single();

      if (invError) throw new Error(`Failed to create invoice: ${invError.message}`);
      invoices.push(invoice);
    }
  }

  revalidatePath('/finance/invoices');
  return { success: true, count: invoices.length };
}

// ----------------------------------------------------------------------
// 2. Record a payment
// ----------------------------------------------------------------------

export async function recordPayment(input: z.infer<typeof paymentSchema>) {
  const { student_id, amount, payment_method, transaction_id, reference, notes, invoice_id } =
    paymentSchema.parse(input);

  const supabase = await createClient();

  // Get the user's school_id from profile
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single();

  if (!profile) throw new Error('Profile not found.');
  const schoolId = profile.school_id;

  let targetInvoiceId = invoice_id;

  // If invoice_id not provided, find the oldest unpaid invoice for this student
  if (!targetInvoiceId) {
    const { data: invoices, error: invError } = await supabase
      .from('invoices')
      .select('id, total_amount, amount_paid')
      .eq('student_id', student_id)
      .neq('status', 'paid')
      .order('issue_date', { ascending: true })
      .limit(1);

    if (invError) throw new Error(`Failed to fetch invoices: ${invError.message}`);
    if (!invoices || invoices.length === 0) {
      throw new Error('No outstanding invoice found for this student.');
    }
    targetInvoiceId = invoices[0].id;
  }

  // Insert payment
  // Add a check above insert if schoolId isn't guaranteed non-null:
if (!schoolId) throw new Error('School ID is required.');

// Replace the insert block (lines 220-232) with:
const { data: payment, error: payError } = await supabase
  .from('payments')
  .insert({
    school_id: schoolId,
    student_id,
    invoice_id: targetInvoiceId,
    amount,
    payment_date: new Date().toISOString(),
    payment_method,
    transaction_id: transaction_id || null,
    reference: reference || null,
    notes: notes || null,
  } as any)
  .select()
  .single();


  if (payError) throw new Error(`Failed to record payment: ${payError.message}`);

  // The trigger on payments will update the invoice's amount_paid automatically.
  // But we can also manually update if trigger not set.
  // We'll rely on the trigger.

  revalidatePath('/finance/payments');
  revalidatePath(`/finance/student/${student_id}`);
  return { success: true, data: payment };
}

// ----------------------------------------------------------------------
// 3. Get balance (total due vs total paid) for a student
// ----------------------------------------------------------------------

export async function getBalance(input: z.infer<typeof balanceQuerySchema>) {
  const { student_id, academic_year_id } = balanceQuerySchema.parse(input);

  const supabase = await createClient();

  // Build invoice query
  let invoiceQuery = supabase
    .from('invoices')
    .select('total_amount, amount_paid, status')
    .eq('student_id', student_id)
    .neq('status', 'cancelled');

  if (academic_year_id) {
    invoiceQuery = invoiceQuery.eq('academic_year_id', academic_year_id);
  }

  const { data: invoices, error: invError } = await invoiceQuery;
  if (invError) throw new Error(`Failed to fetch invoices: ${invError.message}`);

  let totalDue = 0;
  let totalPaid = 0;
  let outstanding = 0;

 // Replace lines 274-278 with:
for (const inv of invoices || []) {
  const totalAmount = inv.total_amount ?? 0;
  const amountPaid = inv.amount_paid ?? 0;

  totalDue += totalAmount;
  totalPaid += amountPaid;
  outstanding += totalAmount - amountPaid;
}
  return {
    student_id,
    totalDue: parseFloat(totalDue.toFixed(2)),
    totalPaid: parseFloat(totalPaid.toFixed(2)),
    outstanding: parseFloat(outstanding.toFixed(2)),
    invoiceCount: invoices?.length || 0,
  };
}

// ----------------------------------------------------------------------
// 4. (Optional) Generate fee structure for a class
// ----------------------------------------------------------------------
// This could be another action to create fee structures, but we'll leave that to admin.