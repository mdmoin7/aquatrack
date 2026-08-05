import { useEffect, useState } from 'react'
import { Download, FileText, Lock } from 'lucide-react'
import DataTable from 'react-data-table-component'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useAppContext } from '@/context/AppContext'
import { formatCurrency, formatKL, formatMonthLabel } from '@/lib/billing'
import { buildInvoiceRows, exportBillsCSV, exportBillsPDF, exportInvoiceSheet } from '@/lib/reports'
import { computeFlatBills, getBillingConfig, getSocietyStats, lockBillingMonth } from '@/services/billingService'
import { useAuth } from '@/context/AuthContext'
import type { FlatBill } from '@/types'

export function AdministrationPage() {
  const { selectedMonth, refresh, refreshKey } = useAppContext()
  const { user } = useAuth()
  const [bills, setBills] = useState<FlatBill[]>([])
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([computeFlatBills(selectedMonth), getBillingConfig(selectedMonth)]).then(
      ([b, config]) => {
        if (!cancelled) {
          setBills(b)
          setLocked(config?.locked ?? false)
          setLoading(false)
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [selectedMonth, refreshKey])

  const handleLock = async () => {
    if (!confirm('Lock bills for this month? They will become immutable.')) return
    try {
      await lockBillingMonth(selectedMonth, user?.id ?? 'admin')
      setLocked(true)
      refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Lock failed')
    }
  }

  const handleExportCSV = () => exportBillsCSV(bills, selectedMonth)
  const handleExportPDF = async () => {
    const stats = await getSocietyStats(selectedMonth)
    exportBillsPDF(bills, selectedMonth, stats)
  }
  const handleExportInvoice = () => exportInvoiceSheet(buildInvoiceRows(bills, selectedMonth), selectedMonth)

  const columns = [
    { name: 'Flat', selector: (row: FlatBill) => row.flat.label, sortable: true },
    { name: 'Opening', selector: (row: FlatBill) => row.openingReading, sortable: true },
    { name: 'Closing', selector: (row: FlatBill) => row.closingReading, sortable: true },
    { name: 'Consumption', selector: (row: FlatBill) => formatKL(row.consumptionKL), sortable: true },
    {
      name: '₹/kL',
      selector: (row: FlatBill) => row.effectiveRatePerKL.toFixed(2),
      sortable: true,
    },
    {
      name: 'Final Bill',
      selector: (row: FlatBill) => formatCurrency(row.finalBill),
      sortable: true,
    },
    { name: 'Efficiency', selector: (row: FlatBill) => row.efficiencyScore, sortable: true },
    { name: 'Last Updated', selector: (row: FlatBill) => new Date(row.lastUpdated).toLocaleDateString() },
    { name: 'Entered By', selector: (row: FlatBill) => row.enteredBy },
  ]

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title="Current Month Consumption"
        description={`Billing administration for ${formatMonthLabel(selectedMonth)}`}
        actions={
          <>
            {locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                <Lock className="h-3 w-3" /> Locked
              </span>
            )}
            {!locked && (
              <button
                type="button"
                onClick={() => void handleLock()}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
              >
                <Lock className="h-4 w-4" />
                Lock Month
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => void handleExportPDF()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={handleExportInvoice}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
            >
              Invoice Sheet
            </button>
          </>
        }
      />

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
        <DataTable
          columns={columns}
          data={bills}
          pagination
          highlightOnHover
          fixedHeader
          fixedHeaderScrollHeight="560px"
          defaultSortFieldId={6}
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
