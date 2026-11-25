'use client';

import { useState, type FormEvent } from 'react';
import {
  assignTeacherToClassSubject,
  createClass,
  deleteClass,
  deleteTeacherAssignment,
  updateClass,
} from '@/actions/school-admin';

type ClassForm = {
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  newStreamName: string;
  newStreamCode: string;
  newStreamDescription: string;
};

type ClassRow = {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  activeEnrollmentCount: number;
};

type AssignmentRow = {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  teacher_name: string;
  subject_name: string;
  academic_year_name: string;
};

type Option = { id: string; label: string };
type Result<T> = { success: true; data: T } | { success: false; error: string };

const EMPTY_CLASS: ClassForm = {
  name: '',
  code: '',
  description: '',
  isActive: true,
  newStreamName: '',
  newStreamCode: '',
  newStreamDescription: '',
};

export function ClassesManager({
  initialClasses,
  initialAssignments,
  teachers,
  subjects,
  academicYears,
}: {
  initialClasses: ClassRow[];
  initialAssignments: AssignmentRow[];
  teachers: Option[];
  subjects: Option[];
  academicYears: Option[];
}) {
  const [classes, setClasses] = useState(initialClasses);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [modal, setModal] = useState<'class' | 'assignment' | null>(null);
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null);
  const [deletingClass, setDeletingClass] = useState<ClassRow | null>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<AssignmentRow | null>(null);
  const [classForm, setClassForm] = useState<ClassForm>(EMPTY_CLASS);
  const [assignmentForm, setAssignmentForm] = useState({
    classId: '',
    teacherId: '',
    subjectId: '',
    academicYearId: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const openNewClass = () => {
    setEditingClass(null);
    setClassForm(EMPTY_CLASS);
    setError(null);
    setModal('class');
  };

  const openEditClass = (row: ClassRow) => {
    setEditingClass(row);
    setClassForm({
      name: row.name,
      code: row.code ?? '',
      description: row.description ?? '',
      isActive: row.is_active ?? true,
      newStreamName: '',
      newStreamCode: '',
      newStreamDescription: '',
    });
    setError(null);
    setModal('class');
  };

  const submitClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (editingClass) {
        const result: Result<Omit<ClassRow, 'activeEnrollmentCount'>> = await updateClass({
          id: editingClass.id,
          name: classForm.name,
          code: classForm.code || null,
          description: classForm.description || null,
          isActive: classForm.isActive,
        });
        if (!result.success) throw new Error(result.error);
        setClasses((rows) =>
          rows.map((row) =>
            row.id === result.data.id
              ? { ...row, ...result.data, activeEnrollmentCount: row.activeEnrollmentCount }
              : row
          )
        );
        setNotice('Class updated.');
      } else {
        const result: Result<Omit<ClassRow, 'activeEnrollmentCount'>> = await createClass({
          name: classForm.name,
          code: classForm.code || null,
          description: classForm.description || null,
          isActive: classForm.isActive,
          newStreamName: classForm.newStreamName || null,
          newStreamCode: classForm.newStreamCode || null,
          newStreamDescription: classForm.newStreamDescription || null,
        });
        if (!result.success) throw new Error(result.error);
        setClasses((rows) => [
          { ...result.data, activeEnrollmentCount: 0 },
          ...rows,
        ]);
        setNotice('Class created.');
      }
      setModal(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this class.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteClass = async () => {
    if (!deletingClass) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteClass({ id: deletingClass.id });
      if (!result.success) throw new Error(result.error);
      setClasses((rows) => rows.filter((row) => row.id !== deletingClass.id));
      setDeletingClass(null);
      setNotice('Class deleted.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this class.');
    } finally {
      setBusy(false);
    }
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result: Result<{
        id: string;
        teacher_id: string;
        class_id: string;
        subject_id: string;
        academic_year_id: string;
        created_at: string | null;
        updated_at: string | null;
      }> = await assignTeacherToClassSubject(assignmentForm);
      if (!result.success) throw new Error(result.error);
      if (!result.data) throw new Error('No teacher assignment was returned.');
      const row = result.data;
      setAssignments((current) => [
        {
          ...row,
          teacher_name: teachers.find((option) => option.id === row.teacher_id)?.label ?? 'Teacher',
          subject_name: subjects.find((option) => option.id === row.subject_id)?.label ?? 'Subject',
          academic_year_name:
            academicYears.find((option) => option.id === row.academic_year_id)?.label ?? 'Academic year',
        },
        ...current,
      ]);
      setNotice('Teacher assigned to the class and subject.');
      setModal(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not assign teacher.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteAssignment = async () => {
    if (!deletingAssignment) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteTeacherAssignment({ id: deletingAssignment.id });
      if (!result.success) throw new Error(result.error);
      setAssignments((current) => current.filter((row) => row.id !== deletingAssignment.id));
      setDeletingAssignment(null);
      setNotice('Teacher assignment removed.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove assignment.');
    } finally {
      setBusy(false);
    }
  };

  const fieldClass =
    'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30';
  const buttonClass =
    'rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-50';
  const assignmentFields: {
    label: string;
    key: keyof typeof assignmentForm;
    options: Option[];
  }[] = [
    { label: 'Class', key: 'classId', options: classes.map((row) => ({ id: row.id, label: row.name })) },
    { label: 'Teacher', key: 'teacherId', options: teachers },
    { label: 'Subject', key: 'subjectId', options: subjects },
    { label: 'Academic year', key: 'academicYearId', options: academicYears },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={openNewClass} className={buttonClass}>
          + Add Class
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setAssignmentForm({
              classId: classes[0]?.id ?? '',
              teacherId: teachers[0]?.id ?? '',
              subjectId: subjects[0]?.id ?? '',
              academicYearId: academicYears[0]?.id ?? '',
            });
            setModal('assignment');
          }}
          disabled={!classes.length || !teachers.length || !subjects.length || !academicYears.length}
          className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-gray-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Assign Teacher
        </button>
      </div>

      {(error || notice) && (
        <div
          role={error ? 'alert' : 'status'}
          className={`rounded-lg border px-4 py-3 text-sm ${
            error
              ? 'border-red-500/30 bg-red-950/30 text-red-200'
              : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'
          }`}
        >
          {error ?? notice}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="pb-3 pr-4 font-medium">Class</th>
              <th className="pb-3 pr-4 font-medium">Code</th>
              <th className="pb-3 pr-4 font-medium">Students</th>
              <th className="pb-3 pr-4 font-medium">Teacher assignments</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {classes.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="py-3 pr-4">
                  <p className="font-medium text-gray-100">{row.name}</p>
                  {row.description && <p className="mt-1 max-w-xs text-xs text-gray-500">{row.description}</p>}
                </td>
                <td className="py-3 pr-4 text-gray-300">{row.code ?? '—'}</td>
                <td className="py-3 pr-4 text-gray-300">{row.activeEnrollmentCount}</td>
                <td className="py-3 pr-4">
                  <ul className="space-y-1">
                    {assignments
                      .filter((assignment) => assignment.class_id === row.id)
                      .map((assignment) => (
                        <li key={assignment.id} className="flex items-start gap-2 text-xs text-gray-300">
                          <span>
                            {assignment.teacher_name} · {assignment.subject_name} ({assignment.academic_year_name})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setDeletingAssignment(assignment);
                            }}
                            className="text-red-300 hover:text-red-200"
                            aria-label={`Remove ${assignment.teacher_name} assignment`}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    {!assignments.some((assignment) => assignment.class_id === row.id) && (
                      <li className="text-xs text-gray-500">No teacher assignment</li>
                    )}
                  </ul>
                </td>
                <td className="py-3 pr-4">
                  <span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs text-gray-200">
                    {row.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => openEditClass(row)} className="text-xs text-cyan-300 hover:text-cyan-200">
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setDeletingClass(row);
                      }}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!classes.length && (
              <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-500">No classes found for this school.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal === 'class' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={submitClass} className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-6">
            <h2 className="text-lg font-semibold text-white">{editingClass ? 'Edit class' : 'Add class'}</h2>
            <label className="block space-y-1 text-sm text-gray-300">Class name<input required maxLength={100} className={fieldClass} value={classForm.name} onChange={(event) => setClassForm({ ...classForm, name: event.target.value })} /></label>
            <label className="block space-y-1 text-sm text-gray-300">Code<input maxLength={50} className={fieldClass} value={classForm.code} onChange={(event) => setClassForm({ ...classForm, code: event.target.value })} /></label>
            <label className="block space-y-1 text-sm text-gray-300">Description<textarea maxLength={2000} className={fieldClass} value={classForm.description} onChange={(event) => setClassForm({ ...classForm, description: event.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={classForm.isActive} onChange={(event) => setClassForm({ ...classForm, isActive: event.target.checked })} /> Active</label>
            {!editingClass && (
              <fieldset className="space-y-3 rounded-xl border border-gray-800 p-4">
                <legend className="px-1 text-sm font-medium text-gray-200">Optional school stream</legend>
                <p className="text-xs text-gray-500">Streams are school-level records and can be selected on student enrollments; the current schema does not link a stream directly to a class.</p>
                <label className="block space-y-1 text-sm text-gray-300">Stream name (optional)<input maxLength={100} className={fieldClass} value={classForm.newStreamName} onChange={(event) => setClassForm({ ...classForm, newStreamName: event.target.value })} /></label>
                {classForm.newStreamName && (
                  <>
                    <label className="block space-y-1 text-sm text-gray-300">Stream code<input maxLength={50} className={fieldClass} value={classForm.newStreamCode} onChange={(event) => setClassForm({ ...classForm, newStreamCode: event.target.value })} /></label>
                    <label className="block space-y-1 text-sm text-gray-300">Stream description<textarea maxLength={1000} className={fieldClass} value={classForm.newStreamDescription} onChange={(event) => setClassForm({ ...classForm, newStreamDescription: event.target.value })} /></label>
                  </>
                )}
              </fieldset>
            )}
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setModal(null)} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950 disabled:opacity-50">{busy ? 'Saving…' : editingClass ? 'Save changes' : 'Create class'}</button>
            </div>
          </form>
        </div>
      )}

      {modal === 'assignment' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={submitAssignment} className="w-full max-w-lg space-y-4 rounded-2xl border border-gray-700 bg-gray-900 p-6">
            <h2 className="text-lg font-semibold text-white">Assign teacher</h2>
            {assignmentFields.map(({ label, key, options }) => (
              <label key={key} className="block space-y-1 text-sm text-gray-300">{label}
                <select
                  required
                  className={fieldClass}
                  value={assignmentForm[key]}
                  onChange={(event) => setAssignmentForm((current) => ({ ...current, [key]: event.target.value }))}
                >
                  {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            ))}
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setModal(null)} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950 disabled:opacity-50">{busy ? 'Assigning…' : 'Assign teacher'}</button>
            </div>
          </form>
        </div>
      )}

      {(deletingClass || deletingAssignment) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md space-y-4 rounded-2xl border border-gray-700 bg-gray-900 p-6">
            <h2 className="text-lg font-semibold text-white">{deletingClass ? 'Delete class?' : 'Remove teacher assignment?'}</h2>
            <p className="text-sm text-gray-400">
              {deletingClass
                ? `Delete ${deletingClass.name}? Classes with linked academic records cannot be deleted.`
                : `Remove ${deletingAssignment?.teacher_name}'s assignment to ${deletingAssignment?.subject_name}?`}
            </p>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => { setDeletingClass(null); setDeletingAssignment(null); }} className={buttonClass}>Cancel</button>
              <button type="button" disabled={busy} onClick={() => void (deletingClass ? confirmDeleteClass() : confirmDeleteAssignment())} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Working…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
