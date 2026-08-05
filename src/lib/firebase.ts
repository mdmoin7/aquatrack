import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null
  if (!app) {
    app = initializeApp(firebaseConfig)
  }
  return app
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  if (!auth) {
    auth = getAuth(firebaseApp)
    if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
    }
  }
  return auth
}

export function getFirestoreDb(): Firestore | null {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  if (!db) {
    if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
      db = getFirestore(firebaseApp)
      connectFirestoreEmulator(db, 'localhost', 8080)
    } else {
      db = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      })
    }
  }
  return db
}
