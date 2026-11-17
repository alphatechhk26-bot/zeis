// components/super-admin/analytics-dashboard.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  BuildingOfficeIcon,
  UsersIcon,
  CurrencyDollarIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

interface Props {
  activeSchools: number;
  growthData: { date: string; count: number }[];
  revenueData: { name: string; amount: number }[];
  dauData: { date: string; activeUsers: number }[];
}

type DateRange = '7d' | '30d' | '1y';

export function AnalyticsDashboard({ activeSchools, growthData, revenueData, dauData }: Props) {
  const [range, setRange] = useState<DateRange>('30d');

  // Helper to filter data based on the selected range
  const filterDataByRange = (data: any[], dateKey: string) => {
    const now = new Date();
    const cutoff = new Date();
    
    if (range === '7d') cutoff.setDate(now.getDate() - 7);
    else if (range === '30d') cutoff.setDate(now.getDate() - 30);
    else cutoff.setFullYear(now.getFullYear() - 1);

    const cutoffStr = cutoff.toISOString().split('T')[0];
    const cutoffMonthStr = cutoff.toISOString().substring(0, 7);

    return data.filter((item) => {
      const val = item[dateKey];
      // For monthly data (YYYY-MM), compare first 7 chars
      if (val.length === 7) return val >= cutoffMonthStr;
      // For daily data (YYYY-MM-DD)
      return val >= cutoffStr;
    });
  };

  const filteredGrowth = useMemo(() => filterDataByRange(growthData, 'date'), [growthData, range]);
  const filteredDau = useMemo(() => filterDataByRange(dauData, 'date'), [dauData, range]);

  // Calculate totals for stat cards based on filtered range
  const totalNewUsers = useMemo(() => filteredGrowth.reduce((sum, item) => sum + item.count, 0), [filteredGrowth]);
  const totalRevenue = useMemo(() => revenueData.reduce((sum, item) => sum + item.amount, 0), [revenueData]);
  const avgDau = useMemo(() => {
    if (filteredDau.length === 0) return 0;
    return Math.round(filteredDau.reduce((sum, item) => sum + item.activeUsers, 0) / filteredDau.length);
  }, [filteredDau]);

  const stats = [
    { label: 'Active Schools', value: activeSchools, icon: BuildingOfficeIcon, color: 'text-blue-400' },
    { label: 'New Users (Range)', value: totalNewUsers, icon: UsersIcon, color: 'text-emerald-400' },
    { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: CurrencyDollarIcon, color: 'text-purple-400' },
    { label: 'Avg. Daily Active', value: avgDau, icon: BoltIcon, color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-end">
        <div className="inline-flex bg-gray-900 border border-gray-800 rounded-lg p-1">
          {(['7d', '30d', '1y'] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                range === r
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '1 Year'}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-gray-900/60 rounded-xl border border-gray-800/60 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">{stat.label}</p>
                <p className={`mt-2 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-gray-900/60 rounded-xl border border-gray-800/60 p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">User Growth Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredGrowth}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                  itemStyle={{ color: '#10B981' }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorUsers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Per School Chart */}
        <div className="bg-gray-900/60 rounded-xl border border-gray-800/60 p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Top Schools by Revenue</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" stroke="#9CA3AF" tick={{ fontSize: 11 }} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                  cursor={{ fill: '#374151', opacity: 0.4 }}
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="amount" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DAU Chart */}
        <div className="bg-gray-900/60 rounded-xl border border-gray-800/60 p-5 lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Daily Active Users (DAU)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredDau}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                  itemStyle={{ color: '#3B82F6' }}
                />
                <Line
                  type="monotone"
                  dataKey="activeUsers"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}