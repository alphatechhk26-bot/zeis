'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSchoolBook,
  deleteSchoolBook,
  issueSchoolBook,
  returnSchoolBook,
  updateSchoolBook,
} from '@/actions/admin-library';

type BookRow = {
  id: string;
  school_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  genre: string | null;
  location: string | null;
  publication_year: number | null;
  publisher: string | null;
  total_copies: number;
  available_copies: number;
  is_active: boolean | null;
};
type BorrowRow = {
  id: string;
  school_id: string;
  book_id: string;
  student_id: string;
  borrow_date: string;
  due_date: string;
  return_date: string | null;
  status: 'borrowed' | 'returned' | 'overdue' | 'lost' | null;
  fine_amount: number | null;
  notes: string | null;
  book_title: string;
  student_name: string;
  admission_number: string;
};
type StudentOption = { id: string; admission_number: string; full_name: string };
type BookForm = {
  title: string;
  author: string;
  isbn: string;
  genre: string;
  location: string;
  publicationYear: string;
  publisher: string;
  totalCopies: string;
  isActive: boolean;
};
type IssueForm = { bookId: string; studentId: string; dueDate: string; notes: string };
type DeletingBook = { id: string; title: string } | null;

const EMPTY_BOOK: BookForm = {
  title: '',
  author: '',
  isbn: '',
  genre: '',
  location: '',
  publicationYear: '',
  publisher: '',
  totalCopies: '1',
  isActive: true,
};
const inputClass = 'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30';
const buttonClass = 'rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-50';
const today = () => new Date().toISOString().slice(0, 10);

