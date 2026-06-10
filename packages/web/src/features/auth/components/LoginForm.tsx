import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { loginUser, getRememberedEmail } from '../services'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    const remembered = getRememberedEmail()
    if (remembered) {
      setEmail(remembered)
      setRememberMe(true)
    }
  }, [])

  const validate = (): boolean => {
    let valid = true
    setEmailError(null)
    setPasswordError(null)

    if (!email.trim()) {
      setEmailError('请输入邮箱地址')
      valid = false
    } else if (!EMAIL_REGEX.test(email)) {
      setEmailError('请输入有效的邮箱地址')
      valid = false
    }

    if (!password) {
      setPasswordError('请输入密码')
      valid = false
    } else if (password.length < 6) {
      setPasswordError('密码长度不能少于 6 位')
      valid = false
    }

    return valid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validate()) return

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
          onChange={e => {
            setEmail(e.target.value)
            if (emailError) setEmailError(null)
          }}
          placeholder="请输入邮箱地址"
          required
          className="h-14 rounded-xl border-border-default text-sm"
        />
        {emailError && <p className="mt-1.5 text-xs text-destructive">{emailError}</p>}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-text-primary">密码</label>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => {
              setPassword(e.target.value)
              if (passwordError) setPasswordError(null)
            }}
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
        {passwordError && <p className="mt-1.5 text-xs text-destructive">{passwordError}</p>}
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
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            登录中...
          </>
        ) : (
          '登录'
        )}
      </Button>
    </form>
  )
}
