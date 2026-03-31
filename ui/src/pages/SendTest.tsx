import { useEffect, useRef, useState } from 'react'
import { getWechatUsers, sendMessage } from '../lib/api'
import type { WechatUser, SendHistory } from '../lib/types'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function SendTest() {
  const [users, setUsers] = useState<WechatUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [selectedUser, setSelectedUser] = useState<WechatUser | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<SendHistory[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    getWechatUsers()
      .then(users => {
        setUsers(users)
        if (users.length > 0) setSelectedUser(users[0])
      })
      .catch(console.error)
      .finally(() => setLoadingUsers(false))
  }, [])

  const handleSend = async () => {
    if (!selectedUser || !text.trim() || sending) return

    const userId = selectedUser.userId
    const msgText = text.trim()
    setSending(true)
    setText('')
    textareaRef.current?.focus()

    try {
      await sendMessage(userId, msgText)
      const entry: SendHistory = {
        id: generateId(),
        userId,
        userLabel: `${userId.slice(0, 12)}…`,
        text: msgText,
        sentAt: new Date().toISOString(),
        success: true,
      }
      setHistory(prev => [entry, ...prev])
    } catch (err) {
      const entry: SendHistory = {
        id: generateId(),
        userId,
        userLabel: `${userId.slice(0, 12)}…`,
        text: msgText,
        sentAt: new Date().toISOString(),
        success: false,
        error: err instanceof Error ? err.message : '发送失败',
      }
      setHistory(prev => [entry, ...prev])
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">消息测试</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">向指定用户发送测试消息</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: user selector */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            选择用户
          </h3>

          {loadingUsers ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 animate-pulse" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 py-10 flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-xs text-gray-400 dark:text-gray-500">暂无用户</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {users.map(user => (
                <button
                  key={user.userId}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full text-left rounded-xl border px-4 py-3 flex items-center justify-between gap-3 transition ${
                    selectedUser?.userId === user.userId
                      ? 'border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                      : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-200 dark:hover:border-emerald-800'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-gray-800 dark:text-gray-200 truncate">
                      {user.userId.slice(0, 12)}…
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{user.accountLabel}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {user.hasContextToken && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="有 Context Token" />
                    )}
                    {selectedUser?.userId === user.userId && (
                      <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: message compose + history */}
        <div className="lg:col-span-2 space-y-4">
          {/* Compose area */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                收件人：
                {selectedUser ? (
                  <span className="font-mono text-gray-800 dark:text-gray-200 ml-1">{selectedUser.userId.slice(0, 12)}…</span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 ml-1">未选择</span>
                )}
              </p>
            </div>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息内容…"
              rows={4}
              disabled={!selectedUser || sending}
              className="w-full px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 bg-transparent border-none outline-none resize-none disabled:opacity-50"
            />
            <div className="px-4 py-3 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                <kbd className="px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono text-xs bg-gray-50 dark:bg-gray-800">⌘</kbd>
                {' + '}
                <kbd className="px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono text-xs bg-gray-50 dark:bg-gray-800">↵</kbd>
                {' 发送'}
              </p>
              <button
                onClick={handleSend}
                disabled={!selectedUser || !text.trim() || sending}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 dark:disabled:bg-emerald-800 text-white text-sm font-medium rounded-lg transition"
              >
                {sending ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    发送中
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    发送
                  </>
                )}
              </button>
            </div>
          </div>

          {/* History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                发送历史
              </h3>
              {history.length > 0 && (
                <button
                  onClick={() => setHistory([])}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  清空
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 py-10 flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-xs text-gray-400 dark:text-gray-500">暂无发送记录</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {history.map(item => (
                  <div
                    key={item.id}
                    className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-3 ${
                      item.success
                        ? 'border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/10'
                        : 'border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/10'
                    }`}
                  >
                    {item.success ? (
                      <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{item.userLabel}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{formatTime(item.sentAt)}</span>
                      </div>
                      <p className="text-gray-800 dark:text-gray-200 mt-0.5 break-all">{item.text}</p>
                      {item.error && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{item.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
