import type { AuthError } from 'firebase/auth'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled for this project.',
  'auth/requires-recent-login': 'Please sign in again before changing your password.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'Pop-up was blocked. Allow pop-ups for this site and try again.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
}

export function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as AuthError).code
    if (code in AUTH_ERROR_MESSAGES) return AUTH_ERROR_MESSAGES[code]
  }
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong. Please try again.'
}
