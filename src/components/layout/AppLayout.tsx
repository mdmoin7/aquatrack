import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BarChart3, Bell, Building2, ChevronDown, ClipboardList, Database, Droplets, FileText, Gauge, LayoutDashboard, LogOut, Menu, ReceiptText, Settings, Truck, User, Users, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppContext } from '@/context/AppContext'
import { DataModeIndicator } from '@/components/common/DataModeIndicator'
import { NotificationBadge } from '@/components/notifications/NotificationBadge'
import { useNotifications } from '@/hooks/useNotifications'
import { formatMonthLabel, getPreviousMonths } from '@/lib/billing'
import { canAccessNotifications } from '@/services/notificationService'
import { getVendors, quickAddTankerDelivery } from '@/services/tankerService'
import type { TankerVendor } from '@/types'

const meterReaderNav = [
  { to: '/block-dashboard', label: 'My Block', icon: LayoutDashboard },
  { to: '/readings', label: 'Enter Readings', icon: Gauge },
  { to: '/notifications', label: 'Notifications', icon: Bell },
]
const adminNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/block-dashboard', label: 'Block Dashboard', icon: ClipboardList },
  { to: '/readings', label: 'Readings', icon: Gauge },
  { to: '/procurement', label: 'Tanker Procurement', icon: Truck },
  { to: '/expenses', label: 'Society Expenses', icon: ReceiptText },
  { to: '/administration', label: 'Administration', icon: Building2 },
  { to: '/billing', label: 'Billing Config', icon: Settings },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/analytics', label: 'Flat Analytics', icon: BarChart3 },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/cache', label: 'Cache Inspector', icon: Database },
]
const residentNav = [
  { to: '/resident', label: 'My Consumption', icon: Droplets },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/monthly-expenses', label: 'Society Expenses', icon: ReceiptText },
]
const guestNav = [
  { to: '/readings', label: 'Readings', icon: Gauge },
  { to: '/analytics', label: 'Flat Analytics', icon: BarChart3 },
]

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { selectedMonth, setSelectedMonth, refresh } = useAppContext()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()
  const months = getPreviousMonths(12)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [quickTankerOpen, setQuickTankerOpen] = useState(false)
  const [quickAddingTanker, setQuickAddingTanker] = useState(false)
  const [vendors, setVendors] = useState<TankerVendor[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [vehicleSnapshot, setVehicleSnapshot] = useState<File | null>(null)
  const [vendorLoading, setVendorLoading] = useState(false)
  const showNotificationBadge = canAccessNotifications(user?.role)
  const nav = user?.role === 'guest' ? guestNav : user?.role === 'resident' ? residentNav : user?.role === 'meter_reader' ? meterReaderNav : adminNav
  const canQuickAdd = user?.role !== 'guest' && user?.role !== 'resident' && user?.role !== 'meter_reader'

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const closeSidebar = () => setSidebarOpen(false)

  const openQuickTanker = async () => {
    if (!canQuickAdd || quickAddingTanker) return
    setQuickTankerOpen(true)
    setVendorLoading(true)
    try {
      const activeVendors = await getVendors()
      setVendors(activeVendors)
      setSelectedVendorId(activeVendors[0]?.id ?? '')
    } catch (e) {
      setVendors([])
      alert(e instanceof Error ? e.message : 'Failed to load tanker vendors')
    } finally {
      setVendorLoading(false)
    }
  }

  const closeQuickTanker = () => {
    if (quickAddingTanker) return
    setQuickTankerOpen(false)
    setVehicleSnapshot(null)
  }

  const handleQuickTanker = async () => {
    if (quickAddingTanker || !selectedVendorId) return
    setQuickAddingTanker(true)
    try {
      await quickAddTankerDelivery(selectedMonth, user?.displayName ?? 'Admin', { vendorId: selectedVendorId, vehicleSnapshot })
      setQuickTankerOpen(false)
      setVehicleSnapshot(null)
      refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add tanker delivery')
    } finally {
      setQuickAddingTanker(false)
    }
  }

  useEffect(() => {
    if (!quickTankerOpen) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeQuickTanker() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [quickTankerOpen, quickAddingTanker])

  return (
    <div className="flex min-h-screen bg-slate-50">
      {sidebarOpen && <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={closeSidebar} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,16rem)] max-w-full flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out lg:z-30 lg:w-64 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 lg:px-5 lg:py-5">
          <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white"><Droplets className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate font-semibold text-slate-900">AquaTrack</p><p className="text-xs text-slate-400">Water Management</p></div></div>
          <button type="button" onClick={closeSidebar} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 lg:hidden" aria-label="Close navigation"><X className="h-5 w-5" /></button>
        </div>
        <DataModeIndicator />
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={closeSidebar} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span>{showNotificationBadge && to === '/notifications' && <NotificationBadge count={unreadCount} className="ml-auto" />}</NavLink>)}
        </nav>
        <div className="border-t border-slate-100 p-3 lg:p-4"><div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600"><User className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{user?.displayName}</p><p className="truncate text-xs capitalize text-slate-400">{user?.role === 'superadmin' ? 'super admin' : user?.role}</p></div><button type="button" onClick={() => void handleSignOut()} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-600" title="Sign out"><LogOut className="h-4 w-4" /></button></div></div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
              <p className="hidden text-sm text-slate-500 sm:block lg:max-w-md lg:truncate xl:max-w-xl">{user?.role === 'guest' ? 'View-only access to readings & consumption timelines' : 'Society water consumption & billing platform'}</p>
              <p className="truncate text-sm font-medium text-slate-700 sm:hidden">{formatMonthLabel(selectedMonth)}</p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {canQuickAdd && <button type="button" onClick={() => void openQuickTanker()} disabled={quickAddingTanker} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-60" title="Add one delivered tanker using vendor defaults"><Truck className="h-4 w-4" />Quick Tanker</button>}
              <div className="relative w-full sm:w-auto"><select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm font-medium text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 sm:w-auto">{months.map((m) => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></div>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6"><Outlet /></main>
      </div>

      {quickTankerOpen && canQuickAdd && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeQuickTanker() }}>
          <div role="dialog" aria-modal="true" aria-labelledby="quick-tanker-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div><h2 id="quick-tanker-title" className="text-lg font-semibold text-slate-900">Quick Tanker Delivery</h2><p className="mt-1 text-xs text-slate-500">Add one delivered tanker using the selected vendor's defaults.</p></div>
              <button type="button" onClick={closeQuickTanker} disabled={quickAddingTanker} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 disabled:opacity-50" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-5 py-5">
              {vendorLoading ? <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading vendors…</div> : vendors.length === 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">No active tanker vendor is configured. Add a vendor before recording a delivery.</div> : <>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Vendor</span><select value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)} disabled={quickAddingTanker} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100">{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
                {(() => { const vendor = vendors.find((item) => item.id === selectedVendorId); return vendor ? <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Capacity</p><p className="mt-1 font-semibold text-slate-900">{vendor.defaultCapacityLiters.toLocaleString()} L</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Cost / tanker</p><p className="mt-1 font-semibold text-slate-900">₹{vendor.defaultCostPerTanker.toLocaleString()}</p></div></div> : null })()}
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Vehicle photo <span className="font-normal text-slate-400">(optional)</span></span><input type="file" accept="image/*" capture="environment" disabled={quickAddingTanker} onChange={(e) => setVehicleSnapshot(e.target.files?.[0] ?? null)} className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200" />{vehicleSnapshot && <p className="mt-1.5 truncate text-xs text-slate-500">Selected: {vehicleSnapshot.name}</p>}</label>
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800"><strong>1 tanker</strong> · {formatMonthLabel(selectedMonth)} · Delivered today</div>
              </>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4"><button type="button" onClick={closeQuickTanker} disabled={quickAddingTanker} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="button" onClick={() => void handleQuickTanker()} disabled={vendorLoading || vendors.length === 0 || !selectedVendorId || quickAddingTanker} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">{quickAddingTanker ? 'Adding…' : 'Add Tanker'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
