import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { canAccessPortal, ROLE_HOME, type UserRole } from "@/lib/rbac"

const PROTECTED_PREFIXES = ["/admin", "/teacher", "/student", "/parent"]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { secure: process.env.NODE_ENV === "production" },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("next", path)
    return NextResponse.redirect(url)
  }

  if (isProtected && user) {
    const role = (user.user_metadata?.role as UserRole) ?? "student"
    const portal = path.split("/")[1]
    if (!canAccessPortal(portal, role)) {
      const url = request.nextUrl.clone()
      url.pathname = ROLE_HOME[role] ?? "/auth/login"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
