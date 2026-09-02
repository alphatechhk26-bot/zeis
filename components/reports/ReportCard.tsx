// components/reports/ReportCard.tsx
'use client';

import { forwardRef } from 'react';

interface SubjectGrade {
  subject_name: string;
  average: number;
  grade: string;
  gpa: number;
}

interface StudentProfile {
  full_name: string;
  admission_number: string;
  school_name: string;
  class_name: string;
  academic_year: string;
  term: string;
}

interface AttendanceSummary {
  percentage: number;
  present: number;
  total: number;
}

interface ReportCardProps {
  student: StudentProfile | null;
  subjects: SubjectGrade[];
  attendance: AttendanceSummary | null;
  overallGPA: number;
  className?: string;
}

const ReportCard = forwardRef<HTMLDivElement, ReportCardProps>(
  ({ student, subjects, attendance, overallGPA, className = '' }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-white text-gray-900 p-8 max-w-4xl mx-auto ${className}`}
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* School header */}
        <div className="flex items-center justify-between border-b-4 border-blue-600 pb-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
              Z
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{student?.school_name || 'ZEIS Academy'}</h1>
              <p className="text-sm text-gray-600">Excellence in Education</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-600">Report Card</div>
            <div className="text-xs text-gray-500">{student?.academic_year || '2025'}</div>
            <div className="text-xs text-gray-500">{student?.term || 'Term 1'}</div>
          </div>
        </div>

        {/* Student info */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <div className="font-semibold text-gray-600">Student Name</div>
            <div className="text-lg font-medium">{student?.full_name || 'N/A'}</div>
          </div>
          <div>
            <div className="font-semibold text-gray-600">Admission No.</div>
            <div>{student?.admission_number || 'N/A'}</div>
          </div>
          <div>
            <div className="font-semibold text-gray-600">Class</div>
            <div>{student?.class_name || 'N/A'}</div>
          </div>
          <div>
            <div className="font-semibold text-gray-600">Attendance</div>
            <div>{attendance?.percentage || 0}%</div>
          </div>
        </div>

        {/* Grade table */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-300 pb-1 mb-3">
            Academic Performance
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left py-2 px-3 font-semibold">Subject</th>
                <th className="text-center py-2 px-3 font-semibold">Average</th>
                <th className="text-center py-2 px-3 font-semibold">Grade</th>
                <th className="text-center py-2 px-3 font-semibold">GPA</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-gray-500">No subjects available</td>
                </tr>
              ) : (
                subjects.map((s, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="py-2 px-3">{s.subject_name}</td>
                    <td className="text-center py-2 px-3">{s.average.toFixed(1)}%</td>
                    <td className="text-center py-2 px-3 font-bold">{s.grade}</td>
                    <td className="text-center py-2 px-3">{s.gpa.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* GPA and summary */}
        <div className="flex flex-wrap justify-between items-center border-t border-gray-300 pt-4">
          <div>
            <div className="text-sm font-semibold text-gray-600">Overall GPA</div>
            <div className="text-2xl font-bold text-blue-600">{overallGPA.toFixed(2)}</div>
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Total Subjects:</span> {subjects.length}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Attendance:</span> {attendance?.percentage || 0}%
          </div>
        </div>

        {/* Teacher comments */}
        <div className="mt-6 border-t border-gray-300 pt-4">
          <h3 className="text-sm font-semibold text-gray-600">Teacher's Comments</h3>
          <p className="text-sm text-gray-700 italic mt-1">
            {student?.full_name} has shown consistent effort this term. Continue to focus on mathematics and science to improve overall performance.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-xs text-gray-500 border-t border-gray-200 pt-4 flex justify-between">
          <span>Generated on {new Date().toLocaleDateString()}</span>
          <span>ZEIS Academy © 2025</span>
        </div>
      </div>
    );
  }
);

ReportCard.displayName = 'ReportCard';

export default ReportCard;