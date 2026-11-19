import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { canAccessPortal, ROLE_HOME, type UserRole } from "@/lib/rbac"

const PROTECTED_PREFIXES = ["/admin", "/teacher", "/student", "/parent"]

export function getSupabaseProxyCredentials() {
  const normalize = (value: string | undefined) => {
    let normalized = value?.trim() ?? ""
    while (
      normalized.length >= 2 &&
      ((normalized[0] === '"' && normalized[normalized.length - 1] === '"') ||
        (normalized[0] === "'" && normalized[normalized.length - 1] === "'"))
    ) {
      normalized = normalized.slice(1, -1).trim()
    }
    return normalized
  }

  return {
    url: normalize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: normalize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  }
}

export function warnIfSupabaseProxyCredentialsMissing(url: string, anonKey: string) {
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean)

  if (missing.length === 0) return false

  console.warn(
    `[ZEIS proxy] Missing or empty ${missing.join(" and ")}; skipping Supabase session and role checks for this request.`,
  )
  return true
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const { url, anonKey } = getSupabaseProxyCredentials()

  if (warnIfSupabaseProxyCredentialsMissing(url, anonKey)) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    url,
    anonKey,
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