export function LibraryManager({
  initialBooks,
  initialBorrows,
  students,
}: {
  initialBooks: BookRow[];
  initialBorrows: BorrowRow[];
  students: StudentOption[];
}) {
  const router = useRouter();
  const [books, setBooks] = useState(initialBooks);
  const [borrows, setBorrows] = useState(initialBorrows);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<BookRow | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<DeletingBook>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [returning, setReturning] = useState<BorrowRow | null>(null);
  const [bookForm, setBookForm] = useState<BookForm>(EMPTY_BOOK);
  const [issueForm, setIssueForm] = useState<IssueForm>({
    bookId: '',
    studentId: '',
    dueDate: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const query = search.trim().toLowerCase();
  const filteredBooks = useMemo(() => books.filter((book) =>
    `${book.title} ${book.author ?? ''} ${book.isbn ?? ''} ${book.genre ?? ''}`.toLowerCase().includes(query)
  ), [books, query]);
  const availableBooks = books.filter((book) => book.is_active && book.available_copies > 0);

  const openNewBook = () => {
    setEditor(null);
    setBookForm(EMPTY_BOOK);
    setError(null);
    setNotice(null);
  };
  const openEditBook = (book: BookRow) => {
    setEditor(book);
    setBookForm({
      title: book.title,
      author: book.author ?? '',
      isbn: book.isbn ?? '',
      genre: book.genre ?? '',
      location: book.location ?? '',
      publicationYear: book.publication_year ? String(book.publication_year) : '',
      publisher: book.publisher ?? '',
      totalCopies: String(book.total_copies),
      isActive: book.is_active ?? true,
    });
    setError(null);
    setNotice(null);
  };

  const submitBook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const values = {
        title: bookForm.title,
        author: bookForm.author || null,
        isbn: bookForm.isbn || null,
        genre: bookForm.genre || null,
        location: bookForm.location || null,
        publicationYear: bookForm.publicationYear ? Number(bookForm.publicationYear) : null,
        publisher: bookForm.publisher || null,
        totalCopies: Number(bookForm.totalCopies),
        isActive: bookForm.isActive,
      };
      const result = editor
        ? await updateSchoolBook({ ...values, id: editor.id })
        : await createSchoolBook(values);
      if (!result.success) throw new Error(result.error);
      setBooks((current) => editor
        ? current.map((book) => book.id === result.data.id ? result.data : book)
        : [result.data, ...current]);
      setEditor(undefined);
      setNotice(editor ? 'Book information updated.' : 'Book added to the catalog.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this book.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteSchoolBook({ id: deleting.id });
      if (!result.success) throw new Error(result.error);
      setBooks((current) => current.filter((book) => book.id !== deleting.id));
      setDeleting(null);
      setNotice('Book deleted.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this book.');
    } finally {
      setBusy(false);
    }
  };

  const openIssue = () => {
    setIssueForm({
      bookId: availableBooks[0]?.id ?? '',
      studentId: students[0]?.id ?? '',
      dueDate: '',
      notes: '',
    });
    setError(null);
    setNotice(null);
    setIssueOpen(true);
  };

  const submitIssue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await issueSchoolBook({
        bookId: issueForm.bookId,
        studentId: issueForm.studentId,
        dueDate: issueForm.dueDate,
        notes: issueForm.notes || null,
      });
      if (!result.success) throw new Error(result.error);
      const book = books.find((row) => row.id === result.data.book_id);
      const student = students.find((row) => row.id === result.data.student_id);
      const newBorrow: BorrowRow = {
        ...result.data,
        fine_amount: null,
        book_title: book?.title ?? 'Book',
        student_name: student?.full_name ?? 'Student',
        admission_number: student?.admission_number ?? '—',
      };
      setBorrows((current) => [newBorrow, ...current]);
      setBooks((current) => current.map((row) => row.id === result.data.book_id
        ? { ...row, available_copies: Math.max(row.available_copies - 1, 0) }
        : row));
      setIssueOpen(false);
      setNotice('Book issued successfully.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not issue this book.');
    } finally {
      setBusy(false);
    }
  };

  const confirmReturn = async () => {
    if (!returning) return;
    setBusy(true);
    setError(null);
    try {
      const result = await returnSchoolBook({ id: returning.id });
      if (!result.success) throw new Error(result.error);
      setBorrows((current) => current.map((row) => row.id === result.data.id ? { ...row, ...result.data } : row));
      setBooks((current) => current.map((row) => row.id === result.data.book_id
        ? { ...row, available_copies: Math.min(row.available_copies + 1, row.total_copies) }
        : row));
      setReturning(null);
      setNotice('Book returned and inventory updated.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not return this book.');
    } finally {
      setBusy(false);
    }
  };

  const banner = (error || notice) && (
    <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-950/30 text-red-200' : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'}`}>
      {error ?? notice}
    </div>
  );

  return (
    <div className="space-y-6">
      {banner}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="sr-only" htmlFor="library-search">Search books</label>
        <input id="library-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, author, ISBN or genre" className={`${inputClass} sm:max-w-sm`} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openIssue} disabled={!availableBooks.length || !students.length} className={buttonClass}>Issue Book</button>
          <button type="button" onClick={openNewBook} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500">+ Add Book</button>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-200">Book catalog</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b border-gray-800 bg-gray-950/60 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="p-3 font-medium">Title / author</th><th className="p-3 font-medium">ISBN / genre</th><th className="p-3 font-medium">Location</th><th className="p-3 font-medium">Available</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredBooks.map((book) => (
                <tr key={book.id}>
                  <td className="p-3 font-medium text-gray-100">{book.title}<span className="block text-xs text-gray-500">{book.author ?? 'Author not listed'}{book.publication_year ? ` · ${book.publication_year}` : ''}</span></td>
                  <td className="p-3 text-gray-400">{book.isbn ?? '—'}<span className="block text-xs text-gray-500">{book.genre ?? '—'}</span></td>
                  <td className="p-3 text-gray-400">{book.location ?? '—'}</td>
                  <td className="p-3 text-gray-200">{book.available_copies} / {book.total_copies}</td>
                  <td className="p-3"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs text-gray-200">{book.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="p-3"><div className="flex gap-3"><button type="button" onClick={() => openEditBook(book)} className="text-xs text-cyan-300 hover:text-cyan-200">Edit</button><button type="button" onClick={() => { setDeleting({ id: book.id, title: book.title }); setError(null); }} className="text-xs text-red-300 hover:text-red-200">Delete</button></div></td>
                </tr>
              ))}
              {!filteredBooks.length && <tr><td colSpan={6} className="p-7 text-center text-gray-400">{query ? 'No matching books.' : 'No books have been added.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-200">Borrowing activity</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b border-gray-800 bg-gray-950/60 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="p-3 font-medium">Book</th><th className="p-3 font-medium">Student</th><th className="p-3 font-medium">Borrowed</th><th className="p-3 font-medium">Due</th><th className="p-3 font-medium">Returned</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {borrows.map((borrow) => (
                <tr key={borrow.id}>
                  <td className="p-3 text-gray-200">{borrow.book_title}</td>
                  <td className="p-3 text-gray-300">{borrow.student_name}<span className="block text-xs text-gray-500">{borrow.admission_number}</span></td>
                  <td className="p-3 text-gray-400">{borrow.borrow_date}</td>
                  <td className="p-3 text-gray-400">{borrow.due_date}</td>
                  <td className="p-3 text-gray-400">{borrow.return_date ?? '—'}</td>
                  <td className="p-3"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs capitalize text-gray-200">{borrow.status ?? 'unknown'}</span></td>
                  <td className="p-3">{borrow.status === 'borrowed' || borrow.status === 'overdue' ? <button type="button" onClick={() => { setReturning(borrow); setError(null); }} className="text-xs text-cyan-300 hover:text-cyan-200">Return</button> : '—'}</td>
                </tr>
              ))}
              {!borrows.length && <tr><td colSpan={7} className="p-7 text-center text-gray-400">No borrow records yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {editor !== undefined && (
        <Modal title={editor ? 'Edit book' : 'Add book'} onClose={() => setEditor(undefined)}>
          <form onSubmit={submitBook} className="grid gap-4 sm:grid-cols-2">
            <Field label="Title"><input required maxLength={255} value={bookForm.title} onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })} className={inputClass} /></Field>
            <Field label="Author"><input maxLength={100} value={bookForm.author} onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })} className={inputClass} /></Field>
            <Field label="ISBN / code"><input maxLength={20} value={bookForm.isbn} onChange={(event) => setBookForm({ ...bookForm, isbn: event.target.value })} className={inputClass} /></Field>
            <Field label="Genre"><input maxLength={100} value={bookForm.genre} onChange={(event) => setBookForm({ ...bookForm, genre: event.target.value })} className={inputClass} /></Field>
            <Field label="Location"><input maxLength={50} value={bookForm.location} onChange={(event) => setBookForm({ ...bookForm, location: event.target.value })} className={inputClass} /></Field>
            <Field label="Publisher"><input maxLength={255} value={bookForm.publisher} onChange={(event) => setBookForm({ ...bookForm, publisher: event.target.value })} className={inputClass} /></Field>
            <Field label="Publication year"><input type="number" min="1000" max="3000" value={bookForm.publicationYear} onChange={(event) => setBookForm({ ...bookForm, publicationYear: event.target.value })} className={inputClass} /></Field>
            <Field label="Total copies"><input required type="number" min="0" max="100000" step="1" value={bookForm.totalCopies} onChange={(event) => setBookForm({ ...bookForm, totalCopies: event.target.value })} className={inputClass} /></Field>
            <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2"><input type="checkbox" checked={bookForm.isActive} onChange={(event) => setBookForm({ ...bookForm, isActive: event.target.checked })} className="accent-cyan-500" />Available for issue</label>
            {error && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}
            <DialogActions busy={busy} onCancel={() => setEditor(undefined)} submitLabel={editor ? 'Save changes' : 'Add book'} />
          </form>
        </Modal>
      )}

      {issueOpen && (
        <Modal title="Issue a book" onClose={() => setIssueOpen(false)}>
          <form onSubmit={submitIssue} className="grid gap-4 sm:grid-cols-2">
            <Field label="Book"><select required value={issueForm.bookId} onChange={(event) => setIssueForm({ ...issueForm, bookId: event.target.value })} className={inputClass}><option value="">Select available book</option>{availableBooks.map((book) => <option key={book.id} value={book.id}>{book.title} ({book.available_copies} available)</option>)}</select></Field>
            <Field label="Student"><select required value={issueForm.studentId} onChange={(event) => setIssueForm({ ...issueForm, studentId: event.target.value })} className={inputClass}><option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.full_name} · {student.admission_number}</option>)}</select></Field>
            <Field label="Due date"><input required type="date" min={today()} value={issueForm.dueDate} onChange={(event) => setIssueForm({ ...issueForm, dueDate: event.target.value })} className={inputClass} /></Field>
            <Field label="Notes"><input maxLength={1000} value={issueForm.notes} onChange={(event) => setIssueForm({ ...issueForm, notes: event.target.value })} className={inputClass} /></Field>
            {error && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}
            <DialogActions busy={busy} onCancel={() => setIssueOpen(false)} submitLabel="Issue book" disabled={!availableBooks.length || !students.length} />
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title={`Delete ${deleting.title}?`} onClose={() => setDeleting(null)} dialog>
          <h2 className="font-semibold text-white">Delete “{deleting.title}”?</h2>
          <p className="mt-2 text-sm text-gray-400">Books with borrowing history cannot be deleted. Deactivate them to preserve records.</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setDeleting(null)} disabled={busy} className={buttonClass}>Cancel</button><button type="button" onClick={confirmDelete} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Deleting…' : 'Delete book'}</button></div>
        </Modal>
      )}

      {returning && (
        <Modal title="Return book?" onClose={() => setReturning(null)} dialog>
          <h2 className="font-semibold text-white">Return “{returning.book_title}”?</h2>
          <p className="mt-2 text-sm text-gray-400">This closes the loan and restores one available copy.</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setReturning(null)} disabled={busy} className={buttonClass}>Cancel</button><button type="button" onClick={confirmReturn} disabled={busy} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Returning…' : 'Confirm return'}</button></div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1.5 text-sm text-gray-300">{label}{children}</label>;
}

function Modal({
  title,
  children,
  onClose,
  dialog = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dialog?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section role={dialog ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl sm:p-6">
        {!dialog && <h2 className="mb-5 text-lg font-semibold text-white">{title}</h2>}
        {children}
        <button type="button" onClick={onClose} className="sr-only">Close dialog</button>
      </section>
    </div>
  );
}

function DialogActions({
  busy,
  onCancel,
  submitLabel,
  disabled = false,
}: {
  busy: boolean;
  onCancel: () => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
      <button type="button" onClick={onCancel} disabled={busy} className={buttonClass}>Cancel</button>
      <button type="submit" disabled={busy || disabled} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : submitLabel}</button>
    </div>
  );
}
