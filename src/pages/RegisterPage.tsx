import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Droplets } from 'lucide-react'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { useAuth } from '@/context/AuthContext'
import { getAuthErrorMessage } from '@/lib/authErrors'

export function RegisterPage() {
  const { signUp, isDemo } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isDemo) return <Navigate to="/login" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      await signUp(email, password, displayName)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500 text-white">
            <Droplets className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Register with Firebase Authentication
          </p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 space-y-4"
        >
          <GoogleSignInButton disabled={loading} onError={setError} />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400">or</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
            <input
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              required
            />
          </div>
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
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Confirm password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              required
              minLength={6}
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-center text-xs text-slate-400">
            After registration you will complete your society profile setup.
          </p>
        </form>
      </div>
    </div>
  )
}
