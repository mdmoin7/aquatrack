import { Link } from 'react-router-dom'
import { Droplets } from 'lucide-react'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { useAuth } from '@/context/AuthContext'
import { getAuthErrorMessage } from '@/lib/authErrors'
import { useState } from 'react'

export function LoginPage() {
  const { signIn, isDemo, signInDemo } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-200">
            <Droplets className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">AquaTrack</h1>
          <p className="mt-2 text-sm text-slate-500">
            Enterprise Water Consumption & Billing Management
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200">
          {isDemo ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-slate-500">
                Demo mode — choose a role to explore the platform
              </p>
              <button
                type="button"
                onClick={() => signInDemo('admin')}
                className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-600"
              >
                Sign in as Admin
              </button>
              <button
                type="button"
                onClick={() => signInDemo('resident')}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign in as Resident
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <GoogleSignInButton disabled={loading} onError={setError} />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400">or</span>
                </div>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    required
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Password</label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-sky-600 hover:text-sky-700"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    required
                  />
                </div>
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
                >
                  {loading ? 'Signing in...' : 'Sign in with email'}
                </button>
                <p className="text-center text-sm text-slate-500">
                  No account?{' '}
                  <Link to="/register" className="font-medium text-sky-600 hover:text-sky-700">
                    Create one
                  </Link>
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
