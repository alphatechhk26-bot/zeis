'use client';

import { useState, type FormEvent } from 'react';
import {
  createAcademicYear,
  createSubject,
  createTerm,
  deleteAcademicYear,
  deleteSubject,
  deleteTerm,
  updateAcademicYear,
  updateSubject,
  updateTerm,
} from '@/actions/school-admin';

type YearRow = {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean | null;
  status: 'active' | 'inactive' | 'archived' | null;
  created_at: string;
  updated_at: string;
};
type TermRow = {
  id: string;
  academic_year_id: string;
  name: string;
  term_number: number;
  start_date: string;
  end_date: string;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};
type SubjectRow = {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};
type Editor =
  | { kind: 'year'; record: YearRow | null }
  | { kind: 'term'; record: TermRow | null }
  | { kind: 'subject'; record: SubjectRow | null }
  | null;
type Deleting = { kind: 'year' | 'term' | 'subject'; id: string; label: string } | null;
type SetupForm = {
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  academicYearId: string;
  termNumber: string;
  code: string;
  description: string;
};

const EMPTY_FORM: SetupForm = {
  name: '',
  startDate: '',
  endDate: '',
  isActive: true,
  academicYearId: '',
  termNumber: '1',
  code: '',
  description: '',
};

export function AcademicSetupManager({
  initialYears,
  initialTerms,
  initialSubjects,
}: {
  initialYears: YearRow[];
  initialTerms: TermRow[];
  initialSubjects: SubjectRow[];
}) {
  const [years, setYears] = useState(initialYears);
  const [terms, setTerms] = useState(initialTerms);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [editor, setEditor] = useState<Editor>(null);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputClass =
    'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30';
  const buttonClass =
    'rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-50';

  const openEditor = (kind: 'year' | 'term' | 'subject', record: YearRow | TermRow | SubjectRow | null) => {
    setError(null);
    if (kind === 'year') {
      const year = record as YearRow | null;
      setForm(year
        ? { ...EMPTY_FORM, name: year.name, startDate: year.start_date, endDate: year.end_date, isActive: year.is_active ?? true }
        : EMPTY_FORM);
      setEditor({ kind, record: year });
    } else if (kind === 'term') {
      const term = record as TermRow | null;
      setForm(term
        ? { ...EMPTY_FORM, name: term.name, startDate: term.start_date, endDate: term.end_date, isActive: term.is_active ?? true, academicYearId: term.academic_year_id, termNumber: String(term.term_number) }
        : { ...EMPTY_FORM, academicYearId: years[0]?.id ?? '' });
      setEditor({ kind, record: term });
    } else {
      const subject = record as SubjectRow | null;
      setForm(subject
        ? { ...EMPTY_FORM, name: subject.name, code: subject.code ?? '', description: subject.description ?? '', isActive: subject.is_active ?? true }
        : EMPTY_FORM);
      setEditor({ kind, record: subject });
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (editor.kind === 'year') {
        const values = {
          name: form.name,
          startDate: form.startDate,
          endDate: form.endDate,
          isActive: form.isActive,
        };
        const result = editor.record
          ? await updateAcademicYear({ ...values, id: editor.record.id })
          : await createAcademicYear(values);
        if (!result.success) throw new Error(result.error);
        setYears((current) =>
          editor.record
            ? current.map((row) => row.id === result.data.id ? result.data : row)
            : [result.data, ...current]
        );
        setNotice(editor.record ? 'Academic year updated.' : 'Academic year created.');
      } else if (editor.kind === 'term') {
        const values = {
          academicYearId: form.academicYearId,
          name: form.name,
          termNumber: Number(form.termNumber),
          startDate: form.startDate,
          endDate: form.endDate,
          isActive: form.isActive,
        };
        const result = editor.record
          ? await updateTerm({ ...values, id: editor.record.id })
          : await createTerm(values);
        if (!result.success) throw new Error(result.error);
        setTerms((current) =>
          editor.record
            ? current.map((row) => row.id === result.data.id ? result.data : row)
            : [result.data, ...current]
        );
        setNotice(editor.record ? 'Term updated.' : 'Term created.');
      } else {
        const values = {
          name: form.name,
          code: form.code || null,
          description: form.description || null,
          isActive: form.isActive,
        };
        const result = editor.record
          ? await updateSubject({ ...values, id: editor.record.id })
          : await createSubject(values);
        if (!result.success) throw new Error(result.error);
        setSubjects((current) =>
          editor.record
            ? current.map((row) => row.id === result.data.id ? result.data : row)
            : [result.data, ...current]
        );
        setNotice(editor.record ? 'Subject updated.' : 'Subject created.');
      }
      setEditor(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this record.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = deleting.kind === 'year'
        ? await deleteAcademicYear({ id: deleting.id })
        : deleting.kind === 'term'
          ? await deleteTerm({ id: deleting.id })
          : await deleteSubject({ id: deleting.id });
      if (!result.success) throw new Error(result.error);
      if (deleting.kind === 'year') setYears((current) => current.filter((row) => row.id !== deleting.id));
      if (deleting.kind === 'term') setTerms((current) => current.filter((row) => row.id !== deleting.id));
      if (deleting.kind === 'subject') setSubjects((current) => current.filter((row) => row.id !== deleting.id));
      setNotice(`${deleting.label} deleted.`);
      setDeleting(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this record.');
    } finally {
      setBusy(false);
    }
  };

  const yearName = (id: string) => years.find((year) => year.id === id)?.name ?? 'Unknown year';
  const actions = (kind: 'year' | 'term' | 'subject', row: YearRow | TermRow | SubjectRow, label: string) => (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={() => openEditor(kind, row)} className="text-xs text-cyan-300 hover:text-cyan-200">Edit</button>
      <button type="button" onClick={() => { setError(null); setDeleting({ kind, id: row.id, label }); }} className="text-xs text-red-300 hover:text-red-200">Delete</button>
    </div>
  );

  return (
    <div className="space-y-5">
      {(error || notice) && (
        <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-950/30 text-red-200' : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'}`}>
          {error ?? notice}
        </div>
      )}

      <section className="rounded-xl border border-gray-800 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h3 className="font-semibold text-white">Academic years</h3><p className="mt-1 text-xs text-gray-500">School-scoped calendar years and date ranges.</p></div>
          <button type="button" onClick={() => openEditor('year', null)} className={buttonClass}>+ Add year</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-gray-800 text-xs uppercase text-gray-500"><tr><th className="pb-2 pr-3">Name</th><th className="pb-2 pr-3">Start</th><th className="pb-2 pr-3">End</th><th className="pb-2 pr-3">Status</th><th className="pb-2 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-800">{years.map((row) => <tr key={row.id}><td className="py-2.5 pr-3 text-gray-100">{row.name}</td><td className="py-2.5 pr-3 text-gray-300">{row.start_date}</td><td className="py-2.5 pr-3 text-gray-300">{row.end_date}</td><td className="py-2.5 pr-3 text-gray-300">{row.is_active ? 'Active' : 'Inactive'}</td><td className="py-2.5">{actions('year', row, row.name)}</td></tr>)}</tbody>
          </table>
          {!years.length && <p className="py-5 text-center text-sm text-gray-500">No academic years yet.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h3 className="font-semibold text-white">Terms</h3><p className="mt-1 text-xs text-gray-500">Terms must fall within their selected academic year.</p></div>
          <button type="button" disabled={!years.length} onClick={() => openEditor('term', null)} className={buttonClass}>+ Add term</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-800 text-xs uppercase text-gray-500"><tr><th className="pb-2 pr-3">Term</th><th className="pb-2 pr-3">Academic year</th><th className="pb-2 pr-3">Dates</th><th className="pb-2 pr-3">Status</th><th className="pb-2 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-800">{terms.map((row) => <tr key={row.id}><td className="py-2.5 pr-3 text-gray-100">{row.name} <span className="text-gray-500">#{row.term_number}</span></td><td className="py-2.5 pr-3 text-gray-300">{yearName(row.academic_year_id)}</td><td className="py-2.5 pr-3 text-gray-300">{row.start_date} – {row.end_date}</td><td className="py-2.5 pr-3 text-gray-300">{row.is_active ? 'Active' : 'Inactive'}</td><td className="py-2.5">{actions('term', row, row.name)}</td></tr>)}</tbody>
          </table>
          {!terms.length && <p className="py-5 text-center text-sm text-gray-500">No terms yet.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h3 className="font-semibold text-white">Subjects</h3><p className="mt-1 text-xs text-gray-500">Subjects are shared with class and teacher assignment workflows.</p></div>
          <button type="button" onClick={() => openEditor('subject', null)} className={buttonClass}>+ Add subject</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-gray-800 text-xs uppercase text-gray-500"><tr><th className="pb-2 pr-3">Subject</th><th className="pb-2 pr-3">Code</th><th className="pb-2 pr-3">Status</th><th className="pb-2 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-800">{subjects.map((row) => <tr key={row.id}><td className="py-2.5 pr-3 text-gray-100">{row.name}{row.description && <p className="mt-1 max-w-md text-xs text-gray-500">{row.description}</p>}</td><td className="py-2.5 pr-3 text-gray-300">{row.code ?? '—'}</td><td className="py-2.5 pr-3 text-gray-300">{row.is_active ? 'Active' : 'Inactive'}</td><td className="py-2.5">{actions('subject', row, row.name)}</td></tr>)}</tbody>
          </table>
          {!subjects.length && <p className="py-5 text-center text-sm text-gray-500">No subjects yet.</p>}
        </div>
      </section>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-6">
            <h2 className="text-lg font-semibold text-white">
              {editor.record ? 'Edit' : 'Add'} {editor.kind === 'year' ? 'academic year' : editor.kind}
            </h2>
            <label className="block space-y-1 text-sm text-gray-300">Name<input required maxLength={100} className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            {editor.kind === 'year' && (
              <>
                <label className="block space-y-1 text-sm text-gray-300">Start date<input required type="date" className={inputClass} value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
                <label className="block space-y-1 text-sm text-gray-300">End date<input required type="date" className={inputClass} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
              </>
            )}
            {editor.kind === 'term' && (
              <>
                <label className="block space-y-1 text-sm text-gray-300">Academic year<select required className={inputClass} value={form.academicYearId} onChange={(event) => setForm({ ...form, academicYearId: event.target.value })}><option value="">Select year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
                <label className="block space-y-1 text-sm text-gray-300">Term number<input required type="number" min={1} max={12} className={inputClass} value={form.termNumber} onChange={(event) => setForm({ ...form, termNumber: event.target.value })} /></label>
                <label className="block space-y-1 text-sm text-gray-300">Start date<input required type="date" className={inputClass} value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
                <label className="block space-y-1 text-sm text-gray-300">End date<input required type="date" className={inputClass} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
              </>
            )}
            {editor.kind === 'subject' && (
              <>
                <label className="block space-y-1 text-sm text-gray-300">Code (optional)<input maxLength={20} className={inputClass} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
                <label className="block space-y-1 text-sm text-gray-300">Description<textarea maxLength={2000} className={inputClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setEditor(null)} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950 disabled:opacity-50">{busy ? 'Saving…' : editor.record ? 'Save changes' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md space-y-4 rounded-2xl border border-gray-700 bg-gray-900 p-6">
            <h2 className="text-lg font-semibold text-white">Delete {deleting.kind}?</h2>
            <p className="text-sm text-gray-400">Delete “{deleting.label}”? Records with linked enrollments or assignments cannot be deleted.</p>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setDeleting(null)} className={buttonClass}>Cancel</button>
              <button type="button" disabled={busy} onClick={() => void confirmDelete()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
