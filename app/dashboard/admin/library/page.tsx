import { BookOpen, BookMarked, Clock3 } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  formatAdminDate,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { requireAdminContext } from '@/lib/admin-dashboard';

export default async function AdminLibraryPage() {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Library" description="Review the school book catalog and borrowing activity." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, role, schoolId } = context;

  return renderAdminPageSafely('library', async () => {
    if (role === 'admin' && !schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Library" description="Review the school book catalog and borrowing activity." />
          <AdminEmptyState title="School assignment required" description="Your admin profile is not assigned to a school, so library records cannot be loaded." />
        </div>
      );
    }

    let booksQuery = supabase
      .from('library_books')
      .select('id, title, author, isbn, genre, location, total_copies, available_copies, is_active, school_id')
      .order('title')
      .limit(500);
    let borrowQuery = supabase
      .from('borrow_records')
      .select('id, book_id, student_id, borrow_date, due_date, return_date, status, school_id')
      .order('borrow_date', { ascending: false })
      .limit(500);
    if (role === 'admin' && schoolId) {
      booksQuery = booksQuery.eq('school_id', schoolId);
      borrowQuery = borrowQuery.eq('school_id', schoolId);
    }
    const [bookResult, borrowResult] = await Promise.all([booksQuery, borrowQuery]);
    if (bookResult.error) throw bookResult.error;
    if (borrowResult.error) throw borrowResult.error;

    const books = bookResult.data ?? [];
    const borrows = borrowResult.data ?? [];
    const bookById = new Map(books.map((book) => [book.id, book]));
    const overdueCount = borrows.filter((record) =>
      record.status !== 'returned' && record.due_date < new Date().toISOString().slice(0, 10),
    ).length;
    const availableCopies = books.reduce((sum, book) => sum + book.available_copies, 0);

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Library" description="Review book availability and recorded borrowing activity." />
        <section aria-label="Library summary" className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Catalog books" value={String(books.length)} detail="Loaded records (up to 500)" icon={BookOpen} />
          <AdminStatCard label="Available copies" value={String(availableCopies)} detail="Across loaded catalog records" icon={BookMarked} />
          <AdminStatCard label="Overdue loans" value={String(overdueCount)} detail="Among loaded borrow records" icon={Clock3} />
        </section>
        <AdminPanel title="Book catalog" description="Availability and catalog information from library_books.">
          {!books.length ? (
            <AdminEmptyState title="No books found" description="Books will appear here when they are added to the library catalog." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Title</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Author / genre</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">ISBN</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Copies available</th>
                    <th scope="col" className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {books.map((book) => (
                    <tr key={book.id}>
                      <td className="py-3 pr-4 font-medium text-gray-100">{book.title}</td>
                      <td className="py-3 pr-4 text-gray-300">{[book.author, book.genre].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="py-3 pr-4 text-gray-300">{book.isbn ?? '—'}</td>
                      <td className="py-3 pr-4 text-gray-300">{book.available_copies} / {book.total_copies}</td>
                      <td className="py-3"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs text-gray-200">{book.is_active ? 'Active' : 'Inactive'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminPanel>
        <AdminPanel title="Recent borrow records" description="Most recent 500 loans recorded by the library.">
          {!borrows.length ? (
            <AdminEmptyState title="No borrow records" description="Borrowing activity will appear here after a loan is recorded." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Book</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Student ID</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Borrowed</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Due</th>
                    <th scope="col" className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {borrows.map((record) => (
                    <tr key={record.id}>
                      <td className="py-3 pr-4 text-gray-200">{bookById.get(record.book_id)?.title ?? 'Book record unavailable'}</td>
                      <td className="py-3 pr-4 text-gray-300">{record.student_id}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatAdminDate(record.borrow_date)}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatAdminDate(record.due_date)}</td>
                      <td className="py-3"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs capitalize text-gray-200">{record.status ?? 'Unknown'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminPanel>
      </div>
    );
  });
}
