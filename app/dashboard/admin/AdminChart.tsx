"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface AdminChartProps {
  chartData: { date: string; amount: number }[];
}

export default function AdminChart({ chartData }: AdminChartProps) {
  return (
    <Card className="bg-gray-900 border-gray-800 p-4">
      <CardHeader>
        <CardTitle className="text-gray-400">Fee Collection (Last 7 Days)</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData || []}>
            <XAxis dataKey="date" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "none" }} />
            <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}