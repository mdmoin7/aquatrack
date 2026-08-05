import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AdminRoute, AnalyticsRoute, BlockDashboardRoute, GuestRoute, ProtectedRoute, SocietyReadingsRoute, StaffRoute } from '@/components/common/ProtectedRoute'
import { AppProvider } from '@/context/AppContext'
import { AuthProvider } from '@/context/AuthContext'
import { CacheProvider } from '@/context/CacheContext'
import { ensureLocalSeed } from '@/data/seed'
import { flushReadingQueue } from '@/services/readingsService'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { SetupProfilePage } from '@/pages/SetupProfilePage'
import { BlockDashboardPage } from '@/pages/BlockDashboardPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ReadingsPage } from '@/pages/ReadingsPage'
import { AdministrationPage } from '@/pages/AdministrationPage'
import { BillingConfigPage } from '@/pages/BillingConfigPage'
import { FlatAnalyticsPage } from '@/pages/FlatAnalyticsPage'
import { AlertsPage } from '@/pages/AlertsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { CacheInspectorPage } from '@/pages/CacheInspectorPage'
import { TankerProcurementPage } from '@/pages/TankerProcurementPage'
import { ResidentPage } from '@/pages/ResidentPage'
import { UsersPage } from '@/pages/UsersPage'

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestRoute>
            <RegisterPage />
          </GuestRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <GuestRoute>
            <ForgotPasswordPage />
          </GuestRoute>
        }
      />
      <Route
        path="/setup-profile"
        element={
          <ProtectedRoute>
            <SetupProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/block-dashboard"
          element={
            <BlockDashboardRoute>
              <BlockDashboardPage />
            </BlockDashboardRoute>
          }
        />
        <Route
          path="/"
          element={
            <AdminRoute>
              <DashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="/readings"
          element={
            <SocietyReadingsRoute>
              <ReadingsPage />
            </SocietyReadingsRoute>
          }
        />
        <Route
          path="/procurement"
          element={
            <AdminRoute>
              <TankerProcurementPage />
            </AdminRoute>
          }
        />
        <Route
          path="/administration"
          element={
            <AdminRoute>
              <AdministrationPage />
            </AdminRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <AdminRoute>
              <BillingConfigPage />
            </AdminRoute>
          }
        />
        <Route
          path="/users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <AdminRoute>
              <ReportsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/cache"
          element={
            <AdminRoute>
              <CacheInspectorPage />
            </AdminRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <AnalyticsRoute>
              <FlatAnalyticsPage />
            </AnalyticsRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <StaffRoute>
              <AlertsPage />
            </StaffRoute>
          }
        />
        <Route
          path="/resident"
          element={
            <StaffRoute>
              <ResidentPage />
            </StaffRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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

  return (
    <AuthProvider>
      <AppProvider>
        <CacheProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </CacheProvider>
      </AppProvider>
    </AuthProvider>
  )
}
