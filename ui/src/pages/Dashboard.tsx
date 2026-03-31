import { useEffect, useState } from 'react'
import { getAccounts, deleteAccount, getHealth } from '../lib/api'
import type { Account, HealthData } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'

interface DashboardProps {
  onTabChange: (tab: string) => void
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

export function Dashboard({ onTabChange }: DashboardProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [deletingToken, setDeletingToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [accts, h] = await Promise.all([getAccounts(), getHealth()])
      setAccounts(accts)
      setHealth(h)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleDelete = async (token: string) => {
    if (!confirm('确认删除该账号？')) return
    setDeletingToken(token)
    try {
      await deleteAccount(token)
      setAccounts(prev => prev.filter(a => a.token !== token))
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingToken(null)
    }
  }

  const onlineCount = accounts.filter(a => a.status === 'online').length
  const offlineCount = accounts.filter(a => a.status === 'offline').length
  const expiredCount = accounts.filter(a => a.status === 'expired').length

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">仪表盘</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">账号状态总览</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg transition"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="在线账号" value={onlineCount} color="emerald" />
        <StatCard label="离线账号" value={offlineCount} color="gray" />
        <StatCard label="已过期" value={expiredCount} color="red" />
        <StatCard
          label="AI 状态"
          value={health ? (health.status === 'ok' ? '正常' : '异常') : '—'}
          sub={health ? `运行 ${formatUptime(health.uptime)}` : undefined}
          color={health?.status === 'ok' ? 'teal' : 'red'}
        />
      </div>

      {/* Accounts */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">账号列表</h3>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 animate-pulse h-32" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyAccounts onAddClick={() => onTabChange('qrlogin')} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(account => (
              <AccountCard
                key={account.token}
                account={account}
                deleting={deletingToken === account.token}
                onDelete={() => handleDelete(account.token)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- sub-components ---------- */

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  color: 'emerald' | 'teal' | 'gray' | 'red'
}) {
  const valueColor = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    teal: 'text-teal-600 dark:text-teal-400',
    gray: 'text-gray-600 dark:text-gray-400',
    red: 'text-red-500 dark:text-red-400',
  }[color]

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function AccountCard({
  account,
  deleting,
  onDelete,
}: {
  account: Account
  deleting: boolean
  onDelete: () => void
}) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white truncate">{account.label}</p>
          {account.userId && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{account.userId}</p>
          )}
        </div>
        <StatusBadge variant={account.status} />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
        <span>最后心跳</span>
        <span>{account.lastKeepAlive ? formatRelativeTime(account.lastKeepAlive) : '—'}</span>
      </div>

      <div className="pt-1 border-t border-gray-50 dark:border-gray-800 flex justify-end">
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition disabled:opacity-50"
        >
          {deleting ? '删除中…' : '删除账号'}
        </button>
      </div>
    </div>
  )
}

function EmptyAccounts({ onAddClick }: { onAddClick: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 py-16 flex flex-col items-center gap-3 text-center">
      <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <p className="text-sm text-gray-500 dark:text-gray-400">暂无账号</p>
      <button
        onClick={onAddClick}
        className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
      >
        前往扫码登录 →
      </button>
    </div>
  )
}
