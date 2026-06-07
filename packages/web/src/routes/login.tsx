import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRequest } from 'alova/client'
import { login } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/utils/cn'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
        setAuth(token, user)
        navigate({ to: '/app' })
      }
    } catch {
      // error handled by useRequest
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2">
      <div className="w-full max-w-sm rounded-lg bg-surface-1 p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-text-primary">登录 GoferBot</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                'mt-1 block w-full rounded-md border px-3 py-2 text-sm',
                'border-border-default bg-surface-1 text-text-primary',
                'focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary',
              )}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                'mt-1 block w-full rounded-md border px-3 py-2 text-sm',
                'border-border-default bg-surface-1 text-text-primary',
                'focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary',
              )}
              placeholder="••••••"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-error">
              {error.message || '登录失败，请检查邮箱和密码'}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full rounded-md px-4 py-2 text-sm font-medium text-white',
              'bg-brand-primary hover:bg-brand-secondary',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          还没有账号？{' '}
          <a href="/register" className="text-brand-primary hover:underline">
            注册
          </a>
        </p>
      </div>
    </div>
  )
}
