import { ArrowLeft, MessageCircle, Search, Shield, Sparkles } from 'lucide-react'
import { useEffect } from 'react'
import { type AuthTab, useAuthPageStore } from '../store'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

interface AuthContainerProps {
  defaultTab?: AuthTab
}

function getTabFromSearch(search: string): AuthTab | null {
  const params = new URLSearchParams(search)
  const tab = params.get('tab')
  if (tab === 'register' || tab === 'login') return tab
  return null
}

function getCurrentSearch(): string {
  return typeof window !== 'undefined' ? window.location.search : ''
}

export function AuthContainer({ defaultTab = 'login' }: AuthContainerProps) {
  const tab = useAuthPageStore((s) => s.tab)
  const setTab = useAuthPageStore((s) => s.setTab)

  useEffect(() => {
    const queryTab = getTabFromSearch(getCurrentSearch())
    if (queryTab) {
      setTab(queryTab)
    } else if (defaultTab === 'register') {
      setTab('register')
    }
  }, [defaultTab, setTab])

  const switchTab = (next: AuthTab) => {
    setTab(next)
  }

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundColor: 'var(--color-auth-bg)',
        backgroundImage: 'url(/images/login-center-bg.png)',
        backgroundSize: '50rem',
        backgroundPosition: '260px 50%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="relative flex min-h-screen flex-col px-20 py-10">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg">
            <Sparkles className="size-6 text-primary" />
          </div>
          <span className="text-2xl font-bold text-text-primary">GoferBot</span>
        </div>
        {/* 功能介绍 */}
        <div className="max-w-md pt-25 relative z-5">
          <h1 className="text-4xl font-bold text-text-primary">智能知识管理</h1>
          <p className="mt-4 text-lg text-text-secondary">让每一次对话都触手可及</p>

          <div className="mt-12 space-y-10">
            <FeatureItem
              icon={<Search className="h-5 w-5 text-primary" />}
              title="高效搜索"
              description="快速查找文档中的关键信息"
            />
            <FeatureItem
              icon={<MessageCircle className="h-5 w-5 text-primary" />}
              title="知识问答"
              description="提出问题，系统自动匹配最佳答案"
            />
            <FeatureItem
              icon={<Shield className="h-5 w-5 text-primary" />}
              title="安全加密"
              description="企业级安全防护，数据全程加密"
            />
          </div>
        </div>

        {/* 登录注册表单 */}
        <div
          className="w-[520px] px-12 py-10 absolute top-1/2 z-10 right-14 -translate-y-1/2"
          style={{
            backgroundColor: 'var(--color-surface-1)',
            borderRadius: '24px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }}
        >
          {tab === 'register' && (
            <button
              type="button"
              onClick={() => switchTab('login')}
              className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              返回登录
            </button>
          )}

          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-text-primary">
              {tab === 'login' ? '欢迎回来' : '创建账户'}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {tab === 'login' ? '登录您的 GoferBot 账户' : '注册一个新的 GoferBot 账户'}
            </p>
          </div>

          {tab === 'login' ? <LoginForm /> : <RegisterForm />}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-subtle"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface-1 px-4 text-xs text-text-tertiary">
                或使用以下方式登录
              </span>
            </div>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border-default bg-white py-3.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-2"
            style={{ height: '56px' }}
          >
            <GoogleIcon />
            使用 Google 账号登录
          </button>

          {tab === 'login' && (
            <p className="mt-8 text-center text-sm text-text-secondary">
              还没有账号？{' '}
              <button
                type="button"
                onClick={() => switchTab('register')}
                className="font-medium text-primary hover:underline"
              >
                立即注册
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/60">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-text-primary">{title}</h3>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <title>Google</title>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
