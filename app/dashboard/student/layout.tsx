import { requireStudentContext } from '@/lib/student-dashboard';

export default async function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStudentContext();
  return children;
}
