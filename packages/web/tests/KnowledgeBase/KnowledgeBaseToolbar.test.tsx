import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { KnowledgeBaseToolbar } from '@/features/KnowledgeBase/components/KnowledgeBaseToolbar'

describe('KnowledgeBaseToolbar', () => {
  it('renders accessible icon-only buttons', () => {
    render(
      <KnowledgeBaseToolbar
        kbName="测试库"
        breadcrumb={[]}
        onNavigate={vi.fn()}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        sortOption="updatedAt-desc"
        onSortChange={vi.fn()}
        onUpload={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '搜索' })).toBeDefined()
    expect(screen.getByRole('button', { name: '切换到列表视图' })).toBeDefined()
    expect(screen.getByRole('button', { name: '排序' })).toBeDefined()
    expect(screen.getByRole('button', { name: '上传文件' })).toBeDefined()
  })

  it('shows upload badge count and aria-label when pending', () => {
    render(
      <KnowledgeBaseToolbar
        kbName="测试库"
        breadcrumb={[]}
        onNavigate={vi.fn()}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        sortOption="updatedAt-desc"
        onSortChange={vi.fn()}
        onUpload={vi.fn()}
        uploadBadgeCount={3}
      />,
    )

    expect(screen.getByTestId('upload-badge').textContent).toBe('3')
    expect(screen.getByRole('button', { name: '上传文件，3 个进行中' })).toBeDefined()
  })

  it('hides badge when count is zero', () => {
    render(
      <KnowledgeBaseToolbar
        kbName="测试库"
        breadcrumb={[]}
        onNavigate={vi.fn()}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        sortOption="updatedAt-desc"
        onSortChange={vi.fn()}
        onUpload={vi.fn()}
        uploadBadgeCount={0}
      />,
    )

    expect(screen.queryByTestId('upload-badge')).toBeNull()
    expect(screen.getByRole('button', { name: '上传文件' })).toBeDefined()
  })

  it('switches view mode aria-label based on current mode', () => {
    const { rerender } = render(
      <KnowledgeBaseToolbar
        kbName="测试库"
        breadcrumb={[]}
        onNavigate={vi.fn()}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        sortOption="updatedAt-desc"
        onSortChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '切换到列表视图' })).toBeDefined()

    rerender(
      <KnowledgeBaseToolbar
        kbName="测试库"
        breadcrumb={[]}
        onNavigate={vi.fn()}
        viewMode="list"
        onViewModeChange={vi.fn()}
        sortOption="updatedAt-desc"
        onSortChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '切换到网格视图' })).toBeDefined()
  })
})
