'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ----------------------------------------------------------------------
// Helpers & Utilities
// ----------------------------------------------------------------------

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Unauthorized: Please log in.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Profile not found.');
  }

  const userRole = (profile as Record<string, any>).role;
  const schoolId = (profile as Record<string, any>).school_id;

  if (!['admin', 'super_admin'].includes(userRole)) {
    throw new Error('Forbidden: Admin privileges required.');
  }

  return { userId: user.id, role: userRole, schoolId };
}

function generateRegistrationNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `STU-${year}-${random}`;
}

// ----------------------------------------------------------------------
// Zod Schemas
// ----------------------------------------------------------------------

const schoolSchema = z.object({
  name: z.string().min(1, 'School name is required.'),
  slug: z.string().min(1, 'Slug is required.').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens.'),
  branding: z.record(z.any()).optional(),
  is_active: z.boolean().default(true),
});

const updateSchoolSchema = schoolSchema.partial().extend({
  id: z.string().uuid('Invalid school ID.'),
});

const createStudentSchema = z.object({
  school_id: z.string().uuid('Invalid school ID.'),
  full_name: z.string().min(1, 'Full name is required.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  enrollment_date: z.string().optional(),
  status: z.enum(['active', 'transferred', 'graduated', 'withdrawn', 'suspended']).default('active'),
});

const createTeacherSchema = z.object({
  school_id: z.string().uuid('Invalid school ID.'),
  full_name: z.string().min(1, 'Full name is required.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  employee_id: z.string().optional(),
  hire_date: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
});

const assignTeacherSchema = z.object({
  teacher_id: z.string().uuid('Invalid teacher ID.'),
  class_id: z.string().uuid('Invalid class ID.'),
  subject_id: z.string().uuid('Invalid subject ID.'),
  academic_year_id: z.string().uuid('Invalid academic year ID.'),
});

// ----------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------

export async function registerSchool(input: z.infer<typeof schoolSchema>) {
  const { role } = await assertAdmin();
  if (role !== 'super_admin') {
    throw new Error('Only super_admin can register new schools.');
  }

  const validated = schoolSchema.parse(input);
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from('schools')
    .insert({
      name: validated.name,
      slug: validated.slug,
      branding: validated.branding || {},
      is_active: validated.is_active,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to register school: ${error.message}`);

  revalidatePath('/admin/schools');
  return { success: true, data };
}

export async function updateSchool(input: z.infer<typeof updateSchoolSchema>) {
  const { userId, role } = await assertAdmin();
  const validated = updateSchoolSchema.parse(input);
  const supabase = (await createClient()) as any;

  if (role === 'admin') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', userId)
      .single();

    if (!profile || (profile as Record<string, any>).school_id !== validated.id) {
      throw new Error('You can only update your own school.');
    }
  }

  const { id, ...updates } = validated;

  const { data, error } = await supabase
    .from('schools')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update school: ${error.message}`);

  revalidatePath('/admin/schools');
  revalidatePath(`/admin/schools/${id}`);
  return { success: true, data };
}

export async function createStudent(input: z.infer<typeof createStudentSchema>) {
  const { userId, role } = await assertAdmin();
  const validated = createStudentSchema.parse(input);
  const supabase = (await createClient()) as any;

  if (role === 'admin') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', userId)
      .single();

    if (!profile || (profile as Record<string, any>).school_id !== validated.school_id) {
      throw new Error('You can only create students for your own school.');
    }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: validated.email,
    password: validated.password,
    email_confirm: true,
    user_metadata: { full_name: validated.full_name },
  });

  if (authError) throw new Error(`Failed to create user: ${authError.message}`);

  const userId_new = authData.user.id;

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: userId_new,
      school_id: validated.school_id,
      role: 'student',
      full_name: validated.full_name,
    });

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId_new);
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  const regNumber = generateRegistrationNumber();
  const { error: studentError } = await supabase
    .from('students')
    .insert({
      id: userId_new,
      school_id: validated.school_id,
      admission_number: regNumber,
      enrollment_date: validated.enrollment_date || new Date().toISOString().split('T')[0],
      status: validated.status,
    });

  if (studentError) {
    await supabase.from('profiles').delete().eq('id', userId_new);
    await supabase.auth.admin.deleteUser(userId_new);
    throw new Error(`Failed to create student record: ${studentError.message}`);
  }

  revalidatePath('/admin/students');
  return { success: true, data: { user_id: userId_new, admission_number: regNumber } };
}

