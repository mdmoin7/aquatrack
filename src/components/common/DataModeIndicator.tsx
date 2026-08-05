import { useEffect, useState } from 'react'
import { AlertTriangle, Cloud, HardDrive, RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppContext } from '@/context/AppContext'
import { fetchFirestoreSyncStatus, type FirestoreSyncStatus } from '@/lib/firestoreStatus'
import { getActiveSocietyId } from '@/lib/firestorePaths'

export function DataModeIndicator() {
  const { isDemo } = useAuth()
  const { refreshKey } = useAppContext()
  const societyId = getActiveSocietyId()
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined
  const [status, setStatus] = useState<FirestoreSyncStatus | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (isDemo) {
      setStatus(null)
      return
    }

    let cancelled = false
    setChecking(true)
    void fetchFirestoreSyncStatus(societyId).then((next) => {
      if (!cancelled) {
        setStatus(next)
        setChecking(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [isDemo, societyId, refreshKey])

  const handleRefresh = () => {
    if (isDemo) return
    setChecking(true)
    void fetchFirestoreSyncStatus(societyId).then((next) => {
      setStatus(next)
      setChecking(false)
    })
  }

  if (isDemo) {
    return (
      <div
        className="mx-3 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
        title="Data is stored in this browser only — not synced to Firebase"
      >
        <div className="flex items-start gap-2">
          <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-900">Demo mode — not in Firestore</p>
            <p className="mt-0.5 text-[11px] leading-snug text-amber-800">
              Data is saved in this browser only. Set <code className="text-[10px]">VITE_FIREBASE_*</code>{' '}
              in <code className="text-[10px]">.env</code> and rebuild to use cloud.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const hasServerData =
    status && !status.error && (status.readingsOnServer > 0 || status.flatsOnServer > 0)

  return (
    <div
      className={`mx-3 mb-3 rounded-xl border px-3 py-2.5 ${
        status?.error
          ? 'border-rose-200 bg-rose-50'
          : hasServerData
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-sky-200 bg-sky-50'
      }`}
    >
      <div className="flex items-start gap-2">
        {status?.error ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
        ) : (
          <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-xs font-semibold ${
                status?.error ? 'text-rose-900' : 'text-emerald-900'
              }`}
            >
              {status?.error ? 'Cloud sync issue' : 'Cloud connected'}
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={checking}
              className="rounded p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-50"
              title="Refresh sync status"
            >
              <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="truncate text-[11px] leading-snug text-slate-600">
            {projectId ?? 'Firebase'} · {societyId}
          </p>
          {status && !status.error && (
            <p className="mt-1 text-[11px] leading-snug text-slate-700">
              Server: {status.readingsOnServer} readings, {status.flatsOnServer} flats
            </p>
          )}
          <p className="mt-1 break-all font-mono text-[10px] leading-snug text-slate-500">
            {status?.readingsPath ?? `societies/${societyId}/readings`}
          </p>
          {status?.error && (
            <p className="mt-1 text-[11px] leading-snug text-rose-800">{status.error}</p>
          )}
          {status && !status.error && status.readingsOnServer === 0 && (
            <p className="mt-1 text-[11px] leading-snug text-sky-800">
              No readings on server yet. Use Dashboard → Load July 2026 Data, or sign in as admin
              to add readings.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
