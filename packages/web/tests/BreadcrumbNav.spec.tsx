import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BreadcrumbNav } from '@/components/kb/BreadcrumbNav'
import type { Folder } from '@/stores/file'

describe('BreadcrumbNav', () => {
  const mockBreadcrumb: Folder[] = [
    { id: 'f-1', kbId: 'kb-1', parentId: null, name: '项目文档', createdAt: '', updatedAt: '' },
    { id: 'f-2', kbId: 'kb-1', parentId: 'f-1', name: '技术方案', createdAt: '', updatedAt: '' },
  ]

  it('AC-04: renders directory path with home icon and KB name', () => {
    render(<BreadcrumbNav items={mockBreadcrumb} currentKbName="我的知识库" onNavigate={vi.fn()} />)
    expect(screen.getByText('我的知识库')).toBeDefined()
    expect(screen.getByText('项目文档')).toBeDefined()
    expect(screen.getByText('技术方案')).toBeDefined()
  })

  it('AC-04: renders only root when no subfolders', () => {
    render(<BreadcrumbNav items={[]} currentKbName="空知识库" onNavigate={vi.fn()} />)
    expect(screen.getByText('空知识库')).toBeDefined()
    // 只有根路径，没有分隔符后的内容
    const separators = document.querySelectorAll('[data-testid="breadcrumb-separator"]')
    expect(separators.length).toBe(0)
  })

  it('AC-04: calls onNavigate with correct folderId on segment click', () => {
    const onNavigate = vi.fn()
    render(<BreadcrumbNav items={mockBreadcrumb} currentKbName="我的知识库" onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('项目文档'))
    expect(onNavigate).toHaveBeenCalledWith('f-1')
  })

  it('AC-04: calls onNavigate with null when clicking root', () => {
    const onNavigate = vi.fn()
    render(<BreadcrumbNav items={mockBreadcrumb} currentKbName="我的知识库" onNavigate={onNavigate} />)
    const homeButton = document.querySelector('[data-testid="breadcrumb-root"]')
    fireEvent.click(homeButton!)
    expect(onNavigate).toHaveBeenCalledWith(null)
  })

  it('AC-04: last segment is not clickable (current folder)', () => {
    const onNavigate = vi.fn()
    render(<BreadcrumbNav items={mockBreadcrumb} currentKbName="我的知识库" onNavigate={onNavigate} />)
    const lastSegment = screen.getByText('技术方案')
    fireEvent.click(lastSegment)
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
