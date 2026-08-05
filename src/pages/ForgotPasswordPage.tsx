import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Droplets } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getAuthErrorMessage } from '@/lib/authErrors'

export function ForgotPasswordPage() {
  const { resetPassword, isDemo } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  if (isDemo) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-slate-500">Password reset is not available in demo mode.</p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
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
          <h1 className="text-2xl font-bold text-slate-900">Reset password</h1>
          <p className="mt-1 text-sm text-slate-500">
            We&apos;ll email you a link to reset your password
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200">
          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
              <p className="text-sm text-slate-700">
                If an account exists for <strong>{email}</strong>, a reset link has been sent.
              </p>
              <Link
                to="/login"
                className="mt-4 inline-block text-sm font-medium text-sky-600 hover:text-sky-700"
              >
                Return to sign in
              </Link>
            </div>
          ) : (
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
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
