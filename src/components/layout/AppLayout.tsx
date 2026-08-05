import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  Database,
  Droplets,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Truck,
  User,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppContext } from '@/context/AppContext'
import { DataModeIndicator } from '@/components/common/DataModeIndicator'
import { formatMonthLabel, getPreviousMonths } from '@/lib/billing'

const adminNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/readings', label: 'Readings', icon: Gauge },
  { to: '/procurement', label: 'Tanker Procurement', icon: Truck },
  { to: '/administration', label: 'Administration', icon: Building2 },
  { to: '/billing', label: 'Billing Config', icon: Settings },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/analytics', label: 'Flat Analytics', icon: BarChart3 },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/cache', label: 'Cache Inspector', icon: Database },
]

const residentNav = [
  { to: '/resident', label: 'My Consumption', icon: Droplets },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
]

const guestNav = [
  { to: '/readings', label: 'Readings', icon: Gauge },
  { to: '/analytics', label: 'Flat Analytics', icon: BarChart3 },
]

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { selectedMonth, setSelectedMonth } = useAppContext()
  const navigate = useNavigate()
  const months = getPreviousMonths(12)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const nav =
    user?.role === 'guest'
      ? guestNav
      : user?.role === 'resident'
        ? residentNav
        : adminNav

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex min-h-screen bg-slate-50">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,16rem)] max-w-full flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out lg:z-30 lg:w-64 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 lg:px-5 lg:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white">
              <Droplets className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">AquaTrack</p>
              <p className="text-xs text-slate-400">Water Management</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSidebar}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <DataModeIndicator />

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3 lg:p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{user?.displayName}</p>
              <p className="truncate text-xs capitalize text-slate-400">
                {user?.role === 'superadmin' ? 'super admin' : user?.role}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-600"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <p className="hidden text-sm text-slate-500 sm:block lg:max-w-md lg:truncate xl:max-w-xl">
                {user?.role === 'guest'
                  ? 'View-only access to readings & consumption timelines'
                  : 'Society water consumption & billing platform'}
              </p>
              <p className="truncate text-sm font-medium text-slate-700 sm:hidden">
                {formatMonthLabel(selectedMonth)}
              </p>
            </div>
            <div className="relative w-full sm:w-auto">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm font-medium text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 sm:w-auto"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
