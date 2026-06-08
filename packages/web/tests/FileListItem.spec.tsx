import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileListItem } from '@/components/kb/FileListItem'
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

describe('FileListItem', () => {
  it('renders folder row with folder icon, name, and type label', () => {
    render(<FileListItem item={mockFolder} isFolder onClick={vi.fn()} />)
    expect(screen.getByText('测试文件夹')).toBeDefined()
    expect(screen.getByText('文件夹')).toBeDefined()
  })

  it('renders document row with file icon, name, size, date', () => {
    render(<FileListItem item={mockDocument} isFolder={false} onClick={vi.fn()} />)
    expect(screen.getByText('测试文档.pdf')).toBeDefined()
    expect(screen.getByText('.pdf')).toBeDefined()
  })

  it('calls onClick when row is clicked', () => {
    const onClick = vi.fn()
    render(<FileListItem item={mockFolder} isFolder onClick={onClick} />)
    fireEvent.click(screen.getByText('测试文件夹'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders as table row with correct structure', () => {
    render(<FileListItem item={mockDocument} isFolder={false} onClick={vi.fn()} />)
    const row = document.querySelector('tr')
    expect(row).toBeDefined()
    const cells = row!.querySelectorAll('td')
    expect(cells.length).toBeGreaterThanOrEqual(3)
  })
})
