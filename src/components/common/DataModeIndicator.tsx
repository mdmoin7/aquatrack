import { Cloud, HardDrive } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { formatReleaseLabel, getAppRelease } from '@/lib/release'

export function DataModeIndicator() {
  const { isDemo } = useAuth()
  const release = getAppRelease()

  if (isDemo) {
    return (
      <div
        className="mx-3 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
        title="Data is stored in this browser only — not synced to Firebase"
      >
        <div className="flex items-start gap-2">
          <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-900">Demo mode</p>
            <p className="mt-0.5 font-mono text-[10px] leading-snug text-amber-800">
              {formatReleaseLabel(release)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="mx-3 mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5"
      title="Connected to Firebase Firestore"
    >
      <div className="flex items-start gap-2">
        <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emerald-900">Cloud connected</p>
          <p className="mt-0.5 font-mono text-[10px] leading-snug text-emerald-800">
            {formatReleaseLabel(release)}
          </p>
        </div>
      </div>
    </div>
  )
}
