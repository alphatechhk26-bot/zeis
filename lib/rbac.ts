export type UserRole = "super_admin" | "school_admin" | "teacher" | "student" | "parent"

export const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/admin",
  school_admin: "/admin",
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
}

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super Administrator",
  school_admin: "School Administrator",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent / Guardian",
}

// Which role(s) may access a given top-level portal segment.
export const PORTAL_ACCESS: Record<string, UserRole[]> = {
  admin: ["super_admin", "school_admin"],
  teacher: ["teacher", "school_admin", "super_admin"],
  student: ["student"],
  parent: ["parent"],
}

export function canAccessPortal(portal: string, role: UserRole): boolean {
  const allowed = PORTAL_ACCESS[portal]
  if (!allowed) return true
  return allowed.includes(role)
}
