'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSchoolExam,
  deleteSchoolExam,
  updateSchoolExam,
} from '@/actions/admin-exams';

type ExamResult = {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  marks_obtained: number | null;
  grade: string | null;
  remarks: string | null;
  is_published: boolean | null;
};
type ExamRow = {
  id: string;
  school_id: string;
  name: string;
  academic_year_id: string;
  term_id: string | null;
  class_id: string;
  subject_id: string;
  exam_date: string | null;
  max_marks: number;
  exam_type: 'quiz' | 'midterm' | 'final' | 'assignment' | 'practical' | null;
  is_active: boolean | null;
  results: ExamResult[];
};
type Option = { id: string; label: string };
type YearOption = Option & { start_date: string; end_date: string };
type TermOption = Option & {
  academic_year_id: string;
  start_date: string;
  end_date: string;
};
type FormValue = {
  name: string;
  academicYearId: string;
  termId: string;
  classId: string;
  subjectId: string;
  examDate: string;
  maxMarks: string;
  examType: 'quiz' | 'midterm' | 'final' | 'assignment' | 'practical';
  isActive: boolean;
};

const EMPTY_FORM: FormValue = {
  name: '',
  academicYearId: '',
  termId: '',
  classId: '',
  subjectId: '',
  examDate: '',
  maxMarks: '100',
  examType: 'quiz',
  isActive: true,
};
const inputClass = 'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30';
const buttonClass = 'rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-50';
const examTypes = ['quiz', 'midterm', 'final', 'assignment', 'practical'] as const;

