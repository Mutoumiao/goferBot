import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatPendingIndicator } from '@/components/chat-pending-indicator'

describe('ChatPendingIndicator', () => {
  it('renders default label and status role', () => {
    render(<ChatPendingIndicator />)
    const el = screen.getByTestId('chat-pending-indicator')
    expect(el.getAttribute('role')).toBe('status')
    expect(el.getAttribute('aria-busy')).toBe('true')
    expect(el.textContent).toContain('正在生成…')
  })

  it('renders custom label and testId', () => {
    render(<ChatPendingIndicator label="正在检索与生成…" testId="chat-pending-custom" />)
    expect(screen.getByTestId('chat-pending-custom').textContent).toContain('正在检索与生成…')
  })
})
