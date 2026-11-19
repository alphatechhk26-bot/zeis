// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getSupabaseProxyCredentials,
  warnIfSupabaseProxyCredentialsMissing,
} from '@/lib/supabase/proxy';
import type { Database } from '@/types/zeis';

// Role-to-path mapping for dashboards
const ROLE_DASHBOARD_MAP: Record<string, string> = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/teacher',
  student: '/dashboard/student',
  parent: '/dashboard/parent',
};

// Path prefixes that require a specific role
const PROTECTED_ROUTES: Record<string, string[]> = {
  '/dashboard/super-admin': ['super_admin'],
  '/dashboard/admin': ['admin', 'super_admin'], // admins can also access admin dashboard
  '/dashboard/teacher': ['teacher', 'admin', 'super_admin'],
  '/dashboard/student': ['student', 'parent', 'teacher', 'admin', 'super_admin'], // parents might view student dashboard? We'll keep to role exactly.
  '/dashboard/parent': ['parent', 'admin', 'super_admin'],
};

export async function proxy(request: NextRequest) {
  // Create a response object to modify cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { url, anonKey } = getSupabaseProxyCredentials();
  if (warnIfSupabaseProxyCredentialsMissing(url, anonKey)) {
    return response;
  }

  // Create a Supabase client with cookie handling
  const supabase = createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. If no user, redirect to login for protected routes
  const isProtectedRoute = Object.keys(PROTECTED_ROUTES).some(prefix =>
    pathname.startsWith(prefix)
  );

  if (!user) {
    if (isProtectedRoute || pathname.startsWith('/dashboard')) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirectedFrom', pathname);
      return NextResponse.redirect(redirectUrl);
    }
    // Allow public routes (e.g., /login, /, public pages)
    return response;
  }

  // 2. User is logged in – get their role from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // If no profile or error, sign out or redirect to error page
  if (profileError || !profile) {
    // Possibly sign out the user (invalid profile)
    await supabase.auth.signOut();
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('error', 'profile_not_found');
    return NextResponse.redirect(redirectUrl);
  }

  const userRole = (profile as any).role;

  // 3. Redirect authenticated user away from login page
  if (pathname === '/login') {
    const dashboard = ROLE_DASHBOARD_MAP[userRole] || '/dashboard/student';
    return NextResponse.redirect(new URL(dashboard, request.url));
  }

  // 4. Protect role-specific dashboard routes
  // Check if the current path is under one of the protected prefixes
  let matchedPrefix: string | null = null;
  for (const [prefix, allowedRoles] of Object.entries(PROTECTED_ROUTES)) {
    if (pathname.startsWith(prefix)) {
      matchedPrefix = prefix;
      // If the user's role is not allowed for this prefix, redirect to their own dashboard
      if (!allowedRoles.includes(userRole)) {
        const dashboard = ROLE_DASHBOARD_MAP[userRole] || '/dashboard/student';
        return NextResponse.redirect(new URL(dashboard, request.url));
      }
      break;
    }
  }

  // 5. (Optional) If the user tries to access a /dashboard/* route that isn't explicitly defined,
  // redirect to their own dashboard.
  if (pathname.startsWith('/dashboard') && !matchedPrefix) {
    const dashboard = ROLE_DASHBOARD_MAP[userRole] || '/dashboard/student';
    return NextResponse.redirect(new URL(dashboard, request.url));
  }

  // 6. All checks passed – allow the request
  return response;
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     * - public folder
     * - api/auth (auth endpoints handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api/auth).*)',
  ],
};