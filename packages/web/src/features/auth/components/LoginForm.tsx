import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Eye, EyeOff } from 'lucide-react'
import { loginUser } from '../services'

export function LoginForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await loginUser(email, password, rememberMe)
    setLoading(false)
    if (result.success) {
      navigate({ to: '/app' })
    } else {
      setError(result.error ?? '登录失败')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-text-primary">邮箱</label>
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="请输入邮箱地址"
          required
          className="h-14 rounded-xl border-border-default text-sm"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-text-primary">密码</label>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="请输入密码"
            required
            className="h-14 rounded-xl border-border-default pr-12 text-sm"
          />
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2">
          <Checkbox checked={rememberMe} onCheckedChange={checked => setRememberMe(checked === true)} />
          <span className="text-sm text-text-secondary">记住我</span>
        </label>
        <a href="#" className="text-sm font-medium text-primary">
          忘记密码？
        </a>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Button type="submit" disabled={loading} className="h-14 w-full rounded-xl text-[15px]">
        {loading ? '登录中...' : '登录'}
      </Button>
    </form>
  )
}
