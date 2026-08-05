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
  Settings,
  Truck,
  User,
  Users,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppContext } from '@/context/AppContext'
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

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { selectedMonth, setSelectedMonth } = useAppContext()
  const navigate = useNavigate()
  const months = getPreviousMonths(12)

  const nav = user?.role === 'resident' ? residentNav : adminNav

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white">
            <Droplets className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">AquaTrack</p>
            <p className="text-xs text-slate-400">Water Management</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-600">
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
              className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-600"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="ml-64 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between px-6 py-4">
            <p className="text-sm text-slate-500">
              Society water consumption & billing platform
            </p>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm font-medium text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
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

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
