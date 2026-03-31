import { useEffect, useState } from 'react'
import { getHealth } from '../lib/api'
import type { HealthData } from '../lib/types'

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时 ${minutes % 60} 分钟`
  return `${Math.floor(hours / 24)} 天 ${hours % 24} 小时`
}

interface Provider {
  id: string
  name: string
  description: string
  envKey: string
  supported: boolean
}

const PROVIDERS: Provider[] = [
  {
    id: 'claude-cli',
    name: 'Claude CLI',
    description: '通过本地 claude 命令行工具调用，无需 API Key，适合个人使用',
    envKey: 'AI_PROVIDER=claude-cli',
    supported: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic API',
    description: '直接调用 Anthropic 官方 API，需要 ANTHROPIC_API_KEY',
    envKey: 'AI_PROVIDER=anthropic',
    supported: true,
  },
  {
    id: 'openai',
    name: 'OpenAI Compatible',
    description: '兼容 OpenAI 格式的任意端点，支持本地 LLM（Ollama、LM Studio 等）',
    envKey: 'AI_PROVIDER=openai',
    supported: true,
  },
]

export function AiConfig() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(err => setError(err instanceof Error ? err.message : '获取状态失败'))
      .finally(() => setLoading(false))
  }, [])

  const isHealthy = health?.status === 'ok'

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI 配置</h2>

      {/* Main status card */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">当前 Provider</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">Claude CLI</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">通过本地命令行工具与 Claude 交互</p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              {loading ? (
                <div className="h-7 w-24 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ) : error ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  无法连接
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                  isHealthy
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                  {isHealthy ? '运行中' : '异常'}
                </span>
              )}
              {health && (
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  已运行 {formatUptime(health.uptime)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Config guide */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-5 space-y-2">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">配置说明</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              AI Provider 通过 <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded text-xs font-mono">.env</code> 文件配置，修改后需要重启服务生效。
            </p>
          </div>
        </div>
        <div className="ml-8 bg-gray-900 dark:bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-300 space-y-1">
          <p className="text-gray-500"># .env 示例</p>
          <p><span className="text-emerald-400">AI_PROVIDER</span>=claude-cli</p>
          <p><span className="text-emerald-400">ANTHROPIC_API_KEY</span>=sk-ant-...</p>
          <p><span className="text-emerald-400">OPENAI_BASE_URL</span>=http://localhost:11434/v1</p>
          <p><span className="text-emerald-400">OPENAI_MODEL</span>=llama3</p>
        </div>
      </div>

      {/* Providers */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">支持的 Provider</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PROVIDERS.map(provider => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 dark:text-white">{provider.name}</p>
        {provider.supported ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            支持
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 shrink-0">
            计划中
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{provider.description}</p>
      <code className="block text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-600 dark:text-gray-400">
        {provider.envKey}
      </code>
    </div>
  )
}
