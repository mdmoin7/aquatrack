import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Save, Truck } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useAppContext } from '@/context/AppContext'
import { formatCurrency, formatMonthLabel } from '@/lib/billing'
import { formatLiters, DEFAULT_TANKER_CAPACITY_LITERS, DEFAULT_TANKER_COST_PER_TANKER } from '@/lib/tanker'
import { getBillingConfig, getSocietyStats, saveBillingConfig } from '@/services/billingService'
import { getProcurementSummary } from '@/services/tankerService'
import type { TankerProcurementSummary } from '@/types'

export function BillingConfigPage() {
  const { selectedMonth, refresh, refreshKey } = useAppContext()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [locked, setLocked] = useState(false)
  const [preview, setPreview] = useState({ totalCost: 0, effectiveRate: 0, totalKL: 0 })
  const [procurement, setProcurement] = useState<TankerProcurementSummary | null>(null)
  const [form, setForm] = useState({
    tankerCapacityLiters: DEFAULT_TANKER_CAPACITY_LITERS,
    tankerCost: DEFAULT_TANKER_COST_PER_TANKER,
    tankerCount: 0,
    maintenanceSurcharge: 5000,
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([
      getBillingConfig(selectedMonth),
      getSocietyStats(selectedMonth),
      getProcurementSummary(selectedMonth),
    ]).then(([config, stats, proc]) => {
        if (cancelled) return
        if (config) {
          setForm({
            tankerCapacityLiters: config.tankerCapacityLiters,
            tankerCost: config.tankerCost,
            tankerCount: config.tankerCount,
            maintenanceSurcharge: config.maintenanceSurcharge,
          })
          setLocked(config.locked)
        }
        setProcurement(proc)
        setPreview({
          totalCost: config
            ? config.tankerCount * config.tankerCost + config.maintenanceSurcharge
            : 0,
          effectiveRate: stats.effectiveRatePerKL,
          totalKL: stats.totalConsumptionKL,
        })
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedMonth, refreshKey])

  const liveTotalCost = form.tankerCount * form.tankerCost + form.maintenanceSurcharge
  const liveEffectiveRate =
    preview.totalKL > 0 ? Math.round((liveTotalCost / preview.totalKL) * 100) / 100 : 0

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveBillingConfig({ month: selectedMonth, ...form })
      refresh()
      setPreview((p) => ({ ...p, totalCost: liveTotalCost, effectiveRate: liveEffectiveRate }))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title="Billing Configuration"
        description={`Tanker & rate setup for ${formatMonthLabel(selectedMonth)}`}
      />

      {procurement && procurement.totalTankers > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
          <Truck className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
          <div className="text-sm text-sky-900">
            <p className="font-medium">Linked to Tanker Procurement</p>
            <p className="mt-1 text-sky-700">
              {procurement.totalTankers} tankers delivered ·{' '}
              {formatLiters(procurement.totalLiters)} · {formatCurrency(procurement.totalCost)} total
              cost.{' '}
              <Link to="/procurement" className="font-medium underline">
                View procurement
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80">
          <h2 className="mb-4 font-semibold text-slate-900">Monthly Configuration</h2>
          {locked && (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              This month is locked. Configuration cannot be edited.
            </p>
          )}
          <div className="space-y-4">
            {[
              { key: 'tankerCapacityLiters', label: 'Tanker Capacity (L)' },
              { key: 'tankerCost', label: 'Cost Per Tanker (₹)' },
              { key: 'tankerCount', label: 'Tanker Count' },
              { key: 'maintenanceSurcharge', label: 'Maintenance Surcharge (₹)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
                <input
                  type="number"
                  disabled={locked}
                  value={form[key as keyof typeof form]}
                  onChange={(e) =>
                    setForm({ ...form, [key]: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm disabled:bg-slate-50"
                />
              </div>
            ))}
          </div>
          {!locked && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80">
          <h2 className="mb-4 font-semibold text-slate-900">Billing Formula Preview</h2>
          <div className="space-y-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-700">
            <div>
              <p className="font-medium text-slate-900">Total Water Cost</p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                Tanker Count × Cost Per Tanker + Maintenance
              </p>
              <p className="mt-2 text-lg font-semibold text-sky-600">
                {formatCurrency(liveTotalCost)}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-900">Society Consumption</p>
              <p className="mt-2 text-lg font-semibold">{preview.totalKL.toFixed(2)} kL</p>
            </div>
            <div>
              <p className="font-medium text-slate-900">Effective ₹/kL</p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                Total Water Cost ÷ Total Society Consumption
              </p>
              <p className="mt-2 text-lg font-semibold text-emerald-600">
                {formatCurrency(liveEffectiveRate)}/kL
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-900">Resident Bill</p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                Resident Consumption (kL) × Effective ₹/kL
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
