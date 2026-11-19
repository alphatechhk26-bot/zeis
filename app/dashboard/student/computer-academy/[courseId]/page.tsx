// app/dashboard/student/computer-academy/[courseId]/page.tsx
'use client';
import { useAIContext } from '@/contexts/AIContext';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
  CheckCircleIcon,
  ClockIcon,
  CodeBracketIcon,
  AcademicCapIcon,
  SparklesIcon,
  XMarkIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { Editor } from '@monaco-editor/react'; // You can replace with react-simple-code-editor if you want fewer dependencies
import { useDebounce } from 'use-debounce';
import ReactMarkdown from 'react-markdown';

type Course = Database['public']['Tables']['computer_courses']['Row'];
type Lesson = Database['public']['Tables']['computer_lessons']['Row'];
type Progress = Database['public']['Tables']['computer_progress']['Row'];
type Quiz = Database['public']['Tables']['quizzes']['Row'] & {
  quiz_questions: Database['public']['Tables']['quiz_questions']['Row'][];
};
type QuizAttempt = Database['public']['Tables']['quiz_attempts']['Row'];

// --------------------------------------------------------------------------
// Main Component
// --------------------------------------------------------------------------
export default function ComputerCoursePage() {
  const params = useParams();
  const courseId = params.courseId as string;

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  // State
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAttempt, setQuizAttempt] = useState<QuizAttempt | null>(null);
  const [quizResponses, setQuizResponses] = useState<Record<string, string>>({});
  const [code, setCode] = useState('// Write your code here');
  const [codeOutput, setCodeOutput] = useState('');
  const [isRunningCode, setIsRunningCode] = useState(false);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();
        supabaseRef.current = supabase;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUser(user);

        // Fetch course
        const { data: courseData, error: courseError } = await supabase
          .from('computer_courses')
          .select('*')
          .eq('id', courseId)
          .single();
        if (courseError) throw courseError;
        setCourse(courseData);

        // Fetch lessons
        const { data: lessonsData, error: lessonsError } = await supabase
          .from('computer_lessons')
          .select('*')
          .eq('computer_course_id', courseId)
          .order('order_index', { ascending: true });
        if (lessonsError) throw lessonsError;
        setLessons(lessonsData);
        if (lessonsData.length > 0) setSelectedLesson(lessonsData[0]);

        // Fetch progress
        const { data: progressData, error: progressError } = await supabase
          .from('computer_progress')
          .select('*')
          .eq('student_id', user.id)
         lessonsData.map((l: any) => l.id)
        if (progressError) throw progressError;
        setProgress(progressData || []);

        // Fetch quizzes (could be per lesson or per course; we'll fetch all for course)
        const { data: quizzesData, error: quizzesError } = await supabase
          .from('quizzes')
          .select(`
            *,
            quiz_questions (*)
          `)
          .eq('course_id', courseId);
        if (quizzesError) throw quizzesError;
        setQuizzes(quizzesData || []);

        // Fetch quiz attempts for user
        if (quizzesData && quizzesData.length > 0) {
          const { data: attempts } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('student_id', user.id)
            .in('quiz_id', quizzesData.map((q: any) => q.id))
            .order('created_at', { ascending: false });
          // We could store attempts but we'll just use for quiz status.
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [courseId]);

  // Compute progress percentage
  const progressPercentage = useMemo(() => {
    if (lessons.length === 0) return 0;
    const completed = lessons.filter(l =>
      progress.some(p => p.lesson_id === l.id && p.completed)
    ).length;
    return Math.round((completed / lessons.length) * 100);
  }, [lessons, progress]);

  // Toggle lesson completion
  const toggleLessonComplete = useCallback(async (lessonId: string) => {
    const supabase = supabaseRef.current;
    if (!user || !supabase) return;
    const existing = progress.find(p => p.lesson_id === lessonId);
    const completed = existing ? !existing.completed : true;

    const { data, error } = await supabase
      .from('computer_progress')
      .upsert({
        student_id: user.id,
        lesson_id: lessonId,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      } as any)
      .select()
      .single();
    if (error) {
      console.error('Failed to update progress:', error);
      return;
    }
    setProgress(prev => {
      const filtered = prev.filter(p => p.lesson_id !== lessonId);
      if (completed) {
        return [...filtered, data];
      }
      return filtered;
    });
  }, [user]);

  // Run code (simplified JavaScript sandbox)
  const runCode = useCallback(() => {
    setIsRunningCode(true);
    setCodeOutput('');
    try {
      // Use a sandbox: Function constructor with a catch for safety
      const result = new Function(code)();
      setCodeOutput(String(result));
    } catch (err: any) {
      setCodeOutput(`Error: ${err.message}`);
    } finally {
      setIsRunningCode(false);
    }
  }, [code]);

  // Quiz submission handler
  // Quiz submission handler
  const submitQuiz = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!user || !selectedLesson || !supabase) return;
    // Find quiz for this lesson (if any)
    const quiz: any = quizzes.find((q: any) => q.lesson_id === selectedLesson.id);
    if (!quiz) return;

    // Insert attempt
    const { data: attempt, error: attemptError }: any = await (supabase as any)
      .from('quiz_attempts')
      .insert({
        quiz_id: quiz.id,
        student_id: user.id,
        start_time: new Date().toISOString(),
        status: 'completed',
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Failed to create attempt:', attemptError);
      return;
    }

    // Save responses
    const responses: any[] = [];
    for (const q of (quiz.quiz_questions || [])) {
      const selected = quizResponses[q.id];
      if (selected !== undefined) {
        responses.push({
          attempt_id: attempt?.id,
          question_id: q.id,
          selected_option: selected,
        });
      }
    }

    if (responses.length > 0) {
      const { error: respError } = await (supabase as any)
        .from('quiz_responses')
        .insert(responses);
      if (respError) console.error('Failed to save responses:', respError);
    }

    // Auto-grade (simple: compare selected with correct_answer)
    let score = 0;
    let totalMarks = 0;
    for (const q of (quiz.quiz_questions || [])) {
      const selected = quizResponses[q.id];
      totalMarks += q.marks || 1;
      if (selected === q.correct_answer) {
        score += q.marks || 1;
      }
    }

    const scorePercent = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    await (supabase as any)
      .from('quiz_attempts')
      .update({
        score: scorePercent,
        end_time: new Date().toISOString(),
      })
      .eq('id', attempt?.id);

    // Show feedback (could set a state)
    alert(`Quiz submitted! Your score: ${scorePercent}%`);
    setShowQuiz(false);
  }, [user, selectedLesson, quizzes, quizResponses]);

  // Render
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center space-y-4">
          <div className="h-8 w-32 bg-gray-700 rounded"></div>
          <div className="h-4 w-64 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Course not found.
      </div>
    );
  }

  // Find quiz for selected lesson
  const currentQuiz = selectedLesson
    ? quizzes.find(q => q.lesson_id === selectedLesson.id)
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col">
      {/* Header */}
      <header className="h-16 bg-gray-900/80 backdrop-blur-md border-b border-gray-800/50 flex items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileSidebarOpen(!mobileSidebarOpen);
              } else {
                setSidebarOpen(!sidebarOpen);
              }
            }}
            className="p-2 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-white truncate">{course.name}</h1>
          <span className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 rounded-full uppercase">
            {course.level}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          {/* Progress gauge */}
          <div className="relative w-10 h-10">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15.915"
                fill="none"
                stroke="#1f2937"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15.915"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeDasharray={`${progressPercentage} 100`}
                strokeLinecap="round"
                className="transition-all duration-500"
                style={{ filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.5))' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
              {progressPercentage}%
            </span>
          </div>
          <button className="p-2 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white">
            <SparklesIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar (retractable) */}
        <AnimatePresence>
          {(sidebarOpen || mobileSidebarOpen) && (
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ duration: 0.3 }}
              className={`fixed lg:relative top-16 lg:top-0 left-0 h-[calc(100vh-4rem)] lg:h-full w-80 bg-gray-900 border-r border-gray-800 overflow-y-auto z-40 ${
                mobileSidebarOpen ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="p-4 space-y-2">
                {lessons.map((lesson, idx) => {
                  const isCompleted = progress.some(p => p.lesson_id === lesson.id && p.completed);
                  const isActive = selectedLesson?.id === lesson.id;
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => {
                        setSelectedLesson(lesson);
                        setShowQuiz(false);
                        if (mobileSidebarOpen) setMobileSidebarOpen(false);
                      }}
                      className={`
                        w-full flex items-center space-x-3 px-3 py-2.5 rounded-md transition-colors text-left
                        ${isActive
                          ? 'bg-blue-600/20 text-blue-400'
                          : 'hover:bg-gray-800 text-gray-300'
                        }
                      `}
                    >
                      <span className="text-sm font-medium text-gray-500 w-6">
                        {idx + 1}.
                      </span>
                      <span className="flex-1 text-sm truncate">{lesson.title}</span>
                      {isCompleted ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-400 flex-shrink-0" />
                      ) : (
                        <ClockIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {selectedLesson ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedLesson.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                {/* Lesson header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedLesson.title}</h2>
                    <div className="flex items-center space-x-2 mt-1">
                      <button
                        onClick={() => toggleLessonComplete(selectedLesson.id)}
                        className={`text-sm px-3 py-1 rounded-md transition-colors flex items-center space-x-1 ${
                          progress.some(p => p.lesson_id === selectedLesson.id && p.completed)
                            ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>
                          {progress.some(p => p.lesson_id === selectedLesson.id && p.completed)
                            ? 'Completed'
                            : 'Mark Complete'}
                        </span>
                      </button>
                      {currentQuiz && (
                        <button
                          onClick={() => setShowQuiz(!showQuiz)}
                          className="text-sm px-3 py-1 bg-purple-600/20 text-purple-400 rounded-md hover:bg-purple-600/30 flex items-center space-x-1"
                        >
                          <AcademicCapIcon className="h-4 w-4" />
                          <span>Quiz</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedLesson.video_url && (
                    <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-full flex items-center space-x-1">
                      <PlayIcon className="h-3 w-3" />
                      <span>Video</span>
                    </span>
                  )}
                </div>

                {/* Lesson content */}
                <div className="prose prose-invert max-w-none">
                  {selectedLesson.content ? (
                    <ReactMarkdown>{selectedLesson.content}</ReactMarkdown>
                  ) : (
                    <p className="text-gray-500 italic">No content provided.</p>
                  )}
                </div>

                {/* Code Editor (if lesson has code) */}
                {selectedLesson.content?.includes('```') && (
                  <div className="border border-gray-700 rounded-md overflow-hidden bg-gray-900/50">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700">
                      <div className="flex items-center space-x-2">
                        <CodeBracketIcon className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-mono text-gray-300">Live Editor</span>
                      </div>
                      <button
                        onClick={runCode}
                        disabled={isRunningCode}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md text-sm text-white flex items-center space-x-1"
                      >
                        <PlayIcon className="h-4 w-4" />
                        <span>Run</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-700">
                      <div className="h-64">
                        <Editor
                          height="100%"
                          defaultLanguage="javascript"
                          defaultValue={code}
                          theme="vs-dark"
                          onChange={(value) => setCode(value || '')}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: 'on',
                          }}
                        />
                      </div>
                      <div className="h-64 p-3 font-mono text-sm overflow-auto bg-gray-950/50">
                        {isRunningCode ? (
                          <span className="text-gray-500">Running...</span>
                        ) : codeOutput ? (
                          <pre className="text-green-400">{codeOutput}</pre>
                        ) : (
                          <span className="text-gray-500">Output will appear here</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Quiz widget */}
                {showQuiz && currentQuiz && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="border border-purple-700 rounded-md bg-gray-900/80 p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                        <AcademicCapIcon className="h-5 w-5 text-purple-400" />
                        <span>Quiz</span>
                      </h3>
                      <button onClick={() => setShowQuiz(false)} className="text-gray-400 hover:text-white">
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      {(currentQuiz.quiz_questions || []).map((q, idx) => (
                        <div key={q.id} className="space-y-2">
                          <p className="text-sm font-medium text-gray-300">
                            {idx + 1}. {q.question_text}
                          </p>
                          {q.options && typeof q.options === 'object' && !Array.isArray(q.options) ? (
                            <div className="space-y-1 ml-4">
                              {Object.entries(q.options).map(([key, value]) => (
                                <label key={key} className="flex items-center space-x-2 text-sm">
                                  <input
                                    type="radio"
                                    name={`q-${q.id}`}
                                    value={key}
                                    checked={quizResponses[q.id] === key}
                                    onChange={(e) =>
                                      setQuizResponses(prev => ({
                                        ...prev,
                                        [q.id]: e.target.value,
                                      }))
                                    }
                                    className="accent-purple-500"
                                  />
                                  <span className="text-gray-400">{key}. {String(value)}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <input
                              type="text"
                              placeholder="Your answer"
                              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-200"
                              onChange={(e) =>
                                setQuizResponses(prev => ({
                                  ...prev,
                                  [q.id]: e.target.value,
                                }))
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={submitQuiz}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-white text-sm font-medium"
                    >
                      Submit Quiz
                    </button>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="text-center text-gray-500 mt-20">
              Select a lesson from the sidebar to begin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}