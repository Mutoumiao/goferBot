import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRequest } from 'alova/client'
import { register } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { send, loading, error } = useRequest(
    () => register({ email, password, name }),
    { immediate: false },
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !name) return
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
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">注册 GoferBot</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text-secondary">
                用户名
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="你的名字"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
                邮箱
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
                密码
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-error">
                {error.message || '注册失败，请重试'}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '注册中...' : '注册'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-text-secondary">
            已有账号？{' '}
            <a href="/login" className="text-brand-primary hover:underline">
              登录
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
