import type { DocumentData } from 'firebase/firestore'

/** Firestore rejects undefined field values — strip them before setDoc. */
export function sanitizeForFirestore(value: unknown): DocumentData {
  if (value === null || typeof value !== 'object') {
    return value as DocumentData
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)) as unknown as DocumentData
  }

  const out: DocumentData = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue
    out[key] =
      entry !== null && typeof entry === 'object'
        ? sanitizeForFirestore(entry)
        : entry
  }
  return out
}
