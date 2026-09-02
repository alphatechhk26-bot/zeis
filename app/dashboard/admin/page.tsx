import AdminChart from "./AdminChart";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = await createClient();

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

  // Fee collection data
  const { data: feeData } = await supabase
    .from("payments")
    .select("amount, payment_date")
    .gte("payment_date", new Date(new Date().setDate(new Date().getDate() - 30)).toISOString());

  // Aggregate fee data for chart
  const chartData = feeData
    ? feeData
        .reduce((acc: { date: string; amount: number }[], curr) => {
          const day = curr.payment_date.split("T")[0];
          const existing = acc.find((item) => item.date === day);
          if (existing) existing.amount += curr.amount;
          else acc.push({ date: day, amount: curr.amount });
          return acc;
        }, [])
        .slice(0, 7)
    : [];

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen text-white">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="text-gray-400">Welcome back! Here is your real-time school overview.</p>

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