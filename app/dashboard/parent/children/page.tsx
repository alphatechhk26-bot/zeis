import { BookOpen, GraduationCap, Users } from 'lucide-react';
import {
  ParentEmptyState,
  ParentErrorState,
  ParentPageHeader,
  ParentPanel,
  ParentStatCard,
  renderParentPageSafely,
} from '@/components/dashboard/parent-ui';
import { loadParentChildren, requireParentContext } from '@/lib/parent-dashboard';

export default async function ParentChildrenPage() {
  const context = await requireParentContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <ParentPageHeader title="My children" description="View students linked to your parent account." />
        <ParentErrorState />
      </div>
    );
  }

  return renderParentPageSafely('children', async () => {
    if (!context.schoolId) {
      return (
        <div className="space-y-6">
          <ParentPageHeader title="My children" description="View students linked to your parent account." />
          <ParentEmptyState
            title="School assignment required"
            description="Your parent profile is not assigned to a school, so student records cannot be displayed."
          />
        </div>
      );
    }

    const [children, schoolResult] = await Promise.all([
      loadParentChildren(context),
      context.supabase
        .from('schools')
        .select('id, name')
        .eq('id', context.schoolId)
        .maybeSingle(),
    ]);
    if (schoolResult.error) throw schoolResult.error;

    const classCount = new Set(children.flatMap((child) => child.class_id ? [child.class_id] : [])).size;

    return (
      <div className="space-y-6">
        <ParentPageHeader title="My children" description="Student records linked to your authenticated parent account and authorized school." />
        <section aria-label="Children summary" className="grid gap-4 sm:grid-cols-2">
          <ParentStatCard label="Linked children" value={String(children.length)} detail="Verified parent-child links" icon={Users} />
          <ParentStatCard label="Classes" value={String(classCount)} detail="Classes assigned in the available student records" icon={BookOpen} />
        </section>
        <ParentPanel title="Children" description={`School: ${schoolResult.data?.name ?? 'School name unavailable'}`}>
          {!children.length ? (
            <ParentEmptyState
              title="No linked children found"
              description="No student records linked to your account were available for your authorized school."
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {children.map((child) => (
                <li key={child.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-5">
                  <div className="flex items-start gap-3">
                    <GraduationCap aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white">{child.full_name}</h3>
                      <p className="mt-1 text-sm text-gray-400">
                        Admission number: {child.admission_number ?? 'Not provided'}
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        Class: {child.class_name ?? 'Not assigned or unavailable'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Enrollment date: {child.enrollment_date ?? 'Not specified'}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ParentPanel>
      </div>
    );
  });
}
