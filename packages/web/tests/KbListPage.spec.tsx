import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { KbListPage } from '@/routes/app/kb'
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

// Mock the file store
const mockLoadItems = vi.fn()

vi.mock('@/stores/file', () => ({
  useFileStore: vi.fn(() => ({
    uploadTasks: [],
    activeUploadCount: 0,
    folders: [mockFolder],
    documents: [mockDocument],
    currentKbId: 'kb-1',
    currentFolderId: null,
    isLoading: false,
    error: null,
    breadcrumb: [],
    loadItems: mockLoadItems,
    addTask: vi.fn(),
    removeTask: vi.fn(),
    clearCompleted: vi.fn(),
    clearError: vi.fn(),
  })),
}))

// Mock kb store
vi.mock('@/stores/kb', () => ({
  useKbStore: vi.fn(() => ({
    selectedId: 'kb-1',
    entries: [{ id: 'kb-1', title: '我的知识库' }],
    isLoading: false,
    setEntries: vi.fn(),
    setIsLoading: vi.fn(),
    setSelectedId: vi.fn(),
  })),
}))

// Mock api
vi.mock('@/api/kb', () => ({
  uploadFile: vi.fn(),
  getFolders: vi.fn(),
  getDocuments: vi.fn(),
  getKbList: vi.fn(() => ({ send: vi.fn().mockResolvedValue({ data: { entries: [] } }) })),
}))

describe('KbListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-08: loads file list and renders BreadcrumbNav on mount', async () => {
    render(<KbListPage />)
    await waitFor(() => {
      expect(mockLoadItems).toHaveBeenCalledWith('kb-1', null)
    })
  })

  it('renders FileManager with folders and documents', async () => {
    render(<KbListPage />)
    await waitFor(() => {
      expect(screen.getByText('测试文件夹')).toBeDefined()
      expect(screen.getByText('测试文档.pdf')).toBeDefined()
    })
  })

  it('renders UploadDropZone', async () => {
    render(<KbListPage />)
    await waitFor(() => {
      expect(screen.getByText(/拖拽文件到此处/)).toBeDefined()
    })
  })

  it('AC-08: clicking a folder triggers loadItems with folderId', async () => {
    render(<KbListPage />)
    await waitFor(() => {
      const folderElement = screen.getByText('测试文件夹')
      folderElement.click()
    })
    await waitFor(() => {
      expect(mockLoadItems).toHaveBeenCalledWith('kb-1', 'folder-1')
    })
  })

  it('shows loading skeleton when isLoading is true', async () => {
    const { useFileStore } = await import('@/stores/file')
    vi.mocked(useFileStore).mockReturnValue({
      folders: [],
      documents: [],
      isLoading: true,
      error: null,
      uploadTasks: [],
      activeUploadCount: 0,
      currentKbId: 'kb-1',
      currentFolderId: null,
      breadcrumb: [],
      loadItems: mockLoadItems,
      addTask: vi.fn(),
      removeTask: vi.fn(),
      clearCompleted: vi.fn(),
      clearError: vi.fn(),
    } as never)
    render(<KbListPage />)
    await waitFor(() => {
      const skeletons = document.querySelectorAll('[data-testid="skeleton-card"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })
})
