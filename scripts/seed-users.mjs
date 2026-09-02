// One-time seed of demo auth users (confirmed) for each role.
// Run with: node scripts/seed-users.mjs
import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHOOL_ID = "11111111-1111-1111-1111-111111111111"

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const users = [
  { email: "superadmin@zeis.ac.tz", password: "Password123!", full_name: "System Administrator", role: "super_admin", school_id: null },
  { email: "admin@zeis.ac.tz", password: "Password123!", full_name: "Salma Mohammed", role: "school_admin", school_id: SCHOOL_ID },
  { email: "teacher@zeis.ac.tz", password: "Password123!", full_name: "Amina Juma", role: "teacher", school_id: SCHOOL_ID },
  { email: "student@zeis.ac.tz", password: "Password123!", full_name: "Ali Mohammed", role: "student", school_id: SCHOOL_ID },
  { email: "parent@zeis.ac.tz", password: "Password123!", full_name: "Omar Haji", role: "parent", school_id: SCHOOL_ID },
]

async function findUserByEmail(email) {
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => u.email === email)
    if (found) return found
    if (data.users.length < 200) return null
    page++
  }
}

async function run() {
  const created = {}
  for (const u of users) {
    let existing = await findUserByEmail(u.email)
    if (existing) {
      console.log(`exists: ${u.email}`)
      created[u.role] = existing.id
      continue
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role, school_id: u.school_id },
    })
    if (error) {
      console.error(`error creating ${u.email}:`, error.message)
      continue
    }
    console.log(`created: ${u.email}`)
    created[u.role] = data.user.id
  }

  // Ensure profile role/school are correct (trigger may default before metadata parse in edge cases)
  for (const u of users) {
    if (!created[u.role]) continue
    await admin.from("profiles").update({
      role: u.role,
      school_id: u.school_id,
      full_name: u.full_name,
    }).eq("id", created[u.role])
  }

  // Link teacher profile to seeded teacher record (Amina Juma)
  if (created.teacher) {
    await admin.from("teachers").update({ profile_id: created.teacher })
      .eq("id", "22222222-0000-0000-0000-000000000001")
  }

  // Link student profile to a seeded student record (first Form 1A student)
  if (created.student) {
    const { data: s } = await admin.from("students")
      .select("id").eq("school_id", SCHOOL_ID).order("admission_no").limit(1)
    if (s && s[0]) {
      await admin.from("students").update({ profile_id: created.student }).eq("id", s[0].id)
    }
  }

  console.log("Seed complete.")
}

run().catch((e) => { console.error(e); process.exit(1) })
