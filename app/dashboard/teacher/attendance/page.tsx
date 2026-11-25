import { TeacherAttendanceManager } from '@/components/dashboard/teacher-attendance-manager';
import {
  renderTeacherPageSafely,
  TeacherErrorState,
  TeacherPageHeader,
  TeacherPanel,
} from '@/components/dashboard/teacher-ui';
import { getTeacherAssignmentOptions, requireTeacherContext } from '@/lib/teacher-dashboard';

export default async function TeacherAttendancePage() {
  const context = await requireTeacherContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Attendance" description="Record and update daily attendance for your assigned classes." />
        <TeacherErrorState />
      </div>
    );
  }

  return renderTeacherPageSafely('attendance', async () => {
    const assignments = await getTeacherAssignmentOptions(context);
    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Attendance" description="Record and update daily attendance for your assigned classes." />
        <TeacherPanel title="Daily class attendance" description="Students are loaded from active enrollments; existing records are updated instead of duplicated.">
          <TeacherAttendanceManager assignments={assignments} initialDate={new Date().toISOString().slice(0, 10)} />
        </TeacherPanel>
      </div>
    );
  });
}
