import Link from 'next/link';
import {
  Banknote,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  GraduationCap,
} from 'lucide-react';
import {
  StudentEmptyState,
  StudentPageHeader,
  StudentStatCard,
} from '@/components/dashboard/student-ui';
import { formatStudentCurrency, formatStudentDate, requireStudentContext } from '@/lib/student-dashboard';

export default async function StudentDashboardPage() {
  const { supabase, studentId, profile } = await requireStudentContext();

  const [
    { data: enrollments, error: enrollmentError },
    { data: attendance, error: attendanceError },
    { data: results, error: resultsError },
    { data: invoices, error: invoiceError },
  ] = await Promise.all([
    supabase
      .from('student_enrollments')
      .select('class_id')
      .eq('student_id', studentId)
      .eq('status', 'active'),
    supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentId),
    supabase
      .from('results')
      .select('id')
      .eq('student_id', studentId)
      .eq('is_published', true),
    supabase
      .from('invoices')
      .select('total_amount, amount_paid, status')
      .eq('student_id', studentId),
  ]);

  if (enrollmentError) throw new Error(`Unable to load your classes: ${enrollmentError.message}`);
  if (attendanceError) throw new Error(`Unable to load your attendance: ${attendanceError.message}`);
  if (resultsError) throw new Error(`Unable to load your results: ${resultsError.message}`);
  if (invoiceError) throw new Error(`Unable to load your finance summary: ${invoiceError.message}`);

  const attendanceRecords = attendance ?? [];
  const attendancePercentage = attendanceRecords.length
    ? Math.round(
        (attendanceRecords.filter((record) => record.status === 'present' || record.status === 'late').length /
          attendanceRecords.length) *
          100,
      )
    : 0;
  const outstandingBalance = (invoices ?? []).reduce((sum, invoice) => {
    if (invoice.status === 'cancelled' || invoice.status === 'draft') return sum;
    return sum + Math.max((invoice.total_amount ?? 0) - (invoice.amount_paid ?? 0), 0);
  }, 0);
  const classIds = [...new Set((enrollments ?? []).map((enrollment) => enrollment.class_id))];

  let upcomingExams: {
    id: string;
    name: string;
    exam_date: string | null;
    subject_id: string;
  }[] = [];

  if (classIds.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('exams')
      .select('id, name, exam_date, subject_id')
      .in('class_id', classIds)
      .eq('is_active', true)
      .gte('exam_date', today)
      .order('exam_date', { ascending: true })
      .limit(5);

    if (error) throw new Error(`Unable to load upcoming exams: ${error.message}`);
    upcomingExams = data ?? [];
  }

  const subjectIds = [...new Set(upcomingExams.map((exam) => exam.subject_id))];
  const subjectsById = new Map<string, string>();
  if (subjectIds.length > 0) {
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('id, name')
      .in('id', subjectIds);

    if (error) throw new Error(`Unable to load exam subjects: ${error.message}`);
    for (const subject of subjects ?? []) subjectsById.set(subject.id, subject.name);
  }

  return (
    <div className="space-y-6">
      <StudentPageHeader
        title={`Welcome${profile.full_name ? `, ${profile.full_name}` : ''}`}
        description="Your classes, academic progress, attendance, and school account at a glance."
      />

      <section aria-label="Student summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StudentStatCard
          label="Active classes"
          value={String(classIds.length)}
          detail="Current enrollments"
          icon={BookOpen}
        />
        <StudentStatCard
          label="Attendance"
          value={`${attendancePercentage}%`}
          detail={`${attendanceRecords.length} recorded school days`}
          icon={CalendarDays}
        />
        <StudentStatCard
          label="Published results"
          value={String(results?.length ?? 0)}
          detail="Results available to you"
          icon={ChartNoAxesCombined}
        />
        <StudentStatCard
          label="Outstanding balance"
          value={formatStudentCurrency(outstandingBalance)}
          detail="Based on non-cancelled invoices"
          icon={Banknote}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Upcoming exams</h2>
              <p className="mt-1 text-sm text-gray-400">Active exams in your enrolled classes.</p>
            </div>
            <GraduationCap aria-hidden="true" className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="mt-4">
            {upcomingExams.length === 0 ? (
              <StudentEmptyState
                title="No upcoming exams"
                description="There are no scheduled active exams for your current classes."
              />
            ) : (
              <ul className="divide-y divide-gray-800">
                {upcomingExams.map((exam) => (
                  <li key={exam.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-medium text-gray-100">{exam.name}</p>
                      <p className="mt-1 text-xs text-gray-400">{subjectsById.get(exam.subject_id) ?? 'Subject not specified'}</p>
                    </div>
                    <time className="text-sm text-gray-300">{formatStudentDate(exam.exam_date)}</time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 sm:p-6">
          <h2 className="font-semibold text-white">Student tools</h2>
          <p className="mt-1 text-sm text-gray-400">Quick access to your learning workspace.</p>
          <nav aria-label="Student dashboard shortcuts" className="mt-4 grid gap-2">
            {[
              { href: '/dashboard/student/classes', label: 'My classes', icon: BookOpen },
              { href: '/dashboard/student/assignments', label: 'Assignments', icon: ClipboardList },
              { href: '/dashboard/student/attendance', label: 'Attendance', icon: CalendarDays },
              { href: '/dashboard/student/finance', label: 'Finance', icon: Banknote },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl border border-gray-800 px-3 py-3 text-sm text-gray-200 transition hover:border-cyan-400/40 hover:bg-gray-800/70"
              >
                <Icon aria-hidden="true" className="h-4 w-4 text-cyan-300" />
                {label}
              </Link>
            ))}
          </nav>
          {!profile.school_id && (
            <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200">
              Your school has not been assigned yet. School-specific learning and class data will appear after onboarding.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
