import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { formatMonthLabel } from '@/lib/billing'
import { meterDisplayToLiters, parseMeterDisplayInput } from '@/lib/meterReading'
import { getActiveMeter, replaceMeter } from '@/services/meterService'
import type { Flat, UserRole, WaterMeter } from '@/types'

interface ReplaceMeterPanelProps {
  flats: Flat[]
  defaultMonth: string
  enteredBy: string
  enteredByRole: UserRole
  onClose: () => void
  onReplaced: () => void
}

function defaultReplacementDate(month: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return today.startsWith(month) ? today : `${month}-01`
}

export function ReplaceMeterPanel({
  flats,
  defaultMonth,
  enteredBy,
  enteredByRole,
  onClose,
  onReplaced,
}: ReplaceMeterPanelProps) {
  const [flatId, setFlatId] = useState('')
  const [activeMeter, setActiveMeter] = useState<WaterMeter | null>(null)
  const [replacementDate, setReplacementDate] = useState(defaultReplacementDate(defaultMonth))
  const [finalDisplay, setFinalDisplay] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [startDisplay, setStartDisplay] = useState('')
  const [reason, setReason] = useState('Fault')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!flatId) {
      setActiveMeter(null)
      return
    }
    let cancelled = false
    void getActiveMeter(flatId).then((meter) => {
      if (!cancelled) setActiveMeter(meter)
    })
    return () => {
      cancelled = true
    }
  }, [flatId])

  const handleReplace = async () => {
    setError('')
    const finalDial = parseMeterDisplayInput(finalDisplay)
    const startDial = parseMeterDisplayInput(startDisplay)
    if (!flatId) {
      setError('Select the flat whose meter is being replaced.')
      return
    }
    if (finalDial === null) {
      setError('Enter the final dial reading on the old meter.')
      return
    }
    if (startDial === null) {
      setError('Enter the starting dial reading on the new meter.')
      return
    }

    setSaving(true)
    try {
      await replaceMeter({
        flatId,
        replacementDate,
        finalReadingLiters: meterDisplayToLiters(finalDial),
        newSerialNumber: serialNumber,
        startReadingLiters: meterDisplayToLiters(startDial),
        reason,
        enteredBy,
        enteredByRole,
      })
      onReplaced()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to replace meter')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
      <h3 className="mb-1 font-semibold text-slate-900">Replace meter</h3>
      <p className="mb-4 text-sm text-slate-500">
        Close the faulty meter at its final dial and start billing the new dial from its own opening.
        Earlier readings stay on the removed meter. This month’s usage is the old meter plus the new meter.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Flat</span>
          <select
            value={flatId}
            onChange={(e) => setFlatId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          >
            <option value="">Select flat</option>
            {flats.map((flat) => (
              <option key={flat.id} value={flat.id}>
                {flat.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Current meter</span>
          <input
            readOnly
            value={activeMeter ? activeMeter.serialNumber : flatId ? 'No active meter' : ''}
            className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-600"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Replacement date</span>
          <input
            type="date"
            value={replacementDate}
            onChange={(e) => setReplacementDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Old meter final dial</span>
          <input
            type="number"
            value={finalDisplay}
            onChange={(e) => setFinalDisplay(e.target.value)}
            placeholder="Dial reading"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">New meter serial</span>
          <input
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="Serial number"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">New meter start dial</span>
          <input
            type="number"
            value={startDisplay}
            onChange={(e) => setStartDisplay(e.target.value)}
            placeholder="Dial reading"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
        </label>

        <label className="block sm:col-span-2 lg:col-span-3">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
        </label>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          The final reading is stored in {formatMonthLabel(replacementDate.slice(0, 7) || defaultMonth)}. The next
          closing uses the new meter’s start dial, even when that number is lower than the old meter.
        </span>
      </div>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void handleReplace()}
          disabled={saving}
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {saving ? 'Replacing…' : 'Replace meter'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
