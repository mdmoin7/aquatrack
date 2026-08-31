import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AdminRoute, AnalyticsRoute, BlockDashboardRoute, GuestRoute, ProtectedRoute, SocietyReadingsRoute, StaffRoute } from '@/components/common/ProtectedRoute'
import { AppProvider } from '@/context/AppContext'
import { AuthProvider } from '@/context/AuthContext'
import { CacheProvider } from '@/context/CacheContext'
import { ensureLocalSeed } from '@/data/seed'
import { flushReadingQueue } from '@/services/readingsService'

const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const SetupProfilePage = lazy(() => import('@/pages/SetupProfilePage').then((m) => ({ default: m.SetupProfilePage })))
const BlockDashboardPage = lazy(() => import('@/pages/BlockDashboardPage').then((m) => ({ default: m.BlockDashboardPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ReadingsPage = lazy(() => import('@/pages/ReadingsPage').then((m) => ({ default: m.ReadingsPage })))
const AdministrationPage = lazy(() => import('@/pages/AdministrationPage').then((m) => ({ default: m.AdministrationPage })))
const BillingConfigPage = lazy(() => import('@/pages/BillingConfigPage').then((m) => ({ default: m.BillingConfigPage })))
const FlatAnalyticsPage = lazy(() => import('@/pages/FlatAnalyticsPage').then((m) => ({ default: m.FlatAnalyticsPage })))
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })))
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const CacheInspectorPage = lazy(() => import('@/pages/CacheInspectorPage').then((m) => ({ default: m.CacheInspectorPage })))
const TankerProcurementPage = lazy(() => import('@/pages/TankerProcurementPage').then((m) => ({ default: m.TankerProcurementPage })))
const ResidentPage = lazy(() => import('@/pages/ResidentPage').then((m) => ({ default: m.ResidentPage })))
const UsersPage = lazy(() => import('@/pages/UsersPage').then((m) => ({ default: m.UsersPage })))
const ExpensesPage = lazy(() => import('@/pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })))
const ExpenseSnapshotPage = lazy(() => import('@/pages/ExpenseSnapshotPage').then((m) => ({ default: m.ExpenseSnapshotPage })))

function PageFallback() {
  return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" aria-label="Loading" /></div>
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
        <Route path="/setup-profile" element={<ProtectedRoute><SetupProfilePage /></ProtectedRoute>} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/block-dashboard" element={<BlockDashboardRoute><BlockDashboardPage /></BlockDashboardRoute>} />
          <Route path="/" element={<AdminRoute><DashboardPage /></AdminRoute>} />
          <Route path="/readings" element={<SocietyReadingsRoute><ReadingsPage /></SocietyReadingsRoute>} />
          <Route path="/procurement" element={<AdminRoute><TankerProcurementPage /></AdminRoute>} />
          <Route path="/expenses" element={<AdminRoute><ExpensesPage /></AdminRoute>} />
          <Route path="/monthly-expenses" element={<StaffRoute><ExpenseSnapshotPage /></StaffRoute>} />
          <Route path="/administration" element={<AdminRoute><AdministrationPage /></AdminRoute>} />
          <Route path="/billing" element={<AdminRoute><BillingConfigPage /></AdminRoute>} />
          <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
          <Route path="/reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
          <Route path="/cache" element={<AdminRoute><CacheInspectorPage /></AdminRoute>} />
          <Route path="/analytics" element={<AnalyticsRoute><FlatAnalyticsPage /></AnalyticsRoute>} />
          <Route path="/notifications" element={<StaffRoute><NotificationsPage /></StaffRoute>} />
          <Route path="/alerts" element={<Navigate to="/notifications" replace />} />
          <Route path="/resident" element={<StaffRoute><ResidentPage /></StaffRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  useEffect(() => {
    void ensureLocalSeed()
    if (navigator.onLine) void flushReadingQueue()
    const onOnline = () => void flushReadingQueue()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  return <AuthProvider><AppProvider><CacheProvider><BrowserRouter><AppRoutes /></BrowserRouter></CacheProvider></AppProvider></AuthProvider>
}
