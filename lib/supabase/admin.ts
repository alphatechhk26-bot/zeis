// lib/supabase/admin.ts
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js'; // 👈 Added SupabaseClient
import type { Database } from '@/types/zeis';

export function createAdminClient(): SupabaseClient<Database> { // 👈 Added explicit return type
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}