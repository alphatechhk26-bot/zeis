'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/zeis';

// ---------------------------------------------------------------------------
// RBAC guard — every action must pass this
// ---------------------------------------------------------------------------
async function assertSuperAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Unauthorized: no session.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Unauthorized: profile missing.');
  }

  if (profile.role !== 'super_admin') {
    throw new Error('Forbidden: super_admin required.');
  }

  return { callerId: user.id };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const roleEnum = z.enum(['super_admin', 'admin', 'teacher', 'student', 'parent']);

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  newRole: roleEnum,
});

const assignSchoolSchema = z.object({
  userId: z.string().uuid(),
  schoolId: z.string().uuid().nullable(),
});

const revokeSchema = z.object({
  userId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// 1. Change a user's role
// ---------------------------------------------------------------------------
export async function updateAdminRole(input: z.infer<typeof updateRoleSchema>) {
  const { callerId } = await assertSuperAdmin();
  const { userId, newRole } = updateRoleSchema.parse(input);

  if (userId === callerId) {
    throw new Error('You cannot change your own role. Ask another super_admin.');
  }

  const adminClient = createAdminClient();

  // Prevent demoting the last remaining super_admin
  if (newRole !== 'super_admin') {
    const { data: target } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (target?.role === 'super_admin') {
      const { count } = await adminClient
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin');

      if ((count ?? 0) <= 1) {
        throw new Error('Cannot demote the last remaining super_admin.');
      }
    }
  }

  // A super_admin should not be tied to a school
  const updates: Record<string, unknown> = { role: newRole };
  if (newRole === 'super_admin') {
    updates.school_id = null;
  }

  const { error } = await adminClient
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) throw new Error(`Failed to update role: ${error.message}`);

  revalidatePath('/dashboard/super-admin/admins');
  return { success: true };
}

// ---------------------------------------------------------------------------
// 2. Assign / change a school for an admin
// ---------------------------------------------------------------------------
export async function assignAdminSchool(input: z.infer<typeof assignSchoolSchema>) {
  await assertSuperAdmin();
  const { userId, schoolId } = assignSchoolSchema.parse(input);

  const adminClient = createAdminClient();

  // Super admins should not be assigned to a school
  const { data: target } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (target?.role === 'super_admin') {
    throw new Error('super_admin cannot be assigned to a school.');
  }

  if (schoolId) {
    const { data: school } = await adminClient
      .from('schools')
      .select('id')
      .eq('id', schoolId)
      .single();
    if (!school) throw new Error('School not found.');
  }

  const { error } = await adminClient
    .from('profiles')
    .update({ school_id: schoolId })
    .eq('id', userId);

  if (error) throw new Error(`Failed to assign school: ${error.message}`);

  revalidatePath('/dashboard/super-admin/admins');
  return { success: true };
}

// ---------------------------------------------------------------------------
// 3. Revoke admin access (downgrade to student, unassign school)
// ---------------------------------------------------------------------------
export async function revokeAdminAccess(input: z.infer<typeof revokeSchema>) {
  const { callerId } = await assertSuperAdmin();
  const { userId } = revokeSchema.parse(input);

  if (userId === callerId) {
    throw new Error('You cannot revoke your own access.');
  }

  const adminClient = createAdminClient();

  const { data: target } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!target) throw new Error('User not found.');

  if (!['admin', 'super_admin'].includes(target.role)) {
    throw new Error('User does not currently have admin privileges.');
  }

  if (target.role === 'super_admin') {
    const { count } = await adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'super_admin');

    if ((count ?? 0) <= 1) {
      throw new Error('Cannot revoke the last remaining super_admin.');
    }
  }

  const { error } = await adminClient
    .from('profiles')
    .update({ role: 'student', school_id: null })
    .eq('id', userId);

  if (error) throw new Error(`Failed to revoke access: ${error.message}`);

  revalidatePath('/dashboard/super-admin/admins');
  return { success: true };
}