// app/dashboard/super-admin/analytics/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AnalyticsDashboard } from "@/components/super-admin/analytics-dashboard";

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const supabase = await createClient();

  // 1. Strict RBAC Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!caller || caller.role !== 'super_admin') {
    redirect('/dashboard');
  }

  // Calculate date 1 year ago
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const dateStr = oneYearAgo.toISOString().split('T')[0];

  // 2. Fetch Active Schools Count
  const { count: activeSchools } = await supabase
    .from('schools')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  // 3. Fetch User Growth (Profiles created in the last year)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', dateStr);

  // 4. Fetch Revenue Data (Payments joined with Schools)
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      amount,
      payment_date,
      school_id,
      schools (name)
    `)
    .gte('payment_date', dateStr);

  // 5. Fetch Daily Activity (Attendance as a proxy for DAU)
  const { data: attendance } = await supabase
    .from('attendance')
    .select('attendance_date, student_id')
    .gte('attendance_date', dateStr);

  // 6. Process and Group Data for Charts
  const growthData: Record<string, number> = {};
  const revenueBySchool: Record<string, number> = {};
  const dauData: Record<string, Set<string>> = {};

  // Process User Growth (Group by Month)
  profiles?.forEach((p) => {
    const month = p.created_at.substring(0, 7); // YYYY-MM
    growthData[month] = (growthData[month] || 0) + 1;
  });

  // Process Revenue (Group by School)
  payments?.forEach((p) => {
    const schoolName = Array.isArray(p.schools) ? p.schools[0]?.name : p.schools?.name;
    if (schoolName) {
      revenueBySchool[schoolName] = (revenueBySchool[schoolName] || 0) + p.amount;
    }
  });

  // Process DAU (Group by Date, unique students)
  attendance?.forEach((a) => {
    const date = a.attendance_date;
    if (!dauData[date]) dauData[date] = new Set();
    dauData[date].add(a.student_id);
  });

  // Format for Recharts
  const formattedGrowth = Object.entries(growthData)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const formattedRevenue = Object.entries(revenueBySchool)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5); // Top 5 revenue generating schools

  const formattedDau = Object.entries(dauData)
    .map(([date, set]) => ({ date, activeUsers: set.size }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Platform Analytics</h2>
        <p className="mt-1 text-sm text-gray-500">
          Global metrics across all schools and users.
        </p>
      </div>

      <AnalyticsDashboard
        activeSchools={activeSchools || 0}
        growthData={formattedGrowth}
        revenueData={formattedRevenue}
        dauData={formattedDau}
      />
    </div>
  );
}