import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff } from 'lucide-react'
import { registerUser } from '../services'

export function RegisterForm() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await registerUser(name, email, password)
    setLoading(false)
    if (result.success) {
      navigate({ to: '/app' })
    } else {
      setError(result.error ?? '注册失败')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-text-primary">用户名</label>
        <Input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="你的名字"
          required
          className="h-14 rounded-xl border-border-default text-sm"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-text-primary">邮箱</label>
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
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

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Button type="submit" disabled={loading} className="h-14 w-full rounded-xl text-[15px]">
        {loading ? '注册中...' : '注册'}
      </Button>
    </form>
  )
}
