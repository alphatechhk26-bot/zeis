'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ----------------------------------------------------------------------
// Types & Configuration
// ----------------------------------------------------------------------

type GradeScale = {
  letter: string;
  min: number;
  max: number;
  gpa: number;
};

// Standard 10‑point scale (can be customised per school)
const DEFAULT_GRADE_SCALE: GradeScale[] = [
  { letter: 'A', min: 80, max: 100, gpa: 4.0 },
  { letter: 'B', min: 70, max: 79, gpa: 3.0 },
  { letter: 'C', min: 60, max: 69, gpa: 2.0 },
  { letter: 'D', min: 50, max: 59, gpa: 1.0 },
  { letter: 'F', min: 0, max: 49, gpa: 0.0 },
];

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/** Convert numeric marks to grade letter and GPA */
function getGradeAndGPA(marks: number, scale: GradeScale[] = DEFAULT_GRADE_SCALE): { grade: string; gpa: number } {
  for (const level of scale) {
    if (marks >= level.min && marks <= level.max) {
      return { grade: level.letter, gpa: level.gpa };
    }
  }
  return { grade: 'N/A', gpa: 0 };
}

/** Compute subject average from multiple exam results */
function computeSubjectAverage(results: { marks_obtained: number | null }[]): number | null {
  const valid = results.filter(r => r.marks_obtained !== null).map(r => r.marks_obtained as number);
  if (valid.length === 0) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

// ----------------------------------------------------------------------
// Zod Schemas
// ----------------------------------------------------------------------

const submitMarksSchema = z.object({
  exam_id: z.string().uuid(),
  student_id: z.string().uuid(),
  marks_obtained: z.number().min(0).max(100),
});

const submitMarksBatchSchema = z.array(submitMarksSchema);

const computeGpaSchema = z.object({
  student_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  term_id: z.string().uuid().optional(),
});

const classRankingSchema = z.object({
  class_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  term_id: z.string().uuid().optional(),
});

const reportCardSchema = z.object({
  student_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  term_id: z.string().uuid().optional(),
});

// ----------------------------------------------------------------------
// 1. Submit exam marks (batch)
// ----------------------------------------------------------------------

export async function submitExamMarks(input: z.infer<typeof submitMarksBatchSchema>) {
  const validated = submitMarksBatchSchema.parse(input);
  const supabase = (await createClient()) as any;

  const results = [];
  for (const item of validated) {
    const { data: existing } = await supabase
      .from('results')
      .select('id')
      .eq('exam_id', item.exam_id)
      .eq('student_id', item.student_id)
      .single();

    const gradeInfo = getGradeAndGPA(item.marks_obtained);

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('results')
        .update({
          marks_obtained: item.marks_obtained,
          grade: gradeInfo.grade,
          remarks: null,
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update result: ${error.message}`);
      result = data;
    } else {
      const { data: examData } = await supabase
        .from('exams')
        .select('school_id')
        .eq('id', item.exam_id)
        .single();
      if (!examData) throw new Error('Exam not found.');
      
      const { data, error } = await supabase
        .from('results')
        .insert({
          exam_id: item.exam_id,
          student_id: item.student_id,
          school_id: examData.school_id,
          marks_obtained: item.marks_obtained,
          grade: gradeInfo.grade,
          remarks: null,
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to insert result: ${error.message}`);
      result = data;
    }
    results.push(result);
  }

  revalidatePath('/grading/exams');
  return { success: true, data: results };
}

// ----------------------------------------------------------------------
// 2. Calculate individual subject grades for a student
// ----------------------------------------------------------------------

export async function calculateStudentSubjectGrades(
  student_id: string,
  academic_year_id: string,
  term_id?: string
) {
  const supabase = (await createClient()) as any;

  let query = supabase
    .from('results')
    .select(`
      marks_obtained,
      exams!inner (
        id,
        subject_id,
        subjects!inner (name)
      )
    `)
    .eq('student_id', student_id)
    .eq('exams.academic_year_id', academic_year_id);

  if (term_id) {
    query = query.eq('exams.term_id', term_id);
  }

  const { data: results, error } = await query;
  if (error) throw new Error(`Failed to fetch results: ${error.message}`);

  const subjectMap = new Map<
    string,
    { subject_id: string; subject_name: string; marks: number[] }
  >();

  for (const row of (results as any[])) {
    const subjectId = row.exams?.subject_id;
    const subjectName = row.exams?.subjects?.name || 'Unknown Subject';
    if (!subjectId) continue;

    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, { subject_id: subjectId, subject_name: subjectName, marks: [] });
    }
    if (row.marks_obtained !== null && row.marks_obtained !== undefined) {
      subjectMap.get(subjectId)!.marks.push(row.marks_obtained);
    }
  }

  const subjectGrades = [];
  for (const [subjectId, data] of subjectMap) {
    const avg = data.marks.length > 0 ? computeSubjectAverage(data.marks.map(m => ({ marks_obtained: m }))) : null;
    const gradeInfo = avg !== null ? getGradeAndGPA(avg) : { grade: 'N/A', gpa: 0 };
    subjectGrades.push({
      subject_id: subjectId,
      subject_name: data.subject_name,
      average: avg,
      grade: gradeInfo.grade,
      gpa: gradeInfo.gpa,
    });
  }

  return subjectGrades;
}

