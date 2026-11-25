'use client';

import { useState, type FormEvent } from 'react';
import { createTeacher, updateTeacher } from '@/actions/school-admin';

type TeacherRow = {
  id: string;
  school_id: string;
  employee_id: string | null;
  hire_date: string | null;
  status: 'active' | 'inactive' | 'archived' | null;
  created_at: string;
  updated_at: string;
  full_name: string | null;
};

type TeacherAssignment = {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  class_name: string;
  subject_name: string;
  academic_year_name: string;
};

type TeacherForm = {
  fullName: string;
  email: string;
  password: string;
  employeeId: string;
  hireDate: string;
  status: 'active' | 'inactive' | 'archived';
};

type Result<T> = { success: true; data: T } | { success: false; error: string };

const EMPTY_FORM: TeacherForm = {
  fullName: '',
  email: '',
  password: '',
  employeeId: '',
  hireDate: '',
  status: 'active',
};

export function TeachersManager({
  initialTeachers,
  initialAssignments,
}: {
  initialTeachers: TeacherRow[];
  initialAssignments: TeacherAssignment[];
}) {
  const [teachers, setTeachers] = useState(initialTeachers);
  const [assignments] = useState(initialAssignments);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TeacherForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fieldClass =
    'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30';
  const buttonClass =
    'rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-50';

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  };

  const openEdit = (teacher: TeacherRow) => {
    setEditing(teacher);
    setForm({
      fullName: teacher.full_name ?? '',
      email: '',
      password: '',
      employeeId: teacher.employee_id ?? '',
      hireDate: teacher.hire_date ?? '',
      status: teacher.status ?? 'active',
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
        const result: Result<{ id: string }> = await updateTeacher({
          teacherId: editing.id,
          fullName: form.fullName,
          employeeId: form.employeeId || null,
          hireDate: form.hireDate || null,
          status: form.status,
        });
        if (!result.success) throw new Error(result.error);
        setTeachers((current) =>
          current.map((teacher) =>
            teacher.id === editing.id
              ? {
                  ...teacher,
                  full_name: form.fullName.trim(),
                  employee_id: form.employeeId.trim() || null,
                  hire_date: form.hireDate || null,
                  status: form.status,
                }
              : teacher
          )
        );
        setNotice('Teacher updated.');
      } else {
        const result: Result<{ id: string; schoolId: string }> = await createTeacher({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          employeeId: form.employeeId || null,
          hireDate: form.hireDate || null,
          status: form.status,
        });
        if (!result.success) throw new Error(result.error);
        const now = new Date().toISOString();
        setTeachers((current) => [
          {
            id: result.data.id,
            school_id: result.data.schoolId,
            employee_id: form.employeeId.trim() || null,
            hire_date: form.hireDate || null,
            status: form.status,
            created_at: now,
            updated_at: now,
            full_name: form.fullName.trim(),
          },
          ...current,
        ]);
        setNotice('Teacher account created.');
      }
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save teacher.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button type="button" onClick={openNew} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-cyan-400">
          + Add Teacher
        </button>
      </div>
      {(error || notice) && (
        <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-950/30 text-red-200' : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'}`}>
          {error ?? notice}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="pb-3 pr-4 font-medium">Teacher</th>
              <th className="pb-3 pr-4 font-medium">Employee ID</th>
              <th className="pb-3 pr-4 font-medium">Hire date</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 pr-4 font-medium">Assigned classes</th>
              <th className="pb-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {teachers.map((teacher) => {
              const rows = assignments.filter((assignment) => assignment.teacher_id === teacher.id);
              return (
                <tr key={teacher.id} className="align-top">
                  <td className="py-3 pr-4 font-medium text-gray-100">{teacher.full_name ?? 'Profile unavailable'}</td>
                  <td className="py-3 pr-4 text-gray-300">{teacher.employee_id ?? '—'}</td>
                  <td className="py-3 pr-4 text-gray-300">{teacher.hire_date ?? '—'}</td>
                  <td className="py-3 pr-4"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs capitalize text-gray-200">{teacher.status ?? 'Unknown'}</span></td>
                  <td className="py-3 pr-4 text-xs text-gray-300">
                    {rows.length ? rows.map((row) => `${row.class_name} · ${row.subject_name} (${row.academic_year_name})`).join(', ') : 'No assigned classes'}
                  </td>
                  <td className="py-3 text-right">
                    <button type="button" onClick={() => openEdit(teacher)} className="text-xs text-cyan-300 hover:text-cyan-200">Edit</button>
                  </td>
                </tr>
              );
            })}
            {!teachers.length && <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-500">No teachers found for this school.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-6">
            <div>
              <h2 className="text-lg font-semibold text-white">{editing ? 'Edit teacher' : 'Add teacher'}</h2>
              <p className="mt-1 text-xs text-gray-500">The teacher account and records will be assigned to your authenticated school.</p>
            </div>
            <label className="block space-y-1 text-sm text-gray-300">Full name<input required maxLength={255} className={fieldClass} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
            {!editing && (
              <>
                <label className="block space-y-1 text-sm text-gray-300">Email<input required type="email" maxLength={254} className={fieldClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
                <label className="block space-y-1 text-sm text-gray-300">Temporary password<input required type="password" minLength={8} className={fieldClass} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
              </>
            )}
            <label className="block space-y-1 text-sm text-gray-300">Employee ID (optional)<input maxLength={100} className={fieldClass} value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} /></label>
            <label className="block space-y-1 text-sm text-gray-300">Hire date<input type="date" className={fieldClass} value={form.hireDate} onChange={(event) => setForm({ ...form, hireDate: event.target.value })} /></label>
            <label className="block space-y-1 text-sm text-gray-300">Status<select className={fieldClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TeacherForm['status'] })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></label>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950 disabled:opacity-50">{busy ? 'Saving…' : editing ? 'Save changes' : 'Create teacher'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
