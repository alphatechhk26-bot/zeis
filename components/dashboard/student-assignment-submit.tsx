'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitAssignment } from '@/actions/lms';

export function StudentAssignmentSubmit({
  assignmentId,
  initialText,
}: {
  assignmentId: string;
  initialText: string;
}) {
  const router = useRouter();
  const [submissionText, setSubmissionText] = useState(initialText);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    try {
      await submitAssignment({
        assignment_id: assignmentId,
        submission_text: submissionText,
      });
      setMessage('Your submission was saved.');
      router.refresh();
    } catch (error) {
      console.error('Failed to submit assignment:', error);
      setMessage('We could not save your submission. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-2">
      <label htmlFor={`submission-${assignmentId}`} className="sr-only">
        Assignment response
      </label>
      <textarea
        id={`submission-${assignmentId}`}
        value={submissionText}
        onChange={(event) => setSubmissionText(event.target.value)}
        rows={3}
        maxLength={10000}
        placeholder="Write your response..."
        className="w-full resize-y rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className="text-xs text-gray-400">{message}</p>
        <button
          type="submit"
          disabled={isSubmitting || !submissionText.trim()}
          className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-gray-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting…' : 'Submit response'}
        </button>
      </div>
    </form>
  );
}
