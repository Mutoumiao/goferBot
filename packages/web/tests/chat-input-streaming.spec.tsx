import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatInput } from '@/components/chat/ChatInput'

describe('ChatInput streaming state', () => {
  it('AC-02a: isStreaming 时显示停止按钮而非发送按钮', () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        isStreaming={true}
        onStop={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /停止/i })).toBeDefined()
    expect(screen.queryByRole('button', { name: /发送/i })).toBeNull()
  })

  it('AC-02b: isStreaming 时禁用 textarea', () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        isStreaming={true}
        onStop={vi.fn()}
      />,
    )

    const textarea = screen.getByPlaceholderText(/输入/) as HTMLTextAreaElement
    expect(textarea.disabled).toBe(true)
  })

  it('AC-02c: 点击停止按钮调用 onStop', () => {
    const onStop = vi.fn()

    render(
      <ChatInput
        onSend={vi.fn()}
        isStreaming={true}
        onStop={onStop}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /停止/i }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('AC-02d: 非 streaming 时显示发送按钮（默认）', () => {
    render(<ChatInput onSend={vi.fn()} />)

    expect(screen.getByRole('button', { name: /发送/i })).toBeDefined()
    expect(screen.queryByRole('button', { name: /停止/i })).toBeNull()
  })
})
