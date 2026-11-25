'use client';

import { useEffect, useState } from 'react';
import { getTeacherExamRoster, saveTeacherExamResults } from '@/actions/teacher-workspace';

export type TeacherExamOption = {
  id: string;
  name: string;
  className: string;
  subjectName: string;
  examDate: string | null;
  maxMarks: number;
};

type ExamStudent = {
  studentId: string;
  admissionNumber: string | null;
  fullName: string;
  marks: number | null | undefined;
  remarks: string;
};

export function TeacherExamsManager({ exams }: { exams: TeacherExamOption[] }) {
  const [examId, setExamId] = useState(exams[0]?.id ?? '');
  const [students, setStudents] = useState<ExamStudent[]>([]);
  const [maxMarks, setMaxMarks] = useState<number | null>(null);
  const [loadedExamId, setLoadedExamId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loading = Boolean(examId && loadedExamId !== examId);

  useEffect(() => {
    if (!examId) return;
    let active = true;
    getTeacherExamRoster({ examId }).then((result) => {
      if (!active) return;
      setStudents(result.students);
      setMaxMarks(result.maxMarks);
      setLoadedExamId(examId);
    }).catch((cause: unknown) => {
      if (!active) return;
      setStudents([]);
      setError(cause instanceof Error ? cause.message : 'Unable to load exam students.');
      setLoadedExamId(examId);
    });
    return () => { active = false; };
  }, [examId]);

  const updateStudent = (studentId: string, updates: Partial<ExamStudent>) => {
    setStudents((current) => current.map((student) =>
      student.studentId === studentId ? { ...student, ...updates } : student
    ));
  };

  const save = async () => {
    const records = students.flatMap((student) => {
      if (student.marks === null || student.marks === undefined) return [];
      return [{ studentId: student.studentId, marks: Number(student.marks), remarks: student.remarks }];
    });
    if (!records.length) {
      setError('Enter at least one mark before saving.');
      return;
    }
    if (records.some((record) => !Number.isFinite(record.marks) || record.marks < 0 || (maxMarks !== null && record.marks > maxMarks))) {
      setError(`Marks must be between 0 and ${maxMarks ?? 'the exam maximum'}.`);
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await saveTeacherExamResults({ examId, records });
      setNotice(`Marks saved for ${result.count} students.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save marks.');
    } finally {
      setSaving(false);
    }
  };

  const selectedExam = exams.find((exam) => exam.id === examId);
  return (
    <div className="space-y-5">
      {!exams.length ? (
        <p className="rounded-xl border border-dashed border-gray-700 px-5 py-8 text-center text-sm text-gray-400">
          No exams are scheduled for your assigned class and subject combinations.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-gray-950 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Exam</th>
                  <th scope="col" className="px-4 py-3">Class</th>
                  <th scope="col" className="px-4 py-3">Subject</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Maximum marks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {exams.map((exam) => (
                  <tr key={exam.id}>
                    <td className="px-4 py-3 font-medium text-gray-100">{exam.name}</td>
                    <td className="px-4 py-3 text-gray-300">{exam.className}</td>
                    <td className="px-4 py-3 text-gray-300">{exam.subjectName}</td>
                    <td className="px-4 py-3 text-gray-300">{exam.examDate || 'Not scheduled'}</td>
                    <td className="px-4 py-3 text-gray-300">{exam.maxMarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="block max-w-xl text-sm text-gray-300">
            Scheduled exam
            <select
              value={examId}
              onChange={(event) => { setExamId(event.target.value); setError(null); setNotice(null); }}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100"
            >
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} · {exam.className} · {exam.subjectName}
                </option>
              ))}
            </select>
          </label>
          {selectedExam && <p className="text-sm text-gray-400">Maximum marks: {selectedExam.maxMarks}</p>}
          {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
          {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</p>}
          {loading ? (
            <p role="status" className="py-8 text-center text-sm text-gray-400">Loading enrolled students and saved marks…</p>
          ) : !students.length ? (
            <p className="rounded-xl border border-dashed border-gray-700 px-5 py-8 text-center text-sm text-gray-400">
              No actively enrolled students were found for this exam.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-gray-950 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Student</th>
                      <th scope="col" className="px-4 py-3">Admission number</th>
                      <th scope="col" className="px-4 py-3">Marks / {maxMarks}</th>
                      <th scope="col" className="px-4 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {students.map((student) => (
                      <tr key={student.studentId}>
                        <td className="px-4 py-3 text-gray-100">{student.fullName}</td>
                        <td className="px-4 py-3 text-gray-300">{student.admissionNumber || '—'}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            max={maxMarks ?? undefined}
                            step="0.01"
                            value={student.marks ?? ''}
                            onChange={(event) => updateStudent(student.studentId, {
                              marks: event.target.value === '' ? null : Number(event.target.value),
                            })}
                            aria-label={`Marks for ${student.fullName}`}
                            className="w-28 rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-gray-100"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={student.remarks}
                            maxLength={1000}
                            onChange={(event) => updateStudent(student.studentId, { remarks: event.target.value })}
                            aria-label={`Remarks for ${student.fullName}`}
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
                  {saving ? 'Saving…' : 'Save marks'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
