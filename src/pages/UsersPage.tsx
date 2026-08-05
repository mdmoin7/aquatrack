import { useEffect, useState } from 'react'
import { Pencil, Plus, Users } from 'lucide-react'
import DataTable from 'react-data-table-component'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useAuth } from '@/context/AuthContext'
import { getFlats } from '@/services/readingsService'
import {
  createUserProfile,
  listSocietyUsers,
  updateUserProfile,
} from '@/services/userProfileService'
import type { BlockId, Flat, User, UserRole } from '@/types'
import { BLOCK_LABELS } from '@/types'
import { getAuthErrorMessage } from '@/lib/authErrors'

const ADMIN_ROLES: UserRole[] = ['admin', 'resident', 'guest', 'meter_reader']
const SUPERADMIN_ROLES: UserRole[] = ['superadmin', 'admin', 'resident', 'guest', 'meter_reader']

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [flats, setFlats] = useState<Flat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    id: '',
    email: '',
    displayName: '',
    role: 'resident' as UserRole,
    flatId: '',
    assignedBlocks: [] as BlockId[],
  })

  const isSuperAdmin = currentUser?.role === 'superadmin'
  const roleOptions = isSuperAdmin ? SUPERADMIN_ROLES : ADMIN_ROLES

  const load = async () => {
    setLoading(true)
    const [u, f] = await Promise.all([listSocietyUsers(), getFlats()])
    setUsers(u)
    setFlats(f)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const resetForm = () => {
    setForm({ id: '', email: '', displayName: '', role: 'resident', flatId: '', assignedBlocks: [] })
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  const openCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (u: User) => {
    setEditingId(u.id)
    setForm({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      flatId: u.flatId ?? '',
      assignedBlocks: u.assignedBlocks ?? [],
    })
    setShowForm(true)
    setError('')
  }

  const handleSave = async () => {
    setError('')
    try {
      if (!isSuperAdmin && form.role === 'superadmin') {
        throw new Error('Only super admins can assign the superadmin role.')
      }
      if (editingId) {
        const target = users.find((u) => u.id === editingId)
        if (target?.role === 'superadmin' && !isSuperAdmin) {
          throw new Error('Only super admins can modify super admin accounts.')
        }
        await updateUserProfile(editingId, {
          displayName: form.displayName,
          role: form.role,
          flatId: form.flatId || undefined,
          assignedBlocks: form.role === 'meter_reader' ? form.assignedBlocks : undefined,
        })
      } else {
        if (!form.id.trim()) throw new Error('Firebase User ID is required')
        await createUserProfile({
          id: form.id.trim(),
          email: form.email,
          displayName: form.displayName,
          role: form.role,
          flatId: form.flatId || undefined,
          assignedBlocks: form.role === 'meter_reader' ? form.assignedBlocks : undefined,
        })
      }
      resetForm()
      await load()
    } catch (err) {
      setError(getAuthErrorMessage(err))
    }
  }

  const columns = [
    { name: 'Name', selector: (row: User) => row.displayName, sortable: true },
    { name: 'Email', selector: (row: User) => row.email, sortable: true },
    { name: 'Role', selector: (row: User) => row.role, sortable: true },
    {
      name: 'Flat',
      selector: (row: User) =>
        flats.find((f) => f.id === row.flatId)?.label ?? row.flatId ?? '—',
    },
    {
      name: 'Blocks',
      selector: (row: User) =>
        row.assignedBlocks?.map((b) => BLOCK_LABELS[b]).join(', ') ?? '—',
    },
    {
      name: 'Actions',
      cell: (row: User) =>
        row.id === currentUser?.id || (row.role !== 'superadmin' || isSuperAdmin) ? (
          <button
            type="button"
            onClick={() => openEdit(row)}
            className="rounded-lg p-2 text-sky-500 hover:bg-sky-50"
            title="Edit user"
          >
            <Pencil className="h-4 w-4" />
          </button>
        ) : null,
      ignoreRowClick: true,
    },
  ]

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Manage society user profiles, roles, and flat assignments"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
          >
            <Plus className="h-4 w-4" />
            Add User Profile
          </button>
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <Users className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
        <div>
          <p className="font-medium text-slate-800">How to add residents</p>
          <ol className="mt-1 list-inside list-decimal space-y-1">
            <li>Create the account in Firebase Console → Authentication, or have them register.</li>
            <li>Copy their User UID from Firebase Console.</li>
            <li>Add a profile here with role <strong>resident</strong> and assign their flat.</li>
          </ol>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
          <h3 className="mb-4 font-semibold text-slate-900">
            {editingId ? 'Edit user profile' : 'New user profile'}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {!editingId && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Firebase User ID
                </label>
                <input
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  placeholder="Paste UID from Firebase Console"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-sm"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={form.email}
                disabled={Boolean(editingId)}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Display name</label>
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                disabled={form.id === currentUser?.id}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm disabled:bg-slate-50"
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Flat</label>
              <select
                value={form.flatId}
                onChange={(e) => setForm({ ...form, flatId: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                <option value="">— None —</option>
                {flats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            {form.role === 'meter_reader' && (
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Assigned blocks
                </label>
                <div className="flex flex-wrap gap-3">
                  {(Object.keys(BLOCK_LABELS) as BlockId[]).map((block) => (
                    <label
                      key={block}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.assignedBlocks.includes(block)}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            assignedBlocks: e.target.checked
                              ? [...form.assignedBlocks, block]
                              : form.assignedBlocks.filter((b) => b !== block),
                          })
                        }}
                      />
                      {BLOCK_LABELS[block]}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
            >
              Save
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
        <DataTable columns={columns} data={users} pagination dense highlightOnHover />
      </div>
    </div>
  )
}
