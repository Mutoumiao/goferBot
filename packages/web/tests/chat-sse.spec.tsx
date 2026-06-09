import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { Mock } from 'vitest'

// Store mock callbacks for triggering from tests
let capturedOnError: ((event: { error: Error }) => void) | null = null
const mockSseSend = vi.fn()
const mockSseClose = vi.fn()

// Mock alova/client
vi.mock('alova/client', () => ({
  useSSE: vi.fn(() => ({
    send: mockSseSend,
    close: mockSseClose,
    onMessage: () => ({ onError: vi.fn(), onOpen: vi.fn() }),
    onError: (cb: (event: { error: Error }) => void) => {
      capturedOnError = cb
      return { onMessage: vi.fn(), onOpen: vi.fn() }
    },
    onOpen: vi.fn().mockReturnThis(),
  })),
  useRequest: vi.fn(() => ({
    send: vi.fn(() => Promise.resolve({ data: { messages: [] } })),
  })),
}))

// Mock @/api/chat — 提供所有 chatStore 依赖的 API 函数
vi.mock('@/api/chat', () => ({
  streamChat: vi.fn(() => ({ __type: 'method' })),
  getHistory: vi.fn(() => ({ __type: 'method' })),
  getSessions: vi.fn(() => ({ __type: 'method' })),
  createSession: vi.fn(() => ({ __type: 'method' })),
  deleteSession: vi.fn(() => ({ __type: 'method' })),
  renameSession: vi.fn(() => ({ __type: 'method' })),
}))

import { useSSE } from 'alova/client'
import { ChatViewPage } from '@/routes/app/chat'
import { useChatStore } from '@/stores/chat'

describe('ChatViewPage SSE streaming', () => {
  beforeEach(() => {
    useChatStore.setState({
      activeSession: null,
      messages: [],
      isStreaming: false,
      streamingContent: '',
      sessions: [],
      isLoadingHistory: false,
      isLoadingSessions: false,
      error: null,
    })
    vi.clearAllMocks()
    capturedOnError = null
  })

  it('AC-03: streaming 时 ChatInput 禁用并显示停止按钮', () => {
    useChatStore.setState({ isStreaming: true })

    render(<ChatViewPage />)

    const textarea = screen.getByPlaceholderText(/输入/) as HTMLTextAreaElement
    expect(textarea.disabled).toBe(true)
    expect(screen.getByRole('button', { name: /停止/i })).toBeDefined()
  })

  it('AC-04: 流式 chunk 追加到消息列表', () => {
    useChatStore.setState({
      isStreaming: true,
      streamingContent: '你好，这是流式回复',
    })

    render(<ChatViewPage />)

    expect(screen.getByText('你好，这是流式回复')).toBeDefined()
  })

  it('AC-05: 首 chunk 到达前显示三点跳动 loading', () => {
    useChatStore.setState({ isStreaming: true, streamingContent: '' })

    render(<ChatViewPage />)

    const dots = document.querySelectorAll('.animate-bounce')
    expect(dots.length).toBe(3)
  })

  it('AC-06: done 信号触发 flushStreamContent 生成完整 assistant 消息', () => {
    useChatStore.setState({
      isStreaming: true,
      streamingContent: '完整 AI 回复内容',
      messages: [],
    })

    useChatStore.getState().flushStreamContent()

    const state = useChatStore.getState()
    expect(state.streamingContent).toBe('')
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].role).toBe('assistant')
    expect(state.messages[0].content).toBe('完整 AI 回复内容')
  })

  it('AC-07: SSE 连接失败时显示 ErrorCard + 重试按钮', async () => {
    render(<ChatViewPage />)

    // 模拟 onError 触发（无需先设置消息，ErrorCard 独立渲染）
    await act(async () => {
      capturedOnError?.({ error: new Error('网络连接失败，请检查网络后重试') })
    })

    expect(screen.getByText(/网络连接失败/)).toBeDefined()
    // ErrorCard 中的重试按钮使用 shadcn Button variant="destructive"
    const retryBtn = document.querySelector('[data-testid="error-retry-btn"]') as HTMLElement
    expect(retryBtn?.textContent).toContain('重试')
  })

  it('AC-08: 点击重试按钮后清除错误并重新发送', async () => {
    // Mock createSession 以支持 handleSend 中的自动创建 session
    const { createSession: mockCreateSession } = await import('@/api/chat')
    const mockApiCreateSession = mockCreateSession as Mock
    mockApiCreateSession.mockReturnValue({
      send: vi.fn(() =>
        Promise.resolve({
          id: 'new-session-id',
          title: '新对话',
          provider: 'openai',
          model: 'gpt-4',
          messageCount: 0,
          createdAt: '',
          updatedAt: '',
        }),
      ),
    })

    render(<ChatViewPage />)

    // 在 ChatInput 输入消息并点击发送
    const textarea = screen.getByPlaceholderText(/输入/)
    fireEvent.change(textarea, { target: { value: '测试重试消息' } })
    fireEvent.click(screen.getByRole('button', { name: /发送/i }))

    // 等待 createSession 完成
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    // 触发 onError
    await act(async () => {
      capturedOnError?.({ error: new Error('服务器内部错误') })
    })

    expect(screen.getByText(/服务器内部错误/)).toBeDefined()

    // 点击重试
    const retryBtn = screen.getByRole('button', { name: /重试/i })
    await act(async () => {
      fireEvent.click(retryBtn)
    })

    // 重试后错误应该被清除
    expect(screen.queryByText(/服务器内部错误/)).toBeNull()
  })

  it('AC-09: 停止按钮中断 SSE 并保留部分内容', () => {
    useChatStore.setState({
      isStreaming: true,
      streamingContent: '部分回复内容',
      messages: [],
    })

    render(<ChatViewPage />)

    fireEvent.click(screen.getByRole('button', { name: /停止/i }))

    expect(mockSseClose).toHaveBeenCalled()

    const state = useChatStore.getState()
    expect(state.streamingContent).toBe('')
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].role).toBe('assistant')
    expect(state.messages[0].content).toBe('部分回复内容')
  })

  it('AC-10: useSSE 配置了 reconnectionTime: 3000', () => {
    render(<ChatViewPage />)

    const useSSEMock = useSSE as Mock
    const calls = useSSEMock.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const configArg = calls[calls.length - 1]?.[1]
    expect(configArg).toMatchObject({ reconnectionTime: 3000 })
  })
})

describe('ChatViewPage idle/empty state', () => {
  beforeEach(() => {
    useChatStore.setState({
      activeSession: null,
      messages: [],
      isStreaming: false,
      streamingContent: '',
      sessions: [],
      isLoadingHistory: false,
      isLoadingSessions: false,
      error: null,
    })
    vi.clearAllMocks()
    capturedOnError = null
  })

  it('AC-01: 无活跃 session 时显示空态引导', () => {
    render(<ChatViewPage />)

    expect(screen.getByText('开始新对话')).toBeDefined()
    expect(screen.getByText(/在下方输入消息/)).toBeDefined()
  })

  it('AC-02: 有活跃 session 时显示会话标题', () => {
    useChatStore.setState({
      activeSession: {
        id: 's1',
        title: '测试会话',
        provider: 'openai',
        model: 'gpt-4',
        messageCount: 0,
        createdAt: '',
        updatedAt: '',
      } as never,
    })

    render(<ChatViewPage />)

    expect(screen.getByText('测试会话')).toBeDefined()
  })
})
