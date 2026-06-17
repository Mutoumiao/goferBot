import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FileGridItem } from '@/features/KnowledgeBase/components/FileGridItem'
import type { Folder, DocumentItem } from '@/features/KnowledgeBase/types'

const mockFolder: Folder = {
  id: 'f1',
  kbId: 'kb1',
  parentId: null,
  name: '测试文件夹',
  createdAt: '2026-06-17T08:00:00.000Z',
  updatedAt: '2026-06-17T08:00:00.000Z',
}

function makeDocument(status: DocumentItem['status']): DocumentItem {
  return {
    id: 'd1',
    kbId: 'kb1',
    folderId: null,
    name: 'report.pdf',
    ext: 'pdf',
    mimeType: 'application/pdf',
    size: 2048,
    status,
    createdAt: '2026-06-17T08:00:00.000Z',
    updatedAt: '2026-06-17T08:00:00.000Z',
  }
}

describe('FileGridItem', () => {
  it('renders folder card with name and document count', () => {
    render(<FileGridItem item={mockFolder} isFolder documentCount={5} onClick={vi.fn()} />)

    expect(screen.getByText('测试文件夹')).toBeDefined()
    expect(screen.getByText('5 个文件')).toBeDefined()
  })

  it.each([
    { status: 'uploaded' as const, label: '已上传' },
    { status: 'chunking' as const, label: '分块中' },
    { status: 'embedding' as const, label: '嵌入中' },
    { status: 'indexing' as const, label: '索引中' },
    { status: 'ready' as const, label: '就绪' },
    { status: 'failed' as const, label: '失败' },
  ])('renders status label $status for documents', ({ status, label }) => {
    render(<FileGridItem item={makeDocument(status)} isFolder={false} onClick={vi.fn()} />)

    expect(screen.getByText(label)).toBeDefined()
  })

  it('renders document name and file size', () => {
    render(<FileGridItem item={makeDocument('ready')} isFolder={false} onClick={vi.fn()} />)

    expect(screen.getByText('report.pdf')).toBeDefined()
    expect(screen.getByText('2.0 KB')).toBeDefined()
  })
})
