import { collection, getDocsFromServer } from 'firebase/firestore'
import { Collections } from '@/lib/firestorePaths'
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase'

export interface FirestoreSyncStatus {
  societyId: string
  readingsPath: string
  flatsPath: string
  readingsOnServer: number
  flatsOnServer: number
  error: string | null
}

export function getFirestoreDataPaths(societyId: string) {
  return {
    readingsPath: `societies/${societyId}/readings`,
    flatsPath: `societies/${societyId}/flats`,
  }
}

/** Fetch document counts directly from Firestore servers (not offline cache). */
export async function fetchFirestoreSyncStatus(
  societyId: string,
): Promise<FirestoreSyncStatus> {
  const paths = getFirestoreDataPaths(societyId)
  const base: FirestoreSyncStatus = {
    societyId,
    readingsPath: paths.readingsPath,
    flatsPath: paths.flatsPath,
    readingsOnServer: 0,
    flatsOnServer: 0,
    error: null,
  }

  if (!isFirebaseConfigured) {
    return { ...base, error: 'Firebase is not configured in this build.' }
  }

  const firestore = getFirestoreDb()
  if (!firestore) {
    return { ...base, error: 'Firestore failed to initialize.' }
  }

  try {
    const [readingsSnap, flatsSnap] = await Promise.all([
      getDocsFromServer(collection(firestore, Collections.readings())),
      getDocsFromServer(collection(firestore, Collections.flats())),
    ])
    return {
      ...base,
      readingsOnServer: readingsSnap.size,
      flatsOnServer: flatsSnap.size,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not reach Firestore'
    return { ...base, error: message }
  }
}
