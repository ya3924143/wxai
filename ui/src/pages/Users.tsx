import { useEffect, useState } from 'react'
import {
  getWechatUsers,
  getManagedUsers,
  addManagedUser,
  deleteManagedUser,
  setUserPermission,
} from '../lib/api'
import type { WechatUser, ManagedUser } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'

export function Users() {
  const [wechatUsers, setWechatUsers] = useState<WechatUser[]>([])
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add user form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUserId, setNewUserId] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [addingUser, setAddingUser] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [wx, managed] = await Promise.all([getWechatUsers(), getManagedUsers()])
      setWechatUsers(wx)
      setManagedUsers(managed)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserId.trim() || !newUserName.trim()) return
    setAddingUser(true)
    setAddError(null)
    try {
      const user = await addManagedUser(newUserId.trim(), newUserName.trim(), true)
      setManagedUsers(prev => [...prev, user])
      setNewUserId('')
      setNewUserName('')
      setShowAddForm(false)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '添加失败')
    } finally {
      setAddingUser(false)
    }
  }

  const handleTogglePermission = async (user: ManagedUser) => {
    setTogglingId(user.userId)
    try {
      await setUserPermission(user.userId, !user.permissions.chat)
      setManagedUsers(prev => prev.map(u =>
        u.userId === user.userId
          ? { ...u, permissions: { ...u.permissions, chat: !u.permissions.chat } }
          : u
      ))
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确认删除该用户？')) return
    setDeletingId(userId)
    try {
      await deleteManagedUser(userId)
      setManagedUsers(prev => prev.filter(u => u.userId !== userId))
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">用户管理</h2>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: WeChat users */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            微信用户 · {wechatUsers.length}
          </h3>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 animate-pulse" />
              ))}
            </div>
          ) : wechatUsers.length === 0 ? (
            <EmptyState text="暂无微信用户" />
          ) : (
            <div className="space-y-2">
              {wechatUsers.map(u => (
                <div
                  key={u.userId}
                  className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-gray-800 dark:text-gray-200 truncate">
                      {u.userId.slice(0, 12)}…
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{u.accountLabel}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.hasContextToken && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="有 Context Token" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Managed users */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              受管理用户 · {managedUsers.length}
            </h3>
            <button
              onClick={() => setShowAddForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加用户
            </button>
          </div>

          {/* Inline add form */}
          {showAddForm && (
            <form
              onSubmit={handleAddUser}
              className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">用户 ID</label>
                  <input
                    value={newUserId}
                    onChange={e => setNewUserId(e.target.value)}
                    placeholder="userId"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">名称</label>
                  <input
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                    placeholder="显示名称"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
              {addError && (
                <p className="text-xs text-red-500 dark:text-red-400">{addError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setAddError(null) }}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={addingUser || !newUserId.trim() || !newUserName.trim()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-medium rounded-lg transition"
                >
                  {addingUser ? '添加中…' : '确认添加'}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 animate-pulse" />
              ))}
            </div>
          ) : managedUsers.length === 0 ? (
            <EmptyState text="暂无受管理用户" />
          ) : (
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">名称</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">用户 ID</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Chat 权限</th>
                    <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {managedUsers.map((u, i) => (
                    <tr
                      key={u.userId}
                      className={i < managedUsers.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {u.userId.slice(0, 12)}…
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant={u.permissions.chat ? 'enabled' : 'disabled'} />
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleTogglePermission(u)}
                          disabled={togglingId === u.userId}
                          className="text-xs text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition disabled:opacity-50"
                        >
                          {togglingId === u.userId ? '…' : (u.permissions.chat ? '禁用' : '启用')}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.userId)}
                          disabled={deletingId === u.userId}
                          className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition disabled:opacity-50"
                        >
                          {deletingId === u.userId ? '…' : '删除'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 py-10 flex flex-col items-center gap-2">
      <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p className="text-sm text-gray-400 dark:text-gray-500">{text}</p>
    </div>
  )
}
