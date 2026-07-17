import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatEmptyHome } from '@/features/chat/components/ChatEmptyHome'
import { useChatStore } from '@/features/chat/store'

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

import { useRequest } from 'alova/client'
import { submitTempChat } from '@/features/chat/services'

describe('ChatEmptyHome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useChatStore.setState({
      activeSession: null,
      selectedSessionId: null,
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
    render(<ChatEmptyHome />)

    expect(screen.getByTestId('chat-home-greeting')).toBeDefined()
    expect(screen.getByTestId('kb-selector-trigger')).toBeDefined()
    expect(screen.getByTestId('provider-selector-trigger')).toBeDefined()
    expect(screen.getByTestId('temp-send-btn')).toBeDefined()
    expect(screen.queryByTestId('quick-actions')).toBeNull()
  })

  it('disables send button when input is empty', () => {
    render(<ChatEmptyHome />)

    const sendBtn = screen.getByTestId('temp-send-btn') as HTMLButtonElement
    expect(sendBtn.disabled).toBe(true)
  })

  it('blocks send without KB selection', async () => {
    const user = userEvent.setup()
    render(<ChatEmptyHome />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'hello world')

    const sendBtn = screen.getByTestId('temp-send-btn') as HTMLButtonElement
    expect(sendBtn.disabled).toBe(true)
    expect(submitTempChat).not.toHaveBeenCalled()
  })

  it('submits and sets selectedSessionId after session create', async () => {
    vi.mocked(submitTempChat).mockResolvedValue('s1')
    const user = userEvent.setup()
    render(<ChatEmptyHome />)

    await user.click(screen.getByTestId('kb-selector-trigger'))
    const items = await screen.findAllByTestId('kb-selector-item')
    await user.click(items[0])

    const input = screen.getByRole('textbox')
    await user.type(input, 'hello world')
    await user.click(screen.getByTestId('temp-send-btn'))

    expect(submitTempChat).toHaveBeenCalledWith('hello world', {
      knowledgeBaseIds: ['kb1'],
    })
    expect(useChatStore.getState().selectedSessionId).toBe('s1')
  })
})
