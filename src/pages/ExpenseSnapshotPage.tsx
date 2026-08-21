import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Copy, ImageDown, IndianRupee, Plus, Trash2, WalletCards } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatMonthLabel, getNextMonth, getPreviousMonth, getPreviousMonths } from '@/lib/billing'
import { getFlatBills } from '@/services/billingService'
import { calculateExpenseTotal, calculateFundCollectionTotal, deleteFundCollection, getExpenseProvision, getExpenses, getFundCollections, groupExpensesByCategory, moveProvisioningMonth, saveExpenseProvision, saveFundCollection } from '@/services/expenseService'
import { EXPENSE_CATEGORY_LABELS, type ExpenseSnapshotData, type FundCollection, type MonthlyExpenseProvision, type SocietyExpense } from '@/types'

const societyName = import.meta.env.VITE_SOCIETY_NAME ?? 'Society'

export function ExpenseSnapshotPage() {
  const { selectedMonth, setSelectedMonth, refreshKey, refresh } = useAppContext()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [expenses, setExpenses] = useState<SocietyExpense[]>([])
  const [fundCollections, setFundCollections] = useState<FundCollection[]>([])
  const [provision, setProvision] = useState<MonthlyExpenseProvision | null>(null)
  const [previousProvision, setPreviousProvision] = useState<MonthlyExpenseProvision | null>(null)
  const [collectionTotal, setCollectionTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [collectionForm, setCollectionForm] = useState({ collectedDate: new Date().toISOString().slice(0, 10), amount: '', source: 'Society maintenance collection', referenceNumber: '' })
  const [correctedMonth, setCorrectedMonth] = useState(selectedMonth)

  const load = async () => {
    setLoading(true)
    try {
      const [items, timing, bills, received, previous] = await Promise.all([getExpenses(selectedMonth), getExpenseProvision(selectedMonth), getFlatBills(selectedMonth), getFundCollections(selectedMonth), getExpenseProvision(getPreviousMonth(selectedMonth))])
      setExpenses(items); setProvision(timing); setPreviousProvision(previous.snapshotGeneratedAt ? previous : null); setCollectionTotal(bills.reduce((sum, bill) => sum + bill.finalBill, 0)); setFundCollections(received)
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [selectedMonth, refreshKey])
  useEffect(() => { setCorrectedMonth(selectedMonth) }, [selectedMonth])
  const cutoff = provision?.snapshotCutoffDate
  const snapshotExpenses = useMemo(() => cutoff ? expenses.filter((item) => item.expenseDate <= cutoff) : expenses, [expenses, cutoff])
  const snapshotCollections = useMemo(() => cutoff ? fundCollections.filter((item) => item.collectedDate <= cutoff) : fundCollections, [fundCollections, cutoff])
  const expenseTotal = useMemo(() => calculateExpenseTotal(snapshotExpenses), [snapshotExpenses])
  const collectedTotal = useMemo(() => calculateFundCollectionTotal(snapshotCollections), [snapshotCollections])
  const carriedForward = previousProvision?.carryForwardMonth === selectedMonth ? previousProvision.surplusCarriedForward ?? 0 : 0
  const availableFunds = collectedTotal + carriedForward
  const surplus = availableFunds - expenseTotal
  const categories = useMemo(() => groupExpensesByCategory(snapshotExpenses), [snapshotExpenses])
  const shareText = provision ? `AquaTrack monthly expense snapshot — ${formatMonthLabel(selectedMonth)} billing${cutoff ? ` (as of ${new Date(`${cutoff}T00:00:00`).toLocaleDateString('en-IN')})` : ''}\n\nFunds collected: ${formatCurrency(collectedTotal)}${carriedForward ? `\nSurplus carried forward: ${formatCurrency(carriedForward)}` : ''}\nAvailable funds: ${formatCurrency(availableFunds)}${collectionTotal ? ` (${formatCurrency(collectionTotal)} billed)` : ''}\nVendor payments scheduled: ${formatMonthLabel(provision.paymentMonth)}\nExpenses recorded: ${formatCurrency(expenseTotal)}\n${surplus >= 0 ? 'Surplus' : 'Shortfall'}: ${formatCurrency(Math.abs(surplus))}${surplus > 0 ? ` (carried to ${formatMonthLabel(getNextMonth(selectedMonth))})` : ''}\n${categories.map((item) => `• ${EXPENSE_CATEGORY_LABELS[item.category]}: ${formatCurrency(item.amount)}`).join('\n')}${provision.residentNote ? `\n\nNote: ${provision.residentNote}` : ''}` : ''

  const copy = async () => { await navigator.clipboard.writeText(shareText); setNotice('Snapshot copied to your clipboard.') }
  const downloadImage = async () => {
    if (!provision?.snapshotData) {
      setNotice('Generate the snapshot before downloading it.')
      return
    }
    try {
      const data = provision.snapshotData
      const canvas = createSnapshotCanvas({
        societyName,
        month: formatMonthLabel(selectedMonth),
        cutoff: new Date(`${data.cutoffDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
        collectedTotal: data.collectedTotal,
        expenseTotal: data.expenseTotal,
        carriedForward: data.carriedForward,
        surplus: data.surplus,
        categories: data.categories.map((item) => ({ label: EXPENSE_CATEGORY_LABELS[item.category], amount: item.amount })),
        residentNote: data.residentNote,
        collectionMonth: formatMonthLabel(data.collectionMonth),
        paymentMonth: formatMonthLabel(data.paymentMonth),
      })
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Unable to create image.')
      const fileName = `aquatrack-expenses-${selectedMonth}.png`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setNotice(`Snapshot image downloaded. Generated ${new Date(data.generatedAt).toLocaleDateString('en-IN')}.`)
    } catch { setNotice('Unable to create the snapshot image. Please try again.') }
  }
  const saveTiming = async () => {
    if (!provision) return
    setSaving(true)
    try { await saveExpenseProvision({ ...provision, updatedBy: user?.displayName || user?.email || 'Administrator' }); setNotice('Provisioning schedule saved.'); refresh() } finally { setSaving(false) }
  }
  const generateSnapshot = async () => {
    if (!provision) return
    const latestCollectionDate = fundCollections[0]?.collectedDate
    if (!latestCollectionDate) { setNotice('Record at least one funds-collected entry before generating a snapshot.'); return }
    setSaving(true)
    try {
      const cutoffDate = latestCollectionDate
      const generatedAt = new Date().toISOString()
      const surplusCarriedForward = Math.max(0, surplus)
      const snapshotData: ExpenseSnapshotData = {
        cutoffDate,
        generatedAt,
        collectedTotal,
        expenseTotal,
        carriedForward,
        surplus,
        categories: categories.map((item) => ({ category: item.category, amount: item.amount })),
        residentNote: provision.residentNote,
        collectionMonth: provision.collectionMonth,
        paymentMonth: provision.paymentMonth,
      }
      const updatedProvision = { ...provision, snapshotCutoffDate: cutoffDate, snapshotGeneratedAt: generatedAt, snapshotData, surplusCarriedForward, carryForwardMonth: getNextMonth(selectedMonth), updatedBy: user?.displayName || user?.email || 'Administrator' }
      await saveExpenseProvision(updatedProvision)
      setProvision(updatedProvision)
      setNotice(`Snapshot generated through the latest funds-collected date: ${new Date(`${cutoffDate}T00:00:00`).toLocaleDateString('en-IN')}.`)
      refresh()
    } finally { setSaving(false) }
  }
  const addFundCollection = async () => {
    try { await saveFundCollection({ billingMonth: selectedMonth, ...collectionForm, amount: Number(collectionForm.amount), recordedBy: user?.displayName || user?.email || 'Administrator' }); setCollectionForm({ collectedDate: new Date().toISOString().slice(0, 10), amount: '', source: 'Society maintenance collection', referenceNumber: '' }); await load() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to record funds.') }
  }
  const removeFundCollection = async (id: string) => { await deleteFundCollection(id); await load() }
  const correctMonth = async () => {
    if (correctedMonth === selectedMonth) return
    if (!window.confirm(`Move all expenses, funds collected, and provisioning from ${formatMonthLabel(selectedMonth)} to ${formatMonthLabel(correctedMonth)}?`)) return
    setSaving(true)
    try { await moveProvisioningMonth(selectedMonth, correctedMonth); setSelectedMonth(correctedMonth); refresh(); setNotice(`Provisioning moved to ${formatMonthLabel(correctedMonth)}.`) } finally { setSaving(false) }
  }

  if (loading || !provision) return <LoadingSpinner label="Preparing resident snapshot..." />
  const snapshotGenerated = Boolean(provision.snapshotData)
  return <div>
    <PageHeader title="Monthly Expense Snapshot" description={`Resident-ready summary for ${formatMonthLabel(selectedMonth)} billing`} actions={<>{isAdmin && <button type="button" disabled={saving} onClick={() => void generateSnapshot()} className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"><CalendarClock className="h-4 w-4" /> {snapshotGenerated ? 'Regenerate Snapshot' : 'Generate Snapshot'}</button>}<button type="button" onClick={() => void copy()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Copy className="h-4 w-4" /> Copy Text</button><button type="button" disabled={!snapshotGenerated} onClick={() => void downloadImage()} className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"><ImageDown className="h-4 w-4" /> Download Snapshot</button></>} />
    <div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm text-sky-900"><p className="font-semibold">{formatMonthLabel(selectedMonth)} expenses · {formatMonthLabel(provision.collectionMonth)} collections · {formatMonthLabel(provision.paymentMonth)} vendor settlement{cutoff ? ` · snapshot through ${new Date(`${cutoff}T00:00:00`).toLocaleDateString('en-IN')}` : ''}.</p><p className="mt-1 text-sky-800">The balance combines all expenses attributed to {formatMonthLabel(selectedMonth)} with funds recorded against that same billing month, even when collections happen in {formatMonthLabel(provision.collectionMonth)}. Generate Snapshot locks the resident-facing image data until it is regenerated.</p></div>
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Funds Collected" value={formatCurrency(collectedTotal)} subtitle={collectionTotal ? `${formatCurrency(collectionTotal)} billed` : `Scheduled for ${formatMonthLabel(provision.collectionMonth)}`} icon={WalletCards} accent="emerald" /><StatCard title="Prior Surplus" value={formatCurrency(carriedForward)} subtitle={carriedForward ? `From ${formatMonthLabel(getPreviousMonth(selectedMonth))}` : 'No carried balance'} icon={WalletCards} accent="violet" /><StatCard title="Vendor Payments" value={formatCurrency(expenseTotal)} subtitle={`Scheduled / paid in ${formatMonthLabel(provision.paymentMonth)}`} icon={IndianRupee} accent="rose" /><StatCard title={surplus >= 0 ? 'Surplus' : 'Shortfall'} value={formatCurrency(Math.abs(surplus))} subtitle={surplus > 0 ? `Carries to ${formatMonthLabel(getNextMonth(selectedMonth))}` : 'More funds are required'} icon={CalendarClock} accent={surplus >= 0 ? 'emerald' : 'rose'} /></div>
    {isAdmin && <section className="mb-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80"><h2 className="mb-1 text-sm font-semibold text-slate-900">Provisioning Schedule</h2><p className="mb-4 text-sm text-slate-500">Set when this billing period is collected from residents and settled with vendors.</p><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Collection month<input type="month" value={provision.collectionMonth} onChange={(e) => setProvision({ ...provision, collectionMonth: e.target.value })} className="mt-1.5 block w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></label><label className="text-sm font-medium text-slate-700">Vendor payment month<input type="month" value={provision.paymentMonth} onChange={(e) => setProvision({ ...provision, paymentMonth: e.target.value })} className="mt-1.5 block w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></label><label className="sm:col-span-2 text-sm font-medium text-slate-700">Resident note<input value={provision.residentNote ?? ''} onChange={(e) => setProvision({ ...provision, residentNote: e.target.value })} placeholder="e.g. Vendor invoices will be settled after collection closes." className="mt-1.5 block w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></label></div><button type="button" disabled={saving} onClick={() => void saveTiming()} className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50">{saving ? 'Saving...' : 'Save Provisioning'}</button><div className="mt-5 border-t border-slate-100 pt-5"><h3 className="text-sm font-semibold text-slate-900">Correct billing month</h3><p className="mt-1 text-xs text-slate-500">Use this only when the whole period was entered under the wrong month. It moves expenses, funds collected, and provisioning together.</p><div className="mt-3 flex flex-wrap gap-2"><select value={correctedMonth} onChange={(e) => setCorrectedMonth(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{getPreviousMonths(24).map((month) => <option key={month} value={month}>{formatMonthLabel(month)}</option>)}</select><button type="button" disabled={saving || correctedMonth === selectedMonth} onClick={() => void correctMonth()} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50">Move to selected month</button></div></div></section>}
    {isAdmin && <section className="mb-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80"><h2 className="mb-1 text-sm font-semibold text-slate-900">Funds Collected</h2><p className="mb-4 text-sm text-slate-500">Record money received against {formatMonthLabel(selectedMonth)} billing, even if it arrives in a later month.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input type="date" value={collectionForm.collectedDate} onChange={(e) => setCollectionForm({ ...collectionForm, collectedDate: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /><input type="number" min="0.01" step="0.01" value={collectionForm.amount} onChange={(e) => setCollectionForm({ ...collectionForm, amount: e.target.value })} placeholder="Amount (₹)" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /><input value={collectionForm.source} onChange={(e) => setCollectionForm({ ...collectionForm, source: e.target.value })} placeholder="Source" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /><div className="flex gap-2"><input value={collectionForm.referenceNumber} onChange={(e) => setCollectionForm({ ...collectionForm, referenceNumber: e.target.value })} placeholder="Reference" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /><button type="button" onClick={() => void addFundCollection()} className="rounded-xl bg-sky-500 px-3 text-white hover:bg-sky-600" aria-label="Add collection"><Plus className="h-4 w-4" /></button></div></div>{fundCollections.length > 0 && <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">{fundCollections.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span className="text-slate-500">{new Date(`${item.collectedDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {item.source}{item.referenceNumber ? ` · ${item.referenceNumber}` : ''}</span><span className="flex items-center gap-2 font-semibold text-slate-900">{formatCurrency(item.amount)}<button type="button" onClick={() => void removeFundCollection(item.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete collection"><Trash2 className="h-3.5 w-3.5" /></button></span></div>)}</div>}</section>}
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80"><h2 className="mb-4 text-sm font-semibold text-slate-900">Expense Breakdown</h2>{categories.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No expenses have been recorded for this billing period yet.</p> : <div className="divide-y divide-slate-100">{categories.map((item) => <div key={item.category} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="text-slate-600">{EXPENSE_CATEGORY_LABELS[item.category]}</span><span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span></div>)}<div className="flex items-center justify-between gap-4 pt-4 text-sm"><span className="font-semibold text-slate-900">Total</span><span className="text-base font-semibold text-slate-900">{formatCurrency(expenseTotal)}</span></div></div>}</section>
    <div className="mt-6 rounded-3xl bg-slate-50 p-5 sm:p-7"><div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"><div className="bg-sky-600 px-6 py-5 text-white"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">{societyName} · Society Update</p><h2 className="mt-1 text-xl font-semibold">{formatMonthLabel(selectedMonth)} Expense Snapshot</h2><p className="mt-1 text-sm text-sky-100">Expenses through {cutoff ? new Date(`${cutoff}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'the latest available record'}</p></div><div className="grid grid-cols-2 gap-px bg-slate-100"><ImageMetric label="Funds collected" value={formatCurrency(collectedTotal)} /><ImageMetric label="Expenses" value={formatCurrency(expenseTotal)} /><ImageMetric label="Prior surplus" value={formatCurrency(carriedForward)} /><ImageMetric label={surplus >= 0 ? 'Surplus carried forward' : 'Shortfall'} value={formatCurrency(Math.abs(surplus))} emphasize={surplus >= 0} /></div><div className="p-6"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Expense breakdown</p>{categories.length ? <div className="space-y-2">{categories.map((item) => <div key={item.category} className="flex justify-between text-sm"><span className="text-slate-600">{EXPENSE_CATEGORY_LABELS[item.category]}</span><span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span></div>)}</div> : <p className="text-sm text-slate-400">No recorded expenses yet.</p>}{provision.residentNote && <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">{provision.residentNote}</p>}<p className="mt-5 text-xs text-slate-400">Collection: {formatMonthLabel(provision.collectionMonth)} · Vendor settlement: {formatMonthLabel(provision.paymentMonth)}</p></div></div></div>
    {notice && <p className="mt-4 text-sm text-sky-700">{notice}</p>}
  </div>
}

function ImageMetric({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) { return <div className="bg-white px-5 py-4"><p className="text-xs text-slate-500">{label}</p><p className={emphasize ? 'mt-1 text-base font-semibold text-emerald-600' : 'mt-1 text-base font-semibold text-slate-900'}>{value}</p></div> }

function createSnapshotCanvas(data: { societyName: string; month: string; cutoff: string; collectedTotal: number; expenseTotal: number; carriedForward: number; surplus: number; categories: Array<{ label: string; amount: number }>; residentNote?: string; collectionMonth: string; paymentMonth: string }): HTMLCanvasElement {
  const width = 1080
  const height = Math.max(1350, 840 + data.categories.length * 64 + (data.residentNote ? 100 : 0))
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable.')
  const pad = 72; const right = width - pad; const text = '#0f172a'; const muted = '#64748b'
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#0284c7'; ctx.fillRect(0, 0, width, 268)
  ctx.fillStyle = '#e0f2fe'; ctx.font = '600 24px system-ui, sans-serif'; ctx.fillText(`${data.societyName.toUpperCase()}  ·  SOCIETY UPDATE`, pad, 72)
  ctx.fillStyle = '#ffffff'; ctx.font = '700 46px system-ui, sans-serif'; ctx.fillText(`${data.month} Expense Snapshot`, pad, 136)
  ctx.fillStyle = '#e0f2fe'; ctx.font = '400 26px system-ui, sans-serif'; ctx.fillText(`Expenses through ${data.cutoff}`, pad, 184)
  ctx.fillStyle = '#f0f9ff'; ctx.font = '400 22px system-ui, sans-serif'; ctx.fillText(`Collection: ${data.collectionMonth}   ·   Vendor settlement: ${data.paymentMonth}`, pad, 226)
  const metrics = [['Funds collected', formatCurrency(data.collectedTotal), '#0f172a'], ['Expenses', formatCurrency(data.expenseTotal), '#0f172a'], ['Prior surplus', formatCurrency(data.carriedForward), '#0f172a'], [data.surplus >= 0 ? 'Surplus carried forward' : 'Shortfall', formatCurrency(Math.abs(data.surplus)), data.surplus >= 0 ? '#059669' : '#e11d48']]
  metrics.forEach(([label, value, color], index) => { const col = index % 2; const row = Math.floor(index / 2); const x = pad + col * 480; const y = 316 + row * 126; ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 456, 104); ctx.fillStyle = muted; ctx.font = '400 22px system-ui, sans-serif'; ctx.fillText(label, x + 24, y + 38); ctx.fillStyle = color; ctx.font = '700 30px system-ui, sans-serif'; ctx.fillText(value, x + 24, y + 78) })
  let y = 624; ctx.fillStyle = muted; ctx.font = '600 22px system-ui, sans-serif'; ctx.fillText('EXPENSE BREAKDOWN', pad, y); y += 46
  if (data.categories.length === 0) { ctx.fillStyle = muted; ctx.font = '400 26px system-ui, sans-serif'; ctx.fillText('No recorded expenses yet.', pad, y) } else data.categories.forEach((item) => { ctx.strokeStyle = '#e2e8f0'; ctx.beginPath(); ctx.moveTo(pad, y + 16); ctx.lineTo(right, y + 16); ctx.stroke(); ctx.fillStyle = text; ctx.font = '400 27px system-ui, sans-serif'; ctx.fillText(item.label, pad, y + 52); ctx.font = '700 27px system-ui, sans-serif'; const amount = formatCurrency(item.amount); ctx.fillText(amount, right - ctx.measureText(amount).width, y + 52); y += 64 })
  if (data.residentNote) { y += 34; ctx.strokeStyle = '#e2e8f0'; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(right, y); ctx.stroke(); y += 42; ctx.fillStyle = muted; ctx.font = '400 23px system-ui, sans-serif'; const words = data.residentNote.split(' '); let line = ''; for (const word of words) { if (ctx.measureText(`${line} ${word}`).width > width - pad * 2) { ctx.fillText(line, pad, y); y += 31; line = word } else line = `${line} ${word}`.trim() } if (line) ctx.fillText(line, pad, y) }
  ctx.fillStyle = '#94a3b8'; ctx.font = '400 18px system-ui, sans-serif'; ctx.fillText('Generated by AquaTrack', pad, height - 36)
  return canvas
}
