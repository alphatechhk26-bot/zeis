// actions/settings.ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/zeis';

const settingsSchema = z.object({
  maintenance_mode: z.boolean(),
  default_term: z.string().min(1),
  email_notifications_enabled: z.boolean(),
  smtp_host: z.string().optional(),
  smtp_port: z.coerce.number().optional(),
  smtp_user: z.string().optional(),
  smtp_password: z.string().optional(),
});

export type SettingsState = {
  error?: string;
  success?: boolean;
};

export async function updateSystemSettings(
  prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  // 1. Strict RBAC Check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: 'Unauthorized.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'super_admin') {
    return { error: 'Forbidden: Only super_admins can modify system settings.' };
  }

  // 2. Parse & Validate
  const rawData = {
    maintenance_mode: formData.get('maintenance_mode') === 'on',
    default_term: formData.get('default_term') as string,
    email_notifications_enabled: formData.get('email_notifications_enabled') === 'on',
    smtp_host: formData.get('smtp_host') as string,
    smtp_port: formData.get('smtp_port') || undefined,
    smtp_user: formData.get('smtp_user') as string,
    smtp_password: formData.get('smtp_password') as string,
  };

  const validated = settingsSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: 'Invalid form data. Please check your inputs.' };
  }

  // 3. Update Database (using admin client to bypass RLS for super_admin writes)
  const adminClient = createAdminSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminClient
    .from('system_settings')
    .upsert({
      id: '00000000-0000-0000-0000-000000000000', // Fixed ID for the global row
      ...validated.data,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return { error: `Database error: ${error.message}` };
  }

  revalidatePath('/dashboard/super-admin/settings');
  return { success: true };
}