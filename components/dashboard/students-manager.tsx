'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { createStudent, updateStudent } from '@/actions/school-admin';

type EnrollmentRow = {
  id: string;
  class_id: string;
  academic_year_id: string;
  term_id: string | null;
  stream_id: string | null;
  enrollment_date: string | null;
  status: 'active' | 'transferred' | 'graduated' | 'withdrawn' | 'suspended' | null;
};

type StudentRow = {
  id: string;
  school_id: string;
  admission_number: string | null;
  enrollment_date: string | null;
  status: EnrollmentRow['status'];
  created_at: string;
  full_name: string | null;
  enrollment: EnrollmentRow | null;
  enrollment_summary: string;
};

type Option = { id: string; label: string };
type TermOption = Option & { academic_year_id: string; start_date: string; end_date: string };
type StudentForm = {
  fullName: string;
  email: string;
  password: string;
  admissionNumber: string;
  enrollmentDate: string;
  status: NonNullable<EnrollmentRow['status']>;
  enrollmentId: string | null;
  classId: string;
  academicYearId: string;
  termId: string;
  streamId: string;
};
type Result<T> = { success: true; data: T } | { success: false; error: string };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StudentsManager({
  initialStudents,
  classes,
  academicYears,
  terms,
  streams,
}: {
  initialStudents: StudentRow[];
  classes: Option[];
  academicYears: Option[];
  terms: TermOption[];
  streams: Option[];
}) {
  const [students, setStudents] = useState(initialStudents);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StudentForm>({
    fullName: '',
    email: '',
    password: '',
    admissionNumber: '',
    enrollmentDate: today(),
    status: 'active',
    enrollmentId: null,
    classId: classes[0]?.id ?? '',
    academicYearId: academicYears[0]?.id ?? '',
    termId: '',
    streamId: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fieldClass =
    'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30';
  const buttonClass =
    'rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-50';
  const filteredTerms = useMemo(
    () => terms.filter((term) => term.academic_year_id === form.academicYearId),
    [terms, form.academicYearId]
  );

  const openNew = () => {
    setEditing(null);
    setForm({
      fullName: '',
      email: '',
      password: '',
      admissionNumber: '',
      enrollmentDate: today(),
      status: 'active',
      enrollmentId: null,
      classId: classes[0]?.id ?? '',
      academicYearId: academicYears[0]?.id ?? '',
      termId: '',
      streamId: '',
    });
    setError(null);
    setOpen(true);
  };

  const openEdit = (student: StudentRow) => {
    const enrollment = student.enrollment;
    setEditing(student);
    setForm({
      fullName: student.full_name ?? '',
      email: '',
      password: '',
      admissionNumber: student.admission_number ?? '',
      enrollmentDate: enrollment?.enrollment_date ?? student.enrollment_date ?? today(),
      status: student.status ?? 'active',
      enrollmentId: enrollment?.id ?? null,
      classId: enrollment?.class_id ?? classes[0]?.id ?? '',
      academicYearId: enrollment?.academic_year_id ?? academicYears[0]?.id ?? '',
      termId: enrollment?.term_id ?? '',
      streamId: enrollment?.stream_id ?? '',
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
      if (editing) {
        const result: Result<{ id: string; enrollmentId: string }> = await updateStudent({
          studentId: editing.id,
          fullName: form.fullName,
          admissionNumber: form.admissionNumber,
          enrollmentDate: form.enrollmentDate,
          status: form.status,
          enrollmentId: form.enrollmentId,
          classId: form.classId,
          academicYearId: form.academicYearId,
          termId: form.termId || null,
          streamId: form.streamId || null,
        });
        if (!result.success) throw new Error(result.error);
        const enrollment: EnrollmentRow = {
          id: result.data.enrollmentId,
          class_id: form.classId,
          academic_year_id: form.academicYearId,
          term_id: form.termId || null,
          stream_id: form.streamId || null,
          enrollment_date: form.enrollmentDate,
          status: form.status,
        };
        const summary = [
          classes.find((option) => option.id === form.classId)?.label,
          academicYears.find((option) => option.id === form.academicYearId)?.label,
          terms.find((option) => option.id === form.termId)?.label,
          streams.find((option) => option.id === form.streamId)?.label,
        ].filter(Boolean).join(' · ');
        setStudents((current) =>
          current.map((student) =>
            student.id === editing.id
              ? {
                  ...student,
                  full_name: form.fullName.trim(),
                  admission_number: form.admissionNumber.trim().toUpperCase(),
                  enrollment_date: form.enrollmentDate,
                  status: form.status,
                  enrollment,
                  enrollment_summary: summary || 'No enrollment details',
                }
              : student
          )
        );
        setNotice('Student and enrollment updated.');
      } else {
        const result: Result<{
          id: string;
          admissionNumber: string;
          schoolId: string;
          enrollmentId: string;
        }> = await createStudent({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          admissionNumber: form.admissionNumber,
          enrollmentDate: form.enrollmentDate,
          status: form.status,
          classId: form.classId,
          academicYearId: form.academicYearId,
          termId: form.termId || null,
          streamId: form.streamId || null,
        });
        if (!result.success) throw new Error(result.error);
        const enrollment: EnrollmentRow = {
          id: result.data.enrollmentId,
          class_id: form.classId,
          academic_year_id: form.academicYearId,
          term_id: form.termId || null,
          stream_id: form.streamId || null,
          enrollment_date: form.enrollmentDate,
          status: form.status,
        };
        const summary = [
          classes.find((option) => option.id === form.classId)?.label,
          academicYears.find((option) => option.id === form.academicYearId)?.label,
          terms.find((option) => option.id === form.termId)?.label,
          streams.find((option) => option.id === form.streamId)?.label,
        ].filter(Boolean).join(' · ');
        setStudents((current) => [
          {
            id: result.data.id,
            school_id: result.data.schoolId,
            admission_number: result.data.admissionNumber,
            enrollment_date: form.enrollmentDate,
            status: form.status,
            created_at: new Date().toISOString(),
            full_name: form.fullName.trim(),
            enrollment,
            enrollment_summary: summary || 'No enrollment details',
          },
          ...current,
        ]);
        setNotice('Student account and initial enrollment created.');
      }
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save student.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">A valid class and academic year are required for every student enrollment.</p>
        <button type="button" onClick={openNew} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-cyan-400">
          + Add Student
        </button>
      </div>
      {(error || notice) && (
        <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-950/30 text-red-200' : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'}`}>
          {error ?? notice}
        </div>
      )}
      {!classes.length || !academicYears.length ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
          Create at least one class and academic year in Settings before adding students.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="pb-3 pr-4 font-medium">Student</th>
              <th className="pb-3 pr-4 font-medium">Admission number</th>
              <th className="pb-3 pr-4 font-medium">Enrollment</th>
              <th className="pb-3 pr-4 font-medium">Date</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {students.map((student) => (
              <tr key={student.id}>
                <td className="py-3 pr-4 font-medium text-gray-100">{student.full_name ?? 'Profile unavailable'}</td>
                <td className="py-3 pr-4 font-mono text-gray-300">{student.admission_number ?? 'Not provided'}</td>
                <td className="py-3 pr-4 text-xs text-gray-300">{student.enrollment_summary}</td>
                <td className="py-3 pr-4 text-gray-300">{student.enrollment?.enrollment_date ?? student.enrollment_date ?? '—'}</td>
                <td className="py-3 pr-4"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs capitalize text-gray-200">{student.status ?? 'Unknown'}</span></td>
                <td className="py-3 text-right"><button type="button" onClick={() => openEdit(student)} className="text-xs text-cyan-300 hover:text-cyan-200">Edit</button></td>
              </tr>
            ))}
            {!students.length && <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-500">No students found for this school.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-6">
            <div>
              <h2 className="text-lg font-semibold text-white">{editing ? 'Edit student' : 'Add student'}</h2>
              <p className="mt-1 text-xs text-gray-500">The account, profile, student record and enrollment use your authenticated school.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm text-gray-300">Full name<input required maxLength={255} className={fieldClass} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
              <label className="block space-y-1 text-sm text-gray-300">Admission number<input required maxLength={50} className={fieldClass} value={form.admissionNumber} onChange={(event) => setForm({ ...form, admissionNumber: event.target.value })} /></label>
              {!editing && (
                <>
                  <label className="block space-y-1 text-sm text-gray-300">Email<input required type="email" maxLength={254} className={fieldClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
                  <label className="block space-y-1 text-sm text-gray-300">Temporary password<input required type="password" minLength={8} className={fieldClass} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
                </>
              )}
              <label className="block space-y-1 text-sm text-gray-300">Class<select required className={fieldClass} value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })}><option value="">Select class</option>{classes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
              <label className="block space-y-1 text-sm text-gray-300">Academic year<select required className={fieldClass} value={form.academicYearId} onChange={(event) => setForm({ ...form, academicYearId: event.target.value, termId: '' })}><option value="">Select year</option>{academicYears.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
              <label className="block space-y-1 text-sm text-gray-300">Term (optional)<select className={fieldClass} value={form.termId} onChange={(event) => setForm({ ...form, termId: event.target.value })}><option value="">No term</option>{filteredTerms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}</select></label>
              <label className="block space-y-1 text-sm text-gray-300">Stream (optional)<select className={fieldClass} value={form.streamId} onChange={(event) => setForm({ ...form, streamId: event.target.value })}><option value="">No stream</option>{streams.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
              <label className="block space-y-1 text-sm text-gray-300">Enrollment date<input required type="date" className={fieldClass} value={form.enrollmentDate} onChange={(event) => setForm({ ...form, enrollmentDate: event.target.value })} /></label>
              <label className="block space-y-1 text-sm text-gray-300">Status<select className={fieldClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as StudentForm['status'] })}><option value="active">Active</option><option value="transferred">Transferred</option><option value="graduated">Graduated</option><option value="withdrawn">Withdrawn</option><option value="suspended">Suspended</option></select></label>
            </div>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy || !classes.length || !academicYears.length} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950 disabled:opacity-50">{busy ? 'Saving…' : editing ? 'Save changes' : 'Create student'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
