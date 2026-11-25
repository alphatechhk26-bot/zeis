import { CalendarDays, BookOpen, GraduationCap } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  formatAdminDate,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { AcademicSetupManager } from '@/components/dashboard/academic-setup-manager';
import { requireAdminContext } from '@/lib/admin-dashboard';

export default async function AdminSettingsPage() {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Settings" description="Manage school academic setup." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, schoolId } = context;

  return renderAdminPageSafely('settings', async () => {
    if (!schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Settings" description="Manage school academic setup." />
          <AdminEmptyState title="School assignment required" description="Your administrator profile must be assigned to a school before managing school settings." />
        </div>
      );
    }

    const [schoolResult, yearResult, subjectResult] = await Promise.all([
      supabase
        .from('schools')
        .select('id, name, slug, is_active, updated_at')
        .eq('id', schoolId)
        .maybeSingle(),
      supabase
        .from('academic_years')
        .select('id, name, start_date, end_date, is_active, status, school_id, created_at, updated_at')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false }),
      supabase
        .from('subjects')
        .select('id, name, code, description, is_active, school_id, created_at, updated_at')
        .eq('school_id', schoolId)
        .order('name'),
    ]);
    if (schoolResult.error) throw schoolResult.error;
    if (yearResult.error) throw yearResult.error;
    if (subjectResult.error) throw subjectResult.error;

    const years = yearResult.data ?? [];
    const academicYearIds = years.map((year) => year.id);
    const { data: terms, error: termError } = academicYearIds.length
      ? await supabase
          .from('terms')
          .select('id, academic_year_id, name, term_number, start_date, end_date, is_active, created_at, updated_at')
          .in('academic_year_id', academicYearIds)
          .order('term_number')
      : { data: [], error: null };
    if (termError) throw termError;

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Settings" description="Manage school academic years, terms and subjects in your authenticated school." />
        {schoolResult.data && (
          <AdminPanel title="School profile" description="Read-only school identity; settings fields are not present in the generated schema.">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-wide text-gray-500">School</dt><dd className="mt-1 text-sm text-gray-100">{schoolResult.data.name}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-gray-500">Slug</dt><dd className="mt-1 text-sm text-gray-100">{schoolResult.data.slug}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-gray-500">Status</dt><dd className="mt-1 text-sm text-gray-100">{schoolResult.data.is_active ? 'Active' : 'Inactive'}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-gray-500">Last updated</dt><dd className="mt-1 text-sm text-gray-100">{formatAdminDate(schoolResult.data.updated_at)}</dd></div>
            </dl>
          </AdminPanel>
        )}
        <section aria-label="Academic setup summary" className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Academic years" value={String(years.length)} detail="For this school" icon={CalendarDays} />
          <AdminStatCard label="Terms" value={String(terms?.length ?? 0)} detail="Across this school's academic years" icon={BookOpen} />
          <AdminStatCard label="Subjects" value={String(subjectResult.data?.length ?? 0)} detail="Available for class assignment" icon={GraduationCap} />
        </section>
        <AdminPanel title="Academic setup" description="Create, edit and safely remove school academic records. Linked records prevent deletion.">
          <AcademicSetupManager
            initialYears={years}
            initialTerms={terms ?? []}
            initialSubjects={subjectResult.data ?? []}
          />
        </AdminPanel>
      </div>
    );
  });
}
