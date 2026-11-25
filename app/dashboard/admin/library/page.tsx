import { BookMarked, BookOpen, Clock3 } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { LibraryManager } from '@/components/dashboard/library-manager';
import { requireAdminContext } from '@/lib/admin-dashboard';

export default async function AdminLibraryPage() {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Library" description="Manage the school book catalog and borrowing activity." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, schoolId } = context;

  return renderAdminPageSafely('library', async () => {
    if (!schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Library" description="Manage the school book catalog and borrowing activity." />
          <AdminEmptyState title="School assignment required" description="Your administrator profile must be assigned to a school before managing library records." />
        </div>
      );
    }

    const [booksResult, borrowsResult, studentsResult] = await Promise.all([
      supabase
        .from('library_books')
        .select('id, school_id, title, author, isbn, genre, location, publication_year, publisher, total_copies, available_copies, is_active')
        .eq('school_id', schoolId)
        .order('title')
        .limit(1000),
      supabase
        .from('borrow_records')
        .select('id, school_id, book_id, student_id, borrow_date, due_date, return_date, status, fine_amount, notes')
        .eq('school_id', schoolId)
        .order('borrow_date', { ascending: false })
        .limit(1000),
      supabase
        .from('students')
        .select('id, school_id, admission_number, status')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('admission_number')
        .limit(2000),
    ]);
    if (booksResult.error) throw booksResult.error;
    if (borrowsResult.error) throw borrowsResult.error;
    if (studentsResult.error) throw studentsResult.error;

    const borrows = borrowsResult.data ?? [];
    const studentIds = [...new Set([
      ...(studentsResult.data ?? []).map((student) => student.id),
      ...borrows.map((record) => record.student_id),
    ])];
    const { data: profiles, error: profileError } = studentIds.length
      ? await supabase
          .from('profiles')
          .select('id, full_name, school_id')
          .in('id', studentIds)
          .eq('school_id', schoolId)
      : { data: [], error: null };
    if (profileError) throw profileError;

    const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
    const students = (studentsResult.data ?? []).map((student) => ({
      id: student.id,
      admission_number: student.admission_number ?? '—',
      full_name: nameById.get(student.id) ?? 'Student',
    }));
    const books = booksResult.data ?? [];
    const bookById = new Map(books.map((book) => [book.id, book.title]));
    const enrichedBorrows = borrows.map((record) => ({
      ...record,
      book_title: bookById.get(record.book_id) ?? 'Book unavailable',
      student_name: nameById.get(record.student_id) ?? 'Student',
      admission_number: studentsResult.data?.find((student) => student.id === record.student_id)?.admission_number ?? '—',
    }));
    const overdueCount = borrows.filter((record) =>
      record.status !== 'returned' && record.due_date < new Date().toISOString().slice(0, 10)
    ).length;
    const availableCopies = books.reduce((total, book) => total + book.available_copies, 0);

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Library" description="Manage books, issue and return loans, and track inventory within your authenticated school." />
        <section aria-label="Library summary" className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Catalog books" value={String(books.length)} detail="Loaded records (up to 1,000)" icon={BookOpen} />
          <AdminStatCard label="Available copies" value={String(availableCopies)} detail="Across loaded catalog records" icon={BookMarked} />
          <AdminStatCard label="Overdue loans" value={String(overdueCount)} detail="Among loaded borrow records" icon={Clock3} />
        </section>
        <AdminPanel title="Library operations" description="Inventory updates and loan transitions are protected by database-side atomic triggers.">
          <LibraryManager
            initialBooks={books}
            initialBorrows={enrichedBorrows}
            students={students}
          />
        </AdminPanel>
      </div>
    );
  });
}
