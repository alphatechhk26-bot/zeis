// actions/attendance.ts
'use server';
 import { Database } from '@/types/supabase'; // <--- Add this to your imports at the top

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ----------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------

const attendanceRecordSchema = z.object({
  student_id: z.string().uuid(),
  class_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  term_id: z.string().uuid().optional(),
  attendance_date: z.string().date(),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  check_in_time: z.string().datetime().optional(),
  check_out_time: z.string().datetime().optional(),
  remarks: z.string().optional(),
});

const bulkAttendanceSchema = z.array(attendanceRecordSchema);

const attendanceQuerySchema = z.object({
  student_id: z.string().uuid().optional(),
  class_id: z.string().uuid().optional(),
  academic_year_id: z.string().uuid(),
  term_id: z.string().uuid().optional(),
  from_date: z.string().date().optional(),
  to_date: z.string().date().optional(),
});

// ----------------------------------------------------------------------
// 1. Record daily attendance (bulk insert/upsert)
// ----------------------------------------------------------------------

export async function recordAttendance(input: z.infer<typeof bulkAttendanceSchema>) {
  const validated = bulkAttendanceSchema.parse(input);

  if (validated.length === 0) {
    return { success: true, message: 'No records to process.' };
  }

  const supabase = await createClient();

  // Get the user's school_id from their profile (for RLS compliance)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single();

  if (!profile) throw new Error('Profile not found.');
  const schoolId = profile.school_id;

  // Prepare records with school_id
  const records = validated.map((r) => ({
    ...r,
    school_id: schoolId,
  }));

 
  // ... [keep your existing code above] ...

  // Upsert using ON CONFLICT
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      records as Database['public']['Tables']['attendance']['Insert'][], 
      {
        onConflict: 'student_id, attendance_date, class_id, academic_year_id',
        ignoreDuplicates: false,
      }
    )
    .select();
  revalidatePath('/attendance');
  return { success: true, count: data?.length ?? 0 };
}

// ----------------------------------------------------------------------
// 2. Calculate attendance percentage for a student / class / etc.
// ----------------------------------------------------------------------

export async function getAttendancePercentage(input: z.infer<typeof attendanceQuerySchema>) {
  const { student_id, class_id, academic_year_id, term_id, from_date, to_date } =
    attendanceQuerySchema.parse(input);

  const supabase = await createClient();

  // Build base query
  let query = supabase
    .from('attendance')
    .select('student_id, status', { count: 'exact' })
    .eq('academic_year_id', academic_year_id);

  if (student_id) {
    query = query.eq('student_id', student_id);
  }
  if (class_id) {
    query = query.eq('class_id', class_id);
  }
  if (term_id) {
    query = query.eq('term_id', term_id);
  }
  if (from_date) {
    query = query.gte('attendance_date', from_date);
  }
  if (to_date) {
    query = query.lte('attendance_date', to_date);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch attendance: ${error.message}`);

  if (!data || data.length === 0) {
    return { total: 0, present: 0, absent: 0, late: 0, excused: 0, percentage: 0 };
  }

  const total = data.length;
  const present = data.filter((r) => r.status === 'present').length;
  const absent = data.filter((r) => r.status === 'absent').length;
  const late = data.filter((r) => r.status === 'late').length;
  const excused = data.filter((r) => r.status === 'excused').length;

  // Percentage: present + late? Usually late counts as present but we can define.
  // We'll consider present and late as attending.
  const attended = present + late;
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

  return {
    total,
    present,
    absent,
    late,
    excused,
    percentage,
  };
}

// ----------------------------------------------------------------------
// 3. Class attendance summary (aggregate per student)
// ----------------------------------------------------------------------

export async function getClassAttendanceSummary(input: Omit<z.infer<typeof attendanceQuerySchema>, 'student_id'>) {
  const { class_id, academic_year_id, term_id, from_date, to_date } =
    attendanceQuerySchema.parse({ ...input, student_id: undefined });

  if (!class_id) throw new Error('class_id is required for summary.');

  const supabase = await createClient();

  // Fetch all attendance records for the class
  let query = supabase
    .from('attendance')
    .select('student_id, status')
    .eq('class_id', class_id)
    .eq('academic_year_id', academic_year_id);

  if (term_id) query = query.eq('term_id', term_id);
  if (from_date) query = query.gte('attendance_date', from_date);
  if (to_date) query = query.lte('attendance_date', to_date);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch class attendance: ${error.message}`);

  // Group by student
  const studentMap = new Map<
    string,
    { present: number; absent: number; late: number; excused: number; total: number }
  >();

  for (const record of data || []) {
    if (!studentMap.has(record.student_id)) {
      studentMap.set(record.student_id, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
    }
    const stats = studentMap.get(record.student_id)!;
    stats.total++;
    stats[record.status as keyof typeof stats] = (stats[record.status as keyof typeof stats] || 0) + 1;
  }

  // Compute percentage for each student
  const summary = [];
  for (const [studentId, stats] of studentMap) {
    const attended = stats.present + stats.late;
    const percentage = stats.total > 0 ? Math.round((attended / stats.total) * 100) : 0;
    summary.push({
      student_id: studentId,
      ...stats,
      attended,
      percentage,
    });
  }

  // Sort by percentage descending
  summary.sort((a, b) => b.percentage - a.percentage);

  return summary;
}