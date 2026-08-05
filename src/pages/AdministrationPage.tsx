import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import DataTable from 'react-data-table-component'
import { BillGenerationPanel } from '@/components/billing/BillGenerationPanel'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useAppContext } from '@/context/AppContext'
import { formatCurrency, formatKL, formatMonthLabel } from '@/lib/billing'
import { buildInvoiceRows, exportBillsCSV, exportBillsPDF, exportInvoiceSheet } from '@/lib/reports'
import {
  generateAndLockFlatBills,
  getBillingConfig,
  getFlatBills,
  getSocietyStats,
  validateBillGeneration,
} from '@/services/billingService'
import { useAuth } from '@/context/AuthContext'
import type { BillingConfig, FlatBill } from '@/types'

export function AdministrationPage() {
  const { selectedMonth, refresh, refreshKey } = useAppContext()
  const { user } = useAuth()
  const [bills, setBills] = useState<FlatBill[]>([])
  const [config, setConfig] = useState<BillingConfig | null>(null)
  const [validation, setValidation] = useState({ ok: false, errors: [] as string[] })
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([
      getFlatBills(selectedMonth),
      getBillingConfig(selectedMonth),
      validateBillGeneration(selectedMonth),
    ]).then(([b, billingConfig, check]) => {
      if (!cancelled) {
        setBills(b)
        setConfig(billingConfig)
        setValidation(check)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedMonth, refreshKey])

  const handleGenerateAndLock = async () => {
    if (
      !confirm(
        'Generate flat bills and lock this month? Bills will be saved as a snapshot and readings will become immutable.',
      )
    ) {
      return
    }
    setGenerating(true)
    try {
      const result = await generateAndLockFlatBills(selectedMonth, user?.id ?? 'admin')
      setBills(result.bills)
      setConfig(result.config)
      setValidation({ ok: false, errors: ['This month is already locked.'] })
      refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Generate & lock failed')
    } finally {
      setGenerating(false)
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

  const totalAmount = bills.reduce((sum, bill) => sum + bill.finalBill, 0)

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title="Current Month Consumption"
        description={`Billing administration for ${formatMonthLabel(selectedMonth)}`}
        actions={
          <>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={bills.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => void handleExportPDF()}
              disabled={bills.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={handleExportInvoice}
              disabled={bills.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
            >
              Invoice Sheet
            </button>
          </>
        }
      />

      <BillGenerationPanel
        month={selectedMonth}
        validation={validation}
        config={config}
        billCount={bills.length}
        totalAmount={totalAmount}
        generating={generating}
        onGenerate={() => void handleGenerateAndLock()}
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
