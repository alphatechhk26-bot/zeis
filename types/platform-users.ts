import type { Database } from '@/types/zeis';

export const platformUserRoles = [
  'super_admin',
  'admin',
  'teacher',
  'student',
  'parent',
] as const satisfies readonly Database['public']['Enums']['user_role'][];

export type PlatformUserRole = (typeof platformUserRoles)[number];

export interface PlatformSchool {
  id: string;
  name: string;
  slug?: string;
  is_active?: boolean | null;
}

export interface PlatformUser {
  id: string;
  email: string | null;
  full_name: string | null;
  role: PlatformUserRole | null;
  school_id: string | null;
  school_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  status: 'no_email' | 'email_verified' | 'email_not_verified';
}

export interface CreatePlatformUserInput {
  email: string;
  password: string;
  fullName: string;
  role: PlatformUserRole;
  schoolId: string | null;
}

export interface UpdatePlatformUserInput {
  userId: string;
  email: string;
  fullName: string;
  role: PlatformUserRole;
  schoolId: string | null;
}