export function ExamsManager({
  initialExams,
  classes,
  subjects,
  academicYears,
  terms,
}: {
  initialExams: ExamRow[];
  classes: Option[];
  subjects: Option[];
  academicYears: YearOption[];
  terms: TermOption[];
}) {
  const router = useRouter();
  const [exams, setExams] = useState(initialExams);
  const [form, setForm] = useState<FormValue>(EMPTY_FORM);
  const [editing, setEditing] = useState<ExamRow | null>(null);
  const [deleting, setDeleting] = useState<ExamRow | null>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return exams.filter((exam) => {
      if (!query) return true;
      return [
        exam.name,
        classes.find((row) => row.id === exam.class_id)?.label,
        subjects.find((row) => row.id === exam.subject_id)?.label,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [classes, exams, search, subjects]);
  const yearLabel = (id: string) => academicYears.find((row) => row.id === id)?.label ?? 'Unknown year';
  const classLabel = (id: string) => classes.find((row) => row.id === id)?.label ?? 'Class unavailable';
  const subjectLabel = (id: string) => subjects.find((row) => row.id === id)?.label ?? 'Subject unavailable';

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, academicYearId: academicYears[0]?.id ?? '' });
    setError(null);
    setOpen(true);
  };
  const openEdit = (exam: ExamRow) => {
    setEditing(exam);
    setForm({
      name: exam.name,
      academicYearId: exam.academic_year_id,
      termId: exam.term_id ?? '',
      classId: exam.class_id,
      subjectId: exam.subject_id,
      examDate: exam.exam_date ?? '',
      maxMarks: String(exam.max_marks),
      examType: exam.exam_type ?? 'quiz',
      isActive: exam.is_active ?? true,
    });
    setError(null);
    setOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const values = {
        name: form.name,
        academicYearId: form.academicYearId,
        termId: form.termId || null,
        classId: form.classId,
        subjectId: form.subjectId,
        examDate: form.examDate,
        maxMarks: Number(form.maxMarks),
        examType: form.examType,
        isActive: form.isActive,
      };
      const result = editing
        ? await updateSchoolExam({ ...values, id: editing.id })
        : await createSchoolExam(values);
      if (!result.success) throw new Error(result.error);
      setExams((current) => editing
        ? current.map((row) => row.id === result.data.id ? { ...row, ...result.data } : row)
        : [{ ...result.data, results: [] }, ...current]);
      setNotice(editing ? 'Exam schedule updated.' : 'Exam scheduled.');
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this exam.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteSchoolExam({ id: deleting.id });
      if (!result.success) throw new Error(result.error);
      setExams((current) => current.filter((row) => row.id !== deleting.id));
      setDeleting(null);
      setNotice('Exam deleted.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this exam.');
    } finally {
      setBusy(false);
    }
  };

  const termsForYear = terms.filter((term) => term.academic_year_id === form.academicYearId);
  const banner = (error || notice) && (
    <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-950/30 text-red-200' : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'}`}>
      {error ?? notice}
    </div>
  );

  return (
    <div className="space-y-4">
      {banner}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="sr-only" htmlFor="exam-search">Search exams</label>
        <input id="exam-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, class or subject" className={`${inputClass} sm:max-w-sm`} />
        <button type="button" onClick={openNew} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500">+ Schedule Exam</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="pb-3 pr-4 font-medium">Exam</th>
              <th className="pb-3 pr-4 font-medium">Class / subject</th>
              <th className="pb-3 pr-4 font-medium">Academic period</th>
              <th className="pb-3 pr-4 font-medium">Date</th>
              <th className="pb-3 pr-4 font-medium">Maximum</th>
              <th className="pb-3 pr-4 font-medium">Results</th>
              <th className="pb-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((exam) => (
              <ExamTableRows
                key={exam.id}
                exam={exam}
                expanded={expanded === exam.id}
                classLabel={classLabel(exam.class_id)}
                subjectLabel={subjectLabel(exam.subject_id)}
                yearLabel={yearLabel(exam.academic_year_id)}
                termLabel={terms.find((row) => row.id === exam.term_id)?.label ?? '—'}
                onToggle={() => setExpanded(expanded === exam.id ? null : exam.id)}
                onEdit={() => openEdit(exam)}
                onDelete={() => { setDeleting(exam); setError(null); }}
              />
            ))}
            {!filtered.length && (
              <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">{search ? 'No matching exams.' : 'No exams scheduled yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="exam-dialog-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl sm:p-6">
            <h2 id="exam-dialog-title" className="text-lg font-semibold text-white">{editing ? 'Edit scheduled exam' : 'Schedule exam'}</h2>
            <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm text-gray-300 sm:col-span-2">Exam title
                <input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} />
              </label>
              <label className="space-y-1.5 text-sm text-gray-300">Academic year
                <select required value={form.academicYearId} onChange={(event) => setForm({ ...form, academicYearId: event.target.value, termId: '' })} className={inputClass}>
                  <option value="">Select year</option>
                  {academicYears.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm text-gray-300">Term
                <select value={form.termId} onChange={(event) => setForm({ ...form, termId: event.target.value })} className={inputClass}>
                  <option value="">No term</option>
                  {termsForYear.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm text-gray-300">Class
                <select required value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })} className={inputClass}>
                  <option value="">Select class</option>
                  {classes.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm text-gray-300">Subject
                <select required value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} className={inputClass}>
                  <option value="">Select subject</option>
                  {subjects.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm text-gray-300">Exam date
                <input required type="date" value={form.examDate} min={academicYears.find((year) => year.id === form.academicYearId)?.start_date} max={academicYears.find((year) => year.id === form.academicYearId)?.end_date} onChange={(event) => setForm({ ...form, examDate: event.target.value })} className={inputClass} />
              </label>
              <label className="space-y-1.5 text-sm text-gray-300">Maximum marks
                <input required type="number" min="0.01" step="0.01" value={form.maxMarks} onChange={(event) => setForm({ ...form, maxMarks: event.target.value })} className={inputClass} />
              </label>
              <label className="space-y-1.5 text-sm text-gray-300">Exam type
                <select value={form.examType} onChange={(event) => setForm({ ...form, examType: event.target.value as FormValue['examType'] })} className={inputClass}>
                  {examTypes.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2">
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="accent-cyan-500" />
                Active schedule
              </label>
              {error && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}
              <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
                <button type="button" onClick={() => setOpen(false)} disabled={busy} className={buttonClass}>Cancel</button>
                <button type="submit" disabled={busy} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : editing ? 'Save changes' : 'Schedule exam'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-exam-title" className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
            <h2 id="delete-exam-title" className="font-semibold text-white">Delete “{deleting.name}”?</h2>
            <p className="mt-2 text-sm text-gray-400">Exam questions will be removed with the schedule. Exams with submitted results cannot be deleted.</p>
            {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleting(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Deleting…' : 'Delete exam'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ExamTableRows({
  exam,
  expanded,
  classLabel,
  subjectLabel,
  yearLabel,
  termLabel,
  onToggle,
  onEdit,
  onDelete,
}: {
  exam: ExamRow;
  expanded: boolean;
  classLabel: string;
  subjectLabel: string;
  yearLabel: string;
  termLabel: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr>
        <td className="py-3 pr-4 font-medium text-gray-100">{exam.name}<span className="mt-1 block text-xs capitalize text-gray-500">{exam.exam_type ?? 'exam'} · {exam.is_active ? 'Active' : 'Inactive'}</span></td>
        <td className="py-3 pr-4 text-gray-300">{classLabel}<span className="mt-1 block text-xs text-gray-500">{subjectLabel}</span></td>
        <td className="py-3 pr-4 text-gray-300">{yearLabel}<span className="mt-1 block text-xs text-gray-500">{termLabel}</span></td>
        <td className="py-3 pr-4 text-gray-300">{exam.exam_date ?? 'Not set'}</td>
        <td className="py-3 pr-4 text-gray-300">{exam.max_marks}</td>
        <td className="py-3 pr-4">
          <button type="button" onClick={onToggle} className="text-cyan-300 hover:text-cyan-200">
            {exam.results.length} result{exam.results.length === 1 ? '' : 's'} {expanded ? '−' : '+'}
          </button>
        </td>
        <td className="py-3 text-right">
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onEdit} className="text-xs text-cyan-300 hover:text-cyan-200">Edit</button>
            <button type="button" onClick={onDelete} className="text-xs text-red-300 hover:text-red-200">Delete</button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-gray-950/50 p-4">
            {!exam.results.length ? (
              <p className="text-sm text-gray-400">No submitted results for this exam.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-xs">
                  <thead className="text-gray-500">
                    <tr><th className="pb-2 pr-4 font-medium">Student</th><th className="pb-2 pr-4 font-medium">Admission no.</th><th className="pb-2 pr-4 font-medium">Marks</th><th className="pb-2 pr-4 font-medium">Grade</th><th className="pb-2 pr-4 font-medium">Status</th><th className="pb-2 font-medium">Remarks</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {exam.results.map((result) => (
                      <tr key={result.id}>
                        <td className="py-2 pr-4 text-gray-200">{result.student_name}</td>
                        <td className="py-2 pr-4 text-gray-400">{result.admission_number}</td>
                        <td className="py-2 pr-4 text-gray-200">{result.marks_obtained ?? '—'} / {exam.max_marks}</td>
                        <td className="py-2 pr-4 text-gray-200">{result.grade ?? '—'}</td>
                        <td className="py-2 pr-4 text-gray-400">{result.is_published ? 'Published' : 'Submitted'}</td>
                        <td className="py-2 text-gray-400">{result.remarks ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
