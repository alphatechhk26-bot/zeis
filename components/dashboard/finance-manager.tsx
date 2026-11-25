'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSchoolFeeStructure,
  deleteSchoolFeeStructure,
  generateSchoolInvoices,
  recordSchoolPayment,
  updateSchoolFeeStructure,
} from '@/actions/admin-finance';
import { formatAdminCurrency } from '@/components/dashboard/admin-ui';

type FeeRow = {
  id: string;
  school_id: string;
  fee_name: string;
  description: string | null;
  amount: number;
  academic_year_id: string;
  class_id: string | null;
  term_id: string | null;
  due_date: string | null;
  is_mandatory: boolean | null;
  created_at: string;
  updated_at: string;
};
type InvoiceRow = {
  id: string;
  school_id: string;
  invoice_number: string;
  student_id: string;
  student_name: string;
  academic_year_id: string;
  term_id: string | null;
  issue_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number | null;
  status: string | null;
  notes: string | null;
};
type PaymentRow = {
  id: string;
  school_id: string;
  invoice_id: string | null;
  student_id: string;
  student_name: string;
  amount: number;
  payment_date: string;
  payment_method: 'cash' | 'bank_transfer' | 'card' | 'mobile_money' | 'cheque';
  transaction_id: string | null;
  reference: string | null;
  notes: string | null;
};
type Option = { id: string; label: string };
type DateOption = Option & { start_date: string; end_date: string };
type TermOption = DateOption & { academic_year_id: string };
type StudentOption = { id: string; admission_number: string; full_name: string };
type EnrollmentOption = {
  student_id: string;
  class_id: string;
  academic_year_id: string;
  term_id: string | null;
};
type FeeForm = {
  feeName: string;
  description: string;
  amount: string;
  academicYearId: string;
  classId: string;
  termId: string;
  dueDate: string;
  isMandatory: boolean;
};
type InvoiceForm = {
  classId: string;
  studentId: string;
  academicYearId: string;
  termId: string;
  feeStructureIds: string[];
  issueDate: string;
  dueDate: string;
};
type PaymentForm = {
  invoiceId: string;
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentRow['payment_method'];
  transactionId: string;
  reference: string;
  notes: string;
};
type DeletingFee = { id: string; name: string } | null;

const EMPTY_FEE: FeeForm = {
  feeName: '',
  description: '',
  amount: '',
  academicYearId: '',
  classId: '',
  termId: '',
  dueDate: '',
  isMandatory: true,
};
const inputClass = 'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30';
const buttonClass = 'rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-50';
const today = () => new Date().toISOString().slice(0, 10);

function invoiceStatus(invoice: InvoiceRow) {
  if (invoice.status === 'cancelled') return 'cancelled';
  const paid = invoice.amount_paid ?? 0;
  if (paid >= invoice.total_amount) return 'paid';
  return paid > 0 ? 'partial' : 'unpaid';
}

function outstanding(invoice: InvoiceRow) {
  return Math.max(invoice.total_amount - (invoice.amount_paid ?? 0), 0);
}

