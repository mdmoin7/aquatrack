import { useEffect, useMemo, useState } from 'react'
import { IndianRupee, Pencil, Plus, ReceiptText, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StatCard } from '@/components/common/StatCard'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatMonthLabel } from '@/lib/billing'
import { calculateExpenseTotal, deleteExpense, getExpenses, groupExpensesByCategory, saveExpense } from '@/services/expenseService'
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory, type SocietyExpense } from '@/types'

const categories = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]
const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100'
const emptyForm = () => ({ expenseDate: new Date().toISOString().slice(0, 10), category: 'utilities' as ExpenseCategory, description: '', amount: '', vendor: '', referenceNumber: '', notes: '' })

export function ExpensesPage() {
  const { selectedMonth, refreshKey, refresh } = useAppContext()
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<SocietyExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SocietyExpense | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try { setExpenses(await getExpenses(selectedMonth)) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [selectedMonth, refreshKey])

  const total = useMemo(() => calculateExpenseTotal(expenses), [expenses])
  const categoryTotals = useMemo(() => groupExpensesByCategory(expenses), [expenses])
  const openNew = () => { setEditing(null); setForm(emptyForm()); setError(''); setShowForm(true) }
  const openEdit = (expense: SocietyExpense) => {
    setEditing(expense)
    setForm({ expenseDate: expense.expenseDate, category: expense.category, description: expense.description, amount: String(expense.amount), vendor: expense.vendor ?? '', referenceNumber: expense.referenceNumber ?? '', notes: expense.notes ?? '' })
    setError(''); setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditing(null); setError('') }
  const submit = async () => {
    setSaving(true); setError('')
    try {
      await saveExpense({ month: selectedMonth, ...form, amount: Number(form.amount), createdBy: user?.displayName || user?.email || 'Administrator' }, editing?.id)
      closeForm(); refresh(); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save expense.') } finally { setSaving(false) }
  }
  const remove = async (expense: SocietyExpense) => {
    if (!window.confirm(`Delete “${expense.description}”?`)) return
    try { await deleteExpense(expense.id); refresh(); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Unable to delete expense.') }
  }

  if (loading) return <LoadingSpinner label="Loading expenses..." />
  return <div>
    <PageHeader title="Society Expenses" description={`Categorical expenses attributed to ${formatMonthLabel(selectedMonth)} billing`} actions={<><a href="/monthly-expenses" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Funds & Snapshot</a><button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"><Plus className="h-4 w-4" /> Add Expense</button></>} />
    <a href="/monthly-expenses" className="mb-6 block rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900 hover:bg-sky-100"><span className="font-semibold">Record funds collected and publish the monthly snapshot.</span><span className="mt-1 block text-sky-800">Use Funds & Snapshot to add money received for this billing month, set its settlement timing, and share the resident update.</span></a>
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard title="Total Expenses" value={formatCurrency(total)} subtitle={`${expenses.length} recorded item${expenses.length === 1 ? '' : 's'}`} icon={IndianRupee} accent="rose" />
      <StatCard title="Categories Used" value={String(categoryTotals.length)} subtitle="Standard society expense categories" icon={ReceiptText} accent="violet" />
      <StatCard title="Largest Category" value={categoryTotals[0] ? EXPENSE_CATEGORY_LABELS[categoryTotals[0].category] : '—'} subtitle={categoryTotals[0] ? formatCurrency(categoryTotals[0].amount) : 'No expenses recorded'} icon={ReceiptText} accent="amber" />
    </div>
    <div className="mb-6 grid gap-6 lg:grid-cols-3">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 lg:col-span-2">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Expense Register</h2>
        {expenses.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">No expenses recorded for this month. Add the first one to start tracking.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Description</th><th className="px-3 py-3">Vendor / Ref.</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3" /></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id} className="border-b border-slate-50 text-slate-600"><td className="px-3 py-3 whitespace-nowrap">{new Date(`${expense.expenseDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td><td className="px-3 py-3"><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">{EXPENSE_CATEGORY_LABELS[expense.category]}</span></td><td className="px-3 py-3 font-medium text-slate-800">{expense.description}<p className="mt-0.5 text-xs font-normal text-slate-400">{expense.notes}</p></td><td className="px-3 py-3 text-xs">{[expense.vendor, expense.referenceNumber].filter(Boolean).join(' · ') || '—'}</td><td className="px-3 py-3 text-right font-semibold text-slate-900">{formatCurrency(expense.amount)}</td><td className="px-3 py-3"><div className="flex justify-end"><button type="button" onClick={() => openEdit(expense)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-sky-600" aria-label="Edit expense"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void remove(expense)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete expense"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>}
      </section>
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80"><h2 className="mb-4 text-sm font-semibold text-slate-900">By Category</h2>{categoryTotals.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Category totals will appear here.</p> : <div className="space-y-4">{categoryTotals.map(({ category, amount }) => <div key={category}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="text-slate-600">{EXPENSE_CATEGORY_LABELS[category]}</span><span className="font-medium text-slate-900">{formatCurrency(amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(4, (amount / total) * 100)}%` }} /></div></div>)}</div>}</section>
    </div>
    {showForm && <section className="rounded-2xl border border-sky-100 bg-white p-5 ring-1 ring-sky-100"><div className="mb-4 flex items-start justify-between"><div><h2 className="font-semibold text-slate-900">{editing ? 'Edit Expense' : 'Record Expense'}</h2><p className="mt-1 text-sm text-slate-500">Attribute this to {formatMonthLabel(selectedMonth)} billing; the payment date can be in a later settlement month.</p></div><button type="button" onClick={closeForm} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X className="h-4 w-4" /></button></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Payment date"><input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className={fieldClass} /></Field><Field label="Category"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })} className={fieldClass}>{categories.map((category) => <option key={category} value={category}>{EXPENSE_CATEGORY_LABELS[category]}</option>)}</select></Field><Field label="Amount (₹)"><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={fieldClass} placeholder="0.00" /></Field><Field label="Description"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={fieldClass} placeholder="e.g. Lift servicing" /></Field><Field label="Vendor"><input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className={fieldClass} placeholder="Optional" /></Field><Field label="Invoice / reference"><input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} className={fieldClass} placeholder="Optional" /></Field><div className="sm:col-span-2 lg:col-span-3"><Field label="Notes"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={fieldClass} placeholder="Optional details" /></Field></div></div>{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}<div className="mt-5 flex gap-2"><button type="button" disabled={saving} onClick={() => void submit()} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Save Changes' : 'Save Expense'}</button><button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">Cancel</button></div></section>}
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-700"><span className="mb-1.5 block">{label}</span>{children}</label> }