export async function createTeacher(input: z.infer<typeof createTeacherSchema>) {
  const { userId, role } = await assertAdmin();
  const validated = createTeacherSchema.parse(input);
  const supabase = (await createClient()) as any;

  if (role === 'admin') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', userId)
      .single();

    if (!profile || (profile as Record<string, any>).school_id !== validated.school_id) {
      throw new Error('You can only create teachers for your own school.');
    }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: validated.email,
    password: validated.password,
    email_confirm: true,
    user_metadata: { full_name: validated.full_name },
  });

  if (authError) throw new Error(`Failed to create user: ${authError.message}`);

  const userId_new = authData.user.id;

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: userId_new,
      school_id: validated.school_id,
      role: 'teacher',
      full_name: validated.full_name,
    });

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId_new);
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  const { error: teacherError } = await supabase
    .from('teachers')
    .insert({
      id: userId_new,
      school_id: validated.school_id,
      employee_id: validated.employee_id || null,
      hire_date: validated.hire_date || null,
      status: validated.status,
    });

  if (teacherError) {
    await supabase.from('profiles').delete().eq('id', userId_new);
    await supabase.auth.admin.deleteUser(userId_new);
    throw new Error(`Failed to create teacher record: ${teacherError.message}`);
  }

  revalidatePath('/admin/teachers');
  return { success: true, data: { user_id: userId_new } };
}

export async function assignTeacherToClassSubject(input: z.infer<typeof assignTeacherSchema>) {
  const { userId, role } = await assertAdmin();
  const validated = assignTeacherSchema.parse(input);
  const supabase = (await createClient()) as any;

  if (role === 'admin') {
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', userId)
      .single();

    if (!adminProfile) throw new Error('Admin profile not found.');

    const { data: teacher } = await supabase
      .from('teachers')
      .select('school_id')
      .eq('id', validated.teacher_id)
      .single();

    if (!teacher || (teacher as Record<string, any>).school_id !== (adminProfile as Record<string, any>).school_id) {
      throw new Error('Teacher does not belong to your school.');
    }

    const { data: classData } = await supabase
      .from('classes')
      .select('school_id')
      .eq('id', validated.class_id)
      .single();

    if (!classData || (classData as Record<string, any>).school_id !== (adminProfile as Record<string, any>).school_id) {
      throw new Error('Class does not belong to your school.');
    }

    const { data: yearData } = await supabase
      .from('academic_years')
      .select('school_id')
      .eq('id', validated.academic_year_id)
      .single();

    if (!yearData || (yearData as Record<string, any>).school_id !== (adminProfile as Record<string, any>).school_id) {
      throw new Error('Academic year does not belong to your school.');
    }

    const { data: subjectData } = await supabase
      .from('subjects')
      .select('school_id')
      .eq('id', validated.subject_id)
      .single();

    if (!subjectData || (subjectData as Record<string, any>).school_id !== (adminProfile as Record<string, any>).school_id) {
      throw new Error('Subject does not belong to your school.');
    }
  }

  const { error } = await supabase
    .from('teacher_assignments')
    .insert({
      teacher_id: validated.teacher_id,
      class_id: validated.class_id,
      subject_id: validated.subject_id,
      academic_year_id: validated.academic_year_id,
    });

  if (error) throw new Error(`Failed to assign teacher: ${error.message}`);

  revalidatePath('/admin/assignments');
  return { success: true, message: 'Teacher assigned successfully.' };
}
// actions/admin.ts

// ... (your existing code: registerSchool, updateSchool, createStudent, etc.) ...

// ----------------------------------------------------------------------
// 6. Toggle School Status (Active / Suspended)
// ----------------------------------------------------------------------

const toggleSchoolStatusSchema = z.object({
  id: z.string().uuid('Invalid school ID.'),
  is_active: z.boolean(),
});

export async function toggleSchoolStatus(input: z.infer<typeof toggleSchoolStatusSchema>) {
  const { role } = await assertAdmin();
  
  if (role !== 'super_admin') {
    throw new Error('Only super_admin can change school status.');
  }

  const validated = toggleSchoolStatusSchema.parse(input);
  // actions/admin.ts

// Change this:
// const adminClient = createAdminClient();

// To this:
const adminClient = createAdminClient() as any; // 👈 Explicit cast fixes the 'never' error
  const { error } = await adminClient
    .from('schools')
    .update({ is_active: validated.is_active })
    .eq('id', validated.id);

  if (error) throw new Error(`Failed to update status: ${error.message}`);

  // Revalidate the path so the UI updates immediately
  revalidatePath('/dashboard/super-admin/schools');
  
  return { success: true };
}