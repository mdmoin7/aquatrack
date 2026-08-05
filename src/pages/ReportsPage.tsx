import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useAppContext } from '@/context/AppContext'
import { formatMonthLabel } from '@/lib/billing'
import {
  buildInvoiceRows,
  exportBillsCSV,
  exportBillsPDF,
  exportInvoiceSheet,
} from '@/lib/reports'
import { computeFlatBills, getSocietyStats } from '@/services/billingService'
import type { FlatBill } from '@/types'

export function ReportsPage() {
  const { selectedMonth, refreshKey } = useAppContext()
  const [bills, setBills] = useState<FlatBill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void computeFlatBills(selectedMonth).then((b) => {
      if (!cancelled) {
        setBills(b)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedMonth, refreshKey])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title="Reports & Exports"
        description={`Generate reports for ${formatMonthLabel(selectedMonth)}`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <ReportCard
          title="CSV Export"
          description="Full consumption & billing data spreadsheet"
          icon={Download}
          onClick={() => exportBillsCSV(bills, selectedMonth)}
        />
        <ReportCard
          title="PDF Report"
          description="Formatted monthly society consumption report"
          icon={FileText}
          onClick={() =>
            void getSocietyStats(selectedMonth).then((stats) =>
              exportBillsPDF(bills, selectedMonth, stats),
            )
          }
        />
        <ReportCard
          title="Invoice Upload Sheet"
          description="Import-ready invoice sheet for society management software"
          icon={FileSpreadsheet}
          onClick={() =>
            exportInvoiceSheet(buildInvoiceRows(bills, selectedMonth), selectedMonth)
          }
        />
      </div>

      <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Export Summary</h2>
        <p className="text-sm text-slate-500">
          {bills.length} flats · {bills.reduce((s, b) => s + b.consumptionKL, 0).toFixed(2)} kL total
          consumption
        </p>
      </div>
    </div>
  )
}

function ReportCard({
  title,
  description,
  icon: Icon,
  onClick,
}: {
  title: string
  description: string
  icon: typeof Download
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl bg-white p-6 text-left shadow-sm ring-1 ring-slate-200/80 transition hover:ring-sky-200 hover:shadow-md"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </button>
  )
}
