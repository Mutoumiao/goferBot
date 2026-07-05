import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

// Mock Captcha 组件，避免 canvas 渲染问题
// ponytail: 关键修复 —— 原实现直接在 render 中调用 onChallengeChange，会在 happy-dom 下触发
// "Cannot read properties of null (reading 'insertBefore')" 之类的崩溃导致 worker 挂起。
// 改为模块级 ref 显式触发 + act() 包裹，让父组件的 setState 在 commit 之后执行。
let captchaRef: {
  onVerify: (valid: boolean) => void
  onChallengeChange?: (c: { captchaId: string; imageBase64: string } | null) => void
  onInput?: (value: string) => void
} | null = null

vi.mock('@/components/ui/captcha', () => ({
  Captcha: ({
    onVerify,
    onChallengeChange,
    onInput,
  }: {
    onVerify: (valid: boolean) => void
    onChallengeChange?: (c: { captchaId: string; imageBase64: string } | null) => void
    onInput?: (value: string) => void
  }) => {
    captchaRef = { onVerify, onChallengeChange, onInput }
    return (
      <div data-testid="captcha">
        <input
          data-testid="captcha-input"
          placeholder="验证码"
          onChange={(e) => {
            const v = e.target.value
            onInput?.(v)
            onVerify(v.length === 4)
          }}
        />
      </div>
    )
  },
}))

/** 触发 captcha challenge 下发（在 act() 中包裹，避免 setState-during-render 警告） */
function primeCaptcha() {
  act(() => {
    captchaRef?.onChallengeChange?.({ captchaId: 'cid-1', imageBase64: 'AAAA' })
  })
}

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

/** 从元素获取最近的 form 元素，若不存在则抛出错误 */
function getForm(element: HTMLElement): HTMLFormElement {
  const form = element.closest('form')
  if (!form) throw new Error('Element is not inside a form')
  return form
}

