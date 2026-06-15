import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useChatStore } from '@/features/chat/store'
import { ChatTempHome } from '@/features/chat/components/ChatTempHome'

vi.mock('@ant-design/x', () => ({
  XProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/features/chat/services', () => ({
  submitTempChat: vi.fn(),
  fetchProviders: vi.fn(),
}))

vi.mock('alova/client', () => ({
  useRequest: vi.fn(),
}))

import { submitTempChat } from '@/features/chat/services'
import { useRequest } from 'alova/client'

describe('ChatTempHome', () => {
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useChatStore.setState({
      activeSession: null,
      messages: [],
      isLoadingHistory: false,
      isStreaming: false,
      streamingContent: '',
      sessions: [],
      isLoadingSessions: false,
      error: null,
      availableProviders: [],
      selectedProviderKey: null,
      isInitLoading: false,
      initError: null,
      sessionCache: new Map(),
    })
    vi.mocked(useRequest).mockReturnValue({
      data: [
        { id: 'kb1', name: '知识库 A', fileCount: 2 },
        { id: 'kb2', name: '知识库 B', fileCount: 5 },
      ],
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)
  })

  it('renders the home page with input and action buttons', () => {
    render(<ChatTempHome onNavigateToSession={mockNavigate} />)

    expect(screen.getByText('今天想从知识库里理解什么？')).toBeDefined()
    expect(screen.getByPlaceholderText('询问、总结或让 AI 帮你整理桌面资料...')).toBeDefined()
    expect(screen.getByTestId('kb-selector-trigger')).toBeDefined()
    expect(screen.getByTestId('provider-selector-trigger')).toBeDefined()
    expect(screen.getByTestId('temp-send-btn')).toBeDefined()
  })

  it('disables send button when input is empty', () => {
    render(<ChatTempHome onNavigateToSession={mockNavigate} />)

    const sendBtn = screen.getByTestId('temp-send-btn') as HTMLButtonElement
    expect(sendBtn.disabled).toBe(true)
  })

  it('submits chat and navigates when clicking send button', async () => {
    vi.mocked(submitTempChat).mockResolvedValue('s1')
    const user = userEvent.setup()

    render(<ChatTempHome onNavigateToSession={mockNavigate} />)

    const input = screen.getByPlaceholderText('询问、总结或让 AI 帮你整理桌面资料...')
    await user.type(input, 'hello world')

    const sendBtn = screen.getByTestId('temp-send-btn')
    await user.click(sendBtn)

    expect(submitTempChat).toHaveBeenCalledWith('hello world', { knowledgeBaseIds: [] })
    expect(mockNavigate).toHaveBeenCalledWith('s1')
  })

  it('submits chat on Enter key without shift', async () => {
    vi.mocked(submitTempChat).mockResolvedValue('s2')
    const user = userEvent.setup()

    render(<ChatTempHome onNavigateToSession={mockNavigate} />)

    const input = screen.getByPlaceholderText('询问、总结或让 AI 帮你整理桌面资料...')
    await user.type(input, 'enter submit')
    await user.keyboard('{Enter}')

    expect(submitTempChat).toHaveBeenCalledWith('enter submit', { knowledgeBaseIds: [] })
    expect(mockNavigate).toHaveBeenCalledWith('s2')
  })

  it('does not submit on shift+enter', async () => {
    vi.mocked(submitTempChat).mockResolvedValue('s3')
    const user = userEvent.setup()

    render(<ChatTempHome onNavigateToSession={mockNavigate} />)

    const input = screen.getByPlaceholderText('询问、总结或让 AI 帮你整理桌面资料...')
    await user.type(input, 'shift enter')
    await user.keyboard('{Shift>}{Enter}{/Shift}')

    expect(submitTempChat).not.toHaveBeenCalled()
  })

  it('carries selected knowledge base ids on submit', async () => {
    vi.mocked(submitTempChat).mockResolvedValue('s4')
    const user = userEvent.setup()

    render(<ChatTempHome onNavigateToSession={mockNavigate} />)

    await user.click(screen.getByTestId('kb-selector-trigger'))
    const items = screen.getAllByTestId('kb-selector-item')
    await user.click(items[0])

    const input = screen.getByPlaceholderText('询问、总结或让 AI 帮你整理桌面资料...')
    await user.type(input, 'with kb')

    await user.click(screen.getByTestId('temp-send-btn'))

    expect(submitTempChat).toHaveBeenCalledWith('with kb', { knowledgeBaseIds: ['kb1'] })
    expect(mockNavigate).toHaveBeenCalledWith('s4')
  })

  it('does not navigate when session creation fails', async () => {
    vi.mocked(submitTempChat).mockResolvedValue(null)
    const user = userEvent.setup()

    render(<ChatTempHome onNavigateToSession={mockNavigate} />)

    const input = screen.getByPlaceholderText('询问、总结或让 AI 帮你整理桌面资料...')
    await user.type(input, 'fail')
    await user.click(screen.getByTestId('temp-send-btn'))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('disables controls while submitting', async () => {
    vi.mocked(submitTempChat).mockImplementation(async () => 's5')
    const user = userEvent.setup()

    render(<ChatTempHome onNavigateToSession={mockNavigate} />)

    const input = screen.getByPlaceholderText('询问、总结或让 AI 帮你整理桌面资料...')
    await user.type(input, 'loading')

    const sendBtn = screen.getByTestId('temp-send-btn') as HTMLButtonElement
    await user.click(sendBtn)

    expect(submitTempChat).toHaveBeenCalled()
  })

  it('shows init error banner with retry', async () => {
    useChatStore.setState({ initError: 'model init failed' })
    const user = userEvent.setup()

    render(<ChatTempHome onNavigateToSession={mockNavigate} />)

    expect(screen.getByText('模型列表加载失败：model init failed')).toBeDefined()
    await user.click(screen.getByText('重试'))
  })

  it('triggers submit from quick action', async () => {
    vi.mocked(submitTempChat).mockResolvedValue('s6')
    const user = userEvent.setup()

    render(<ChatTempHome onNavigateToSession={mockNavigate} />)

    await user.click(screen.getByText('总结文档'))

    expect(submitTempChat).toHaveBeenCalledWith(
      '请帮我总结这份文档的重点内容和行动项',
      { knowledgeBaseIds: [] },
    )
    expect(mockNavigate).toHaveBeenCalledWith('s6')
  })
})
