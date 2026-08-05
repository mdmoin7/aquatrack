import { useCallback, useEffect, useState } from 'react'
import { CloudOff, RefreshCw, Upload } from 'lucide-react'
import { useAppContext } from '@/context/AppContext'
import { getPendingCount, listPendingReadings } from '@/services/readingQueueService'
import { flushReadingQueue } from '@/services/readingsService'

export function OfflineSyncBanner() {
  const { refresh } = useAppContext()
  const [online, setOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')

  const loadPending = useCallback(async () => {
    setPendingCount(await getPendingCount())
  }, [])

  const handleSync = useCallback(async () => {
    if (!navigator.onLine) return
    setSyncing(true)
    setMessage('')
    try {
      const result = await flushReadingQueue()
      await loadPending()
      if (result.synced > 0) refresh()
      if (result.synced > 0 || result.failed > 0) {
        setMessage(
          result.failed > 0
            ? `Synced ${result.synced}, ${result.failed} failed`
            : `Synced ${result.synced} reading${result.synced === 1 ? '' : 's'}`,
        )
      }
      if (result.failed > 0) {
        const failed = await listPendingReadings()
        const errors = failed
          .filter((p) => p.lastError)
          .map((p) => p.lastError)
          .slice(0, 1)
        if (errors[0]) setMessage(errors[0]!)
      }
    } finally {
      setSyncing(false)
    }
  }, [loadPending, refresh])

  useEffect(() => {
    void loadPending()
    const onOnline = () => {
      setOnline(true)
      void handleSync()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [handleSync, loadPending])

  if (online && pendingCount === 0 && !message) return null

  return (
    <div
      className={`mb-6 flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        online ? 'border-sky-200 bg-sky-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-start gap-3">
        {online ? (
          <Upload className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
        ) : (
          <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        )}
        <div className="text-sm">
          <p className={`font-medium ${online ? 'text-sky-900' : 'text-amber-900'}`}>
            {online
              ? pendingCount > 0
                ? `${pendingCount} reading${pendingCount === 1 ? '' : 's'} waiting to sync`
                : 'Offline queue clear'
              : 'Offline — readings saved on this device'}
          </p>
          <p className={`mt-0.5 ${online ? 'text-sky-800' : 'text-amber-800'}`}>
            {online
              ? 'Tap sync when back on network to upload queued meter entries.'
              : 'New readings are queued locally and will sync when you reconnect.'}
          </p>
          {message && <p className="mt-1 text-xs text-slate-600">{message}</p>}
        </div>
      </div>
      {online && pendingCount > 0 && (
        <button
          type="button"
          disabled={syncing}
          onClick={() => void handleSync()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      )}
    </div>
  )
}
