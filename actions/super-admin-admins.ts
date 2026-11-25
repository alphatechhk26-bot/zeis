'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/zeis';
import {
  platformUserRoles,
  type CreatePlatformUserInput,
  type PlatformSchool,
  type PlatformUser,
  type PlatformUserRole,
  type UpdatePlatformUserInput,
} from '@/types/platform-users';

const adminsPath = '/dashboard/super-admin/admins';
const authUsersPageSize = 1000;
const profileBatchSize = 500;

type ProfileListRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'role' | 'school_id' | 'created_at'
>;

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function getErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Invalid input.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}

async function runAction<T>(action: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { success: true, data: await action() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

async function assertSuperAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Unauthorized: please sign in.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Unauthorized: profile not found.');
  }
  if (profile.role !== 'super_admin') {
    throw new Error('Forbidden: super_admin access is required.');
  }

  return user.id;
}

const roleSchema = z.enum(platformUserRoles);

const userIdSchema = z.string().uuid();

const createUserSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  fullName: z.string().trim().min(1, 'Full name is required.').max(255),
  role: roleSchema,
  schoolId: z.string().uuid('Select a valid school.').nullable(),
}).strict();

const updateUserSchema = z.object({
  userId: userIdSchema,
  email: z.string().trim().email('Enter a valid email address.').max(254).transform((email) => email.toLowerCase()),
  fullName: z.string().trim().min(1, 'Full name is required.').max(255),
  role: roleSchema,
  schoolId: z.string().uuid('Select a valid school.').nullable(),
}).strict();

const revokeSchema = z.object({ userId: userIdSchema }).strict();
const deleteSchema = z.object({ userId: userIdSchema }).strict();

function validateRoleSchool(
  role: PlatformUserRole,
  schoolId: string | null,
  allowUnassignedStudent = false
): void {
  if (role === 'super_admin' && schoolId !== null) {
    throw new Error('Super Admin accounts must use the platform-level assignment.');
  }
  if (
    (role === 'teacher' || role === 'parent' || (role === 'student' && !allowUnassignedStudent)) &&
    schoolId === null
  ) {
    throw new Error(`${role} accounts must be assigned to a school.`);
  }
}

