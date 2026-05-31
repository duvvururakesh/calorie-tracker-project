import { Suspense, lazy } from 'react'
import { Capacitor } from '@capacitor/core'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import Layout from '@/components/Layout'
import Spinner from '@/components/Spinner'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SignupPage = lazy(() => import('@/pages/SignupPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const LogPage = lazy(() => import('@/pages/LogPage'))
const GoalsPage = lazy(() => import('@/pages/GoalsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const NibblyPage = lazy(() => import('@/pages/NibblyPage'))
const FriendsPage = lazy(() => import('@/pages/FriendsPage'))

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })
const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children, redirectTo = '/dashboard' }: { children: React.ReactNode; redirectTo?: string }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to={redirectTo} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Router>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute redirectTo="/onboarding"><SignupPage /></PublicRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/log" element={<LogPage />} />
                <Route path="/coach" element={<NibblyPage />} />
                <Route path="/friends" element={<FriendsPage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}