export function FinanceManager({
  initialInvoices,
  initialPayments,
  initialFees,
  classes,
  academicYears,
  terms,
  students,
  enrollments,
}: {
  initialInvoices: InvoiceRow[];
  initialPayments: PaymentRow[];
  initialFees: FeeRow[];
  classes: Option[];
  academicYears: DateOption[];
  terms: TermOption[];
  students: StudentOption[];
  enrollments: EnrollmentOption[];
}) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [payments, setPayments] = useState(initialPayments);
  const [fees, setFees] = useState(initialFees);
  const [feeEditor, setFeeEditor] = useState<FeeRow | null | undefined>(undefined);
  const [deletingFee, setDeletingFee] = useState<DeletingFee>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [feeForm, setFeeForm] = useState<FeeForm>(EMPTY_FEE);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>({
    classId: '',
    studentId: '',
    academicYearId: academicYears[0]?.id ?? '',
    termId: '',
    feeStructureIds: [],
    issueDate: today(),
    dueDate: '',
  });
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    invoiceId: '',
    amount: '',
    paymentDate: today(),
    paymentMethod: 'cash',
    transactionId: '',
    reference: '',
    notes: '',
  });
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const query = search.trim().toLowerCase();
  const filteredInvoices = useMemo(() => invoices.filter((invoice) =>
    `${invoice.invoice_number} ${invoice.student_name}`.toLowerCase().includes(query)
  ), [invoices, query]);
  const filteredFees = useMemo(() => fees.filter((fee) =>
    `${fee.fee_name} ${fee.description ?? ''}`.toLowerCase().includes(query)
  ), [fees, query]);
  const studentsById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const classLabel = (id: string | null) => id ? classes.find((row) => row.id === id)?.label ?? 'Class unavailable' : 'All classes';
  const yearLabel = (id: string) => academicYears.find((row) => row.id === id)?.label ?? 'Unknown year';
  const termLabel = (id: string | null) => id ? terms.find((row) => row.id === id)?.label ?? 'Term unavailable' : 'All terms';
  const feesForInvoice = fees.filter((fee) =>
    fee.academic_year_id === invoiceForm.academicYearId &&
    (!fee.class_id || fee.class_id === invoiceForm.classId) &&
    (invoiceForm.termId ? !fee.term_id || fee.term_id === invoiceForm.termId : !fee.term_id)
  );
  const studentsForInvoice = students.filter((student) =>
    enrollments.some((enrollment) =>
      enrollment.student_id === student.id &&
      enrollment.class_id === invoiceForm.classId &&
      enrollment.academic_year_id === invoiceForm.academicYearId &&
      enrollment.term_id === (invoiceForm.termId || null)
    )
  );
  const termsForFee = terms.filter((term) => term.academic_year_id === feeForm.academicYearId);
  const termsForInvoice = terms.filter((term) => term.academic_year_id === invoiceForm.academicYearId);
  const invoicesForPayment = invoices.filter((invoice) => invoice.status !== 'cancelled' && outstanding(invoice) > 0);
  const selectedPaymentInvoice = invoices.find((invoice) => invoice.id === paymentForm.invoiceId);

  const openNewFee = () => {
    setFeeEditor(null);
    setFeeForm({ ...EMPTY_FEE, academicYearId: academicYears[0]?.id ?? '' });
    setError(null);
    setNotice(null);
  };
  const openEditFee = (fee: FeeRow) => {
    setFeeEditor(fee);
    setFeeForm({
      feeName: fee.fee_name,
      description: fee.description ?? '',
      amount: String(fee.amount),
      academicYearId: fee.academic_year_id,
      classId: fee.class_id ?? '',
      termId: fee.term_id ?? '',
      dueDate: fee.due_date ?? '',
      isMandatory: fee.is_mandatory ?? true,
    });
    setError(null);
    setNotice(null);
  };

  const submitFee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const values = {
        feeName: feeForm.feeName,
        description: feeForm.description || null,
        amount: Number(feeForm.amount),
        academicYearId: feeForm.academicYearId,
        classId: feeForm.classId || null,
        termId: feeForm.termId || null,
        dueDate: feeForm.dueDate || null,
        isMandatory: feeForm.isMandatory,
      };
      const result = feeEditor
        ? await updateSchoolFeeStructure({ ...values, id: feeEditor.id })
        : await createSchoolFeeStructure(values);
      if (!result.success) throw new Error(result.error);
      setFees((current) => feeEditor
        ? current.map((fee) => fee.id === result.data.id ? result.data : fee)
        : [result.data, ...current]);
      setFeeEditor(undefined);
      setNotice(feeEditor ? 'Fee structure updated.' : 'Fee structure created.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this fee structure.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteFee = async () => {
    if (!deletingFee) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteSchoolFeeStructure({ id: deletingFee.id });
      if (!result.success) throw new Error(result.error);
      setFees((current) => current.filter((fee) => fee.id !== deletingFee.id));
      setNotice('Fee structure deleted.');
      setDeletingFee(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this fee structure.');
    } finally {
      setBusy(false);
    }
  };

  const openInvoiceForm = () => {
    const academicYearId = academicYears[0]?.id ?? '';
    const classId = classes[0]?.id ?? '';
    const feeStructureIds = fees
      .filter((fee) =>
        fee.academic_year_id === academicYearId &&
        fee.is_mandatory &&
        (!fee.class_id || fee.class_id === classId) &&
        !fee.term_id
      )
      .map((fee) => fee.id);
    setInvoiceForm({
      classId,
      studentId: '',
      academicYearId,
      termId: '',
      feeStructureIds,
      issueDate: today(),
      dueDate: '',
    });
    setError(null);
    setNotice(null);
    setInvoiceOpen(true);
  };

  const defaultFeeIds = (academicYearId: string, classId: string, termId: string) => fees
    .filter((fee) =>
      fee.academic_year_id === academicYearId &&
      fee.is_mandatory &&
      (!fee.class_id || fee.class_id === classId) &&
      (termId ? !fee.term_id || fee.term_id === termId : !fee.term_id)
    )
    .map((fee) => fee.id);

  const submitInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await generateSchoolInvoices({
        classId: invoiceForm.classId,
        studentId: invoiceForm.studentId || null,
        academicYearId: invoiceForm.academicYearId,
        termId: invoiceForm.termId || null,
        feeStructureIds: invoiceForm.feeStructureIds,
        issueDate: invoiceForm.issueDate,
        dueDate: invoiceForm.dueDate,
      });
      if (!result.success) throw new Error(result.error);
      const newInvoices: InvoiceRow[] = result.data.map((invoice) => ({
        ...invoice,
        student_name: studentsById.get(invoice.student_id)?.full_name ?? 'Student',
      }));
      setInvoices((current) => [...newInvoices, ...current]);
      setInvoiceOpen(false);
      setNotice(`Generated ${newInvoices.length} invoice${newInvoices.length === 1 ? '' : 's'}.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not generate invoices.');
    } finally {
      setBusy(false);
    }
  };

  const openPaymentForm = () => {
    const invoice = invoicesForPayment[0];
    setPaymentForm({
      invoiceId: invoice?.id ?? '',
      amount: invoice ? outstanding(invoice).toFixed(2) : '',
      paymentDate: today(),
      paymentMethod: 'cash',
      transactionId: '',
      reference: '',
      notes: '',
    });
    setError(null);
    setNotice(null);
    setPaymentOpen(true);
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await recordSchoolPayment({
        invoiceId: paymentForm.invoiceId,
        amount: Number(paymentForm.amount),
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        transactionId: paymentForm.transactionId || null,
        reference: paymentForm.reference || null,
        notes: paymentForm.notes || null,
      });
      if (!result.success) throw new Error(result.error);
      const studentName = studentsById.get(result.data.payment.student_id)?.full_name ?? 'Student';
      setPayments((current) => [{ ...result.data.payment, student_name: studentName }, ...current]);
      setInvoices((current) => current.map((invoice) =>
        invoice.id === result.data.invoice.id
          ? { ...invoice, amount_paid: result.data.invoice.amount_paid, status: result.data.invoice.status }
          : invoice
      ));
      setPaymentOpen(false);
      setNotice('Payment recorded and invoice balance updated.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not record this payment.');
    } finally {
      setBusy(false);
    }
  };

  const banner = (error || notice) && (
    <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-950/30 text-red-200' : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'}`}>
      {error ?? notice}
    </div>
  );

  return (
    <div className="space-y-6">
      {banner}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="sr-only" htmlFor="finance-search">Search finance records</label>
        <input id="finance-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoices or fee structures" className={`${inputClass} lg:max-w-sm`} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openNewFee} className={buttonClass}>+ Create Fee Structure</button>
          <button type="button" onClick={openInvoiceForm} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500">+ Generate Invoice</button>
          <button type="button" onClick={openPaymentForm} className={buttonClass}>+ Record Payment</button>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-200">Invoices</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-gray-800 bg-gray-950/60 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="p-3 font-medium">Invoice</th><th className="p-3 font-medium">Student</th><th className="p-3 font-medium">Period</th><th className="p-3 font-medium">Dates</th><th className="p-3 font-medium">Amount</th><th className="p-3 font-medium">Paid</th><th className="p-3 font-medium">Balance</th><th className="p-3 font-medium">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="p-3 font-medium text-gray-100">{invoice.invoice_number}</td>
                  <td className="p-3 text-gray-300">{invoice.student_name}</td>
                  <td className="p-3 text-gray-400">{yearLabel(invoice.academic_year_id)} · {termLabel(invoice.term_id)}</td>
                  <td className="p-3 text-gray-400">{invoice.issue_date} / {invoice.due_date ?? '—'}</td>
                  <td className="p-3 text-gray-200">{formatAdminCurrency(invoice.total_amount)}</td>
                  <td className="p-3 text-gray-200">{formatAdminCurrency(invoice.amount_paid ?? 0)}</td>
                  <td className="p-3 text-gray-200">{formatAdminCurrency(outstanding(invoice))}</td>
                  <td className="p-3"><StatusBadge status={invoiceStatus(invoice)} /></td>
                </tr>
              ))}
              {!filteredInvoices.length && <tr><td colSpan={8} className="p-7 text-center text-gray-400">{query ? 'No matching invoices.' : 'No invoices have been generated.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-200">Fee structures</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-gray-800 bg-gray-950/60 text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="p-3 font-medium">Fee</th><th className="p-3 font-medium">Applies to</th><th className="p-3 font-medium">Amount</th><th className="p-3 font-medium">Due</th><th className="p-3 font-medium">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredFees.map((fee) => (
                  <tr key={fee.id}>
                    <td className="p-3 text-gray-100">{fee.fee_name}<span className="block text-xs text-gray-500">{fee.is_mandatory ? 'Mandatory' : 'Optional'}</span></td>
                    <td className="p-3 text-gray-400">{yearLabel(fee.academic_year_id)} · {classLabel(fee.class_id)} · {termLabel(fee.term_id)}</td>
                    <td className="p-3 text-gray-200">{formatAdminCurrency(fee.amount)}</td>
                    <td className="p-3 text-gray-400">{fee.due_date ?? '—'}</td>
                    <td className="p-3"><div className="flex gap-3"><button type="button" onClick={() => openEditFee(fee)} className="text-xs text-cyan-300 hover:text-cyan-200">Edit</button><button type="button" onClick={() => { setDeletingFee({ id: fee.id, name: fee.fee_name }); setError(null); }} className="text-xs text-red-300 hover:text-red-200">Delete</button></div></td>
                  </tr>
                ))}
                {!filteredFees.length && <tr><td colSpan={5} className="p-7 text-center text-gray-400">{query ? 'No matching fees.' : 'No fee structures configured.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-200">Recent payments</h3>
          {!payments.length ? (
            <div className="rounded-xl border border-dashed border-gray-700 px-5 py-8 text-center text-sm text-gray-400">No payments recorded.</div>
          ) : (
            <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-950/30">
              {payments.slice(0, 15).map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <div><p className="text-gray-200">{payment.student_name}</p><p className="text-xs text-gray-500">{payment.payment_date.slice(0, 10)} · {payment.payment_method.replace('_', ' ')}{payment.reference ? ` · ${payment.reference}` : ''}</p></div>
                  <span className="font-medium text-gray-100">{formatAdminCurrency(payment.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {feeEditor !== undefined && (
        <Modal title={feeEditor ? 'Edit fee structure' : 'Create fee structure'} onClose={() => setFeeEditor(undefined)}>
          <form onSubmit={submitFee} className="grid gap-4 sm:grid-cols-2">
            <Field label="Fee name"><input required maxLength={100} value={feeForm.feeName} onChange={(event) => setFeeForm({ ...feeForm, feeName: event.target.value })} className={inputClass} /></Field>
            <Field label="Amount"><input required type="number" min="0.01" step="0.01" value={feeForm.amount} onChange={(event) => setFeeForm({ ...feeForm, amount: event.target.value })} className={inputClass} /></Field>
            <Field label="Academic year"><select required value={feeForm.academicYearId} onChange={(event) => setFeeForm({ ...feeForm, academicYearId: event.target.value, termId: '' })} className={inputClass}><option value="">Select year</option>{academicYears.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}</select></Field>
            <Field label="Class scope"><select value={feeForm.classId} onChange={(event) => setFeeForm({ ...feeForm, classId: event.target.value })} className={inputClass}><option value="">All classes</option>{classes.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></Field>
            <Field label="Term scope"><select value={feeForm.termId} onChange={(event) => setFeeForm({ ...feeForm, termId: event.target.value })} className={inputClass}><option value="">All terms</option>{termsForFee.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></Field>
            <Field label="Due date (optional)"><input type="date" value={feeForm.dueDate} onChange={(event) => setFeeForm({ ...feeForm, dueDate: event.target.value })} className={inputClass} /></Field>
            <Field label="Description"><textarea maxLength={2000} rows={3} value={feeForm.description} onChange={(event) => setFeeForm({ ...feeForm, description: event.target.value })} className={inputClass} /></Field>
            <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2"><input type="checkbox" checked={feeForm.isMandatory} onChange={(event) => setFeeForm({ ...feeForm, isMandatory: event.target.checked })} className="accent-cyan-500" />Mandatory fee</label>
            {error && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}
            <DialogActions busy={busy} onCancel={() => setFeeEditor(undefined)} submitLabel={feeEditor ? 'Save changes' : 'Create fee'} />
          </form>
        </Modal>
      )}

      {invoiceOpen && (
        <Modal title="Generate invoice(s)" onClose={() => setInvoiceOpen(false)}>
          <form onSubmit={submitInvoice} className="grid gap-4 sm:grid-cols-2">
            <Field label="Class"><select required value={invoiceForm.classId} onChange={(event) => setInvoiceForm({ ...invoiceForm, classId: event.target.value, studentId: '', feeStructureIds: defaultFeeIds(invoiceForm.academicYearId, event.target.value, invoiceForm.termId) })} className={inputClass}><option value="">Select class</option>{classes.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></Field>
            <Field label="Student (optional)"><select value={invoiceForm.studentId} onChange={(event) => setInvoiceForm({ ...invoiceForm, studentId: event.target.value })} className={inputClass}><option value="">Entire class</option>{studentsForInvoice.map((student) => <option key={student.id} value={student.id}>{student.full_name} · {student.admission_number}</option>)}</select></Field>
            <Field label="Academic year"><select required value={invoiceForm.academicYearId} onChange={(event) => setInvoiceForm({ ...invoiceForm, academicYearId: event.target.value, termId: '', studentId: '', feeStructureIds: defaultFeeIds(event.target.value, invoiceForm.classId, '') })} className={inputClass}><option value="">Select year</option>{academicYears.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></Field>
            <Field label="Term"><select value={invoiceForm.termId} onChange={(event) => setInvoiceForm({ ...invoiceForm, termId: event.target.value, studentId: '', feeStructureIds: defaultFeeIds(invoiceForm.academicYearId, invoiceForm.classId, event.target.value) })} className={inputClass}><option value="">All year (non-term fees)</option>{termsForInvoice.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></Field>
            <Field label="Issue date"><input required type="date" value={invoiceForm.issueDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, issueDate: event.target.value })} className={inputClass} /></Field>
            <Field label="Due date"><input required type="date" value={invoiceForm.dueDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, dueDate: event.target.value })} className={inputClass} /></Field>
            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="mb-2 text-sm text-gray-300">Fees to include</legend>
              {feesForInvoice.length ? feesForInvoice.map((fee) => (
                <label key={fee.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-gray-200"><input type="checkbox" checked={invoiceForm.feeStructureIds.includes(fee.id)} onChange={(event) => setInvoiceForm({ ...invoiceForm, feeStructureIds: event.target.checked ? [...invoiceForm.feeStructureIds, fee.id] : invoiceForm.feeStructureIds.filter((id) => id !== fee.id) })} className="accent-cyan-500" />{fee.fee_name}{fee.is_mandatory ? ' · Mandatory' : ''}</span>
                  <span className="text-gray-400">{formatAdminCurrency(fee.amount)}</span>
                </label>
              )) : <p className="text-sm text-amber-300">No fee structures match this class, year and term.</p>}
            </fieldset>
            {error && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}
            <DialogActions busy={busy} onCancel={() => setInvoiceOpen(false)} submitLabel="Generate invoices" disabled={!invoiceForm.feeStructureIds.length} />
          </form>
        </Modal>
      )}

      {paymentOpen && (
        <Modal title="Record payment" onClose={() => setPaymentOpen(false)}>
          <form onSubmit={submitPayment} className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoice"><select required value={paymentForm.invoiceId} onChange={(event) => {
              const invoice = invoices.find((row) => row.id === event.target.value);
              setPaymentForm({ ...paymentForm, invoiceId: event.target.value, amount: invoice ? outstanding(invoice).toFixed(2) : '' });
            }} className={inputClass}><option value="">Select invoice</option>{invoicesForPayment.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {invoice.student_name} · Due {formatAdminCurrency(outstanding(invoice))}</option>)}</select></Field>
            <Field label="Payment amount"><input required type="number" min="0.01" step="0.01" max={selectedPaymentInvoice ? outstanding(selectedPaymentInvoice) : undefined} value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} className={inputClass} /></Field>
            <Field label="Payment date"><input required type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} className={inputClass} /></Field>
            <Field label="Method"><select value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethod: event.target.value as PaymentForm['paymentMethod'] })} className={inputClass}>{['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque'].map((method) => <option key={method} value={method}>{method.replace('_', ' ')}</option>)}</select></Field>
            <Field label="Transaction ID"><input maxLength={100} value={paymentForm.transactionId} onChange={(event) => setPaymentForm({ ...paymentForm, transactionId: event.target.value })} className={inputClass} /></Field>
            <Field label="Reference"><input maxLength={100} value={paymentForm.reference} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} className={inputClass} /></Field>
            <Field label="Notes"><textarea maxLength={1000} rows={3} value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} className={`${inputClass} sm:col-span-2`} /></Field>
            {error && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}
            {!invoicesForPayment.length && <p className="text-sm text-amber-300 sm:col-span-2">There are no outstanding invoices to pay.</p>}
            <DialogActions busy={busy} onCancel={() => setPaymentOpen(false)} submitLabel="Record payment" disabled={!invoicesForPayment.length} />
          </form>
        </Modal>
      )}

      {deletingFee && (
        <Modal title={`Delete ${deletingFee.name}?`} onClose={() => setDeletingFee(null)} dialog>
          <h2 className="font-semibold text-white">Delete “{deletingFee.name}”?</h2>
          <p className="text-sm text-gray-400">This removes the fee structure. Existing invoices and recorded payments are not changed.</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setDeletingFee(null)} disabled={busy} className={buttonClass}>Cancel</button>
            <button type="button" onClick={confirmDeleteFee} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Deleting…' : 'Delete fee'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'paid'
    ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'
    : status === 'partial'
      ? 'border-amber-500/30 bg-amber-950/30 text-amber-200'
      : status === 'cancelled'
        ? 'border-gray-600 bg-gray-800 text-gray-400'
        : 'border-red-500/30 bg-red-950/30 text-red-200';
  return <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${color}`}>{status}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1.5 text-sm text-gray-300">{label}{children}</label>;
}

function Modal({
  title,
  children,
  onClose,
  dialog = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dialog?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section role={dialog ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl sm:p-6">
        {!dialog && <h2 className="mb-5 text-lg font-semibold text-white">{title}</h2>}
        {children}
        <button type="button" onClick={onClose} className="sr-only">Close dialog</button>
      </section>
    </div>
  );
}

function DialogActions({
  busy,
  onCancel,
  submitLabel,
  disabled = false,
}: {
  busy: boolean;
  onCancel: () => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
      <button type="button" onClick={onCancel} disabled={busy} className={buttonClass}>Cancel</button>
      <button type="submit" disabled={busy || disabled} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : submitLabel}</button>
    </div>
  );
}
