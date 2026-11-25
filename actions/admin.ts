'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  assignTeacherToClassSubject as assignSchoolTeacher,
  createStudent as createSchoolStudent,
  createTeacher as createSchoolTeacher,
} from '@/actions/school-admin';

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
  full_name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(254),
  password: z.string().min(8),
  admission_number: z.string().trim().min(1).max(50),
  enrollment_date: z.string(),
  status: z.enum(['active', 'transferred', 'graduated', 'withdrawn', 'suspended']),
  class_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  term_id: z.string().uuid().nullable(),
  stream_id: z.string().uuid().nullable(),
}).strict();

const createTeacherSchema = z.object({
  full_name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(254),
  password: z.string().min(8),
  employee_id: z.string().trim().max(100).nullable(),
  hire_date: z.string().nullable(),
  status: z.enum(['active', 'inactive', 'archived']),
}).strict();

const assignTeacherSchema = z.object({
  teacher_id: z.string().uuid(),
  class_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
}).strict();

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
  const validated = createStudentSchema.parse(input);
  return createSchoolStudent({
    fullName: validated.full_name,
    email: validated.email,
    password: validated.password,
    admissionNumber: validated.admission_number,
    enrollmentDate: validated.enrollment_date,
    status: validated.status,
    classId: validated.class_id,
    academicYearId: validated.academic_year_id,
    termId: validated.term_id,
    streamId: validated.stream_id,
  });
}

export async function createTeacher(input: z.infer<typeof createTeacherSchema>) {
  const validated = createTeacherSchema.parse(input);
  return createSchoolTeacher({
    fullName: validated.full_name,
    email: validated.email,
    password: validated.password,
    employeeId: validated.employee_id,
    hireDate: validated.hire_date,
    status: validated.status,
  });
}

export async function assignTeacherToClassSubject(input: z.infer<typeof assignTeacherSchema>) {
  const validated = assignTeacherSchema.parse(input);
  return assignSchoolTeacher({
    teacherId: validated.teacher_id,
    classId: validated.class_id,
    subjectId: validated.subject_id,
    academicYearId: validated.academic_year_id,
  });
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