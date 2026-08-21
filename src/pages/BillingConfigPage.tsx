import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Save, Truck, Plus, Trash2, Layers, HelpCircle } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useAppContext } from '@/context/AppContext'
import { formatCurrency, formatMonthLabel, calculateSlabWaterCharge } from '@/lib/billing'
import { formatLiters, DEFAULT_TANKER_CAPACITY_LITERS, DEFAULT_TANKER_COST_PER_TANKER } from '@/lib/tanker'
import { getBillingConfig, getSocietyStats, saveBillingConfig } from '@/services/billingService'
import { getProcurementSummary } from '@/services/tankerService'
import type { TankerProcurementSummary, SlabRate } from '@/types'

export function BillingConfigPage() {
  const { selectedMonth, refresh, refreshKey } = useAppContext()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [locked, setLocked] = useState(false)
  const [preview, setPreview] = useState({ totalCost: 0, effectiveRate: 0, totalKL: 0 })
  const [procurement, setProcurement] = useState<TankerProcurementSummary | null>(null)
  
  const [form, setForm] = useState<{
    tankerCapacityLiters: number
    tankerCost: number
    tankerCount: number
    maintenanceSurcharge: number
    billingMode: 'fixed' | 'slab'
    slabs: SlabRate[]
  }>({
    tankerCapacityLiters: DEFAULT_TANKER_CAPACITY_LITERS,
    tankerCost: DEFAULT_TANKER_COST_PER_TANKER,
    tankerCount: 0,
    maintenanceSurcharge: 5000,
    billingMode: 'fixed',
    slabs: [
      { limitKL: 10, ratePerKL: 50 },
      { limitKL: 20, ratePerKL: 80 },
      { limitKL: 999999, ratePerKL: 120 },
    ],
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
          billingMode: config.billingMode ?? 'fixed',
          slabs: config.slabs && config.slabs.length > 0 
            ? config.slabs 
            : [
                { limitKL: 10, ratePerKL: 50 },
                { limitKL: 20, ratePerKL: 80 },
                { limitKL: 999999, ratePerKL: 120 },
              ],
        })
        setLocked(config.locked)
      } else {
        // Reset to default on month change if no config
        setForm({
          tankerCapacityLiters: DEFAULT_TANKER_CAPACITY_LITERS,
          tankerCost: DEFAULT_TANKER_COST_PER_TANKER,
          tankerCount: proc ? proc.totalTankers : 0,
          maintenanceSurcharge: 5000,
          billingMode: 'fixed',
          slabs: [
            { limitKL: 10, ratePerKL: 50 },
            { limitKL: 20, ratePerKL: 80 },
            { limitKL: 999999, ratePerKL: 120 },
          ],
        })
        setLocked(false)
      }
      setProcurement(proc)
      setPreview({
        totalCost: config
          ? config.tankerCount * config.tankerCost + config.maintenanceSurcharge
          : (proc ? proc.totalCost + 5000 : 5000),
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
      // Validate slabs if in slab mode
      if (form.billingMode === 'slab') {
        if (form.slabs.length === 0) {
          throw new Error('Must configure at least one billing slab.')
        }
        // Ensure limit values are progressive
        const sorted = [...form.slabs].sort((a, b) => a.limitKL - b.limitKL)
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].limitKL >= sorted[i + 1].limitKL) {
            throw new Error('Slab limits must be strictly increasing.')
          }
        }
      }

      await saveBillingConfig({ month: selectedMonth, ...form })
      refresh()
      setPreview((p) => ({ ...p, totalCost: liveTotalCost, effectiveRate: liveEffectiveRate }))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const addSlab = () => {
    const current = [...form.slabs]
    if (current.length === 0) {
      current.push({ limitKL: 10, ratePerKL: 50 })
    } else if (current.length === 1) {
      const first = current[0]
      current[0] = { limitKL: 10, ratePerKL: first.ratePerKL }
      current.push({ limitKL: 999999, ratePerKL: first.ratePerKL + 30 })
    } else {
      const last = current[current.length - 1]
      const secondLast = current[current.length - 2]
      const newLimit = secondLast.limitKL + 10
      current.splice(current.length - 1, 0, { limitKL: newLimit, ratePerKL: Math.round((secondLast.ratePerKL + last.ratePerKL) / 2) })
    }
    setForm({ ...form, slabs: current })
  }

  const deleteSlab = (index: number) => {
    if (form.slabs.length <= 1) {
      alert('You must have at least one slab.')
      return
    }
    const current = form.slabs.filter((_, i) => i !== index)
    current[current.length - 1].limitKL = 999999
    setForm({ ...form, slabs: current })
  }

  const updateSlab = (index: number, field: 'limitKL' | 'ratePerKL', value: number) => {
    const current = form.slabs.map((slab, i) => {
      if (i === index) {
        return { ...slab, [field]: value }
      }
      return slab
    })
    setForm({ ...form, slabs: current })
  }

  const lightPreview = calculateSlabWaterCharge(5, form.slabs)
  const medPreview = calculateSlabWaterCharge(15, form.slabs)
  const heavyPreview = calculateSlabWaterCharge(25, form.slabs)

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
          <div className="mb-6 flex flex-col justify-between border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <h2 className="text-sm font-semibold text-slate-900">Monthly Configuration</h2>
            <div className="mt-3 flex rounded-xl border border-slate-200 p-0.5 text-xs font-medium sm:mt-0">
              <button
                type="button"
                disabled={locked}
                onClick={() => setForm({ ...form, billingMode: 'fixed' })}
                className={`rounded-lg px-3 py-1.5 transition-all duration-200 ${
                  form.billingMode === 'fixed'
                    ? 'bg-sky-500 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 disabled:opacity-50'
                }`}
              >
                Fixed Rate
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => setForm({ ...form, billingMode: 'slab' })}
                className={`rounded-lg px-3 py-1.5 transition-all duration-200 ${
                  form.billingMode === 'slab'
                    ? 'bg-sky-500 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 disabled:opacity-50'
                }`}
              >
                Tiered Slabs
              </button>
            </div>
          </div>

          {locked && (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              This month is locked. Configuration cannot be edited.
            </p>
          )}

          {form.billingMode === 'fixed' ? (
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
                    value={form[key as keyof typeof form] as number}
                    onChange={(e) =>
                      setForm({ ...form, [key]: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm disabled:bg-slate-50 focus:border-sky-500 focus:outline-none transition-colors"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Maintenance Surcharge (₹)</label>
                <input
                  type="number"
                  disabled={locked}
                  value={form.maintenanceSurcharge}
                  onChange={(e) =>
                    setForm({ ...form, maintenanceSurcharge: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm disabled:bg-slate-50 focus:border-sky-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-sky-500" />
                    Water Slabs Setup
                  </label>
                  {!locked && (
                    <button
                      type="button"
                      onClick={addSlab}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Slab
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {form.slabs.map((slab, idx) => {
                    const isLast = idx === form.slabs.length - 1;
                    return (
                      <div key={idx} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 animate-fade-in">
                        <span className="text-xs font-bold text-slate-400 w-16">
                          Slab #{idx + 1}
                        </span>

                        <div className="flex flex-1 items-center gap-2">
                          <span className="text-xs text-slate-500">Up to</span>
                          {isLast ? (
                            <span className="w-24 text-sm font-semibold text-slate-700 px-3 py-2 bg-slate-100 rounded-lg text-center">
                              ∞ kL
                            </span>
                          ) : (
                            <input
                              type="number"
                              disabled={locked}
                              value={slab.limitKL === 999999 ? '' : slab.limitKL}
                              onChange={(e) => updateSlab(idx, 'limitKL', Number(e.target.value))}
                              placeholder="Limit"
                              className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-center disabled:bg-slate-100 focus:outline-none focus:border-sky-500"
                            />
                          )}
                          <span className="text-xs text-slate-500">kL</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">@</span>
                          <input
                            type="number"
                            disabled={locked}
                            value={slab.ratePerKL}
                            onChange={(e) => updateSlab(idx, 'ratePerKL', Number(e.target.value))}
                            placeholder="Rate"
                            className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-right disabled:bg-slate-100 focus:outline-none focus:border-sky-500"
                          />
                          <span className="text-xs text-slate-500">₹/kL</span>
                        </div>

                        {!locked && (
                          <button
                            type="button"
                            onClick={() => deleteSlab(idx)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete Slab"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {!locked && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60 shadow-sm transition-all duration-200 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          )}
        </div>

        <div className="space-y-6">
          {form.billingMode === 'fixed' ? (
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
          ) : (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80">
              <h2 className="mb-4 font-semibold text-slate-900 flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-sky-500" />
                Slabs Preview Calculator
              </h2>
              <p className="mb-4 text-xs text-slate-500">
                Check how these slabs are calculated for different resident water consumption profiles.
              </p>

              <div className="space-y-4">
                {[
                  { label: 'Light User (5 kL)', result: lightPreview, value: 5 },
                  { label: 'Medium User (15 kL)', result: medPreview, value: 15 },
                  { label: 'Heavy User (25 kL)', result: heavyPreview, value: 25 },
                ].map(({ label, result, value }) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-semibold text-slate-800">{label}</span>
                      <span className="font-bold text-sky-600">{formatCurrency(result.charge)}</span>
                    </div>
                    <div className="mt-2 space-y-1 font-mono text-xs text-slate-500">
                      {result.breakdown
                        .filter((b) => b.consumptionInSlabKL > 0)
                        .map((b) => (
                          <div key={b.slabIndex} className="flex justify-between">
                            <span>
                              Slab {b.slabIndex} ({b.consumptionInSlabKL.toFixed(2)} kL @ ₹{b.ratePerKL})
                            </span>
                            <span>{formatCurrency(b.charge)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
