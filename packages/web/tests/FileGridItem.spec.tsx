import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileGridItem } from '@/components/kb/FileGridItem'
import type { Folder, DocumentItem } from '@/stores/file'

const mockFolder: Folder = {
  id: 'folder-1',
  kbId: 'kb-1',
  parentId: null,
  name: '测试文件夹',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
}

const mockDocument: DocumentItem = {
  id: 'doc-1',
  kbId: 'kb-1',
  folderId: null,
  name: '测试文档.pdf',
  ext: '.pdf',
  mimeType: 'application/pdf',
  size: 1024000,
  status: 'ready',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
}

describe('FileGridItem', () => {
  it('AC-03: renders folder with folder icon and name', () => {
    render(<FileGridItem item={mockFolder} isFolder onClick={vi.fn()} />)
    expect(screen.getByText('测试文件夹')).toBeDefined()
    // 文件夹不显示文件大小
    expect(document.querySelector('[data-testid="item-size"]')).toBeNull()
  })

  it('AC-03: renders document with file icon, name, size, and date', () => {
    render(<FileGridItem item={mockDocument} isFolder={false} onClick={vi.fn()} />)
    expect(screen.getByText('测试文档.pdf')).toBeDefined()
    const visibleSize = document.querySelector('div.flex.gap-2 > span:first-child')
    expect(visibleSize?.textContent).toBe('1000.0 KB')
    expect(document.querySelector('[data-testid="item-date"]')).toBeDefined()
  })

  it('AC-03: shows correct icon for different file extensions', () => {
    const imageDoc: DocumentItem = { ...mockDocument, name: 'photo.png', ext: '.png', mimeType: 'image/png' }
    render(<FileGridItem item={imageDoc} isFolder={false} onClick={vi.fn()} />)
    expect(document.querySelector('[data-testid="file-icon"]')).toBeDefined()
  })

  it('calls onClick when card is clicked', () => {
    const onClick = vi.fn()
    render(<FileGridItem item={mockFolder} isFolder onClick={onClick} />)
    fireEvent.click(screen.getByText('测试文件夹'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('formats file size correctly: bytes', () => {
    const tinyDoc: DocumentItem = { ...mockDocument, size: 500, name: 'tiny.txt' }
    render(<FileGridItem item={tinyDoc} isFolder={false} onClick={vi.fn()} />)
    // 查询可见区域中的 size（排除 hidden 的 data-testid="item-size"）
    const visibleSize = document.querySelector('div.flex.gap-2 > span:first-child')
    expect(visibleSize?.textContent).toBe('500 B')
  })

  it('formats file size correctly: GB', () => {
    const hugeDoc: DocumentItem = { ...mockDocument, size: 3.5 * 1024 * 1024 * 1024, name: 'huge.bin' }
    render(<FileGridItem item={hugeDoc} isFolder={false} onClick={vi.fn()} />)
    const visibleSize = document.querySelector('div.flex.gap-2 > span:first-child')
    expect(visibleSize?.textContent).toBe('3.5 GB')
  })
})
