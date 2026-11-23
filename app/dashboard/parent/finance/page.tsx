import { Banknote, FileText, Wallet } from 'lucide-react';
import {
  ParentEmptyState,
  ParentErrorState,
  ParentPageHeader,
  ParentPanel,
  ParentStatCard,
  renderParentPageSafely,
} from '@/components/dashboard/parent-ui';
import {
  formatParentCurrency,
  formatParentDate,
  loadParentChildren,
  requireParentContext,
} from '@/lib/parent-dashboard';

export default async function ParentFinancePage() {
  const context = await requireParentContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <ParentPageHeader title="Finance" description="Review invoices and payments for your linked children." />
        <ParentErrorState />
      </div>
    );
  }

  return renderParentPageSafely('finance', async () => {
    if (!context.schoolId) {
      return (
        <div className="space-y-6">
          <ParentPageHeader title="Finance" description="Review invoices and payments for your linked children." />
          <ParentEmptyState title="School assignment required" description="Your parent profile is not assigned to a school." />
        </div>
      );
    }

    const children = await loadParentChildren(context);
    if (!children.length) {
      return (
        <div className="space-y-6">
          <ParentPageHeader title="Finance" description="Review invoices and payments for your linked children." />
          <ParentEmptyState title="No linked children found" description="Financial records are available only for children linked to your account." />
        </div>
      );
    }

    const childIds = children.map((child) => child.id);
    const [invoiceResult, paymentResult] = await Promise.all([
      context.supabase
        .from('invoices')
        .select('id, student_id, invoice_number, issue_date, due_date, total_amount, status')
        .in('student_id', childIds)
        .order('issue_date', { ascending: false })
        .limit(500),
      context.supabase
        .from('payments')
        .select('id, invoice_id, student_id, amount, payment_date, payment_method')
        .in('student_id', childIds)
        .order('payment_date', { ascending: false })
        .limit(500),
    ]);
    if (invoiceResult.error) throw invoiceResult.error;
    if (paymentResult.error) throw paymentResult.error;

    const invoices = invoiceResult.data ?? [];
    const payments = paymentResult.data ?? [];
    const paidByInvoice = new Map<string, number>();
    for (const payment of payments) {
      if (!payment.invoice_id) continue;
      paidByInvoice.set(payment.invoice_id, (paidByInvoice.get(payment.invoice_id) ?? 0) + payment.amount);
    }
    const validInvoices = invoices.filter((invoice) => invoice.status !== 'cancelled' && invoice.status !== 'draft');
    const billed = validInvoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
    const outstanding = validInvoices.reduce(
      (sum, invoice) => sum + Math.max(invoice.total_amount - (paidByInvoice.get(invoice.id) ?? 0), 0),
      0,
    );
    const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const childById = new Map(children.map((child) => [child.id, child.full_name]));

    return (
      <div className="space-y-6">
        <ParentPageHeader title="Finance" description="Financial records are limited to verified linked children and their authorized school." />
        <section aria-label="Finance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ParentStatCard label="Invoiced" value={formatParentCurrency(billed)} detail={`${validInvoices.length} loaded invoices`} icon={FileText} />
          <ParentStatCard label="Outstanding" value={formatParentCurrency(outstanding)} detail="Calculated from recorded payments linked to invoices" icon={Wallet} />
          <ParentStatCard label="Payments" value={formatParentCurrency(paid)} detail={`${payments.length} loaded payment records`} icon={Banknote} />
        </section>
        <ParentPanel title="Invoices" description="Most recent invoices for your linked children.">
          {!invoices.length ? (
            <ParentEmptyState title="No invoices found" description="No invoices are available for your linked children." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Child</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Invoice</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Issued</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Due</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Amount</th>
                    <th scope="col" className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="py-3 pr-4 text-gray-200">{childById.get(invoice.student_id) ?? 'Child unavailable'}</td>
                      <td className="py-3 pr-4 font-medium text-gray-100">{invoice.invoice_number}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatParentDate(invoice.issue_date)}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatParentDate(invoice.due_date)}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatParentCurrency(invoice.total_amount)}</td>
                      <td className="py-3 capitalize text-gray-300">{invoice.status ?? 'Unavailable'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ParentPanel>
        <ParentPanel title="Payment history" description="Recorded payments for your linked children.">
          {!payments.length ? (
            <ParentEmptyState title="No payments found" description="Payments will appear here after they are recorded by your school." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Child</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Date</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Method</th>
                    <th scope="col" className="pb-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="py-3 pr-4 text-gray-200">{childById.get(payment.student_id) ?? 'Child unavailable'}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatParentDate(payment.payment_date)}</td>
                      <td className="py-3 pr-4 capitalize text-gray-300">{payment.payment_method.replaceAll('_', ' ')}</td>
                      <td className="py-3 text-gray-100">{formatParentCurrency(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ParentPanel>
      </div>
    );
  });
}
