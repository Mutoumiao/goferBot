import { ArrowLeft, MessageCircle, Search, ShieldCheck, Sparkles } from 'lucide-react'
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
      className="relative min-h-screen flex overflow-hidden"
      style={{
        backgroundColor: 'var(--color-auth-bg)',
        color: 'var(--color-auth-text-primary)',
      }}
    >
      {/* 背景装饰 */}
      <div
        className="pointer-events-none fixed top-0 left-0 w-[700px] h-[700px] z-0"
        style={{
          background:
            'radial-gradient(circle at 40% 45%, rgba(80, 116, 250, 0.06) 0%, transparent 50%)',
        }}
      />
      <div
        className="pointer-events-none fixed bottom-0 right-0 w-[500px] h-[500px] z-0"
        style={{
          background:
            'radial-gradient(circle at 60% 60%, rgba(80, 116, 250, 0.04) 0%, transparent 55%)',
        }}
      />
      {/* 装饰几何线 — 左上 */}
      <svg
        className="pointer-events-none fixed top-0 left-0 z-0 opacity-[0.03]"
        width="400"
        height="400"
        viewBox="0 0 400 400"
        aria-hidden="true"
      >
        <title>decoration</title>
        <circle cx="200" cy="200" r="180" fill="none" stroke="#5074fa" strokeWidth="1" />
        <circle cx="200" cy="200" r="140" fill="none" stroke="#5074fa" strokeWidth="0.5" />
        <line x1="40" y1="200" x2="360" y2="200" stroke="#5074fa" strokeWidth="0.5" />
        <line x1="200" y1="40" x2="200" y2="360" stroke="#5074fa" strokeWidth="0.5" />
      </svg>

      {/* ============ 左侧：品牌 + 插画区域 ============ */}
      <div className="relative z-10 hidden lg:flex lg:w-[52%] xl:w-[54%] flex-col items-center justify-center px-12 xl:px-20">
        {/* Logo */}
        <div
          className="absolute top-10 left-12 xl:left-20 flex items-center gap-3 animate-fade-in"
          style={{ animationDelay: '0.1s' }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--color-auth-accent-soft)' }}
          >
            <Sparkles className="size-5" style={{ color: 'var(--color-auth-accent)' }} />
          </div>
          <span
            className="text-xl font-bold tracking-tight"
            style={{ color: 'var(--color-auth-text-primary)' }}
          >
            GoferBot
          </span>
        </div>

        {/* 插画区域 */}
        <div className="relative animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <div
            className="absolute inset-0 -inset-x-16 -inset-y-10 rounded-full blur-3xl"
            style={{
              background: 'var(--color-auth-glow)',
              opacity: 0.7,
            }}
          />
          <img
            src="/images/login-center-bg.png"
            alt="GoferBot 知识管理"
            className="relative w-full max-w-[520px] h-auto"
            style={{
              filter: 'drop-shadow(0 16px 48px rgba(80, 116, 250, 0.12))',
            }}
          />
        </div>

        {/* 底部功能亮点 */}
        <div
          className="mt-10 w-full max-w-[520px] flex gap-6 animate-fade-in-up"
          style={{ animationDelay: '0.45s' }}
        >
          <FeatureBadge icon={<Search className="size-4" />} label="高效搜索" />
          <FeatureBadge icon={<MessageCircle className="size-4" />} label="知识问答" />
          <FeatureBadge icon={<ShieldCheck className="size-4" />} label="安全加密" />
        </div>
      </div>

      {/* ============ 右侧：表单区域 ============ */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-8 sm:px-10 lg:px-0 lg:pr-14 xl:pr-24">
        <div
          className="w-full max-w-[420px] lg:max-w-[440px] animate-fade-in-up"
          style={{
            animationDelay: '0.35s',
            backgroundColor: 'var(--color-auth-card)',
            border: '1px solid var(--color-auth-card-border)',
            borderRadius: '28px',
            padding: 'clamp(2rem, 5vw, 3rem)',
            boxShadow:
              '0 4px 32px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
        >
          {/* 移动端 Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8 mt-1">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'var(--color-auth-accent-soft)' }}
            >
              <Sparkles className="size-4" style={{ color: 'var(--color-auth-accent)' }} />
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--color-auth-text-primary)' }}>
              GoferBot
            </span>
          </div>

          {/* 注册时返回按钮 */}
          {tab === 'register' && (
            <button
              type="button"
              onClick={() => switchTab('login')}
              className="mb-6 flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-70"
              style={{ color: 'var(--color-auth-text-secondary)' }}
            >
              <ArrowLeft className="size-4" />
              返回登录
            </button>
          )}

          {/* 标题 */}
          <div className="mb-8">
            <h1
              className="text-[28px] font-bold tracking-tight leading-tight"
              style={{ color: 'var(--color-auth-text-primary)' }}
            >
              {tab === 'login' ? '欢迎回来' : '创建账户'}
            </h1>
            <p
              className="mt-2 text-[15px] leading-relaxed"
              style={{ color: 'var(--color-auth-text-secondary)' }}
            >
              {tab === 'login'
                ? '登录您的 GoferBot 账户，继续智能知识管理之旅'
                : '注册 GoferBot，开启高效知识管理'}
            </p>
          </div>

          {/* 表单 */}
          {tab === 'login' ? <LoginForm /> : <RegisterForm />}

          {/* 底部切换链接 */}
          {tab === 'login' && (
            <p
              className="mt-8 text-center text-sm"
              style={{ color: 'var(--color-auth-text-secondary)' }}
            >
              还没有账号？{' '}
              <button
                type="button"
                onClick={() => switchTab('register')}
                className="font-semibold hover:underline transition-colors"
                style={{ color: 'var(--color-auth-accent)' }}
              >
                立即注册
              </button>
            </p>
          )}
        </div>
      </div>

      {/* 动画样式 */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out both;
        }
      `}</style>
    </div>
  )
}

function FeatureBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-sm"
      style={{
        backgroundColor: 'var(--color-auth-card)',
        border: '1px solid var(--color-auth-card-border)',
        color: 'var(--color-auth-text-secondary)',
      }}
    >
      <span style={{ color: 'var(--color-auth-accent)' }}>{icon}</span>
      {label}
    </div>
  )
}
