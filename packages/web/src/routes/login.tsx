import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRequest } from 'alova/client'
import { login } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const { send, loading, error } = useRequest(
    () => login({ email, password }),
    { immediate: false },
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    try {
      const res = await send()
      const token = res.accessToken
      const user = res.user
      if (token && user) {
        localStorage.setItem('goferbot_access_token', token)
        if (rememberMe) {
          localStorage.setItem('goferbot_remember_email', email)
        }
        setAuth(token, user)
        navigate({ to: '/app' })
      }
    } catch {
      // error handled by useRequest
    }
  }

  return (
    /* 全屏背景容器 - 插画用背景图方式填充 */
    <div
      className="relative min-h-screen"
      style={{
        backgroundColor: '#e8ebfb',
        backgroundImage: 'url(/images/login-center-bg.png)',
        backgroundSize: '700px auto',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* 左侧内容层 - Logo + 标题 + 功能点 + 版权 */}
      <div className="relative z-10 flex min-h-screen flex-col px-20 py-10">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: '#4f46e5' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="text-lg font-semibold" style={{ color: '#1a1a2e' }}>
            GoferBot
          </span>
        </div>

        {/* 标题 + 功能点 */}
        <div className="max-w-md pt-16">
          <h1 className="text-4xl font-bold" style={{ color: '#1a1a2e' }}>
            智能知识管理
          </h1>
          <p className="mt-4 text-lg" style={{ color: '#6c757d' }}>
            让每一次对话都触手可及
          </p>

          {/* 功能卖点列表 */}
          <div className="mt-12 space-y-8">
            {/* 高效搜索 */}
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: '#1a1a2e' }}>
                  高效搜索
                </h3>
                <p className="mt-1 text-sm" style={{ color: '#6c757d' }}>
                  快速查找文档中的关键信息
                </p>
              </div>
            </div>

            {/* 知识问答 */}
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: '#1a1a2e' }}>
                  知识问答
                </h3>
                <p className="mt-1 text-sm" style={{ color: '#6c757d' }}>
                  提出问题，系统自动匹配最佳答案
                </p>
              </div>
            </div>

            {/* 安全加密 */}
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: '#1a1a2e' }}>
                  安全加密
                </h3>
                <p className="mt-1 text-sm" style={{ color: '#6c757d' }}>
                  企业级安全防护，数据全程加密
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 底部版权 */}
        <div className="mt-auto text-sm" style={{ color: '#8b8fa3' }}>
          © 2025 GoferBot. All rights reserved.
        </div>
      </div>

      {/* 登录框 - 直接 fixed 定位到右侧 */}
      <div
        className="fixed inset-y-0 right-0 flex items-center px-8"
        style={{ width: '38%', minWidth: '520px' }}
      >
        <div
          className="mx-auto w-full px-12 py-10"
          style={{
            maxWidth: '520px',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }}
        >
          {/* 标题 */}
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold" style={{ color: '#1a1a2e' }}>
              欢迎回来
            </h2>
            <p className="mt-2 text-sm" style={{ color: '#6c757d' }}>
              登录您的 GoferBot 账户
            </p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 邮箱 */}
            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: '#1a1a2e' }}>
                邮箱
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱地址"
                required
                className="h-14 rounded-xl border-gray-200 text-sm"
                style={{ borderRadius: '12px', height: '56px' }}
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: '#1a1a2e' }}>
                密码
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  required
                  className="h-14 rounded-xl border-gray-200 pr-12 text-sm"
                  style={{ borderRadius: '12px', height: '56px' }}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ color: '#6c757d' }}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 记住我 & 忘记密码 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <span className="text-sm" style={{ color: '#6c757d' }}>
                  记住我
                </span>
              </label>
              <a href="#" className="text-sm font-medium" style={{ color: '#4f46e5' }}>
                忘记密码？
              </a>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
                {error.message || '登录失败，请检查邮箱和密码'}
              </div>
            )}

            {/* 登录按钮 */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              style={{
                height: '56px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                fontSize: '15px',
              }}
            >
              {loading ? '登录中...' : '登录'}
            </Button>

            {/* 注册按钮 */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              style={{
                height: '56px',
                borderRadius: '12px',
                borderColor: '#dee2e6',
                color: '#1a1a2e',
                fontSize: '15px',
              }}
            >
              注册
            </Button>
          </form>

          {/* 分隔线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: '#e9ecef' }}></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-xs" style={{ color: '#adb5bd' }}>
                或使用以下方式登录
              </span>
            </div>
          </div>

          {/* Google 登录 */}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 border bg-white py-3.5 text-sm font-medium transition-colors hover:bg-gray-50"
            style={{
              height: '56px',
              borderRadius: '12px',
              borderColor: '#dee2e6',
              color: '#1a1a2e',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            使用 Google 账号登录
          </button>

          {/* 底部链接 */}
          <p className="mt-8 text-center text-sm" style={{ color: '#6c757d' }}>
            还没有账号？{' '}
            <a href="#" className="font-medium" style={{ color: '#4f46e5' }}>
              立即注册
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