async function ensureSchoolExists(
  adminClient: ReturnType<typeof createAdminClient>,
  schoolId: string | null
): Promise<void> {
  if (!schoolId) return;

  const { data: school, error } = await adminClient
    .from('schools')
    .select('id')
    .eq('id', schoolId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not verify the selected school: ${error.message}`);
  }
  if (!school) {
    throw new Error('The selected school does not exist.');
  }
}

async function ensureNotLastSuperAdmin(
  adminClient: ReturnType<typeof createAdminClient>,
  targetRole: PlatformUserRole | null,
  newRole: PlatformUserRole
): Promise<void> {
  if (targetRole !== 'super_admin' || newRole === 'super_admin') return;

  const { count, error } = await adminClient
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'super_admin');

  if (error) {
    throw new Error(`Could not verify Super Admin accounts: ${error.message}`);
  }
  if (count === null) {
    throw new Error('Could not verify the remaining Super Admin count.');
  }
  if (count <= 1) {
    throw new Error('The last remaining Super Admin cannot be demoted or deleted.');
  }
}

async function getAuthUser(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string
) {
  const { data, error } = await adminClient.auth.admin.getUserById(userId);
  if (error || !data.user) {
    throw new Error(error?.message ?? 'User not found.');
  }
  return data.user;
}

async function cleanupNewAuthUser(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<string | null> {
  try {
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    return error ? error.message : null;
  } catch (error) {
    return getErrorMessage(error);
  }
}

type ExistingProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'role' | 'school_id'
>;

async function restoreProfile(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  previousProfile: ExistingProfile | null
): Promise<string | null> {
  try {
    const result = previousProfile
      ? await adminClient.from('profiles').upsert(previousProfile, { onConflict: 'id' })
      : await adminClient.from('profiles').delete().eq('id', userId);

    return result.error?.message ?? null;
  } catch (error) {
    return getErrorMessage(error);
  }
}

export async function getAllPlatformUsers(): Promise<
  ActionResult<{ users: PlatformUser[]; schools: PlatformSchool[] }>
> {
  return runAction(async () => {
    await assertSuperAdmin();
    const adminClient = createAdminClient();

    const authUsers: User[] = [];
    for (let page = 1; ; page += 1) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: authUsersPageSize,
      });
      if (error) {
        throw new Error(`Failed to load Auth users: ${error.message}`);
      }

      authUsers.push(...data.users);
      if (data.users.length < authUsersPageSize) break;
    }

    const profileRows: ProfileListRow[] = [];
    for (let offset = 0; offset < authUsers.length; offset += profileBatchSize) {
      const userIds = authUsers
        .slice(offset, offset + profileBatchSize)
        .map((user) => user.id);
      const { data, error } = await adminClient
        .from('profiles')
        .select('id, full_name, role, school_id, created_at')
        .in('id', userIds);

      if (error) {
        throw new Error(`Failed to load user profiles: ${error.message}`);
      }
      profileRows.push(...data);
    }

    const schools: PlatformSchool[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await adminClient
        .from('schools')
        .select('id, name')
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + 999);

      if (error) {
        throw new Error(`Failed to load schools: ${error.message}`);
      }
      schools.push(...data);
      if (data.length < 1000) break;
    }

    const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));
    const schoolById = new Map(schools.map((school) => [school.id, school.name]));

    const users: PlatformUser[] = authUsers.map((authUser) => {
      const profile = profileById.get(authUser.id);
      return {
        id: authUser.id,
        email: authUser.email ?? null,
        full_name: profile?.full_name ?? null,
        role: profile?.role ?? null,
        school_id: profile?.school_id ?? null,
        school_name: profile?.school_id
          ? schoolById.get(profile.school_id) ?? null
          : null,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at ?? null,
        email_confirmed_at: authUser.email_confirmed_at ?? null,
        status: !authUser.email
          ? 'no_email'
          : authUser.email_confirmed_at
            ? 'email_verified'
            : 'email_not_verified',
      };
    });

    return { users, schools };
  });
}

export async function createPlatformUser(
  input: CreatePlatformUserInput
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await assertSuperAdmin();
    const validated = createUserSchema.parse(input);
    validateRoleSchool(validated.role, validated.schoolId);

    const adminClient = createAdminClient();
    await ensureSchoolExists(adminClient, validated.schoolId);

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: validated.email,
      password: validated.password,
      email_confirm: true,
      user_metadata: { full_name: validated.fullName },
    });

    if (authError || !authData.user) {
      const message = authError?.message ?? 'No Auth user was returned.';
      if (/already registered|already exists|duplicate/i.test(message)) {
        throw new Error('An account with this email already exists.');
      }
      throw new Error(`Failed to create Auth user: ${message}`);
    }

    const userId = authData.user.id;
    let profileCreationError: string | null = null;
    try {
      const { error: profileError } = await adminClient.from('profiles').insert({
        id: userId,
        full_name: validated.fullName,
        role: validated.role,
        school_id: validated.schoolId,
      });
      profileCreationError = profileError?.message ?? null;
    } catch (error) {
      profileCreationError = getErrorMessage(error);
    }

    if (profileCreationError) {
      const cleanupError = await cleanupNewAuthUser(adminClient, userId);
      const message = `Failed to create user profile: ${profileCreationError}`;
      throw new Error(
        cleanupError
          ? `${message} Auth account cleanup also failed: ${cleanupError}`
          : message
      );
    }

    revalidatePath(adminsPath);
    return { id: userId };
  });
}

export async function updatePlatformUser(
  input: UpdatePlatformUserInput
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const callerId = await assertSuperAdmin();
    const validated = updateUserSchema.parse(input);
    if (validated.userId === callerId && validated.role !== 'super_admin') {
      throw new Error('You cannot demote your own Super Admin account.');
    }

    const adminClient = createAdminClient();
    await ensureSchoolExists(adminClient, validated.schoolId);

    const authUser = await getAuthUser(adminClient, validated.userId);
    const { data: previousProfile, error: profileReadError } = await adminClient
      .from('profiles')
      .select('id, full_name, role, school_id')
      .eq('id', validated.userId)
      .maybeSingle();

    if (profileReadError) {
      throw new Error(`Failed to load the existing profile: ${profileReadError.message}`);
    }

    validateRoleSchool(
      validated.role,
      validated.schoolId,
      validated.role === 'student' &&
        previousProfile?.role === 'student' &&
        previousProfile.school_id === null
    );

    await ensureNotLastSuperAdmin(
      adminClient,
      previousProfile?.role ?? null,
      validated.role
    );

    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: validated.userId,
          full_name: validated.fullName,
          role: validated.role,
          school_id: validated.schoolId,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      throw new Error(`Failed to update user profile: ${profileError.message}`);
    }

    const emailChanged = (authUser.email ?? '').toLowerCase() !== validated.email;
    const metadataChanged = authUser.user_metadata?.full_name !== validated.fullName;
    if (emailChanged || metadataChanged) {
      const attributes = {
        ...(emailChanged ? { email: validated.email, email_confirm: true } : {}),
        ...(metadataChanged
          ? {
              user_metadata: {
                ...authUser.user_metadata,
                full_name: validated.fullName,
              },
            }
          : {}),
      };
      let authUpdateErrorMessage: string | null = null;
      try {
        const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
          validated.userId,
          attributes
        );
        authUpdateErrorMessage = authUpdateError?.message ?? null;
      } catch (error) {
        authUpdateErrorMessage = getErrorMessage(error);
      }

      if (authUpdateErrorMessage) {
        const rollbackError = await restoreProfile(
          adminClient,
          validated.userId,
          previousProfile ?? null
        );
        const authMessage = /already registered|already exists|duplicate/i.test(authUpdateErrorMessage)
          ? 'An account with this email already exists.'
          : `Failed to update Auth user: ${authUpdateErrorMessage}`;
        throw new Error(
          rollbackError
            ? `${authMessage} Profile rollback also failed: ${rollbackError}`
            : authMessage
        );
      }
    }

    revalidatePath(adminsPath);
    return { id: validated.userId };
  });
}

export async function revokeUserRole(
  input: z.infer<typeof revokeSchema>
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const callerId = await assertSuperAdmin();
    const { userId } = revokeSchema.parse(input);
    if (userId === callerId) {
      throw new Error('You cannot revoke your own Super Admin account.');
    }

    const adminClient = createAdminClient();
    await getAuthUser(adminClient, userId);

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) {
      throw new Error(`Failed to load the user's profile: ${profileError.message}`);
    }
    if (!profile) {
      throw new Error('The user has no profile to revoke.');
    }
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      throw new Error('Only Admin or Super Admin roles can be revoked.');
    }

    await ensureNotLastSuperAdmin(adminClient, profile.role, 'student');

    const { error } = await adminClient
      .from('profiles')
      .update({ role: 'student', school_id: null })
      .eq('id', userId);
    if (error) {
      throw new Error(`Failed to revoke the user role: ${error.message}`);
    }

    revalidatePath(adminsPath);
    return { id: userId };
  });
}

export async function deletePlatformUser(
  input: z.infer<typeof deleteSchema>
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const callerId = await assertSuperAdmin();
    const { userId } = deleteSchema.parse(input);
    if (userId === callerId) {
      throw new Error('You cannot delete your own account.');
    }

    const adminClient = createAdminClient();
    await getAuthUser(adminClient, userId);

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) {
      throw new Error(`Failed to load the user's profile: ${profileError.message}`);
    }
    await ensureNotLastSuperAdmin(adminClient, profile?.role ?? null, 'student');

    try {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) {
        if (deleteError.code === '23503' || /foreign key/i.test(deleteError.message)) {
          throw new Error(
            'Deletion is blocked by related records. Important school data was not removed.'
          );
        }
        throw new Error(`Failed to delete Auth user: ${deleteError.message}`);
      }
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Failed to delete the user because of an unexpected database error.');
    }

    revalidatePath(adminsPath);
    return { id: userId };
  });
}
