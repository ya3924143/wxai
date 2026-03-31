import { useEffect, useState } from 'react'
import { getPlugins } from '../lib/api'
import type { Plugin } from '../lib/types'

export function Plugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPlugins()
      .then(setPlugins)
      .catch(err => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">插件</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">自动化任务与功能扩展</p>
        </div>
        {!loading && !error && (
          <span className="text-sm text-gray-400 dark:text-gray-500">{plugins.length} 个插件</span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 animate-pulse h-40" />
          ))}
        </div>
      ) : plugins.length === 0 ? (
        <EmptyPlugins />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plugins.map(plugin => (
            <PluginCard key={plugin.id} plugin={plugin} />
          ))}
        </div>
      )}
    </div>
  )
}

function PluginCard({ plugin }: { plugin: Plugin }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-gray-900 dark:text-white">{plugin.name}</p>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" title="已启用" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{plugin.description}</p>
      </div>

      {/* Triggers */}
      {plugin.triggers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">触发词</p>
          <div className="flex flex-wrap gap-1.5">
            {plugin.triggers.map(trigger => (
              <span
                key={trigger}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
              >
                {trigger}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Schedule */}
      {plugin.schedule && (
        <div className="pt-3 border-t border-gray-50 dark:border-gray-800 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-teal-500 dark:text-teal-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="min-w-0">
            <p className="text-xs font-medium text-teal-600 dark:text-teal-400 truncate">{plugin.schedule.label}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{plugin.schedule.cron}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyPlugins() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 py-20 flex flex-col items-center gap-3">
      <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
      </svg>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">暂无插件</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">插件配置后将在此显示</p>
    </div>
  )
}
