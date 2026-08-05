import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, Upload, X } from 'lucide-react'
import { formatMonthLabel } from '@/lib/billing'
import {
  downloadReadingUploadTemplate,
  formatRowConsumption,
  formatUploadSummary,
  parseReadingUploadCSV,
  validateUploadRows,
  type ValidatedUploadRow,
} from '@/lib/readingUpload'
import { bulkImportReadings, resolveOpeningReading } from '@/services/readingsService'
import type { Flat } from '@/types'
import type { UserRole } from '@/types'

interface ReadingUploadPanelProps {
  month: string
  flats: Flat[]
  enteredBy: string
  enteredByRole: UserRole
  onClose: () => void
  onImported: () => void
}

export function ReadingUploadPanel({
  month,
  flats,
  enteredBy,
  enteredByRole,
  onClose,
  onImported,
}: ReadingUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ValidatedUploadRow[]>([])
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')

  const openingCache = new Map<string, number | null>()

  const getResolvedOpening = (flatId: string): number | null => {
    if (openingCache.has(flatId)) return openingCache.get(flatId) ?? null
    return null
  }

  const handleFile = async (file: File) => {
    setParseError('')
    setImportResult(null)
    setFileName(file.name)

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file')
      return
    }

    try {
      const text = await file.text()
      const parsed = parseReadingUploadCSV(text)

      openingCache.clear()
      for (const flat of flats) {
        const info = await resolveOpeningReading(flat.id, month)
        openingCache.set(flat.id, info.openingReading)
      }

      const validated = validateUploadRows(parsed, flats, getResolvedOpening)
      setRows(validated)
    } catch (e) {
      setRows([])
      setParseError(e instanceof Error ? e.message : 'Failed to parse file')
    }
  }

  const handleImport = async () => {
    const validRows = rows.filter((r) => r.status === 'valid' && r.flat && r.closingReading !== null)
    if (validRows.length === 0) return

    setImporting(true)
    setImportResult(null)
    try {
      const result = await bulkImportReadings(
        validRows.map((r) => ({
          flatId: r.flat!.id,
          flatLabel: r.flat!.label,
          closingReading: r.closingReading!,
          initialOpeningReading: r.openingReading ?? undefined,
        })),
        month,
        enteredBy,
        enteredByRole,
      )

      const parts = [`${result.imported} reading${result.imported === 1 ? '' : 's'} imported`]
      if (result.failed.length) parts.push(`${result.failed.length} failed`)
      setImportResult(parts.join(', '))

      if (result.imported > 0) {
        onImported()
      }
    } catch (e) {
      setImportResult(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const validCount = rows.filter((r) => r.status === 'valid').length

  return (
    <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Upload Meter Readings</h3>
          <p className="mt-1 text-sm text-slate-500">
            Import closing readings per flat for {formatMonthLabel(month)}. Opening is computed
            automatically from the previous month&apos;s closing — you only need an opening value
            the very first time a flat is recorded.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadReadingUploadTemplate(flats, month)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Download Template
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
        >
          <Upload className="h-4 w-4" />
          Choose CSV File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />
      </div>

      <div className="mb-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
        <p className="font-medium text-slate-700">Expected CSV columns</p>
        <p className="mt-1 font-mono">Block, Unit, Flat, Closing Reading (L)</p>
        <p className="mt-2">
          <strong>Closing Reading</strong> is the only value required each month.{' '}
          <strong>Opening Reading (L)</strong> is an optional column — use it only when uploading
          a flat&apos;s first-ever reading (no prior month data). Otherwise opening is taken from
          the previous closing automatically.
        </p>
      </div>

      {parseError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {parseError}
        </div>
      )}

      {fileName && rows.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{fileName}</span> —{' '}
              {formatUploadSummary(rows)}
            </p>
            {validCount > 0 && (
              <button
                type="button"
                disabled={importing}
                onClick={() => void handleImport()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {importing ? 'Importing...' : `Import ${validCount} Reading${validCount === 1 ? '' : 's'}`}
              </button>
            )}
          </div>

          {importResult && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              {importResult}
            </div>
          )}

          <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Flat</th>
                  <th className="px-3 py-2 font-medium">Opening</th>
                  <th className="px-3 py-2 font-medium">Closing</th>
                  <th className="px-3 py-2 font-medium">Consumption</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNumber} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-400">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {row.flat?.label ?? (row.flatLabel || `${row.block}-${row.unit}`)}
                    </td>
                    <td className="px-3 py-2">
                      {row.resolvedOpening !== null ? (
                        <>
                          {row.resolvedOpening.toLocaleString()}
                          {!row.openingReading && (
                            <span className="ml-1 text-xs text-slate-400">(auto)</span>
                          )}
                        </>
                      ) : (
                        row.openingReading?.toLocaleString() ?? '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.closingReading?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {formatRowConsumption(row.consumptionLiters)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function StatusBadge({ row }: { row: ValidatedUploadRow }) {
  const styles = {
    valid: 'bg-emerald-50 text-emerald-700',
    error: 'bg-rose-50 text-rose-700',
    skip: 'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[row.status]}`}>
      {row.message}
    </span>
  )
}