// ----------------------------------------------------------------------
// 3. Compute GPA for a student
// ----------------------------------------------------------------------

export async function computeStudentGPA(input: z.infer<typeof computeGpaSchema>) {
  const { student_id, academic_year_id, term_id } = computeGpaSchema.parse(input);

  const subjectGrades = await calculateStudentSubjectGrades(student_id, academic_year_id, term_id);

  const validGpas = subjectGrades
    .filter(s => s.gpa > 0)
    .map(s => s.gpa);

  if (validGpas.length === 0) {
    return { gpa: null, subjectCount: 0 };
  }

  const total = validGpas.reduce((a, b) => a + b, 0);
  const gpa = Math.round((total / validGpas.length) * 100) / 100;

  return { gpa, subjectCount: validGpas.length };
}

// ----------------------------------------------------------------------
// 4. Determine class rankings
// ----------------------------------------------------------------------

export async function determineClassRankings(input: z.infer<typeof classRankingSchema>) {
  const { class_id, academic_year_id, term_id } = classRankingSchema.parse(input);
  const supabase = (await createClient()) as any;

  let query = supabase
    .from('student_enrollments')
    .select(`
      student_id,
      students!inner (id, admission_number, profiles!inner (full_name))
    `)
    .eq('class_id', class_id)
    .eq('academic_year_id', academic_year_id)
    .eq('status', 'active');

  if (term_id) {
    query = query.eq('term_id', term_id);
  }

  const { data: enrollments, error } = await query;
  if (error) throw new Error(`Failed to fetch enrollments: ${error.message}`);

  const rankingData: any[] = [];
  for (const enrollment of (enrollments as any[])) {
    const studentId = enrollment.student_id;
    const fullName = enrollment.students?.profiles?.full_name || 'Unknown';
    const admissionNumber = enrollment.students?.admission_number || 'N/A';

    const { gpa } = await computeStudentGPA({
      student_id: studentId,
      academic_year_id,
      term_id,
    });

    rankingData.push({
      student_id: studentId,
      full_name: fullName,
      admission_number: admissionNumber,
      gpa: gpa,
      rank: 0,
    });
  }

  rankingData.sort((a, b) => (b.gpa || 0) - (a.gpa || 0));

  let rank = 1;
  let previousGpa: number | null = null;
  let count = 0;
  for (const item of rankingData) {
    count++;
    if (previousGpa !== null && item.gpa !== previousGpa) {
      rank = count;
    }
    item.rank = rank;
    previousGpa = item.gpa;
  }

  return rankingData;
}

// ----------------------------------------------------------------------
// 5. Generate Report Card
// ----------------------------------------------------------------------

export async function generateReportCard(input: z.infer<typeof reportCardSchema>) {
  const { student_id, academic_year_id, term_id } = reportCardSchema.parse(input);
  const supabase = (await createClient()) as any;

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select(`
      id,
      admission_number,
      enrollment_date,
      profiles!inner (full_name, school_id),
      schools!inner (name)
    `)
    .eq('id', student_id)
    .single();

  if (studentError || !student) {
    throw new Error('Student not found.');
  }

  const subjectGrades = await calculateStudentSubjectGrades(student_id, academic_year_id, term_id);
  const { gpa } = await computeStudentGPA({ student_id, academic_year_id, term_id });

  let classQuery = supabase
    .from('student_enrollments')
    .select('class_id, classes!inner (name)')
    .eq('student_id', student_id)
    .eq('academic_year_id', academic_year_id)
    .eq('status', 'active');

  if (term_id) {
    classQuery = classQuery.eq('term_id', term_id);
  }

  const { data: enrollData } = await classQuery.single();

  let rankData = null;
  if (enrollData) {
    const rankings = await determineClassRankings({
      class_id: enrollData.class_id,
      academic_year_id,
      term_id,
    });
    const found = rankings.find(r => r.student_id === student_id);
    if (found) {
      rankData = {
        rank: found.rank,
        totalStudents: rankings.length,
      };
    }
  }

  const reportCard = {
    student: {
      id: student.id,
      full_name: student.profiles?.full_name,
      admission_number: student.admission_number,
      enrollment_date: student.enrollment_date,
      school: student.schools?.name,
      school_id: student.profiles?.school_id,
    },
    academic_year_id,
    term_id: term_id || null,
    subjects: subjectGrades.map(s => ({
      subject_name: s.subject_name,
      average: s.average,
      grade: s.grade,
      gpa: s.gpa,
    })),
    gpa: gpa,
    rank: rankData,
    generated_at: new Date().toISOString(),
  };

  return reportCard;
}