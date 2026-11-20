import { Banknote } from 'lucide-react';
import {
  formatStudentCurrency,
  formatStudentDate,
  requireStudentContext,
} from '@/lib/student-dashboard';
import {
  StudentEmptyState,
  StudentPageHeader,
  StudentPanel,
  StudentStatCard,
} from '@/components/dashboard/student-ui';

export default async function StudentFinancePage() {
  const { supabase, studentId } = await requireStudentContext();
  const [{ data: invoices, error: invoiceError }, { data: payments, error: paymentError }] =
    await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, issue_date, due_date, total_amount, amount_paid, status')
        .eq('student_id', studentId)
        .order('issue_date', { ascending: false }),
      supabase
        .from('payments')
        .select('id, invoice_id, amount, payment_date, payment_method, reference')
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false }),
    ]);

  if (invoiceError) throw new Error(`Unable to load your invoices: ${invoiceError.message}`);
  if (paymentError) throw new Error(`Unable to load your payment history: ${paymentError.message}`);

  const invoiceRows = invoices ?? [];
  const outstanding = invoiceRows.reduce((sum, invoice) => {
    if (invoice.status === 'cancelled' || invoice.status === 'draft') return sum;
    return sum + Math.max((invoice.total_amount ?? 0) - (invoice.amount_paid ?? 0), 0);
  }, 0);
  const totalInvoiced = invoiceRows.reduce((sum, invoice) => {
    if (invoice.status === 'cancelled' || invoice.status === 'draft') return sum;
    return sum + invoice.total_amount;
  }, 0);
  const totalPaid = invoiceRows.reduce((sum, invoice) => {
    if (invoice.status === 'cancelled' || invoice.status === 'draft') return sum;
    return sum + (invoice.amount_paid ?? 0);
  }, 0);

  return (
    <div className="space-y-6">
      <StudentPageHeader title="Finance" description="Review your invoices, fee balance, and payment history." />
      <section aria-label="Finance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StudentStatCard label="Outstanding" value={formatStudentCurrency(outstanding)} detail="Balance on issued invoices" icon={Banknote} />
        <StudentStatCard label="Total invoiced" value={formatStudentCurrency(totalInvoiced)} detail="Excludes drafts and cancelled invoices" icon={Banknote} />
        <StudentStatCard label="Total paid" value={formatStudentCurrency(totalPaid)} detail={`${payments?.length ?? 0} recorded payments`} icon={Banknote} />
      </section>

      <StudentPanel title="Invoices" description="Invoices and current payment statuses associated with your account.">
        {!invoiceRows.length ? (
          <StudentEmptyState
            title="No invoices available"
            description="Your school has not issued any invoices for your account."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="pb-3 pr-4 font-medium">Invoice</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Issued</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Due</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Amount</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Paid</th>
                  <th scope="col" className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {invoiceRows.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="py-3 pr-4 font-medium text-gray-100">{invoice.invoice_number}</td>
                    <td className="py-3 pr-4 text-gray-300">{formatStudentDate(invoice.issue_date)}</td>
                    <td className="py-3 pr-4 text-gray-300">{formatStudentDate(invoice.due_date)}</td>
                    <td className="py-3 pr-4 text-gray-300">{formatStudentCurrency(invoice.total_amount)}</td>
                    <td className="py-3 pr-4 text-gray-300">{formatStudentCurrency(invoice.amount_paid ?? 0)}</td>
                    <td className="py-3 capitalize text-gray-300">{invoice.status ?? 'unavailable'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </StudentPanel>

      <StudentPanel title="Payment history" description="Payments recorded against your student account.">
        {!payments?.length ? (
          <StudentEmptyState
            title="No payments recorded"
            description="Payments will appear here after they are recorded by your school."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="pb-3 pr-4 font-medium">Date</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Method</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Reference</th>
                  <th scope="col" className="pb-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="py-3 pr-4 text-gray-300">{formatStudentDate(payment.payment_date)}</td>
                    <td className="py-3 pr-4 capitalize text-gray-300">{payment.payment_method.replaceAll('_', ' ')}</td>
                    <td className="py-3 pr-4 text-gray-400">{payment.reference ?? '—'}</td>
                    <td className="py-3 text-gray-100">{formatStudentCurrency(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </StudentPanel>
    </div>
  );
}
