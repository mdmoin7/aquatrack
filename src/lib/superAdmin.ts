/** Comma-separated list of emails that receive superadmin on sign-in. */
const SUPERADMIN_EMAILS = (import.meta.env.VITE_SUPERADMIN_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean)

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return SUPERADMIN_EMAILS.includes(email.trim().toLowerCase())
}

export function getSuperAdminEmails(): string[] {
  return [...SUPERADMIN_EMAILS]
}