describe('auth components', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isInitialized: false })
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
      // 找到密码可见性切换按钮（tabIndex=-1），Eye 图标
      const container = passwordInput.parentElement!
      const toggle = container.querySelector('button[tabindex="-1"]')!
      expect(toggle).toBeDefined()

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

      fireEvent.submit(getForm(emailInput as HTMLInputElement))

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
      fireEvent.submit(getForm(emailInput as HTMLInputElement))

      await waitFor(() => {
        expect(screen.getByText('密码长度至少 8 位')).toBeDefined()
      })
      expect(loginUser).not.toHaveBeenCalled()
    })

    it('shows password validation error for missing digit', async () => {
      render(<LoginForm />)
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'Abcdefgh')
      fireEvent.submit(getForm(emailInput as HTMLInputElement))

      await waitFor(() => {
        expect(screen.getByText('密码必须包含数字')).toBeDefined()
      })
      expect(loginUser).not.toHaveBeenCalled()
    })

    it('shows captcha validation error if not verified', async () => {
      render(<LoginForm />)
      // 不触发 primeCaptcha（captchaVerified 仍为 false）
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'Password1')
      // 不输入验证码直接提交，应提示验证码未完成
      fireEvent.submit(getForm(emailInput as HTMLInputElement))

      await waitFor(() => {
        expect(screen.getByText('请完成验证码验证')).toBeDefined()
      })
    })

    it('submits login with credentials and captcha', async () => {
      vi.mocked(loginUser).mockResolvedValue({ success: true })

      render(<LoginForm />)
      primeCaptcha()

      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'Password1')
      const captchaInput = screen.getByTestId('captcha-input')
      setInputValue(captchaInput, 'ABCD')

      // ponytail: 等待 React 19 提交所有 state 更新
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      fireEvent.submit(getForm(emailInput as HTMLInputElement))

      await waitFor(
        () => {
          expect(loginUser).toHaveBeenCalledWith('user@example.com', 'Password1', false, {
            captchaId: 'cid-1',
            captchaCode: 'ABCD',
          })
        },
        { timeout: 3000 },
      )
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/', replace: true })
    })

    it('shows error message on failure', async () => {
      vi.mocked(loginUser).mockResolvedValue({ success: false, error: 'invalid credentials' })

      render(<LoginForm />)
      primeCaptcha()
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'Password1')
      // 验证码
      const captchaInput = screen.getByTestId('captcha-input')
      setInputValue(captchaInput, 'ABCD')
      fireEvent.submit(getForm(emailInput as HTMLInputElement))

      await waitFor(() => {
        expect(screen.getByText('invalid credentials')).toBeDefined()
      })
    })

    it('disables submit button while loading', async () => {
      vi.mocked(loginUser).mockImplementation(() => new Promise(() => {}))

      render(<LoginForm />)
      primeCaptcha()
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'Password1')
      // 验证码
      const captchaInput = screen.getByTestId('captcha-input')
      setInputValue(captchaInput, 'ABCD')
      fireEvent.submit(getForm(emailInput as HTMLInputElement))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '登录中...' })).toBeDefined()
      })
      expect(
        (screen.getByRole('button', { name: '登录中...' }) as HTMLButtonElement).disabled,
      ).toBe(true)
    })

    it('shows instant validation on blur', async () => {
      render(<LoginForm />)
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'invalid')
      fireEvent.blur(emailInput)

      await waitFor(() => {
        expect(screen.getByText('请输入有效的邮箱地址')).toBeDefined()
      })
    })

    it('clears error when user starts typing', async () => {
      render(<LoginForm />)
      const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
      setInputValue(emailInput, 'invalid')
      fireEvent.submit(getForm(emailInput as HTMLInputElement))

      await waitFor(() => {
        expect(screen.getByText('请输入有效的邮箱地址')).toBeDefined()
      })

      setInputValue(emailInput, 'user@example.com')
      expect(screen.queryByText('请输入有效的邮箱地址')).toBeNull()
    })

    it('shows forgot password view when clicked', () => {
      render(<LoginForm />)
      fireEvent.click(screen.getByText('忘记密码？'))
      expect(screen.getByText('找回密码')).toBeDefined()
      expect(screen.getByPlaceholderText('请输入注册时使用的邮箱')).toBeDefined()
    })

    it('can navigate back from forgot password', () => {
      render(<LoginForm />)
      fireEvent.click(screen.getByText('忘记密码？'))
      fireEvent.click(screen.getByText('返回登录'))
      expect(screen.getByRole('button', { name: '登录' })).toBeDefined()
    })

    it('renders captcha component', () => {
      render(<LoginForm />)
      expect(screen.getByTestId('captcha')).toBeDefined()
    })

    it('shows remember me checkbox', () => {
      render(<LoginForm />)
      expect(screen.getByText('记住我')).toBeDefined()
    })
  })

  describe('RegisterForm', () => {
    it('renders name, email and password inputs', () => {
      render(<RegisterForm />)
      expect(screen.getByPlaceholderText('你的名字')).toBeDefined()
      expect(screen.getByPlaceholderText('you@example.com')).toBeDefined()
      expect(screen.getByPlaceholderText('请输入密码')).toBeDefined()
      expect(screen.getByRole('button', { name: '创建账户' })).toBeDefined()
    })

    it('shows name validation error for empty name', async () => {
      render(<RegisterForm />)
      const emailInput = screen.getByPlaceholderText('you@example.com')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'password123')
      setInputValue(screen.getByPlaceholderText('请再次输入密码'), 'password123')

      fireEvent.submit(getForm(emailInput as HTMLInputElement))

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

      fireEvent.submit(getForm(emailInput as HTMLInputElement))

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
      fireEvent.submit(getForm(emailInput as HTMLInputElement))

      await waitFor(() => {
        expect(screen.getByText('密码长度至少 8 位')).toBeDefined()
      })
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('shows confirm password validation error for mismatch', async () => {
      render(<RegisterForm />)
      const emailInput = screen.getByPlaceholderText('you@example.com')
      setInputValue(screen.getByPlaceholderText('你的名字'), 'User')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'Password1')
      setInputValue(screen.getByPlaceholderText('请再次输入密码'), 'Different1')
      fireEvent.submit(getForm(emailInput as HTMLInputElement))

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
      setInputValue(screen.getByPlaceholderText('请输入邀请码'), 'TEST-INVITE-CODE')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'Password1')
      setInputValue(screen.getByPlaceholderText('请再次输入密码'), 'Password1')
      fireEvent.submit(getForm(emailInput as HTMLInputElement))

      await waitFor(() => {
        expect(registerUser).toHaveBeenCalledWith(
          'User',
          'user@example.com',
          'Password1',
          'TEST-INVITE-CODE',
        )
      })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/', replace: true })
    })

    it('toggles confirm password visibility', () => {
      render(<RegisterForm />)
      const confirmInput = screen.getByPlaceholderText('请再次输入密码') as HTMLInputElement
      const confirmWrapper = confirmInput.closest('div')
      if (!confirmWrapper) throw new Error('confirmWrapper not found')
      const confirmToggle = confirmWrapper.querySelector('button')
      if (!confirmToggle) throw new Error('confirmToggle not found')

      expect(confirmInput.type).toBe('password')
      fireEvent.click(confirmToggle)
      expect(confirmInput.type).toBe('text')
    })

    it('shows password validation error for password without number', async () => {
      render(<RegisterForm />)
      const emailInput = screen.getByPlaceholderText('you@example.com')
      setInputValue(screen.getByPlaceholderText('你的名字'), 'User')
      setInputValue(emailInput, 'user@example.com')
      setInputValue(screen.getByPlaceholderText('请输入密码'), 'Abcdefgh')
      setInputValue(screen.getByPlaceholderText('请再次输入密码'), 'Abcdefgh')
      fireEvent.submit(getForm(emailInput as HTMLInputElement))

      await waitFor(() => {
        expect(screen.getByText('密码必须包含数字')).toBeDefined()
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
      fireEvent.submit(getForm(emailInput as HTMLInputElement))

      await waitFor(() => {
        expect(screen.getByText('密码长度至少 8 位')).toBeDefined()
      })

      const passwordInput = screen.getByPlaceholderText('请输入密码')
      setInputValue(passwordInput, 'Newpassword123')
      expect(screen.queryByText('密码长度至少 8 位')).toBeNull()
    })
  })

  describe('AuthContainer', () => {
    it('renders login form by default', () => {
      render(<AuthContainer />)
      expect(screen.getByRole('button', { name: '登录' })).toBeDefined()
    })

    it('switches to register form when register button clicked', () => {
      render(<AuthContainer />)
      // AuthContainer 在 lg 屏幕下有两个 "欢迎回来" / "创建账户"
      fireEvent.click(screen.getByText('立即注册'))
      expect(screen.getByText('返回登录')).toBeDefined()
    })

    it('switches back to login from register form', () => {
      render(<AuthContainer />)
      fireEvent.click(screen.getByText('立即注册'))
      fireEvent.click(screen.getByText('返回登录'))
      // 验证有登录按钮
      expect(screen.getByRole('button', { name: '登录' })).toBeDefined()
    })

    it('renders feature list on left side', () => {
      render(<AuthContainer />)
      expect(screen.getByText('高效搜索')).toBeDefined()
      expect(screen.getByText('知识问答')).toBeDefined()
      expect(screen.getByText('安全加密')).toBeDefined()
    })

    it('renders logo', () => {
      render(<AuthContainer />)
      const logos = screen.getAllByText('GoferBot')
      expect(logos.length).toBeGreaterThanOrEqual(1)
    })
  })
})
