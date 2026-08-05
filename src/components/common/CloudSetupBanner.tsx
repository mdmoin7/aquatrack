import { useEffect, useState } from 'react'
import { AlertTriangle, CloudUpload } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppContext } from '@/context/AppContext'
import { getActiveSocietyId } from '@/lib/firestorePaths'
import { isLegacySocietyFlats } from '@/lib/societyData'
import { dataStore } from '@/services/dataStore'
import { loadJuly2026Society } from '@/data/seed'

type BannerMode = 'hidden' | 'empty' | 'legacy'

export function CloudSetupBanner() {
  const { isDemo } = useAuth()
  const { refresh } = useAppContext()
  const [mode, setMode] = useState<BannerMode>('hidden')
  const [seeding, setSeeding] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (isDemo) return
    void dataStore.getFlats().then((flats) => {
      if (flats.length === 0) setMode('empty')
      else if (isLegacySocietyFlats(flats)) setMode('legacy')
      else setMode('hidden')
    })
  }, [isDemo])

  if (isDemo || mode === 'hidden') return null

  const handleLoad = async () => {
    if (
      mode === 'legacy' &&
      !confirm(
        'This will delete all existing flats, readings, and billing data, then load July 2026 consumption (A001, B001, …). Continue?',
      )
    ) {
      return
    }

    setSeeding(true)
    setMessage('')
    try {
      await loadJuly2026Society({ replace: mode === 'legacy' })
      refresh()
      window.location.reload()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div
      className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 ${
        mode === 'legacy'
          ? 'border-amber-200 bg-amber-50'
          : 'border-sky-200 bg-sky-50'
      }`}
    >
      <CloudUpload
        className={`mt-0.5 h-5 w-5 shrink-0 ${mode === 'legacy' ? 'text-amber-600' : 'text-sky-600'}`}
      />
      <div className="flex-1 text-sm">
        <p className={`font-medium ${mode === 'legacy' ? 'text-amber-900' : 'text-sky-900'}`}>
          {mode === 'legacy'
            ? 'Legacy sample data detected (A-1B format)'
            : 'Load July 2026 consumption data'}
        </p>
        <p className={`mt-1 ${mode === 'legacy' ? 'text-amber-800' : 'text-sky-800'}`}>
          {mode === 'legacy' ? (
            <>
              Your society still has old demo flats/readings. Replace them with the real July 2026
              data for society{' '}
              <code className="rounded bg-amber-100 px-1">{getActiveSocietyId()}</code> (66 flats:
              A001, B001, Common, Pool, …).
            </>
          ) : (
            <>
              No flats found for society{' '}
              <code className="rounded bg-sky-100 px-1">{getActiveSocietyId()}</code>. Import the
              July 2026 meter readings (66 flats) from the bundled consumption file.
            </>
          )}
        </p>
        {message && (
          <p className="mt-2 flex items-center gap-1 text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            {message}
          </p>
        )}
        <button
          type="button"
          disabled={seeding}
          onClick={() => void handleLoad()}
          className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
            mode === 'legacy'
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-sky-600 hover:bg-sky-700'
          }`}
        >
          {seeding
            ? 'Loading...'
            : mode === 'legacy'
              ? 'Replace with July 2026 Data'
              : 'Load July 2026 Data'}
        </button>
      </div>
    </div>
  )
}
