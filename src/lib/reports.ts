import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FlatBill, InvoiceRow, SocietyStats } from '@/types'
import { formatCurrency, formatKL, formatMonthLabel } from '@/lib/billing'

export function exportBillsCSV(bills: FlatBill[], month: string): void {
  const headers = [
    'Block',
    'Unit',
    'Opening Reading',
    'Closing Reading',
    'Consumption (L)',
    'Consumption (kL)',
    'Effective Rate (₹/kL)',
    'Water Charge',
    'Maintenance',
    'Final Bill',
    'Efficiency Score',
    'Entered By',
    'Last Updated',
  ]
  const rows = bills.map((b) => [
    b.flat.block,
    b.flat.unit,
    b.openingReading,
    b.closingReading,
    b.consumptionLiters,
    b.consumptionKL,
    b.effectiveRatePerKL,
    b.waterCharge,
    b.maintenanceShare,
    b.finalBill,
    b.efficiencyScore,
    b.enteredBy,
    b.lastUpdated,
  ])
  downloadCSV([headers, ...rows], `aquatrack-bills-${month}.csv`)
}

export function exportInvoiceSheet(rows: InvoiceRow[], month: string): void {
  const headers = [
    'Block',
    'Unit',
    'Charge Type',
    'Charge Description',
    'Charge Date',
    'Pay By Date',
    'Amount',
  ]
  const data = rows.map((r) => [
    r.block,
    r.unit,
    r.chargeType,
    r.chargeDescription,
    r.chargeDate,
    r.payByDate,
    r.amount,
  ])
  downloadCSV([headers, ...data], `aquatrack-invoice-upload-${month}.csv`)
}

export function buildInvoiceRows(bills: FlatBill[], month: string): InvoiceRow[] {
  const chargeDate = new Date().toISOString().slice(0, 10)
  const payByDate = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)

  return bills.map((bill) => ({
    block: bill.flat.block,
    unit: bill.flat.unit,
    chargeType: 'Water',
    chargeDescription: [
      `Billing: ${formatMonthLabel(month)}`,
      `Opening: ${bill.openingReading} L`,
      `Closing: ${bill.closingReading} L`,
      `Consumption: ${formatKL(bill.consumptionKL)}`,
      `Rate: ${formatCurrency(bill.effectiveRatePerKL)}/kL`,
      `Total: ${formatCurrency(bill.finalBill)}`,
    ].join(' | '),
    chargeDate,
    payByDate,
    amount: bill.finalBill,
  }))
}

export function exportBillsPDF(bills: FlatBill[], month: string, stats: SocietyStats): void {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(18)
  doc.text('AquaTrack — Monthly Consumption Report', 14, 18)
  doc.setFontSize(11)
  doc.text(formatMonthLabel(month), 14, 26)
  doc.text(`Total Society Consumption: ${formatKL(stats.totalConsumptionKL)}`, 14, 33)
  doc.text(`Effective Rate: ${formatCurrency(stats.effectiveRatePerKL)}/kL`, 14, 40)

  autoTable(doc, {
    startY: 48,
    head: [[
      'Flat',
      'Opening',
      'Closing',
      'kL',
      '₹/kL',
      'Bill',
      'Efficiency',
      'Entered By',
    ]],
    body: bills.map((b) => [
      b.flat.label,
      b.openingReading,
      b.closingReading,
      b.consumptionKL.toFixed(2),
      b.effectiveRatePerKL.toFixed(2),
      b.finalBill.toFixed(2),
      b.efficiencyScore,
      b.enteredBy,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [14, 165, 233] },
  })

  doc.save(`aquatrack-report-${month}.pdf`)
}

function downloadCSV(rows: (string | number)[][], filename: string): void {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell)
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
        })
        .join(','),
    )
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
