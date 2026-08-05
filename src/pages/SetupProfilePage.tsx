import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { UserCog } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getActiveSocietyId } from '@/lib/firestorePaths'
import { isSuperAdminEmail } from '@/lib/superAdmin'
import { getAuthErrorMessage } from '@/lib/authErrors'

export function SetupProfilePage() {
  const { user, isDemo, profileMissing, createProfile, signOut } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName)
  }, [user?.displayName])

  if (isDemo) return <Navigate to="/" replace />
  if (!user) return <Navigate to="/login" replace />
  if (!profileMissing) return <Navigate to={user.role === 'resident' ? '/resident' : '/'} replace />

  const isSuperAdmin = isSuperAdminEmail(user.email)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createProfile(displayName)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <UserCog className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Complete your profile</h1>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <p className="text-sm text-slate-600">
            Your Firebase account is ready. Create your AquaTrack profile for society{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              {getActiveSocietyId()}
            </code>
            .
          </p>
          <p className="text-xs text-amber-700">
            Society administrators: complete setup below. Residents should ask an admin to create
            their profile from the Users page.
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              required
            />
          </div>
          <p className="rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-500">
            User ID: {user.id}
          </p>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
          >
            {loading
              ? 'Creating profile...'
              : isSuperAdmin
                ? 'Create super admin profile'
                : 'Create admin profile'}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
