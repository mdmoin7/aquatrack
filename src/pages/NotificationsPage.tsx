import { useState, type ReactNode } from 'react'
import { Bell } from 'lucide-react'
import { NotificationCard } from '@/components/notifications/NotificationCard'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StatCard } from '@/components/common/StatCard'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { formatMonthLabel } from '@/lib/billing'
import { getNotificationHistory } from '@/services/notificationService'
import type { NotificationTab } from '@/services/notificationService'

export function NotificationsPage() {
  const { user } = useAuth()
  const { selectedMonth } = useAppContext()
  const { notifications, active, unreadCount, loading, acknowledge } = useNotifications()
  const [tab, setTab] = useState<NotificationTab>('active')

  if (loading) return <LoadingSpinner label="Loading notifications..." />

  const history = getNotificationHistory(notifications)
  const visible = tab === 'active' ? active : history

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`Water usage alerts for ${formatMonthLabel(selectedMonth)}`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Unread"
          value={String(unreadCount)}
          subtitle="Needs attention"
          icon={Bell}
          accent="rose"
        />
        <StatCard
          title="Active"
          value={String(active.length)}
          subtitle="This month"
          icon={Bell}
          accent="amber"
        />
        <StatCard
          title="Acknowledged"
          value={String(history.length)}
          subtitle="Resolved this month"
          icon={Bell}
          accent="emerald"
        />
      </div>

      <div className="mb-4 flex rounded-xl border border-slate-200 p-0.5 text-sm font-medium">
        <TabButton active={tab === 'active'} onClick={() => setTab('active')}>
          Active ({active.length})
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          History ({history.length})
        </TabButton>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-slate-200/80">
          <Bell className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 text-sm text-slate-500">
            {tab === 'active'
              ? 'No active notifications for this month'
              : 'No acknowledged notifications for this month'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((alert) => (
            <NotificationCard
              key={alert.id}
              alert={alert}
              user={user}
              onAcknowledge={(id) => void acknowledge(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-4 py-2 transition-colors ${
        active ? 'bg-sky-500 text-white' : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}
