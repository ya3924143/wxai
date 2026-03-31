import { useEffect, useRef, useState } from 'react'
import { startQrLogin, pollQrStatus } from '../lib/api'
import type { QrStatusCode } from '../lib/types'

interface QrState {
  phase: 'idle' | 'loading' | 'polling' | 'done' | 'error'
  qrcode?: string
  qrcodeImgContent?: string
  statusCode?: QrStatusCode
  message?: string
  accountLabel?: string
}

const STATUS_TEXT: Record<QrStatusCode, string> = {
  pending: '等待扫码',
  scanned: '已扫码，请在手机上确认',
  confirmed: '登录成功',
  success: '登录成功',
  expired: '二维码已过期，请重新获取',
  error: '登录出错',
}

const STATUS_COLOR: Record<QrStatusCode, string> = {
  pending: 'text-gray-600 dark:text-gray-400',
  scanned: 'text-amber-600 dark:text-amber-400',
  confirmed: 'text-emerald-600 dark:text-emerald-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  expired: 'text-red-600 dark:text-red-400',
  error: 'text-red-600 dark:text-red-400',
}

export function QrLogin() {
  const [state, setState] = useState<QrState>({ phase: 'idle' })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => () => stopPolling(), [])

  const handleStart = async () => {
    setState({ phase: 'loading' })
    stopPolling()

    try {
      const result = await startQrLogin()
      setState({
        phase: 'polling',
        qrcode: result.qrcode,
        qrcodeImgContent: result.qrcodeImgContent,
        statusCode: 'pending',
      })

      pollRef.current = setInterval(async () => {
        try {
          const status = await pollQrStatus(result.qrcode)
          setState(prev => ({
            ...prev,
            statusCode: status.status,
            message: status.message,
            accountLabel: status.account?.label,
          }))

          if (['confirmed', 'success', 'expired', 'error'].includes(status.status)) {
            stopPolling()
            setState(prev => ({ ...prev, phase: 'done' }))
          }
        } catch (err) {
          stopPolling()
          setState(prev => ({
            ...prev,
            phase: 'error',
            message: err instanceof Error ? err.message : '轮询失败',
          }))
        }
      }, 2000)
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : '获取二维码失败',
      })
    }
  }

  const handleReset = () => {
    stopPolling()
    setState({ phase: 'idle' })
  }

  const isSuccess = state.statusCode === 'confirmed' || state.statusCode === 'success'
  const isTerminal = state.phase === 'done' || state.phase === 'error'

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">扫码登录</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">添加微信账号到网关</p>
        </div>

        {/* Main card */}
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          <div className="p-6 flex flex-col items-center gap-6">
            {state.phase === 'idle' && (
              <IdleView onStart={handleStart} />
            )}

            {state.phase === 'loading' && (
              <LoadingView />
            )}

            {(state.phase === 'polling' || state.phase === 'done') && state.qrcodeImgContent && (
              <>
                {/* QR image */}
                <div className={`relative rounded-xl overflow-hidden border-2 transition ${
                  isSuccess
                    ? 'border-emerald-400 dark:border-emerald-500'
                    : state.statusCode === 'expired' || state.statusCode === 'error'
                    ? 'border-red-300 dark:border-red-700'
                    : 'border-gray-200 dark:border-gray-700'
                }`}>
                  <img
                    src={state.qrcodeImgContent}
                    alt="微信登录二维码"
                    className={`w-56 h-56 object-contain transition ${isSuccess ? 'opacity-60' : ''}`}
                  />
                  {isSuccess && (
                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm">
                      <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status */}
                {state.statusCode && (
                  <div className="text-center space-y-1">
                    <p className={`font-medium ${STATUS_COLOR[state.statusCode]}`}>
                      {STATUS_TEXT[state.statusCode]}
                    </p>
                    {state.message && state.message !== STATUS_TEXT[state.statusCode] && (
                      <p className="text-sm text-gray-400 dark:text-gray-500">{state.message}</p>
                    )}
                    {state.accountLabel && isSuccess && (
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        账号：{state.accountLabel}
                      </p>
                    )}
                    {state.phase === 'polling' && state.statusCode === 'pending' && (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mt-1">
                        <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>
                )}

                {isTerminal && (
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition"
                  >
                    {isSuccess ? '继续添加账号' : '重新获取二维码'}
                  </button>
                )}
              </>
            )}

            {state.phase === 'error' && !state.qrcodeImgContent && (
              <ErrorView message={state.message} onRetry={handleStart} />
            )}
          </div>
        </div>

        {/* Steps guide */}
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">操作步骤</p>
          <ol className="space-y-2">
            {[
              '点击"获取二维码"按钮',
              '打开手机微信 → 扫描页面二维码',
              '在手机上点击"登录"确认',
              '等待登录成功提示',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-500 dark:text-gray-400">
                <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

function IdleView({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
        <svg className="w-10 h-10 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">点击按钮生成微信登录二维码</p>
      <button
        onClick={onStart}
        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition"
      >
        获取二维码
      </button>
    </div>
  )
}

function LoadingView() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="w-12 h-12 rounded-full border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-500 animate-spin" />
      <p className="text-sm text-gray-500 dark:text-gray-400">正在生成二维码…</p>
    </div>
  )
}

function ErrorView({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <p className="text-sm text-red-500 dark:text-red-400 text-center">{message ?? '出现错误'}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition"
      >
        重试
      </button>
    </div>
  )
}
