import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MoveCopyDialog from '@/features/KnowledgeBase/components/MoveCopyDialog'
import { useKbStore } from '@/features/KnowledgeBase/store'
import type { Folder, DocumentItem } from '@/features/KnowledgeBase/types'
import type { KbEntry } from '@goferbot/data'

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

vi.mock('@/api/file', () => ({
  getFolders: vi.fn(() => ({ send: vi.fn().mockResolvedValue([]) })),
}))

vi.mock('@/api/KnowledgeBase', () => ({
  getKbList: vi.fn(() => ({ send: vi.fn().mockResolvedValue({ items: [] }) })),
}))

vi.mock('@/features/KnowledgeBase/services', () => ({
  moveDocument: vi.fn(() => ({ send: vi.fn().mockResolvedValue(undefined) })),
  moveFolder: vi.fn(() => ({ send: vi.fn().mockResolvedValue(undefined) })),
  copyDocument: vi.fn(() => ({ send: vi.fn().mockResolvedValue(undefined) })),
  copyFolder: vi.fn(() => ({ send: vi.fn().mockResolvedValue(undefined) })),
}))

const mockFolder: Folder = {
  id: 'f1',
  kbId: 'kb1',
  parentId: null,
  name: 'Source Folder',
  createdAt: '2026-06-17T08:00:00.000Z',
  updatedAt: '2026-06-17T08:00:00.000Z',
}

const mockDocument: DocumentItem = {
  id: 'd1',
  kbId: 'kb1',
  folderId: null,
  name: 'report.pdf',
  ext: 'pdf',
  mimeType: 'application/pdf',
  size: 2048,
  status: 'ready',
  createdAt: '2026-06-17T08:00:00.000Z',
  updatedAt: '2026-06-17T08:00:00.000Z',
}

const mockKb: KbEntry = {
  id: 'kb1',
  name: 'Test KB',
  isPinned: false,
  sortOrder: 0,
  createdAt: '2026-06-17T08:00:00.000Z',
}

describe('MoveCopyDialog', () => {
  beforeEach(() => {
    useKbStore.setState({
      currentKbId: 'kb1',
      currentFolderId: null,
    })
  })

  it('renders move dialog for document', async () => {
    const { getKbList } = await import('@/api/KnowledgeBase')
    vi.mocked(getKbList).mockReturnValue({ send: vi.fn().mockResolvedValue({ items: [mockKb] }) } as any)

    render(
      <MoveCopyDialog
        mode="move"
        item={mockDocument}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('移动文档')).toBeDefined()
    })
    expect(screen.getByText('report.pdf')).toBeDefined()
    expect(screen.getByText('目标知识库')).toBeDefined()
    expect(screen.getByText('目标文件夹')).toBeDefined()
  })

  it('renders copy dialog for folder', async () => {
    const { getKbList } = await import('@/api/KnowledgeBase')
    vi.mocked(getKbList).mockReturnValue({ send: vi.fn().mockResolvedValue({ items: [mockKb] }) } as any)

    render(
      <MoveCopyDialog
        mode="copy"
        item={mockFolder}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('复制文件夹')).toBeDefined()
    })
    expect(screen.getByText('Source Folder')).toBeDefined()
  })

  it('confirms move with root target', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const { getKbList } = await import('@/api/KnowledgeBase')
    vi.mocked(getKbList).mockReturnValue({ send: vi.fn().mockResolvedValue({ items: [mockKb] }) } as any)

    render(
      <MoveCopyDialog
        mode="move"
        item={mockDocument}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('根目录')).toBeDefined()
    })

    const confirmButton = screen.getByRole('button', { name: '确定' })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
  })

  it('disables source folder and its descendants in copy mode', async () => {
    const { getKbList } = await import('@/api/KnowledgeBase')
    const { getFolders } = await import('@/api/file')
    vi.mocked(getKbList).mockReturnValue({ send: vi.fn().mockResolvedValue({ items: [mockKb] }) } as any)
    vi.mocked(getFolders).mockImplementation((_kbId, parentId) => ({
      send: vi.fn().mockResolvedValue(
        parentId === null
          ? [{ id: 'f1', kbId: 'kb1', parentId: null, name: 'Source Folder' }, { id: 'f2', kbId: 'kb1', parentId: null, name: 'Sibling' }]
          : parentId === 'f1'
            ? [{ id: 'f1-1', kbId: 'kb1', parentId: 'f1', name: 'Child' }]
            : [],
      ),
    }) as any)

    render(
      <MoveCopyDialog
        mode="copy"
        item={mockFolder}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Child')).toBeDefined()
    })

    const sourceRadio = screen.getByRole('radio', { name: 'Source Folder' })
    const childRadio = screen.getByRole('radio', { name: 'Child' })
    const siblingRadio = screen.getByRole('radio', { name: 'Sibling' })

    expect((sourceRadio as HTMLInputElement).disabled).toBe(true)
    expect((childRadio as HTMLInputElement).disabled).toBe(true)
    expect((siblingRadio as HTMLInputElement).disabled).toBe(false)
  })
})
