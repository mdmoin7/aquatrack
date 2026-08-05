import { useEffect, useState } from 'react'
import { Link2, Pencil, Plus, RefreshCw, Trash2, Truck, UserPlus, X } from 'lucide-react'
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
import { VehicleSnapshotField } from '@/components/procurement/VehicleSnapshotField'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatKL, formatMonthLabel } from '@/lib/billing'
import { formatLiters, DEFAULT_TANKER_CAPACITY_LITERS, DEFAULT_TANKER_COST_PER_TANKER } from '@/lib/tanker'
import {
  deleteDelivery,
  getDeliveries,
  getProcurementSummary,
  getVendors,
  deleteVendor,
  countVendorDeliveries,
  saveDelivery,
  saveVendor,
  syncProcurementToBilling,
  updatePendingDelivery,
  canUpdateDelivery,
  getAllowedStatusUpdates,
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
  const [vendorMode, setVendorMode] = useState<'existing' | 'new'>('existing')
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
  const [newVendor, setNewVendor] = useState({
    name: '',
    contactPerson: '',
    phone: '',
  })
  const [vehicleSnapshot, setVehicleSnapshot] = useState<File | null>(null)
  const [vehicleSnapshotPreview, setVehicleSnapshotPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [updatingDelivery, setUpdatingDelivery] = useState<TankerDelivery | null>(null)
  const [updateForm, setUpdateForm] = useState({
    tankerCount: 1,
    status: 'ordered' as TankerOrderStatus,
    deliveryDate: '',
    invoiceNumber: '',
    notes: '',
  })
  const [updateVehicleSnapshot, setUpdateVehicleSnapshot] = useState<File | null>(null)
  const [updateVehicleSnapshotPreview, setUpdateVehicleSnapshotPreview] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState('')
  const [updating, setUpdating] = useState(false)

  const clearUpdateVehicleSnapshot = () => {
    if (updateVehicleSnapshotPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(updateVehicleSnapshotPreview)
    }
    setUpdateVehicleSnapshot(null)
    setUpdateVehicleSnapshotPreview(null)
  }

  const openUpdateDelivery = (delivery: TankerDelivery) => {
    setShowForm(false)
    setUpdateError('')
    clearUpdateVehicleSnapshot()
    setUpdatingDelivery(delivery)
    setUpdateForm({
      tankerCount: delivery.tankerCount,
      status: delivery.status,
      deliveryDate: delivery.deliveryDate,
      invoiceNumber: delivery.invoiceNumber ?? '',
      notes: delivery.notes ?? '',
    })
  }

  const closeUpdateDelivery = () => {
    clearUpdateVehicleSnapshot()
    setUpdatingDelivery(null)
    setUpdateError('')
  }

  const handleUpdateDelivery = async () => {
    if (!updatingDelivery) return
    setUpdateError('')
    setUpdating(true)
    try {
      await updatePendingDelivery(
        updatingDelivery.id,
        {
          tankerCount: updateForm.tankerCount,
          status: updateForm.status,
          deliveryDate: updateForm.deliveryDate,
          invoiceNumber: updateForm.invoiceNumber || undefined,
          notes: updateForm.notes || undefined,
        },
        { vehicleSnapshot: updateVehicleSnapshot },
      )
      closeUpdateDelivery()
      refresh()
      await load()
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : 'Failed to update delivery')
    } finally {
      setUpdating(false)
    }
  }

  const openDeliveryForm = () => {
    closeUpdateDelivery()
    setError('')
    setVendorMode(vendors.length > 0 ? 'existing' : 'new')
    setNewVendor({ name: '', contactPerson: '', phone: '' })
    if (vehicleSnapshotPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(vehicleSnapshotPreview)
    }
    setVehicleSnapshot(null)
    setVehicleSnapshotPreview(null)
    setShowForm(true)
  }

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
    setSaving(true)
    try {
      let vendor: TankerVendor | undefined = vendors.find((v) => v.id === form.vendorId)

      if (vendorMode === 'new') {
        vendor = await saveVendor({
          name: newVendor.name,
          contactPerson: newVendor.contactPerson || undefined,
          phone: newVendor.phone || undefined,
          defaultCapacityLiters: form.capacityLiters,
          defaultCostPerTanker: form.costPerTanker,
        })
      }

      if (!vendor) {
        setError(vendorMode === 'new' ? 'Enter a vendor name' : 'Select a vendor')
        return
      }

      await saveDelivery(
        {
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
        },
        { vehicleSnapshot },
      )
      if (vehicleSnapshotPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(vehicleSnapshotPreview)
      }
      setVehicleSnapshot(null)
      setVehicleSnapshotPreview(null)
      setShowForm(false)
      refresh()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save delivery')
    } finally {
      setSaving(false)
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

  const handleDeleteVendor = async (vendor: TankerVendor) => {
    const deliveryCount = await countVendorDeliveries(vendor.id)
    const message =
      deliveryCount > 0
        ? `Delete ${vendor.name}? ${deliveryCount} delivery record(s) reference this vendor — they will keep the vendor name.`
        : `Delete vendor ${vendor.name}?`

    if (!confirm(message)) return

    try {
      await deleteVendor(vendor.id)
      if (form.vendorId === vendor.id) {
        setForm((f) => ({ ...f, vendorId: '' }))
      }
      refresh()
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete vendor')
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
      name: 'Vehicle',
      cell: (row: TankerDelivery) =>
        row.vehicleSnapshotUrl ? (
          <a
            href={row.vehicleSnapshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            title="View vehicle snapshot"
          >
            <img
              src={row.vehicleSnapshotUrl}
              alt="Vehicle snapshot"
              className="h-10 w-14 rounded-lg border border-slate-200 object-cover"
            />
          </a>
        ) : (
          <span className="text-slate-300">—</span>
        ),
      width: '90px',
      ignoreRowClick: true,
    },
    {
      name: 'Actions',
      cell: (row: TankerDelivery) => (
        <div className="flex gap-1">
          {canUpdateDelivery(row) && (
            <button
              type="button"
              onClick={() => openUpdateDelivery(row)}
              className="rounded-lg p-2 text-sky-500 hover:bg-sky-50"
              title="Update status or tanker count"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleDelete(row.id)}
            className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
            title="Delete delivery"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
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
              onClick={openDeliveryForm}
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

      <div className="mb-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Vendors</h2>
            <p className="text-xs text-slate-500">Manage tanker suppliers used for deliveries</p>
          </div>
          <button
            type="button"
            onClick={() => {
              openDeliveryForm()
              setVendorMode('new')
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add vendor
          </button>
        </div>

        {vendors.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No vendors yet. Add one when recording a delivery or use Add vendor above.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{vendor.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[
                      vendor.contactPerson || null,
                      vendor.phone || null,
                      `${formatLiters(vendor.defaultCapacityLiters)}/tanker`,
                      `${formatCurrency(vendor.defaultCostPerTanker)}/tanker`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteVendor(vendor)}
                  className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                  title={`Delete ${vendor.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
          <h3 className="mb-4 font-semibold text-slate-900">Record Tanker Delivery / Order</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-700">Vendor</label>
                {vendors.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setVendorMode((mode) => (mode === 'existing' ? 'new' : 'existing'))
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {vendorMode === 'existing' ? 'Add new vendor' : 'Select existing vendor'}
                  </button>
                )}
              </div>

              {vendorMode === 'existing' && vendors.length > 0 ? (
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
              ) : (
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Vendor name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newVendor.name}
                      onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                      placeholder="e.g. AquaFlow Tankers"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Contact person
                    </label>
                    <input
                      type="text"
                      value={newVendor.contactPerson}
                      onChange={(e) =>
                        setNewVendor({ ...newVendor, contactPerson: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                    <input
                      type="tel"
                      value={newVendor.phone}
                      onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                      placeholder="Optional"
                    />
                  </div>
                  <p className="text-xs text-slate-500 sm:col-span-3">
                    Default capacity and cost below will be saved with this vendor for future deliveries.
                  </p>
                </div>
              )}
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

            <VehicleSnapshotField
              file={vehicleSnapshot}
              previewUrl={vehicleSnapshotPreview}
              onChange={(file, previewUrl) => {
                setVehicleSnapshot(file)
                setVehicleSnapshotPreview(previewUrl)
              }}
            />
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
              disabled={
                saving || (vendorMode === 'new' ? !newVendor.name.trim() : !form.vendorId)
              }
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (vehicleSnapshotPreview?.startsWith('blob:')) {
                  URL.revokeObjectURL(vehicleSnapshotPreview)
                }
                setVehicleSnapshot(null)
                setVehicleSnapshotPreview(null)
                setShowForm(false)
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {updatingDelivery && (
        <div className="mb-6 rounded-2xl border border-sky-100 bg-white p-5 ring-1 ring-sky-100">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900">Update Delivery</h3>
              <p className="mt-1 text-sm text-slate-500">
                {updatingDelivery.vendorName} · currently{' '}
                <span className="font-medium">{TANKER_STATUS_LABELS[updatingDelivery.status]}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={closeUpdateDelivery}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              aria-label="Close update form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
              <select
                value={updateForm.status}
                onChange={(e) =>
                  setUpdateForm({ ...updateForm, status: e.target.value as TankerOrderStatus })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                {getAllowedStatusUpdates(updatingDelivery.status).map((s) => (
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
                value={updateForm.tankerCount}
                onChange={(e) =>
                  setUpdateForm({ ...updateForm, tankerCount: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Delivery Date</label>
              <input
                type="date"
                value={updateForm.deliveryDate}
                onChange={(e) =>
                  setUpdateForm({ ...updateForm, deliveryDate: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Invoice #</label>
              <input
                type="text"
                value={updateForm.invoiceNumber}
                onChange={(e) =>
                  setUpdateForm({ ...updateForm, invoiceNumber: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                placeholder="Optional"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
              <input
                type="text"
                value={updateForm.notes}
                onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                placeholder="Optional"
              />
            </div>

            {updateForm.status === 'delivered' && (
              <VehicleSnapshotField
                file={updateVehicleSnapshot}
                previewUrl={updateVehicleSnapshotPreview ?? updatingDelivery.vehicleSnapshotUrl ?? null}
                onChange={(file, previewUrl) => {
                  setUpdateVehicleSnapshot(file)
                  setUpdateVehicleSnapshotPreview(previewUrl)
                }}
              />
            )}
          </div>

          <p className="mt-3 text-sm text-slate-600">
            Total:{' '}
            <strong>
              {updateForm.tankerCount * updatingDelivery.capacityLiters} L
            </strong>{' '}
            ·{' '}
            <strong>
              {formatCurrency(updateForm.tankerCount * updatingDelivery.costPerTanker)}
            </strong>
          </p>

          {updateForm.status === 'delivered' && updatingDelivery.status !== 'delivered' && (
            <p className="mt-2 text-xs text-emerald-700">
              Marking as delivered will include this order in billing sync and procurement totals.
            </p>
          )}

          {updateError && <p className="mt-2 text-sm text-rose-600">{updateError}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void handleUpdateDelivery()}
              disabled={updating || updateForm.tankerCount < 1}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {updating ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={closeUpdateDelivery}
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
