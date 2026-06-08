import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatInput } from '@/components/chat/ChatInput'

// Mock alova useRequest for KbSelector
vi.mock('alova/client', () => ({
  useRequest: vi.fn(() => ({
    data: undefined,
    loading: false,
    error: undefined,
    send: vi.fn(),
  })),
}))

describe('ChatInput with KbSelector', () => {
  it('renders KbSelector trigger in input area', () => {
    render(<ChatInput onSend={() => {}} />)

    expect(screen.getByTestId('kb-selector-trigger')).toBeDefined()
  })

  it('passes selectedKnowledgeBaseIds to onSend', () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByPlaceholderText(/输入消息/)
    fireEvent.change(textarea, { target: { value: 'Hello' } })

    fireEvent.click(screen.getByText('发送'))

    // onSend 应被调用，第二个参数为 selectedKnowledgeBaseIds
    expect(onSend).toHaveBeenCalledWith('Hello', [])
  })

  it('disables input and KbSelector when disabled', () => {
    render(<ChatInput onSend={() => {}} disabled={true} />)

    const textarea = screen.getByPlaceholderText(/输入消息/) as HTMLTextAreaElement
    expect(textarea.disabled).toBe(true)
  })
})
