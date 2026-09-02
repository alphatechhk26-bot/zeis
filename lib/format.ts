export function formatCurrency(amount: number, currency = "TZS") {
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount || 0)
  return `${currency} ${formatted}`
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n || 0)
}

export function formatDate(input: string | Date | null | undefined) {
  if (!input) return "—"
  const d = typeof input === "string" ? new Date(input) : input
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}
