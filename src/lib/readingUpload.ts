import type { Flat } from '@/types'
import { calculateConsumption, formatKL, formatMonthLabel, litersToKL } from '@/lib/billing'

export interface ReadingUploadRow {
  rowNumber: number
  block: string
  unit: string
  flatLabel: string
  closingReading: number | null
  openingReading: number | null
}

export interface ValidatedUploadRow extends ReadingUploadRow {
  flat: Flat | null
  resolvedOpening: number | null
  status: 'valid' | 'error' | 'skip'
  message: string
  consumptionLiters: number | null
}

const HEADER_ALIASES: Record<string, keyof Omit<ReadingUploadRow, 'rowNumber'>> = {
  block: 'block',
  unit: 'unit',
  flat: 'flatLabel',
  flatlabel: 'flatLabel',
  flat_label: 'flatLabel',
  flatid: 'flatLabel',
  flat_id: 'flatLabel',
  closing: 'closingReading',
  closingreading: 'closingReading',
  closing_reading: 'closingReading',
  'closing reading (l)': 'closingReading',
  'closing reading': 'closingReading',
  opening: 'openingReading',
  openingreading: 'openingReading',
  opening_reading: 'openingReading',
  'opening reading (l)': 'openingReading',
  'opening reading': 'openingReading',
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseCSVLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, '').trim()
  if (!cleaned) return null
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : null
}

export function parseReadingUploadCSV(text: string): ReadingUploadRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) {
    throw new Error('File must contain a header row and at least one data row.')
  }

  const headers = parseCSVLine(lines[0]).map(normalizeHeader)
  const columnMap = headers.map((h) => HEADER_ALIASES[h] ?? null)

  if (!columnMap.includes('closingReading')) {
    throw new Error(
      'Missing required column: Closing Reading. Expected headers like Block, Unit, Flat, Closing Reading (L).',
    )
  }

  const rows: ReadingUploadRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i])
    const row: ReadingUploadRow = {
      rowNumber: i + 1,
      block: '',
      unit: '',
      flatLabel: '',
      closingReading: null,
      openingReading: null,
    }

    let hasData = false
    columnMap.forEach((field, idx) => {
      if (!field) return
      const value = cells[idx]?.trim() ?? ''
      if (!value) return
      hasData = true
      if (field === 'closingReading' || field === 'openingReading') {
        const num = parseNumber(value)
        if (num === null) {
          throw new Error(`Row ${i + 1}: invalid number "${value}" in ${field}`)
        }
        row[field] = num
      } else {
        row[field] = value
      }
    })

    if (hasData) rows.push(row)
  }

  if (rows.length === 0) {
    throw new Error('No data rows found in the uploaded file.')
  }

  return rows
}

export function matchFlat(row: ReadingUploadRow, flats: Flat[]): Flat | null {
  if (row.flatLabel) {
    const byLabel = flats.find(
      (f) =>
        f.label.toLowerCase() === row.flatLabel.toLowerCase() ||
        f.id.toLowerCase() === row.flatLabel.toLowerCase(),
    )
    if (byLabel) return byLabel
  }

  if (row.block && row.unit) {
    const byBlockUnit = flats.find(
      (f) =>
        f.block.toLowerCase() === row.block.toLowerCase() &&
        f.unit.toLowerCase() === row.unit.toLowerCase(),
    )
    if (byBlockUnit) return byBlockUnit
  }

  if (row.flatLabel) {
    const partial = flats.find((f) =>
      f.label.toLowerCase().includes(row.flatLabel.toLowerCase()),
    )
    if (partial) return partial
  }

  return null
}

export function validateUploadRows(
  rows: ReadingUploadRow[],
  flats: Flat[],
  resolveOpening: (flatId: string) => number | null,
): ValidatedUploadRow[] {
  const seenFlats = new Set<string>()

  return rows.map((row) => {
    const flat = matchFlat(row, flats)

    if (!flat) {
      const identifier = row.flatLabel || `${row.block}-${row.unit}` || `row ${row.rowNumber}`
      return {
        ...row,
        flat: null,
        resolvedOpening: null,
        status: 'error',
        message: `Flat not found: ${identifier}`,
        consumptionLiters: null,
      }
    }

    if (seenFlats.has(flat.id)) {
      return {
        ...row,
        flat,
        resolvedOpening: null,
        status: 'skip',
        message: 'Duplicate flat in upload — only first occurrence will be imported',
        consumptionLiters: null,
      }
    }
    seenFlats.add(flat.id)

    if (row.closingReading === null) {
      return {
        ...row,
        flat,
        resolvedOpening: null,
        status: 'error',
        message: 'Closing reading is required',
        consumptionLiters: null,
      }
    }

    const resolvedOpening = row.openingReading ?? resolveOpening(flat.id)
    if (resolvedOpening === null) {
      return {
        ...row,
        flat,
        resolvedOpening: null,
        status: 'error',
        message: 'First reading for this flat — add Opening Reading (L) in CSV',
        consumptionLiters: null,
      }
    }

    if (row.closingReading < resolvedOpening) {
      return {
        ...row,
        flat,
        resolvedOpening,
        status: 'error',
        message: `Closing (${row.closingReading}) < opening (${resolvedOpening})`,
        consumptionLiters: null,
      }
    }

    const consumptionLiters = calculateConsumption(resolvedOpening, row.closingReading)

    return {
      ...row,
      flat,
      resolvedOpening,
      status: 'valid',
      message: row.openingReading
        ? 'Initial opening (first reading)'
        : 'Opening from previous closing (auto)',
      consumptionLiters,
    }
  })
}

export function downloadReadingUploadTemplate(flats: Flat[], month: string): void {
  const headers = ['Block', 'Unit', 'Flat', 'Closing Reading (L)']
  const rows = flats.map((f) => [f.block, f.unit, f.label, ''])
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell)
          return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str
        })
        .join(','),
    )
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `aquatrack-readings-template-${month}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function formatUploadSummary(rows: ValidatedUploadRow[]): string {
  const valid = rows.filter((r) => r.status === 'valid').length
  const errors = rows.filter((r) => r.status === 'error').length
  const skipped = rows.filter((r) => r.status === 'skip').length
  return `${valid} valid, ${errors} error${errors === 1 ? '' : 's'}, ${skipped} skipped`
}

export function getUploadMonthLabel(month: string): string {
  return formatMonthLabel(month)
}

export function formatRowConsumption(liters: number | null): string {
  if (liters === null) return '—'
  return formatKL(litersToKL(liters))
}
