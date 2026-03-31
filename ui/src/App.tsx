import { useState } from 'react'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Users } from './pages/Users'
import { AiConfig } from './pages/AiConfig'
import { Plugins } from './pages/Plugins'
import { SendTest } from './pages/SendTest'
import { QrLogin } from './pages/QrLogin'

type Tab = 'dashboard' | 'users' | 'ai-config' | 'plugins' | 'send-test' | 'qrlogin'

interface TabConfig {
  id: Tab
  label: string
}

const TABS: TabConfig[] = [
  { id: 'dashboard', label: '仪表盘' },
  { id: 'users', label: '用户管理' },
  { id: 'ai-config', label: 'AI 配置' },
  { id: 'plugins', label: '插件' },
  { id: 'send-test', label: '消息测试' },
  { id: 'qrlogin', label: '扫码登录' },
]

function checkLoggedIn(): boolean {
  return document.cookie.includes('session=') || !!sessionStorage.getItem('wxai_authed')
}

export default function App() {
  const [authed, setAuthed] = useState<boolean>(checkLoggedIn)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  const handleLoginSuccess = () => {
    sessionStorage.setItem('wxai_authed', '1')
    setAuthed(true)
  }

  const handleTabChange = (tab: string) => {
    if (TABS.some(t => t.id === tab)) {
      setActiveTab(tab as Tab)
    }
  }

  if (!authed) {
    return <Login onSuccess={handleLoginSuccess} />
  }

  return (
    <Layout>
      {/* Brand bar */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
        {/* Top brand row */}
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-bold leading-none">wx</span>
            </div>
            <div>
              <span className="text-base font-bold text-gray-900 dark:text-white">wxai</span>
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">微信 AI 机器人管理</span>
            </div>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem('wxai_authed'); setAuthed(false) }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            退出
          </button>
        </div>

        {/* Brand gradient line */}
        <div className="h-0.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

        {/* Tab nav */}
        <nav className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'dashboard' && <Dashboard onTabChange={handleTabChange} />}
        {activeTab === 'users' && <Users />}
        {activeTab === 'ai-config' && <AiConfig />}
        {activeTab === 'plugins' && <Plugins />}
        {activeTab === 'send-test' && <SendTest />}
        {activeTab === 'qrlogin' && <QrLogin />}
      </main>
    </Layout>
  )
}
