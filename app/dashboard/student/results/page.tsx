// app/dashboard/student/results/page.tsx
'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Scatter,
} from 'recharts';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  CalendarIcon,
  CommandLineIcon,
  PrinterIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import ReportCard from '@/components/reports/ReportCard';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
interface SubjectGrade {
  subject_id: string;
  subject_name: string;
  average: number;
  grade: string;
  gpa: number;
  trend: number; // change from previous term
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
  daily: { date: string; status: string }[];
}

interface ExamResult {
  exam_id: string;
  exam_name: string;
  subject: string;
  marks_obtained: number;
  max_marks: number;
  grade: string;
  exam_date: string;
}

interface StudentProfile {
  id: string;
  full_name: string;
  admission_number: string;
  school_name: string;
  class_name: string;
  academic_year: string;
  term: string;
}

// --------------------------------------------------------------------------
// CLI Command System
// --------------------------------------------------------------------------
type CommandResult = {
  type: 'table' | 'message' | 'chart';
  data: any;
  message?: string;
};

const COMMAND_REGISTRY: Record<string, (args: string[], data: any) => CommandResult> = {
  'show': (args, data) => {
    if (args[0] === 'subjects') {
      return { type: 'table', data: data.subjects };
    }
    if (args[0] === 'attendance') {
      return { type: 'table', data: data.attendance.daily.slice(0, 10) };
    }
    if (args[0] === 'exams') {
      return { type: 'table', data: data.exams };
    }
    return { type: 'message', data: null, message: 'Available: subjects, attendance, exams' };
  },
  'grade': (args, data) => {
    const subject = args[0];
    if (!subject) return { type: 'message', data: null, message: 'Usage: grade <subject_name>' };
    const found = data.subjects.find((s: any) => s.subject_name.toLowerCase().includes(subject.toLowerCase()));
    if (found) {
      return { type: 'message', data: null, message: `${found.subject_name}: ${found.grade} (${found.average}%)` };
    }
    return { type: 'message', data: null, message: 'Subject not found.' };
  },
  'help': (args, data) => {
    return {
      type: 'message',
      data: null,
      message: 'Commands: show subjects|attendance|exams, grade <subject>, help, clear'
    };
  },
};

