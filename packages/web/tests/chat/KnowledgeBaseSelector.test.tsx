import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { KnowledgeBaseSelector } from '@/features/chat/components/KnowledgeBaseSelector'

vi.mock('alova/client', () => ({
  useRequest: vi.fn(),
}))

import { useRequest } from 'alova/client'

const mockKbList = [
  { id: 'kb1', name: '知识库 A', fileCount: 2 },
  { id: 'kb2', name: '知识库 B', fileCount: 5 },
]

describe('KnowledgeBaseSelector', () => {
  const onSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRequest).mockReturnValue({
      data: mockKbList,
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)
  })

  it('renders trigger and opens selector', async () => {
    const user = userEvent.setup()
    render(<KnowledgeBaseSelector selectedId={null} onSelect={onSelect} />)

    await user.click(screen.getByTestId('kb-selector-trigger'))

    await waitFor(() => {
      expect(screen.getAllByTestId('kb-selector-item')).toHaveLength(2)
    })
  })

  it('selects a knowledge base on click', async () => {
    const user = userEvent.setup()
    render(<KnowledgeBaseSelector selectedId={null} onSelect={onSelect} />)

    await user.click(screen.getByTestId('kb-selector-trigger'))
    const items = screen.getAllByTestId('kb-selector-item')
    await user.click(items[0])

    expect(onSelect).toHaveBeenCalledWith('kb1')
  })

  it('deselects when clicking already selected item', async () => {
    const user = userEvent.setup()
    render(<KnowledgeBaseSelector selectedId="kb1" onSelect={onSelect} />)

    await user.click(screen.getByTestId('kb-selector-trigger'))
    const items = screen.getAllByTestId('kb-selector-item')
    await user.click(items[0])

    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('marks selected item with aria-checked', async () => {
    const user = userEvent.setup()
    render(<KnowledgeBaseSelector selectedId="kb2" onSelect={onSelect} />)

    await user.click(screen.getByTestId('kb-selector-trigger'))
    const items = screen.getAllByTestId('kb-selector-item')
    expect(items[0].getAttribute('aria-checked')).toBe('false')
    expect(items[1].getAttribute('aria-checked')).toBe('true')
  })

  it('shows retry button on error', async () => {
    const send = vi.fn()
    vi.mocked(useRequest).mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error('load failed'),
      send,
    } as any)

    const user = userEvent.setup()
    render(<KnowledgeBaseSelector selectedId={null} onSelect={onSelect} />)

    await user.click(screen.getByTestId('kb-selector-trigger'))
    await user.click(screen.getByTestId('kb-selector-retry'))

    expect(send).toHaveBeenCalled()
  })
})
