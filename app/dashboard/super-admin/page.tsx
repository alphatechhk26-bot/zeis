import AdminChart from "@/components/dashboard/AdminChart";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminOverviewGrid } from "@/components/super-admin/super-admin-overview-grid";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { count: activeSchoolCount, error: activeSchoolsError } = await supabase
    .from("schools")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  // Fetch real counts
  const { count: studentCount } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true });

  const { count: teacherCount } = await supabase
    .from("teachers")
    .select("*", { count: "exact", head: true });

  const today = new Date().toISOString().split("T")[0];
  const { count: presentToday } = await supabase
    .from("attendance")
    .select("*", { count: "exact", head: true })
    .eq("attendance_date", today)
    .eq("status", "present");

  // Fee collection data (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: feeData } = await supabase
    .from("payments")
    .select("amount, payment_date")
    .gte("payment_date", thirtyDaysAgo.toISOString())
    .order("payment_date", { ascending: true });

  // Aggregate fee data for chart and ensure chronological sorting
  const aggregatedMap: { [key: string]: number } = {};
  
  feeData?.forEach((curr) => {
    const day = curr.payment_date.split("T")[0];
    aggregatedMap[day] = (aggregatedMap[day] || 0) + curr.amount;
  });

  const chartData = Object.keys(aggregatedMap)
    .sort() // Sort dates chronologically
    .map((date) => ({
      date,
      amount: aggregatedMap[date],
    }))
    .slice(-7); // Take the most recent 7 days

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen text-white">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="text-gray-400">Welcome back! Here is your real-time school overview.</p>

      <SuperAdminOverviewGrid
        activeSchools={activeSchoolCount || 0}
        enrollment={studentCount || 0}
        supabaseOnline={!activeSchoolsError}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-400">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{studentCount || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-400">Total Teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teacherCount || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-400">Present Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{presentToday || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-400">Revenue (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">
              TSh {feeData?.reduce((sum, p) => sum + p.amount, 0).toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Component Chart */}
      <AdminChart chartData={chartData} />
    </div>
  );
}