// --------------------------------------------------------------------------
// Main Component
// --------------------------------------------------------------------------
export default function StudentResultsPage() {
  const router = useRouter();

  // State
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [subjects, setSubjects] = useState<SubjectGrade[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [exams, setExams] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedTerm, setSelectedTerm] = useState('current');
  const [showReportCard, setShowReportCard] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // CLI state
  const [cliHistory, setCliHistory] = useState<{ input: string; output: CommandResult }[]>([]);
  const [cliInput, setCliInput] = useState('');
  const [cliOpen, setCliOpen] = useState(false);
  const cliInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setUser(user);

        // Fetch profile with class and school
       const { data: rawProfile, error: profileError } = await supabase
  .from('profiles')
  .select(`
    id, full_name, school_id,
    students!inner (
      admission_number,
      school_id,
      student_enrollments (
        class_id,
        academic_year_id,
        classes (name),
        academic_years (name)
      )
    )
  `)
  .eq('id', user.id)
  .single();

if (profileError || !rawProfile) throw new Error('Profile not found');

// Explicitly type profileData as any to bypass Supabase join inferencing
const profileData = rawProfile as any;
const studentObj = Array.isArray(profileData.students) ? profileData.students[0] : profileData.students;
const enrollments = studentObj?.student_enrollments || [];
const enroll = Array.isArray(enrollments) ? enrollments[0] : enrollments;

const studentProfile: StudentProfile = {
  id: profileData.id,
  full_name: profileData.full_name || 'Student',
  admission_number: studentObj?.admission_number || 'N/A',
  school_name: 'School information unavailable',
  class_name: enroll?.classes?.name || 'N/A',
  academic_year: enroll?.academic_years?.name || 'N/A',
  term: 'Term information unavailable',
};
        setProfile(studentProfile);

        // Fetch results/subject grades
        // For a real app, compute from results table; we'll simulate using a view or aggregation.
        // Here we fetch all results and compute averages per subject.
        const { data: resultsData, error: resultsError } = await supabase
  .from('results')
  .select(`
    marks_obtained,
    exams!inner (
      id, name, subject_id,
      subjects (name),
      academic_year_id,
      term_id
    )
  `)
  .eq('student_id', user.id);

if (resultsError) throw resultsError;

const results = (resultsData || []) as any[];
const subjectMap = new Map<string, { name: string; marks: number[] }>();

for (const r of results) {
  const exam = Array.isArray(r.exams) ? r.exams[0] : r.exams;
  if (!exam) continue;

  const subjectId = exam.subject_id;
  const subjectName = Array.isArray(exam.subjects) ? exam.subjects[0]?.name : exam.subjects?.name;

  if (!subjectMap.has(subjectId)) {
    subjectMap.set(subjectId, {
      name: subjectName || 'Unknown',
      marks: [],
    });
  }
  if (r.marks_obtained !== null && r.marks_obtained !== undefined) {
    subjectMap.get(subjectId)!.marks.push(Number(r.marks_obtained));
  }
}
        const subjectGrades: SubjectGrade[] = [];
        for (const [id, data] of subjectMap) {
          const avg = data.marks.length > 0
            ? Math.round(data.marks.reduce((a, b) => a + b, 0) / data.marks.length * 100) / 100
            : 0;
          const grade = avg >= 80 ? 'A' : avg >= 70 ? 'B' : avg >= 60 ? 'C' : avg >= 50 ? 'D' : 'F';
          const gpa = avg >= 80 ? 4 : avg >= 70 ? 3 : avg >= 60 ? 2 : avg >= 50 ? 1 : 0;
          subjectGrades.push({
            subject_id: id,
            subject_name: data.name,
            average: avg,
            grade,
            gpa,
            trend: 0, // would require previous term data
          });
        }
        setSubjects(subjectGrades);

        // Fetch attendance summary
        const { data: attendanceData, error: attError } = await supabase
  .from('attendance')
  .select('attendance_date, status')
  .eq('student_id', user.id)
  .order('attendance_date', { ascending: true });

if (!attError && attendanceData) {
  const records = attendanceData as any[];
  const total = records.length;
  const present = records.filter(a => a.status === 'present').length;
  const absent = records.filter(a => a.status === 'absent').length;
  const late = records.filter(a => a.status === 'late').length;
  const excused = records.filter(a => a.status === 'excused').length;
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  setAttendance({
    total,
    present,
    absent,
    late,
    excused,
    percentage,
    daily: records.map(a => ({ date: a.attendance_date, status: a.status })),
  });
}

        // Fetch exam results (list)
        const { data: examResults, error: examError } = await supabase
          .from('results')
          .select(`
            marks_obtained,
            exams!inner (
              id, name, exam_date, max_marks,
              subjects (name)
            )
          `)
          .eq('student_id', user.id)
          .order('exams.exam_date', { ascending: true });

        if (!examError && examResults) {
  const rawList = examResults as any[];
  const formatted: ExamResult[] = rawList.map(r => {
    const exam = Array.isArray(r.exams) ? r.exams[0] : r.exams;
    const subjectName = Array.isArray(exam?.subjects) ? exam?.subjects[0]?.name : exam?.subjects?.name;
    const marksObtained = Number(r.marks_obtained) || 0;
    const maxMarks = Number(exam?.max_marks) || 100;

    return {
      exam_id: exam?.id || '',
      exam_name: exam?.name || 'Exam',
      subject: subjectName || 'Unknown',
      marks_obtained: marksObtained,
      max_marks: maxMarks,
      grade: '',
      exam_date: exam?.exam_date || new Date().toISOString(),
    };
  });

  formatted.forEach(e => {
    const pct = (e.marks_obtained / e.max_marks) * 100;
    e.grade = pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
  });

  setExams(formatted);
}
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  // Compute GPA
  const overallGPA = useMemo(() => {
    if (subjects.length === 0) return 0;
    const total = subjects.reduce((sum, s) => sum + s.gpa, 0);
    return Math.round((total / subjects.length) * 100) / 100;
  }, [subjects]);

  // Prepare performance matrix (risk vs opportunity)
  const performanceMatrix = useMemo(() => {
    // 2x2 grid: low risk & high opportunity = "Star", etc.
    const result: any = {
      star: { count: 0, subjects: [] },
      highRisk: { count: 0, subjects: [] },
      lowOpportunity: { count: 0, subjects: [] },
      moderate: { count: 0, subjects: [] },
    };
    subjects.forEach(s => {
      const isHigh = s.average >= 70;
      const isImproving = s.trend > 0; // we don't have trend, so simulate with grade maybe
      if (isHigh && isImproving) {
        result.star.count++;
        result.star.subjects.push(s.subject_name);
      } else if (!isHigh && isImproving) {
        result.highRisk.count++;
        result.highRisk.subjects.push(s.subject_name);
      } else if (isHigh && !isImproving) {
        result.lowOpportunity.count++;
        result.lowOpportunity.subjects.push(s.subject_name);
      } else {
        result.moderate.count++;
        result.moderate.subjects.push(s.subject_name);
      }
    });
    return result;
  }, [subjects]);

  // Attendance pulse chart data (daily)
  const attendanceChartData = useMemo(() => {
    if (!attendance) return [];
    const daily = attendance.daily.slice(-30); // last 30 days
    return daily.map(d => ({
      date: d.date,
      present: d.status === 'present' ? 1 : 0,
      absent: d.status === 'absent' ? 1 : 0,
      late: d.status === 'late' ? 1 : 0,
      excused: d.status === 'excused' ? 1 : 0,
    }));
  }, [attendance]);

  // Subject trend chart (using exam results)
  const subjectTrendData = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    exams.forEach(e => {
      if (!grouped[e.subject]) grouped[e.subject] = [];
      grouped[e.subject].push({
        exam: e.exam_name,
        score: e.marks_obtained,
        max: e.max_marks,
        date: e.exam_date,
      });
    });
    // Return for line chart: each subject as a line; but we need x-axis as exam sequence
    const allExams = [...new Set(exams.map(e => e.exam_name))];
    const data: any[] = allExams.map(exam => {
      const row: any = { exam };
      for (const [subject, scores] of Object.entries(grouped)) {
        const found = scores.find(s => s.exam === exam);
        row[subject] = found ? (found.score / found.max * 100) : null;
      }
      return row;
    });
    return data;
  }, [exams]);

  // Command execution
  const executeCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    const parts = trimmed.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    const data = { subjects, attendance, exams };
    let result: CommandResult;
    if (command === 'clear') {
      setCliHistory([]);
      return;
    }
    if (COMMAND_REGISTRY[command]) {
      result = COMMAND_REGISTRY[command](args, data);
    } else {
      result = { type: 'message', data: null, message: `Unknown command: ${command}. Type 'help' for available commands.` };
    }
    setCliHistory(prev => [...prev, { input: trimmed, output: result }]);
  }, [subjects, attendance, exams]);

  // Handle CLI keydown
  const handleCliKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(cliInput);
      setCliInput('');
    }
  };

  // Toggle CLI
  const toggleCli = () => {
    setCliOpen(!cliOpen);
    if (!cliOpen) {
      setTimeout(() => cliInputRef.current?.focus(), 100);
    }
  };

  // Print report card
  const handlePrint = () => {
    setShowReportCard(true);
    // Delay print after render
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // If loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading your results...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-6 space-y-6 relative">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Academic Performance</h1>
          <p className="text-gray-400 text-sm">
            {profile?.full_name} • {profile?.class_name} • {profile?.academic_year}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleCli}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-md text-sm flex items-center space-x-1 border border-gray-700"
          >
            <CommandLineIcon className="h-4 w-4" />
            <span>CLI</span>
            <kbd className="ml-1 text-xs px-1 bg-gray-700 rounded">`</kbd>
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-sm text-white flex items-center space-x-1"
          >
            <PrinterIcon className="h-4 w-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* GPA & Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-800/50">
          <div className="text-sm text-gray-400">Overall GPA</div>
          <div className="text-3xl font-bold text-blue-400">{overallGPA.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">Based on {subjects.length} subjects</div>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-800/50">
          <div className="text-sm text-gray-400">Attendance</div>
          <div className="text-3xl font-bold text-green-400">{attendance?.percentage || 0}%</div>
          <div className="text-xs text-gray-500 mt-1">{attendance?.present}/{attendance?.total} days present</div>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-800/50">
          <div className="text-sm text-gray-400">Exams Taken</div>
          <div className="text-3xl font-bold text-purple-400">{exams.length}</div>
          <div className="text-xs text-gray-500 mt-1">Across all subjects</div>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-800/50">
          <div className="text-sm text-gray-400">Class Rank</div>
          <div className="text-3xl font-bold text-yellow-400">—</div>
          <div className="text-xs text-gray-500 mt-1">Class ranking is not available</div>
        </div>
      </div>

      {/* Performance Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900/60 rounded-lg p-4 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-blue-400">Stars</h3>
            <span className="text-2xl font-bold text-blue-400">{performanceMatrix.star.count}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1 truncate">{performanceMatrix.star.subjects.join(', ') || 'None'}</div>
          <p className="text-xs text-gray-500 mt-2">High performance, improving</p>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-4 border border-orange-500/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-orange-400">Risk</h3>
            <span className="text-2xl font-bold text-orange-400">{performanceMatrix.highRisk.count}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1 truncate">{performanceMatrix.highRisk.subjects.join(', ') || 'None'}</div>
          <p className="text-xs text-gray-500 mt-2">Low scores but improving</p>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-4 border border-purple-500/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-purple-400">Opportunity</h3>
            <span className="text-2xl font-bold text-purple-400">{performanceMatrix.lowOpportunity.count}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1 truncate">{performanceMatrix.lowOpportunity.subjects.join(', ') || 'None'}</div>
          <p className="text-xs text-gray-500 mt-2">High scores, not improving</p>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-500/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">Moderate</h3>
            <span className="text-2xl font-bold text-gray-400">{performanceMatrix.moderate.count}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1 truncate">{performanceMatrix.moderate.subjects.join(', ') || 'None'}</div>
          <p className="text-xs text-gray-500 mt-2">Average performance</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject trends */}
        <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-800/50">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
            <ChartBarIcon className="h-4 w-4 mr-2 text-blue-400" />
            Subject Performance Trends
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={subjectTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="exam" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                <YAxis stroke="#9CA3AF" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151' }}
                  labelStyle={{ color: '#E5E7EB' }}
                />
                <Legend />
                {Object.keys(subjectTrendData[0] || {})
                  .filter(k => k !== 'exam')
                  .map((subject, idx) => (
                    <Line
                      key={subject}
                      type="monotone"
                      dataKey={subject}
                      stroke={`hsl(${(idx * 60) % 360}, 70%, 60%)`}
                      strokeWidth={2}
                      connectNulls
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance pulse */}
        <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-800/50">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
            <CalendarIcon className="h-4 w-4 mr-2 text-green-400" />
            Attendance Pulse (Last 30 Days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 8 }} />
                <YAxis stroke="#9CA3AF" domain={[0, 1]} tick={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151' }}
                  labelStyle={{ color: '#E5E7EB' }}
                />
                <Legend />
                <Bar dataKey="present" stackId="a" fill="#10B981" />
                <Bar dataKey="late" stackId="a" fill="#F59E0B" />
                <Bar dataKey="absent" stackId="a" fill="#EF4444" />
                <Bar dataKey="excused" stackId="a" fill="#8B5CF6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* CLI Panel */}
      <AnimatePresence>
        {cliOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-gray-900/95 border border-gray-700 rounded-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700">
              <span className="text-xs text-gray-400 font-mono">Command Line Interface</span>
              <button onClick={() => setCliOpen(false)} className="text-gray-500 hover:text-white">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 max-h-48 overflow-y-auto font-mono text-sm space-y-1">
              {cliHistory.map((entry, idx) => (
                <div key={idx}>
                  <div className="text-blue-400">$ {entry.input}</div>
                  {entry.output.type === 'message' && (
                    <div className="text-gray-300 pl-4">{entry.output.message}</div>
                  )}
                  {entry.output.type === 'table' && entry.output.data && (
                    <div className="pl-4 text-gray-300 overflow-x-auto">
                      <pre className="text-xs">{JSON.stringify(entry.output.data, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex items-center">
                <span className="text-blue-400">$</span>
                <input
                  ref={cliInputRef}
                  type="text"
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  onKeyDown={handleCliKeyDown}
                  className="flex-1 bg-transparent border-none outline-none text-gray-200 ml-2"
                  placeholder="Type a command..."
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Card Modal (for print) */}
      {showReportCard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 print:bg-white print:relative print:inset-auto print:block" style={{ display: isPrinting ? 'block' : 'flex' }}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none relative">
            <button
              onClick={() => setShowReportCard(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 print:hidden z-10"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <ReportCard
              student={profile}
              subjects={subjects}
              attendance={attendance}
              overallGPA={overallGPA}
              className="print:m-0 print:p-8"
            />
          </div>
        </div>
      )}
    </div>
  );
}