import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/features/auth/services', () => ({
  loginUser: vi.fn(),
  registerUser: vi.fn(),
}))

import { loginUser, registerUser } from '@/features/auth/services'
import { useAuthStore } from '@/stores/auth'
import { AuthContainer } from '@/features/auth/components/AuthContainer'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { useAuthPageStore } from '@/features/auth/store'

describe('auth components', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false })
    useAuthPageStore.setState({ tab: 'login', rememberEmail: null })
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('LoginForm', () => {
    it('renders email and password inputs', () => {
      render(<LoginForm />)
      expect(screen.getByPlaceholderText('请输入邮箱地址')).toBeDefined()
      expect(screen.getByPlaceholderText('请输入密码')).toBeDefined()
      expect(screen.getByRole('button', { name: '登录' })).toBeDefined()
    })

    it('toggles password visibility', () => {
      render(<LoginForm />)
      const passwordInput = screen.getByPlaceholderText('请输入密码') as HTMLInputElement
      const toggle = screen.getAllByRole('button')[0]

      expect(passwordInput.type).toBe('password')
      fireEvent.click(toggle)
      expect(passwordInput.type).toBe('text')
    })

    it('submits login with credentials', async () => {
      vi.mocked(loginUser).mockResolvedValue({ success: true })

      render(<LoginForm />)
      fireEvent.change(screen.getByPlaceholderText('请输入邮箱地址'), { target: { value: 'user@example.com' } })
      fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'password' } })
      fireEvent.click(screen.getByRole('button', { name: '登录' }))

      await vi.waitFor(() => {
        expect(loginUser).toHaveBeenCalledWith('user@example.com', 'password', false)
      })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/app' })
    })

    it('shows error message on failure', async () => {
      vi.mocked(loginUser).mockResolvedValue({ success: false, error: 'invalid credentials' })

      render(<LoginForm />)
      fireEvent.change(screen.getByPlaceholderText('请输入邮箱地址'), { target: { value: 'user@example.com' } })
      fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'password' } })
      fireEvent.click(screen.getByRole('button', { name: '登录' }))

      await vi.waitFor(() => {
        expect(screen.getByText('invalid credentials')).toBeDefined()
      })
    })
  })

  describe('RegisterForm', () => {
    it('renders name, email and password inputs', () => {
      render(<RegisterForm />)
      expect(screen.getByPlaceholderText('你的名字')).toBeDefined()
      expect(screen.getByPlaceholderText('you@example.com')).toBeDefined()
      expect(screen.getByPlaceholderText('请输入密码')).toBeDefined()
      expect(screen.getByRole('button', { name: '注册' })).toBeDefined()
    })

    it('submits registration with credentials', async () => {
      vi.mocked(registerUser).mockResolvedValue({ success: true })

      render(<RegisterForm />)
      fireEvent.change(screen.getByPlaceholderText('你的名字'), { target: { value: 'User' } })
      fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'user@example.com' } })
      fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'password' } })
      fireEvent.click(screen.getByRole('button', { name: '注册' }))

      await vi.waitFor(() => {
        expect(registerUser).toHaveBeenCalledWith('User', 'user@example.com', 'password')
      })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/app' })
    })
  })

  describe('AuthContainer', () => {
    it('renders login form by default', () => {
      render(<AuthContainer />)
      expect(screen.getByText('欢迎回来')).toBeDefined()
      expect(screen.getByRole('button', { name: '登录' })).toBeDefined()
    })

    it('switches to register form when register button clicked', () => {
      render(<AuthContainer />)
      fireEvent.click(screen.getByRole('button', { name: '立即注册' }))
      expect(screen.getByText('创建账户')).toBeDefined()
      expect(screen.getByText('返回登录')).toBeDefined()
    })

    it('switches back to login from register form', () => {
      render(<AuthContainer />)
      fireEvent.click(screen.getByRole('button', { name: '立即注册' }))
      fireEvent.click(screen.getByText('返回登录'))
      expect(screen.getByText('欢迎回来')).toBeDefined()
    })

    it('renders feature list on left side', () => {
      render(<AuthContainer />)
      expect(screen.getByText('高效搜索')).toBeDefined()
      expect(screen.getByText('知识问答')).toBeDefined()
      expect(screen.getByText('安全加密')).toBeDefined()
    })
  })
})
