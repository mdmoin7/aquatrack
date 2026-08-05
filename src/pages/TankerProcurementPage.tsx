import { useEffect, useState } from 'react'
import { Link2, Plus, RefreshCw, Trash2, Truck } from 'lucide-react'
import DataTable from 'react-data-table-component'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatKL, formatMonthLabel } from '@/lib/billing'
import { formatLiters, DEFAULT_TANKER_CAPACITY_LITERS, DEFAULT_TANKER_COST_PER_TANKER } from '@/lib/tanker'
import {
  deleteDelivery,
  getDeliveries,
  getProcurementSummary,
  getVendors,
  saveDelivery,
  syncProcurementToBilling,
} from '@/services/tankerService'
import type { TankerDelivery, TankerOrderStatus, TankerProcurementSummary, TankerVendor } from '@/types'
import { TANKER_STATUS_LABELS } from '@/types'

const STATUS_STYLES: Record<TankerOrderStatus, string> = {
  planned: 'bg-slate-100 text-slate-700',
  ordered: 'bg-sky-50 text-sky-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-600',
}

export function TankerProcurementPage() {
  const { selectedMonth, refresh, refreshKey } = useAppContext()
  const { user } = useAuth()
  const [deliveries, setDeliveries] = useState<TankerDelivery[]>([])
  const [summary, setSummary] = useState<TankerProcurementSummary | null>(null)
  const [vendors, setVendors] = useState<TankerVendor[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    vendorId: '',
    deliveryDate: new Date().toISOString().slice(0, 10),
    tankerCount: 1,
    capacityLiters: DEFAULT_TANKER_CAPACITY_LITERS,
    costPerTanker: DEFAULT_TANKER_COST_PER_TANKER,
    invoiceNumber: '',
    status: 'delivered' as TankerOrderStatus,
    notes: '',
  })

  const load = async () => {
    setLoading(true)
    const [d, s, v] = await Promise.all([
      getDeliveries(selectedMonth),
      getProcurementSummary(selectedMonth),
      getVendors(),
    ])
    setDeliveries(d)
    setSummary(s)
    setVendors(v)
    if (v.length && !form.vendorId) {
      setForm((f) => ({
        ...f,
        vendorId: v[0].id,
        capacityLiters: v[0].defaultCapacityLiters,
        costPerTanker: v[0].defaultCostPerTanker,
      }))
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [selectedMonth, refreshKey])

  const handleVendorChange = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId)
    setForm((f) => ({
      ...f,
      vendorId,
      capacityLiters: vendor?.defaultCapacityLiters ?? f.capacityLiters,
      costPerTanker: vendor?.defaultCostPerTanker ?? f.costPerTanker,
    }))
  }

  const handleSave = async () => {
    setError('')
    const vendor = vendors.find((v) => v.id === form.vendorId)
    if (!vendor) {
      setError('Select a vendor')
      return
    }
    try {
      await saveDelivery({
        month: selectedMonth,
        deliveryDate: form.deliveryDate,
        vendorId: vendor.id,
        vendorName: vendor.name,
        tankerCount: form.tankerCount,
        capacityLiters: form.capacityLiters,
        costPerTanker: form.costPerTanker,
        invoiceNumber: form.invoiceNumber || undefined,
        status: form.status,
        notes: form.notes || undefined,
        orderedBy: user?.displayName ?? 'Admin',
      })
      setShowForm(false)
      refresh()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save delivery')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this procurement record?')) return
    try {
      await deleteDelivery(id)
      refresh()
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const handleSyncBilling = async () => {
    setSyncing(true)
    try {
      await syncProcurementToBilling(selectedMonth)
      refresh()
      alert('Billing configuration updated from procurement records.')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const chartData = deliveries
    .filter((d) => d.status === 'delivered')
    .map((d) => ({
      date: new Date(d.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      tankers: d.tankerCount,
      liters: d.totalLiters / 1000,
      cost: d.totalCost,
    }))

  const columns = [
    {
      name: 'Date',
      selector: (row: TankerDelivery) => new Date(row.deliveryDate).toLocaleDateString(),
      sortable: true,
    },
    { name: 'Vendor', selector: (row: TankerDelivery) => row.vendorName, sortable: true },
    { name: 'Tankers', selector: (row: TankerDelivery) => row.tankerCount, sortable: true },
    {
      name: 'Capacity',
      selector: (row: TankerDelivery) => formatLiters(row.capacityLiters),
    },
    {
      name: 'Total Water',
      selector: (row: TankerDelivery) => formatLiters(row.totalLiters),
      sortable: true,
    },
    {
      name: 'Cost',
      selector: (row: TankerDelivery) => formatCurrency(row.totalCost),
      sortable: true,
    },
    {
      name: 'Status',
      cell: (row: TankerDelivery) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
          {TANKER_STATUS_LABELS[row.status]}
        </span>
      ),
    },
    { name: 'Invoice', selector: (row: TankerDelivery) => row.invoiceNumber ?? '—' },
    {
      name: 'Actions',
      cell: (row: TankerDelivery) => (
        <button
          type="button"
          onClick={() => void handleDelete(row.id)}
          className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
      ignoreRowClick: true,
    },
  ]

  if (loading || !summary) return <LoadingSpinner label="Loading procurement data..." />

  return (
    <div>
      <PageHeader
        title="Tanker Procurement"
        description={`Water tanker orders, deliveries & planning for ${formatMonthLabel(selectedMonth)}`}
        actions={
          <>
            <button
              type="button"
              onClick={() => void handleSyncBilling()}
              disabled={syncing || summary.totalTankers === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              {syncing ? 'Syncing...' : 'Sync to Billing'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
            >
              <Plus className="h-4 w-4" />
              Add Delivery
            </button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tankers Delivered"
          value={String(summary.totalTankers)}
          subtitle={`${summary.deliveredCount} deliveries`}
          icon={Truck}
        />
        <StatCard
          title="Water Procured"
          value={formatLiters(summary.totalLiters)}
          subtitle={`${summary.coveragePercent}% of demand`}
          icon={Truck}
          accent="emerald"
        />
        <StatCard
          title="Procurement Cost"
          value={formatCurrency(summary.totalCost)}
          subtitle={`Avg ${formatCurrency(summary.avgCostPerTanker)}/tanker`}
          icon={Truck}
          accent="amber"
        />
        <StatCard
          title="Procurement Gap"
          value={formatLiters(summary.procurementGapLiters)}
          subtitle={
            summary.procurementGapTankers > 0
              ? `~${summary.procurementGapTankers} tankers needed`
              : 'Demand covered'
          }
          icon={RefreshCw}
          accent={summary.procurementGapLiters > 0 ? 'rose' : 'violet'}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Procurement vs Demand</h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Society demand" value={formatKL(summary.requiredLiters / 1000)} />
            <Metric label="Procured" value={formatLiters(summary.totalLiters)} />
            <Metric label="Est. tankers needed" value={String(summary.requiredTankers)} />
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="tankers" name="Tankers" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">No delivered tankers yet this month</p>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Procurement Plan</h2>
          <div className="space-y-3 text-sm">
            <PlanRow
              label="Demand (consumption)"
              value={formatKL(summary.requiredLiters / 1000)}
            />
            <PlanRow label="Delivered" value={formatLiters(summary.totalLiters)} />
            <PlanRow label="Planned / ordered" value={String(summary.plannedCount)} />
            <PlanRow
              label="Gap remaining"
              value={formatLiters(summary.procurementGapLiters)}
              highlight={summary.procurementGapLiters > 0}
            />
            <PlanRow
              label="Recommended order"
              value={
                summary.procurementGapTankers > 0
                  ? `${summary.procurementGapTankers} tankers × ${formatLiters(summary.capacityLiters)}`
                  : 'None'
              }
            />
          </div>
          <div className="mt-4 rounded-xl bg-sky-50 p-3 text-xs text-sky-800">
            Delivered tankers auto-sync to{' '}
            <a href="/billing" className="font-medium underline">
              Billing Config
            </a>{' '}
            for effective ₹/kL calculation.
          </div>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
          <h3 className="mb-4 font-semibold text-slate-900">Record Tanker Delivery / Order</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Vendor</label>
              <select
                value={form.vendorId}
                onChange={(e) => handleVendorChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Delivery Date</label>
              <input
                type="date"
                value={form.deliveryDate}
                onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TankerOrderStatus })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                {(Object.keys(TANKER_STATUS_LABELS) as TankerOrderStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {TANKER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Tanker Count</label>
              <input
                type="number"
                min={1}
                value={form.tankerCount}
                onChange={(e) => setForm({ ...form, tankerCount: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Capacity (L/tanker)</label>
              <input
                type="number"
                value={form.capacityLiters}
                onChange={(e) => setForm({ ...form, capacityLiters: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Cost (₹/tanker)</label>
              <input
                type="number"
                value={form.costPerTanker}
                onChange={(e) => setForm({ ...form, costPerTanker: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Invoice #</label>
              <input
                type="text"
                value={form.invoiceNumber}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                placeholder="Optional"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                placeholder="Optional"
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Total: <strong>{form.tankerCount * form.capacityLiters} L</strong> ·{' '}
            <strong>{formatCurrency(form.tankerCount * form.costPerTanker)}</strong>
          </p>
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
        <h2 className="mb-4 px-1 text-sm font-semibold text-slate-900">Delivery Log</h2>
        <DataTable
          columns={columns}
          data={deliveries}
          pagination
          highlightOnHover
          customStyles={{
            headCells: { style: { fontWeight: 600, fontSize: '13px', color: '#64748b' } },
          }}
        />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function PlanRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${highlight ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  )
}
