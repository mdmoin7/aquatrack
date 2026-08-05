import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Info, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import DataTable from 'react-data-table-component'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { FlatReadingTimeline } from '@/components/readings/FlatReadingTimeline'
import { ReadingUploadPanel } from '@/components/readings/ReadingUploadPanel'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import {
  formatKL,
  formatMonthLabel,
  litersToKL,
  calculateConsumption,
} from '@/lib/billing'
import {
  deleteReading,
  getFlats,
  getMonthlySummaries,
  getReadings,
  resolveOpeningReading,
  saveReading,
  type OpeningReadingInfo,
} from '@/services/readingsService'
import type { Flat, MeterReading, MonthlyFlatSummary } from '@/types'

export function ReadingsPage() {
  const { selectedMonth, refresh } = useAppContext()
  const { user } = useAuth()
  const [readings, setReadings] = useState<MeterReading[]>([])
  const [summaries, setSummaries] = useState<MonthlyFlatSummary[]>([])
  const [flats, setFlats] = useState<Flat[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    flatId: '',
    closingReading: '',
    initialOpeningReading: '',
  })
  const [openingInfo, setOpeningInfo] = useState<OpeningReadingInfo | null>(null)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [timelineFlatId, setTimelineFlatId] = useState<string | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!timelineFlatId) return
    timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [timelineFlatId])

  const load = async () => {
    setLoading(true)
    const [r, s, f] = await Promise.all([
      getReadings(selectedMonth),
      getMonthlySummaries(selectedMonth),
      getFlats(),
    ])
    setReadings(r)
    setSummaries(s)
    setFlats(f)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [selectedMonth])

  useEffect(() => {
    if (!form.flatId || editingId) {
      if (!editingId) setOpeningInfo(null)
      return
    }
    void resolveOpeningReading(form.flatId, selectedMonth).then(setOpeningInfo)
  }, [form.flatId, selectedMonth, editingId])

  const flatMap = Object.fromEntries(flats.map((f) => [f.id, f]))
  const summaryMap = Object.fromEntries(summaries.map((s) => [s.flatId, s]))
  const isFirstCycle = openingInfo?.source === 'none'
  const isAdditionalEntry = openingInfo?.source === 'previous_entry'

  const openAddForm = () => {
    setEditingId(null)
    setShowForm(true)
    setShowUpload(false)
    setForm({ flatId: '', closingReading: '', initialOpeningReading: '' })
    setOpeningInfo(null)
    setError('')
  }

  const openEditForm = (reading: MeterReading) => {
    setEditingId(reading.id)
    setShowForm(true)
    setForm({
      flatId: reading.flatId,
      closingReading: String(reading.closingReading),
      initialOpeningReading: String(reading.openingReading),
    })
    setOpeningInfo({
      openingReading: reading.openingReading,
      source: 'previous_entry',
      entryNumber: summaryMap[reading.flatId]?.readingCount,
    })
    setError('')
  }

  const handleFlatSelect = (flatId: string) => {
    setEditingId(null)
    setForm({
      flatId,
      closingReading: '',
      initialOpeningReading: '',
    })
  }

  const handleSave = async () => {
    setError('')
    try {
      if (editingId) {
        await saveReading(
          {
            flatId: form.flatId,
            month: selectedMonth,
            closingReading: Number(form.closingReading),
            initialOpeningReading: Number(form.initialOpeningReading),
            enteredBy: user?.displayName ?? 'Unknown',
            enteredByRole: user?.role ?? 'guest',
          },
          editingId,
        )
      } else {
        await saveReading({
          flatId: form.flatId,
          month: selectedMonth,
          closingReading: Number(form.closingReading),
          initialOpeningReading: isFirstCycle
            ? Number(form.initialOpeningReading)
            : undefined,
          enteredBy: user?.displayName ?? 'Unknown',
          enteredByRole: user?.role ?? 'guest',
        })
      }
      setShowForm(false)
      setEditingId(null)
      setForm({ flatId: '', closingReading: '', initialOpeningReading: '' })
      setOpeningInfo(null)
      refresh()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save reading')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reading entry? Monthly billing will be recalculated.')) return
    try {
      await deleteReading(id, user?.id ?? '', user?.displayName ?? '', user?.role === 'admin')
      refresh()
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const entryIndexById = useMemo(() => {
    const map = new Map<string, number>()
    for (const summary of summaries) {
      summary.readings.forEach((r, i) => map.set(r.id, i + 1))
    }
    return map
  }, [summaries])

  const columns = [
    {
      name: 'Flat',
      selector: (row: MeterReading) => flatMap[row.flatId]?.label ?? row.flatId,
      sortable: true,
    },
    {
      name: 'Entry #',
      selector: (row: MeterReading) => entryIndexById.get(row.id) ?? '—',
      sortable: true,
      width: '90px',
    },
    { name: 'Opening (L)', selector: (row: MeterReading) => row.openingReading, sortable: true },
    { name: 'Closing (L)', selector: (row: MeterReading) => row.closingReading, sortable: true },
    {
      name: 'Entry Use',
      selector: (row: MeterReading) => formatKL(row.consumptionKL),
      sortable: true,
    },
    {
      name: 'Monthly Billable',
      selector: (row: MeterReading) => formatKL(summaryMap[row.flatId]?.consumptionKL ?? 0),
    },
    {
      name: 'Date',
      selector: (row: MeterReading) => new Date(row.createdAt).toLocaleDateString(),
      sortable: true,
    },
    { name: 'Entered By', selector: (row: MeterReading) => row.enteredBy },
    {
      name: 'Actions',
      cell: (row: MeterReading) =>
        user?.role === 'admin' ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => openEditForm(row)}
              className="rounded-lg p-2 text-sky-500 hover:bg-sky-50"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(row.id)}
              className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null,
      ignoreRowClick: true,
    },
  ]

  const resolvedOpening = editingId
    ? Number(form.initialOpeningReading) || null
    : isFirstCycle
      ? Number(form.initialOpeningReading) || null
      : openingInfo?.openingReading ?? null

  const entryConsumption =
    resolvedOpening !== null && form.closingReading
      ? litersToKL(calculateConsumption(resolvedOpening, Number(form.closingReading)))
      : null

  const projectedMonthlyKL =
    resolvedOpening !== null && form.closingReading && form.flatId
      ? litersToKL(
          calculateConsumption(
            summaryMap[form.flatId]?.openingReading ?? resolvedOpening,
            Number(form.closingReading),
          ),
        )
      : entryConsumption

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title="Meter Readings"
        description={`Multiple entries per flat allowed for ${formatMonthLabel(selectedMonth)} — billing uses monthly totals only`}
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setShowUpload(true)
                setShowForm(false)
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" />
              Upload CSV
            </button>
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
            >
              <Plus className="h-4 w-4" />
              Add Reading
            </button>
          </>
        }
      />

      {showUpload && (
        <ReadingUploadPanel
          month={selectedMonth}
          flats={flats}
          enteredBy={user?.displayName ?? 'Unknown'}
          enteredByRole={user?.role ?? 'guest'}
          onClose={() => setShowUpload(false)}
          onImported={() => {
            refresh()
            void load()
          }}
        />
      )}

      {summaries.length > 0 && (
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Monthly Billing Summary</h3>
          <p className="mb-4 text-xs text-slate-500">
            One bill per flat per month — opening from first entry, closing from latest entry.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map((s) => (
              <Fragment key={s.flatId}>
                <button
                  type="button"
                  onClick={() =>
                    setTimelineFlatId((current) => (current === s.flatId ? null : s.flatId))
                  }
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                    timelineFlatId === s.flatId
                      ? 'border-sky-300 bg-sky-50 ring-1 ring-sky-200'
                      : 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white'
                  }`}
                >
                  <p className="font-medium text-slate-900">
                    {flatMap[s.flatId]?.label ?? s.flatId}
                  </p>
                  <p className="mt-1 text-slate-600">
                    {s.openingReading.toLocaleString()} → {s.closingReading.toLocaleString()} L
                  </p>
                  <p className="mt-1 font-semibold text-sky-700">
                    {formatKL(s.consumptionKL)} · {s.readingCount} entr{s.readingCount === 1 ? 'y' : 'ies'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {timelineFlatId === s.flatId ? 'Click to hide timeline' : 'Click to view timeline'}
                  </p>
                </button>

                {timelineFlatId === s.flatId && (
                  <div
                    ref={timelineRef}
                    className="col-span-full rounded-2xl border border-sky-100 bg-white p-5 shadow-sm ring-1 ring-sky-100"
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          Reading Timeline — {flatMap[s.flatId]?.label ?? s.flatId}
                        </h3>
                        <p className="text-xs text-slate-500">{formatMonthLabel(selectedMonth)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTimelineFlatId(null)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                        aria-label="Close timeline"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <FlatReadingTimeline
                      entries={s.readings}
                      emptyMessage="No entries for this flat in the selected month."
                    />
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
          <h3 className="mb-1 font-semibold text-slate-900">
            {editingId ? 'Edit Reading Entry' : 'Add Reading Entry'}
          </h3>
          <p className="mb-4 text-sm text-slate-500">
            {editingId
              ? 'Update this individual entry. Monthly billing will be recalculated.'
              : 'Add a new reading entry. Multiple entries per flat are allowed each month.'}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Flat</label>
              <select
                value={form.flatId}
                disabled={Boolean(editingId)}
                onChange={(e) => handleFlatSelect(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm disabled:bg-slate-50"
              >
                <option value="">Select flat</option>
                {flats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Opening Reading (L)
                {!editingId && !isFirstCycle && (
                  <span className="ml-1 font-normal text-slate-400">
                    {isAdditionalEntry ? '— from last entry' : '— from previous month'}
                  </span>
                )}
              </label>
              <input
                type="number"
                readOnly={!editingId && !isFirstCycle}
                placeholder={isFirstCycle ? 'Initial meter reading' : 'Auto-filled'}
                value={
                  editingId
                    ? form.initialOpeningReading
                    : isFirstCycle
                      ? form.initialOpeningReading
                      : openingInfo?.openingReading?.toString() ?? ''
                }
                onChange={(e) =>
                  setForm({ ...form, initialOpeningReading: e.target.value })
                }
                className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
                  !editingId && !isFirstCycle
                    ? 'border-slate-100 bg-slate-50 text-slate-600'
                    : 'border-slate-200'
                }`}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Closing Reading (L)
              </label>
              <input
                type="number"
                placeholder="Meter reading"
                value={form.closingReading}
                onChange={(e) => setForm({ ...form, closingReading: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {openingInfo?.source === 'previous_closing' && openingInfo.previousMonth && !editingId && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Entry #{openingInfo.entryNumber}: opening of{' '}
                <strong>{openingInfo.openingReading?.toLocaleString()} L</strong> from{' '}
                {formatMonthLabel(openingInfo.previousMonth)} closing.
              </span>
            </div>
          )}

          {isAdditionalEntry && !editingId && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Entry #{openingInfo?.entryNumber}: opening of{' '}
                <strong>{openingInfo?.openingReading?.toLocaleString()} L</strong> from the previous
                entry this month. Current monthly total:{' '}
                <strong>{formatKL(openingInfo?.monthlyConsumptionKL ?? 0)}</strong>.
              </span>
            </div>
          )}

          {isFirstCycle && form.flatId && !editingId && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                First reading for this flat — enter the initial meter reading. Additional entries can
                be added anytime during the month.
              </span>
            </div>
          )}

          {entryConsumption !== null && (
            <p className="mt-3 text-sm text-slate-600">
              This entry: <strong>{formatKL(entryConsumption)}</strong>
              {!editingId && projectedMonthlyKL !== null && projectedMonthlyKL !== entryConsumption && (
                <>
                  {' '}
                  · Monthly billable: <strong>{formatKL(projectedMonthlyKL)}</strong>
                </>
              )}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={
                !form.flatId ||
                !form.closingReading ||
                ((!editingId && isFirstCycle && !form.initialOpeningReading) as boolean)
              }
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
                setForm({ flatId: '', closingReading: '', initialOpeningReading: '' })
                setOpeningInfo(null)
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
        <DataTable
          columns={columns}
          data={readings}
          pagination
          highlightOnHover
          fixedHeader
          fixedHeaderScrollHeight="500px"
          customStyles={{
            headCells: {
              style: { fontWeight: 600, fontSize: '13px', color: '#64748b' },
            },
          }}
        />
      </div>
    </div>
  )
}
