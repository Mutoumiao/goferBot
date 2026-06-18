import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/features/auth/services', () => ({
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  getRememberedEmail: vi.fn(() => null),
}))

import { AuthContainer } from '@/features/auth/components/AuthContainer'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { getRememberedEmail, loginUser, registerUser } from '@/features/auth/services'
import { useAuthPageStore } from '@/features/auth/store'
import { useAuthStore } from '@/stores/auth'

/** 设置受控 input 的值并触发 React onChange */
function setInputValue(element: HTMLElement, value: string) {
  const input = element as HTMLInputElement
  fireEvent.change(input, { target: { value } })
}

describe('auth components', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isInitialized: false })
    useAuthPageStore.setState({ tab: 'login', rememberEmail: null })
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(getRememberedEmail).mockReturnValue(null)
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

    it('fills remembered email on mount', () => {
      vi.mocked(getRememberedEmail).mockReturnValue('remembered@example.com')
      render(<LoginForm />)
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址') as HTMLInputElement
      expect(emailInput.value).toBe('remembered@example.com')
    })

    it('shows email validation error for invalid email', async () => {
      render(<LoginForm />)
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'invalid')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'password')

      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('请输入有效的邮箱地址')).toBeDefined()
      })
      expect(loginUser).not.toHaveBeenCalled()
    })

    it('shows password validation error for short password', async () => {
      render(<LoginForm />)
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), '123')
      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('密码长度不能少于 6 位')).toBeDefined()
      })
      expect(loginUser).not.toHaveBeenCalled()
    })

    it('submits login with credentials', async () => {
      vi.mocked(loginUser).mockResolvedValue({ success: true })

      render(<LoginForm />)
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'password')

      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(loginUser).toHaveBeenCalledWith('user@example.com', 'password', false)
      })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/', replace: true })
    })

    it('shows error message on failure', async () => {
      vi.mocked(loginUser).mockResolvedValue({ success: false, error: 'invalid credentials' })

      render(<LoginForm />)
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'password')
      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('invalid credentials')).toBeDefined()
      })
    })

    it('disables submit button while loading', async () => {
      vi.mocked(loginUser).mockImplementation(() => new Promise(() => {}))

      render(<LoginForm />)
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'password')
      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '登录中...' })).toBeDefined()
      })
      expect(
        (screen.getByRole('button', { name: '登录中...' }) as HTMLButtonElement).disabled,
      ).toBe(true)
    })

    it('clears email error when user starts typing', async () => {
      render(<LoginForm />)
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'invalid')
      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('请输入有效的邮箱地址')).toBeDefined()
      })

      setInputValue(emailInput, 'invalid-changed')
      expect(screen.queryByText('请输入有效的邮箱地址')).toBeNull()
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

    it('shows name validation error for empty name', async () => {
      render(<RegisterForm />)
      const emailInput = screen.getByPlaceholderText('you@example.com')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'password123')
      setInputValue(screen.getByPlaceholderText('请再次输入密码'), 'password123')

      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('请输入用户名')).toBeDefined()
      })
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('shows email validation error for invalid email', async () => {
      render(<RegisterForm />)
      const emailInput = screen.getByPlaceholderText('you@example.com')
      setInputValue(screen.getByPlaceholderText('你的名字'), 'User')
      setInputValue(emailInput, 'invalid')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'password123')
      setInputValue(screen.getByPlaceholderText('请再次输入密码'), 'password123')

      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('请输入有效的邮箱地址')).toBeDefined()
      })
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('shows password validation error for weak password', async () => {
      render(<RegisterForm />)
      const emailInput = screen.getByPlaceholderText('you@example.com')
      setInputValue(screen.getByPlaceholderText('你的名字'), 'User')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'weak')
      setInputValue(screen.getByPlaceholderText('请再次输入密码'), 'weak')
      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('密码长度不能少于 6 位')).toBeDefined()
      })
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('shows confirm password validation error for mismatch', async () => {
      render(<RegisterForm />)
      const emailInput = screen.getByPlaceholderText('you@example.com')
      setInputValue(screen.getByPlaceholderText('你的名字'), 'User')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'password123')
      setInputValue(screen.getByPlaceholderText('请再次输入密码'), 'different')
      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('两次输入的密码不一致')).toBeDefined()
      })
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('submits registration with credentials', async () => {
      vi.mocked(registerUser).mockResolvedValue({ success: true })

      render(<RegisterForm />)
      const emailInput = screen.getByPlaceholderText('you@example.com')
      setInputValue(screen.getByPlaceholderText('你的名字'), 'User')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'password123')
      setInputValue(screen.getByPlaceholderText('请再次输入密码'), 'password123')
      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(registerUser).toHaveBeenCalledWith('User', 'user@example.com', 'password123')
      })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/', replace: true })
    })

    it('toggles confirm password visibility', () => {
      render(<RegisterForm />)
      const confirmInput = screen.getByPlaceholderText('请再次输入密码') as HTMLInputElement
      // Find the toggle button next to confirm password input
      const confirmWrapper = confirmInput.closest('div')!
      const confirmToggle = confirmWrapper.querySelector('button')!

      expect(confirmInput.type).toBe('password')
      fireEvent.click(confirmToggle)
      expect(confirmInput.type).toBe('text')
    })

    it('shows password validation error for password without number', async () => {
      render(<RegisterForm />)
      const emailInput = screen.getByPlaceholderText('you@example.com')
      setInputValue(screen.getByPlaceholderText('你的名字'), 'User')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'password')
      setInputValue(screen.getByPlaceholderText('请再次输入密码'), 'password')
      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('密码需同时包含字母和数字')).toBeDefined()
      })
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('clears password error when user starts typing', async () => {
      render(<RegisterForm />)
      const emailInput = screen.getByPlaceholderText('you@example.com')
      setInputValue(screen.getByPlaceholderText('你的名字'), 'User')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'weak')
      setInputValue(screen.getByPlaceholderText('请再次输入密码'), 'weak')
      fireEvent.submit((emailInput as HTMLInputElement).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('密码长度不能少于 6 位')).toBeDefined()
      })

      const passwordInput = screen.getByPlaceholderText('请输入密码')
      setInputValue(passwordInput, 'weak-changed')
      expect(screen.queryByText('密码长度不能少于 6 位')).toBeNull()
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
