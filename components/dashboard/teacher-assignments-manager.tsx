'use client';

import { FormEvent, useState } from 'react';
import {
  createTeacherAssignment,
  createTeacherQuiz,
  gradeTeacherSubmission,
} from '@/actions/teacher-workspace';

type CourseOption = { id: string; name: string };
type SubmissionRow = {
  id: string;
  studentName: string;
  admissionNumber: string | null;
  submissionText: string | null;
  fileUrls: string[] | null;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
};
type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  maxScore: number;
  isPublished: boolean | null;
  courseName: string;
  submissions: SubmissionRow[];
};
type QuizRow = { id: string; title: string; courseName: string; isPublished: boolean | null };
type QuestionDraft = {
  questionText: string;
  questionType: 'multiple_choice' | 'true_false' | 'short_answer';
  options: string;
  correctAnswer: string;
  marks: string;
};

function secureFileUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const EMPTY_QUESTION: QuestionDraft = {
  questionText: '',
  questionType: 'multiple_choice',
  options: '',
  correctAnswer: '',
  marks: '1',
};

function SubmissionReview({ submission, maxScore }: { submission: SubmissionRow; maxScore: number }) {
  const [grade, setGrade] = useState(submission.grade?.toString() ?? '');
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const parsedGrade = Number(grade);
    if (!grade || !Number.isFinite(parsedGrade) || parsedGrade < 0 || parsedGrade > maxScore) {
      setError(`Enter a grade between 0 and ${maxScore}.`);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await gradeTeacherSubmission({ submissionId: submission.id, grade: parsedGrade, feedback });
      setNotice('Review saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save review.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-medium text-gray-200">
          {submission.studentName}
          <span className="ml-2 text-xs font-normal text-gray-500">{submission.admissionNumber || 'No admission number'}</span>
        </p>
        <time className="text-xs text-gray-500" dateTime={submission.submittedAt}>
          {submission.submittedAt.replace('T', ' ').slice(0, 16)} UTC
        </time>
      </div>
      {submission.submissionText && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">{submission.submissionText}</p>}
      {submission.fileUrls?.length ? (
        <ul className="mt-2 flex flex-wrap gap-3 text-xs">
          {submission.fileUrls.map((url, index) => {
            const safeUrl = secureFileUrl(url);
            return (
              <li key={`${url}:${index}`}>
                {safeUrl
                  ? <a href={safeUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200">Open submitted file</a>
                  : <span className="text-gray-500">Unavailable file link</span>}
            </li>
            );
          })}
        </ul>
      ) : null}
      <form onSubmit={save} className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_auto]">
        <label className="text-xs text-gray-500">
          Grade / {maxScore}
          <input
            type="number"
            min={0}
            max={maxScore}
            step="0.01"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100"
          />
        </label>
        <label className="text-xs text-gray-500">
          Feedback
          <input
            value={feedback}
            maxLength={5000}
            onChange={(event) => setFeedback(event.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100"
          />
        </label>
        <button disabled={busy} className="self-end rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50">
          {busy ? 'Saving…' : 'Save review'}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-2 text-xs text-emerald-300">{notice}</p>}
    </li>
  );
}

export function TeacherAssignmentsManager({
  courses,
  assignments,
  quizzes,
}: {
  courses: CourseOption[];
  assignments: AssignmentRow[];
  quizzes: QuizRow[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ ...EMPTY_QUESTION }]);

  const withFeedback = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await operation();
      setNotice(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete this operation.');
    } finally {
      setBusy(false);
    }
  };

  const submitAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void withFeedback(() => createTeacherAssignment({
      courseId: String(form.get('courseId')),
      lessonId: String(form.get('lessonId') || '') || undefined,
      title: String(form.get('title')),
      instructions: String(form.get('instructions') || ''),
      dueDate: String(form.get('dueDate') || '') || undefined,
      maxScore: Number(form.get('maxScore')),
      isPublished: form.get('isPublished') === 'on',
    }), 'Assignment created.');
    event.currentTarget.reset();
  };

  const submitQuiz = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void withFeedback(() => createTeacherQuiz({
      courseId: String(form.get('quizCourseId')),
      lessonId: String(form.get('quizLessonId') || '') || undefined,
      title: String(form.get('quizTitle')),
      description: String(form.get('quizDescription') || ''),
      timeLimitMinutes: form.get('timeLimit') ? Number(form.get('timeLimit')) : undefined,
      passingScore: form.get('passingScore') ? Number(form.get('passingScore')) : undefined,
      isPublished: form.get('quizPublished') === 'on',
      questions: questions.map((question) => ({
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.questionType === 'multiple_choice'
          ? question.options.split('\n').map((option) => option.trim()).filter(Boolean)
          : undefined,
        correctAnswer: question.correctAnswer,
        marks: Number(question.marks),
      })),
    }), 'Quiz and questions created.');
    event.currentTarget.reset();
    setQuestions([{ ...EMPTY_QUESTION }]);
  };

  return (
    <div className="space-y-6">
      {(error || notice) && (
        <p role={error ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
          {error ?? notice}
        </p>
      )}
      {!courses.length ? (
        <p className="rounded-xl border border-dashed border-gray-700 px-5 py-8 text-center text-sm text-gray-400">
          Create a course for one of your assigned class-subject combinations before adding assignments or quizzes.
        </p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <form onSubmit={submitAssignment} className="space-y-3 rounded-xl border border-gray-800 bg-gray-950/50 p-4">
            <h3 className="font-medium text-white">Create assignment</h3>
            <label className="block text-xs text-gray-400">Course
              <select name="courseId" required className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100">
                {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
            <label className="block text-xs text-gray-400">Title
              <input name="title" required maxLength={200} className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
            </label>
            <label className="block text-xs text-gray-400">Instructions
              <textarea name="instructions" rows={3} maxLength={10000} className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-gray-400">Due date
                <input name="dueDate" type="date" className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
              </label>
              <label className="text-xs text-gray-400">Maximum score
                <input name="maxScore" type="number" min="0.01" step="0.01" required defaultValue="100" className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input name="isPublished" type="checkbox" className="accent-cyan-400" /> Publish for students
            </label>
            <button disabled={busy} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-cyan-400 disabled:opacity-50">
              {busy ? 'Saving…' : 'Create assignment'}
            </button>
          </form>

          <form onSubmit={submitQuiz} className="space-y-3 rounded-xl border border-gray-800 bg-gray-950/50 p-4">
            <h3 className="font-medium text-white">Create quiz</h3>
            <label className="block text-xs text-gray-400">Course
              <select name="quizCourseId" required className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100">
                {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
            <label className="block text-xs text-gray-400">Title
              <input name="quizTitle" required maxLength={200} className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
            </label>
            <label className="block text-xs text-gray-400">Description
              <textarea name="quizDescription" rows={2} maxLength={5000} className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-gray-400">Time limit (minutes)
                <input name="timeLimit" type="number" min="1" max="600" className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
              </label>
              <label className="text-xs text-gray-400">Passing score (%)
                <input name="passingScore" type="number" min="0" max="100" className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
              </label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-200">Questions</p>
                <button type="button" onClick={() => setQuestions((current) => [...current, { ...EMPTY_QUESTION }])} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">
                  + Add question
                </button>
              </div>
              {questions.map((question, index) => (
                <fieldset key={index} className="space-y-2 rounded-lg border border-gray-800 p-3">
                  <legend className="px-1 text-xs text-gray-500">Question {index + 1}</legend>
                  <input
                    required
                    maxLength={2000}
                    value={question.questionText}
                    onChange={(event) => setQuestions((current) => current.map((item, i) => i === index ? { ...item, questionText: event.target.value } : item))}
                    placeholder="Question"
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={question.questionType}
                      onChange={(event) => setQuestions((current) => current.map((item, i) => i === index ? { ...item, questionType: event.target.value as QuestionDraft['questionType'] } : item))}
                      className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100"
                    >
                      <option value="multiple_choice">Multiple choice</option>
                      <option value="true_false">True / False</option>
                      <option value="short_answer">Short answer</option>
                    </select>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={question.marks}
                      onChange={(event) => setQuestions((current) => current.map((item, i) => i === index ? { ...item, marks: event.target.value } : item))}
                      aria-label={`Marks for question ${index + 1}`}
                      className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100"
                    />
                  </div>
                  {question.questionType === 'multiple_choice' && (
                    <textarea
                      rows={2}
                      value={question.options}
                      onChange={(event) => setQuestions((current) => current.map((item, i) => i === index ? { ...item, options: event.target.value } : item))}
                      placeholder="One option per line"
                      className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100"
                    />
                  )}
                  <input
                    required
                    value={question.correctAnswer}
                    onChange={(event) => setQuestions((current) => current.map((item, i) => i === index ? { ...item, correctAnswer: event.target.value } : item))}
                    placeholder="Correct answer"
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100"
                  />
                  {questions.length > 1 && <button type="button" onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))} className="text-xs text-red-300 hover:text-red-200">Remove question</button>}
                </fieldset>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input name="quizPublished" type="checkbox" className="accent-cyan-400" /> Publish quiz
            </label>
            <button disabled={busy} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-cyan-400 disabled:opacity-50">
              {busy ? 'Saving…' : 'Create quiz'}
            </button>
          </form>
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h3 className="font-semibold text-white">Assignments and submissions</h3>
          <p className="mt-1 text-sm text-gray-400">Review and grade submissions from students actively enrolled in your course classes.</p>
        </div>
        {!assignments.length ? (
          <p className="rounded-xl border border-dashed border-gray-700 px-5 py-8 text-center text-sm text-gray-400">No assignments have been created for your courses.</p>
        ) : assignments.map((assignment) => (
          <article key={assignment.id} className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-medium text-white">{assignment.title}</h4>
                <p className="mt-1 text-xs text-gray-500">{assignment.courseName} · Due {assignment.dueDate || 'not set'} · Max {assignment.maxScore}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs ${assignment.isPublished ? 'border-emerald-500/30 text-emerald-300' : 'border-gray-700 text-gray-400'}`}>
                {assignment.isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
            {assignment.description && <p className="mt-3 whitespace-pre-wrap text-sm text-gray-300">{assignment.description}</p>}
            <ul className="mt-4 space-y-3">
              {!assignment.submissions.length
                ? <li className="text-sm text-gray-500">No submissions yet.</li>
                : assignment.submissions.map((submission) => (
                    <SubmissionReview key={submission.id} submission={submission} maxScore={assignment.maxScore} />
                  ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold text-white">Quizzes</h3>
          <p className="mt-1 text-sm text-gray-400">Quizzes are available only in your assigned course materials.</p>
        </div>
        {!quizzes.length ? (
          <p className="text-sm text-gray-500">No quizzes created.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {quizzes.map((quiz) => (
              <li key={quiz.id} className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
                <p className="font-medium text-gray-100">{quiz.title}</p>
                <p className="mt-1 text-xs text-gray-500">{quiz.courseName} · {quiz.isPublished ? 'Published' : 'Draft'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
