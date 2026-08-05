import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase'
import { getAuthErrorMessage } from '@/lib/authErrors'

function requireAuth() {
  const auth = getFirebaseAuth()
  if (!auth) throw new Error('Firebase Authentication is not configured')
  return auth
}

export function subscribeToAuthState(
  callback: (user: FirebaseUser | null) => void,
): () => void {
  const auth = getFirebaseAuth()
  if (!auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}

export function getCurrentAuthUser(): FirebaseUser | null {
  return getFirebaseAuth()?.currentUser ?? null
}

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const auth = requireAuth()
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
    return credential.user
  } catch (error) {
    throw new Error(getAuthErrorMessage(error))
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<FirebaseUser> {
  const auth = requireAuth()
  try {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
    if (displayName.trim()) {
      await updateProfile(credential.user, { displayName: displayName.trim() })
    }
    return credential.user
  } catch (error) {
    throw new Error(getAuthErrorMessage(error))
  }
}

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth()
  if (auth) await firebaseSignOut(auth)
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = requireAuth()
  try {
    await sendPasswordResetEmail(auth, email.trim())
  } catch (error) {
    throw new Error(getAuthErrorMessage(error))
  }
}

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const auth = requireAuth()
  try {
    const credential = await signInWithPopup(auth, googleProvider)
    return credential.user
  } catch (error) {
    throw new Error(getAuthErrorMessage(error))
  }
}
