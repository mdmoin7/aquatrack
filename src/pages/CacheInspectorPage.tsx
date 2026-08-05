import { RefreshCw, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { useCacheContext } from '@/context/CacheContext'

export function CacheInspectorPage() {
  const { config, entries, updateConfig, invalidate, clearAll, reload } = useCacheContext()

  return (
    <div>
      <PageHeader
        title="Cache Inspector"
        description="Application-level cache with configurable TTL and IndexedDB support"
        actions={
          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200/80">
          <h2 className="mb-4 font-semibold text-slate-900">Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                TTL (minutes)
              </label>
              <input
                type="number"
                value={Math.round(config.ttlMs / 60000)}
                onChange={(e) =>
                  updateConfig({ ttlMs: Number(e.target.value) * 60000 })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={config.useIndexedDB}
                onChange={(e) => updateConfig({ useIndexedDB: e.target.checked })}
                className="rounded border-slate-300"
              />
              Use IndexedDB persistence
            </label>
          </div>
          <button
            type="button"
            onClick={() => void clearAll()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
          >
            <Trash2 className="h-4 w-4" />
            Clear All Cache
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200/80">
          <h2 className="mb-4 font-semibold text-slate-900">Cache Stats</h2>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Entries" value={String(entries.length)} />
            <Stat
              label="Expired"
              value={String(entries.filter((e) => Date.now() > e.expiresAt).length)}
            />
            <Stat label="TTL" value={`${Math.round(config.ttlMs / 60000)} min`} />
            <Stat label="Storage" value={config.useIndexedDB ? 'IndexedDB + Memory' : 'Memory'} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-slate-200/80">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Cache Entries</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {entries.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">No cache entries</p>
          ) : (
            entries.map((entry) => {
              const expired = Date.now() > entry.expiresAt
              return (
                <div
                  key={entry.key}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <p className="font-mono text-sm text-slate-800">{entry.key}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Created {new Date(entry.createdAt).toLocaleString()} · Expires{' '}
                      {new Date(entry.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        expired
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {expired ? 'Expired' : 'Active'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void invalidate(entry.key)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  )
}
