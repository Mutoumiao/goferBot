import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { registerUser } from '../services'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RegisterForm() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)

  const validate = (): boolean => {
    let valid = true
    setNameError(null)
    setEmailError(null)
    setPasswordError(null)
    setConfirmPasswordError(null)

    if (!name.trim()) {
      setNameError('请输入用户名')
      valid = false
    }

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
    } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      setPasswordError('密码需同时包含字母和数字')
      valid = false
    }

    if (!confirmPassword) {
      setConfirmPasswordError('请再次输入密码')
      valid = false
    } else if (confirmPassword !== password) {
      setConfirmPasswordError('两次输入的密码不一致')
      valid = false
    }

    return valid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validate()) return

    setLoading(true)
    const result = await registerUser(name, email, password)
    setLoading(false)
    if (result.success) {
      navigate({ to: '/app/chat' })
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
          onChange={e => {
            setName(e.target.value)
            if (nameError) setNameError(null)
          }}
          placeholder="你的名字"
          required
          className="h-14 rounded-xl border-border-default text-sm"
        />
        {nameError && <p className="mt-1.5 text-xs text-destructive">{nameError}</p>}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-text-primary">邮箱</label>
        <Input
          type="email"
          value={email}
          onChange={e => {
            setEmail(e.target.value)
            if (emailError) setEmailError(null)
          }}
          placeholder="you@example.com"
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

      <div>
        <label className="mb-2 block text-sm font-medium text-text-primary">确认密码</label>
        <div className="relative">
          <Input
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={e => {
              setConfirmPassword(e.target.value)
              if (confirmPasswordError) setConfirmPasswordError(null)
            }}
            placeholder="请再次输入密码"
            required
            className="h-14 rounded-xl border-border-default pr-12 text-sm"
          />
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {confirmPasswordError && <p className="mt-1.5 text-xs text-destructive">{confirmPasswordError}</p>}
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Button type="submit" disabled={loading} className="h-14 w-full rounded-xl text-[15px]">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            注册中...
          </>
        ) : (
          '注册'
        )}
      </Button>
    </form>
  )
}
