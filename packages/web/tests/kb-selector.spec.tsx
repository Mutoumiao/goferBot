import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KbSelector } from '@/components/chat/KbSelector'

// Mock alova useRequest
vi.mock('alova/client', () => ({
  useRequest: vi.fn(),
}))

import { useRequest } from 'alova/client'

describe('KbSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-07: renders trigger button when closed', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={() => {}} />)

    expect(screen.getByTestId('kb-selector-trigger')).toBeDefined()
  })

  it('AC-07: opens dropdown on trigger click and renders KB items', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: { data: [
        { id: 'kb-1', name: 'Docs', fileCount: 5 },
        { id: 'kb-2', name: 'Code', fileCount: 3 },
      ] },
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={() => {}} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))

    expect(screen.getByTestId('kb-selector-dropdown')).toBeDefined()
    expect(screen.getByText('Docs')).toBeDefined()
    expect(screen.getByText('Code')).toBeDefined()
  })

  it('AC-07: shows loading skeleton when loading', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={() => {}} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))

    // 骨架占位（3 条）
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('AC-07: shows empty hint when no KB entries', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: { data: [] },
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={() => {}} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))

    expect(screen.getByText('请先创建知识库')).toBeDefined()
  })

  it('AC-07: shows error message with retry button', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error('加载失败'),
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={() => {}} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))

    expect(screen.getByText('加载失败')).toBeDefined()
    expect(screen.getByTestId('kb-selector-retry')).toBeDefined()
  })

  it('AC-07: toggles KB selection on item click', () => {
    const onToggle = vi.fn()
    vi.mocked(useRequest).mockReturnValue({
      data: { data: [{ id: 'kb-1', name: 'Docs', fileCount: 5 }] },
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={onToggle} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))
    fireEvent.click(screen.getByText('Docs'))

    expect(onToggle).toHaveBeenCalledWith('kb-1')
  })

  it('AC-07: shows checked state for selected KBs', () => {
    const onToggle = vi.fn()
    vi.mocked(useRequest).mockReturnValue({
      data: { data: [{ id: 'kb-1', name: 'Docs', fileCount: 5 }] },
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={['kb-1']} onToggle={onToggle} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('AC-07: closes dropdown on Escape key', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: { data: [{ id: 'kb-1', name: 'Docs', fileCount: 5 }] },
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={() => {}} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))
    expect(screen.getByTestId('kb-selector-dropdown')).toBeDefined()

    fireEvent.keyDown(document, { key: 'Escape' })
    // 下拉应关闭
    expect(screen.queryByTestId('kb-selector-dropdown')).toBeNull()
  })

  it('AC-07: closes dropdown on outside click', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: { data: [{ id: 'kb-1', name: 'Docs', fileCount: 5 }] },
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(
      <div>
        <KbSelector selectedIds={[]} onToggle={() => {}} />
        <div data-testid="outside">outside</div>
      </div>
    )

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))
    expect(screen.getByTestId('kb-selector-dropdown')).toBeDefined()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByTestId('kb-selector-dropdown')).toBeNull()
  })
})
