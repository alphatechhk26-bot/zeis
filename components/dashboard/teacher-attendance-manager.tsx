'use client';

import { useEffect, useMemo, useState } from 'react';
import { getTeacherAttendanceRoster, saveTeacherAttendance } from '@/actions/teacher-workspace';

type AssignmentOption = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  academicYearId: string;
  academicYearName: string;
};

type AttendanceStudent = {
  studentId: string;
  admissionNumber: string | null;
  fullName: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks: string;
};

export function TeacherAttendanceManager({
  assignments,
  initialDate,
}: {
  assignments: AssignmentOption[];
  initialDate: string;
}) {
  const options = useMemo(() => {
    const seen = new Set<string>();
    return assignments.filter((assignment) => {
      const key = `${assignment.classId}:${assignment.academicYearId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [assignments]);
  const [selection, setSelection] = useState(options[0] ? `${options[0].classId}:${options[0].academicYearId}` : '');
  const [attendanceDate, setAttendanceDate] = useState(initialDate);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = options.find((option) => `${option.classId}:${option.academicYearId}` === selection);
  const selectedClassId = selected?.classId;
  const selectedAcademicYearId = selected?.academicYearId;
  const requestKey = `${selectedClassId ?? ''}:${selectedAcademicYearId ?? ''}:${attendanceDate}`;
  const loading = Boolean(selectedClassId && selectedAcademicYearId && attendanceDate && loadedKey !== requestKey);
  useEffect(() => {
    if (!selectedClassId || !selectedAcademicYearId || !attendanceDate) return;
    let active = true;
    getTeacherAttendanceRoster({
      classId: selectedClassId,
      academicYearId: selectedAcademicYearId,
      attendanceDate,
    }).then((rows) => {
      if (active) {
        setStudents(rows);
        setLoadedKey(requestKey);
      }
    }).catch((cause: unknown) => {
      if (active) {
        setStudents([]);
        setError(cause instanceof Error ? cause.message : 'Unable to load the class roster.');
        setLoadedKey(requestKey);
      }
    });
    return () => { active = false; };
  }, [selectedClassId, selectedAcademicYearId, attendanceDate, requestKey]);

  const updateStudent = (studentId: string, updates: Partial<AttendanceStudent>) => {
    setStudents((current) => current.map((student) =>
      student.studentId === studentId ? { ...student, ...updates } : student
    ));
  };

  const save = async () => {
    if (!selected || !students.length) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await saveTeacherAttendance({
        classId: selected.classId,
        academicYearId: selected.academicYearId,
        attendanceDate,
        records: students.map((student) => ({
          studentId: student.studentId,
          status: student.status,
          remarks: student.remarks,
        })),
      });
      setNotice(`Attendance saved for ${result.count} students.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-gray-300">
          Class and academic year
          <select
            value={selection}
            onChange={(event) => { setSelection(event.target.value); setError(null); setNotice(null); }}
            className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100"
          >
            {options.map((option) => (
              <option key={`${option.classId}:${option.academicYearId}`} value={`${option.classId}:${option.academicYearId}`}>
                {option.className} · {option.academicYearName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-300">
          Attendance date
          <input
            type="date"
            value={attendanceDate}
            onChange={(event) => { setAttendanceDate(event.target.value); setError(null); setNotice(null); }}
            className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100"
          />
        </label>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</p>}

      {!options.length ? (
        <p className="rounded-xl border border-dashed border-gray-700 px-5 py-8 text-center text-sm text-gray-400">
          No valid class and subject assignments are available for attendance.
        </p>
      ) : loading ? (
        <p role="status" className="py-8 text-center text-sm text-gray-400">Loading enrolled students…</p>
      ) : !students.length ? (
        <p className="rounded-xl border border-dashed border-gray-700 px-5 py-8 text-center text-sm text-gray-400">
          No actively enrolled students were found for this class and date.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-400">{students.length} actively enrolled students</p>
            <button
              type="button"
              onClick={() => setStudents((current) => current.map((student) => ({ ...student, status: 'present' })))}
              className="text-sm font-medium text-cyan-300 hover:text-cyan-200"
            >
              Mark all present
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-gray-950 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Student</th>
                  <th scope="col" className="px-4 py-3">Admission number</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {students.map((student) => (
                  <tr key={student.studentId}>
                    <td className="px-4 py-3 text-gray-100">{student.fullName}</td>
                    <td className="px-4 py-3 text-gray-300">{student.admissionNumber || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Attendance status for ${student.fullName}`}
                        value={student.status}
                        onChange={(event) => updateStudent(student.studentId, { status: event.target.value as AttendanceStudent['status'] })}
                        className="rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-gray-100"
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                        {student.status === 'excused' && <option value="excused">Excused</option>}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        aria-label={`Remarks for ${student.fullName}`}
                        maxLength={500}
                        value={student.remarks}
                        onChange={(event) => updateStudent(student.studentId, { remarks: event.target.value })}
                        className="w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-gray-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving || loading}
              onClick={save}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save attendance'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
