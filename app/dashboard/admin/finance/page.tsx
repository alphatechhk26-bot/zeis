import { Banknote, FileText, Wallet } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  formatAdminCurrency,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { FinanceManager } from '@/components/dashboard/finance-manager';
import { requireAdminContext } from '@/lib/admin-dashboard';

export default async function AdminFinancePage() {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Finance" description="Manage fee structures, invoices and payments for your school." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, schoolId } = context;

  return renderAdminPageSafely('finance', async () => {
    if (!schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Finance" description="Manage fee structures, invoices and payments for your school." />
          <AdminEmptyState title="School assignment required" description="Your administrator profile must be assigned to a school before managing finance records." />
        </div>
      );
    }

    const [invoicesResult, paymentsResult, feesResult, yearsResult, classesResult, studentsResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, school_id, invoice_number, student_id, academic_year_id, term_id, issue_date, due_date, total_amount, amount_paid, status, notes')
        .eq('school_id', schoolId)
        .order('issue_date', { ascending: false })
        .limit(500),
      supabase
        .from('payments')
        .select('id, school_id, invoice_id, student_id, amount, payment_date, payment_method, transaction_id, reference, notes')
        .eq('school_id', schoolId)
        .order('payment_date', { ascending: false })
        .limit(500),
      supabase
        .from('fee_structures')
        .select('id, school_id, fee_name, description, amount, academic_year_id, class_id, term_id, due_date, is_mandatory, created_at, updated_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('academic_years')
        .select('id, name, school_id, start_date, end_date')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false }),
      supabase
        .from('classes')
        .select('id, name, school_id')
        .eq('school_id', schoolId)
        .order('name'),
      supabase
        .from('students')
        .select('id, school_id, admission_number, status')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('admission_number')
        .limit(2000),
    ]);
    if (invoicesResult.error) throw invoicesResult.error;
    if (paymentsResult.error) throw paymentsResult.error;
    if (feesResult.error) throw feesResult.error;
    if (yearsResult.error) throw yearsResult.error;
    if (classesResult.error) throw classesResult.error;
    if (studentsResult.error) throw studentsResult.error;

    const years = yearsResult.data ?? [];
    const yearIds = years.map((year) => year.id);
    const { data: terms, error: termsError } = yearIds.length
      ? await supabase
          .from('terms')
          .select('id, academic_year_id, name, start_date, end_date')
          .in('academic_year_id', yearIds)
          .order('term_number')
      : { data: [], error: null };
    if (termsError) throw termsError;

    const classIds = (classesResult.data ?? []).map((row) => row.id);
    const { data: enrollmentRows, error: enrollmentError } = classIds.length && yearIds.length
      ? await supabase
          .from('student_enrollments')
          .select('student_id, class_id, academic_year_id, term_id')
          .in('class_id', classIds)
          .in('academic_year_id', yearIds)
          .eq('status', 'active')
      : { data: [], error: null };
    if (enrollmentError) throw enrollmentError;

    const activeStudentIds = new Set((studentsResult.data ?? []).map((student) => student.id));
    const enrollments = (enrollmentRows ?? []).filter((row) => activeStudentIds.has(row.student_id));

    const studentIds = [...new Set([
      ...(studentsResult.data ?? []).map((student) => student.id),
      ...(invoicesResult.data ?? []).map((invoice) => invoice.student_id),
      ...(paymentsResult.data ?? []).map((payment) => payment.student_id),
    ])];
    const { data: profiles, error: profilesError } = studentIds.length
      ? await supabase
          .from('profiles')
          .select('id, full_name, school_id')
          .in('id', studentIds)
          .eq('school_id', schoolId)
      : { data: [], error: null };
    if (profilesError) throw profilesError;
    const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
    const students = (studentsResult.data ?? []).map((student) => ({
      id: student.id,
      admission_number: student.admission_number ?? '—',
      full_name: nameById.get(student.id) ?? 'Student',
    }));

    const invoices = invoicesResult.data ?? [];
    const payments = paymentsResult.data ?? [];
    const fees = feesResult.data ?? [];
    const billed = invoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
    const outstanding = invoices.reduce((sum, invoice) => (
      invoice.status === 'cancelled'
        ? sum
        : sum + Math.max(invoice.total_amount - (invoice.amount_paid ?? 0), 0)
    ), 0);
    const recentPaymentsTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Finance" description="Manage fee structures, invoices and payment records within your authenticated school." />
        <section aria-label="Finance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AdminStatCard label="Billed" value={formatAdminCurrency(billed)} detail={`Loaded invoices: ${invoices.length}`} icon={FileText} />
          <AdminStatCard label="Outstanding" value={formatAdminCurrency(outstanding)} detail="Based on loaded non-cancelled invoices" icon={Wallet} />
          <AdminStatCard label="Payments received" value={formatAdminCurrency(recentPaymentsTotal)} detail={`Loaded payments: ${payments.length}`} icon={Banknote} />
        </section>
        <AdminPanel title="School finance" description="Fee structures, invoice generation and payment recording are limited to this school.">
          <FinanceManager
            initialInvoices={invoices.map((invoice) => ({
              ...invoice,
              student_name: nameById.get(invoice.student_id) ?? 'Student',
            }))}
            initialPayments={payments.map((payment) => ({
              ...payment,
              student_name: nameById.get(payment.student_id) ?? 'Student',
            }))}
            initialFees={fees}
            classes={(classesResult.data ?? []).map((row) => ({ id: row.id, label: row.name }))}
            academicYears={years.map((row) => ({
              id: row.id,
              label: row.name,
              start_date: row.start_date,
              end_date: row.end_date,
            }))}
            terms={(terms ?? []).map((row) => ({
              id: row.id,
              label: row.name,
              academic_year_id: row.academic_year_id,
              start_date: row.start_date,
              end_date: row.end_date,
            }))}
            students={students}
            enrollments={enrollments}
          />
        </AdminPanel>
      </div>
    );
  });
}
