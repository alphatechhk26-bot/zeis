import { Banknote, FileText, Wallet } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  formatAdminCurrency,
  formatAdminDate,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { requireAdminContext } from '@/lib/admin-dashboard';

export default async function AdminFinancePage() {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Finance" description="Review invoices, payments, and configured fee structures." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, role, schoolId } = context;

  return renderAdminPageSafely('finance', async () => {
    if (role === 'admin' && !schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Finance" description="Review invoices, payments, and configured fee structures." />
          <AdminEmptyState title="School assignment required" description="Your admin profile is not assigned to a school, so finance records cannot be loaded." />
        </div>
      );
    }

    let invoicesQuery = supabase
      .from('invoices')
      .select('id, invoice_number, student_id, total_amount, amount_paid, status, issue_date, due_date, school_id')
      .order('issue_date', { ascending: false })
      .limit(500);
    let paymentsQuery = supabase
      .from('payments')
      .select('id, invoice_id, student_id, amount, payment_date, payment_method, reference, school_id')
      .order('payment_date', { ascending: false })
      .limit(500);
    let feesQuery = supabase
      .from('fee_structures')
      .select('id, fee_name, amount, due_date, is_mandatory, school_id')
      .order('created_at', { ascending: false })
      .limit(500);

    if (role === 'admin' && schoolId) {
      invoicesQuery = invoicesQuery.eq('school_id', schoolId);
      paymentsQuery = paymentsQuery.eq('school_id', schoolId);
      feesQuery = feesQuery.eq('school_id', schoolId);
    }

    const [invoiceResult, paymentResult, feeResult] = await Promise.all([
      invoicesQuery,
      paymentsQuery,
      feesQuery,
    ]);
    if (invoiceResult.error) throw invoiceResult.error;
    if (paymentResult.error) throw paymentResult.error;
    if (feeResult.error) throw feeResult.error;

    const invoices = invoiceResult.data ?? [];
    const payments = paymentResult.data ?? [];
    const fees = feeResult.data ?? [];
    const billed = invoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
    const outstanding = invoices.reduce((sum, invoice) => {
      if (invoice.status === 'cancelled') return sum;
      return sum + Math.max(invoice.total_amount - (invoice.amount_paid ?? 0), 0);
    }, 0);
    const recentPaymentsTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Finance" description="Review financial records scoped to your authorized school." />
        <section aria-label="Finance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AdminStatCard label="Billed" value={formatAdminCurrency(billed)} detail={`Loaded invoices: ${invoices.length}`} icon={FileText} />
          <AdminStatCard label="Outstanding" value={formatAdminCurrency(outstanding)} detail="Based on loaded non-cancelled invoices" icon={Wallet} />
          <AdminStatCard label="Recent payments" value={formatAdminCurrency(recentPaymentsTotal)} detail={`Loaded payments: ${payments.length}`} icon={Banknote} />
        </section>
        <AdminPanel title="Invoices" description="Most recent invoices (up to 500).">
          {!invoices.length ? (
            <AdminEmptyState title="No invoices found" description="Invoices will appear here when the database contains records for your scope." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Invoice</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Student ID</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Issued</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Due</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Amount</th>
                    <th scope="col" className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="py-3 pr-4 font-medium text-gray-100">{invoice.invoice_number}</td>
                      <td className="py-3 pr-4 text-gray-300">{invoice.student_id}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatAdminDate(invoice.issue_date)}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatAdminDate(invoice.due_date)}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatAdminCurrency(invoice.total_amount)}</td>
                      <td className="py-3"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs capitalize text-gray-200">{invoice.status ?? 'Unknown'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminPanel>
        <AdminPanel title="Payments and fee structures" description="Payments and fees currently configured in the database.">
          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-medium text-gray-200">Recent payments</h3>
              {!payments.length ? (
                <AdminEmptyState title="No payments found" description="Recorded payments will appear here." />
              ) : (
                <ul className="divide-y divide-gray-800">
                  {payments.slice(0, 10).map((payment) => (
                    <li key={payment.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                      <span className="text-gray-300">{formatAdminDate(payment.payment_date)} · {payment.payment_method}</span>
                      <span className="font-medium text-gray-100">{formatAdminCurrency(payment.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium text-gray-200">Fee structures</h3>
              {!fees.length ? (
                <AdminEmptyState title="No fee structures found" description="No fee structures are available in the generated database schema for this scope." />
              ) : (
                <ul className="divide-y divide-gray-800">
                  {fees.slice(0, 10).map((fee) => (
                    <li key={fee.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                      <span className="text-gray-300">{fee.fee_name}{fee.is_mandatory ? ' · Required' : ''}</span>
                      <span className="font-medium text-gray-100">{formatAdminCurrency(fee.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </AdminPanel>
      </div>
    );
  });
}
