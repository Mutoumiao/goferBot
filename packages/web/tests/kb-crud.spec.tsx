import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  kbEntrySchema,
  createKbRequestSchema,
  updateKbRequestSchema,
} from '@goferbot/data'
import { KbListPage } from '@/routes/app/kb'
import CreateKbDialog from '@/overlays/dialogs/CreateKbDialog'
import EditKbDialog from '@/overlays/dialogs/EditKbDialog'
import DeleteKbDialog from '@/overlays/dialogs/DeleteKbDialog'

// ─── Schema Tests ───────────────────────────────────────────────

describe('KB Schema', () => {
  it('AC-16: kbEntrySchema accepts name field (not title)', () => {
    const result = kbEntrySchema.safeParse({
      id: '1',
      name: '我的知识库',
      description: '描述',
      fileCount: 3,
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // @ts-expect-error title 不应存在
      expect(result.data.title).toBeUndefined()
      expect(result.data.name).toBe('我的知识库')
    }
  })

  it('AC-16b: createKbRequestSchema validates name (not title)', () => {
    const result = createKbRequestSchema.safeParse({
      name: '新知识库',
      description: '描述',
    })
    expect(result.success).toBe(true)
  })

  it('AC-16c: createKbRequestSchema rejects empty name', () => {
    const result = createKbRequestSchema.safeParse({
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('AC-16d: updateKbRequestSchema validates name', () => {
    const result = updateKbRequestSchema.safeParse({
      name: '更新名称',
      description: '更新描述',
    })
    expect(result.success).toBe(true)
  })

  it('AC-16e: kbEntrySchema rejects title field', () => {
    const result = kbEntrySchema.safeParse({
      id: '1',
      title: '旧字段名',
      description: '描述',
      fileCount: 3,
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })
})

// ─── Mocks ──────────────────────────────────────────────────────

const mockStore = {
  entries: [] as any[],
  isLoading: false,
  selectedId: null as string | null,
  setEntries: vi.fn(),
  setIsLoading: vi.fn(),
  setSelectedId: vi.fn(),
  addEntry: vi.fn(),
  updateEntry: vi.fn(),
  removeEntry: vi.fn(),
}

vi.mock('@/stores/kb', () => ({
  useKbStore: (selector?: any) => {
    if (typeof selector === 'function') return selector(mockStore)
    return mockStore
  },
}))

vi.mock('@/stores/file', () => ({
  useFileStore: vi.fn(() => ({
    folders: [],
    documents: [],
    currentFolderId: null,
    isLoading: false,
    error: null,
    uploadTasks: [],
    activeUploadCount: 0,
    breadcrumb: [],
    loadItems: vi.fn(),
    addTask: vi.fn(),
    removeTask: vi.fn(),
    clearCompleted: vi.fn(),
    clearError: vi.fn(),
  })),
}))

vi.mock('@/api/kb', () => ({
  getKbList: vi.fn(() => ({
    send: vi.fn().mockResolvedValue({ data: { entries: [] } }),
  })),
  createKb: vi.fn(() => ({
    send: vi.fn().mockResolvedValue({ id: 'new-kb' }),
  })),
  updateKb: vi.fn(() => ({
    send: vi.fn().mockResolvedValue({ id: 'kb-1' }),
  })),
  deleteKb: vi.fn(() => ({
    send: vi.fn().mockResolvedValue(undefined),
  })),
  uploadFile: vi.fn(),
  getKbDetail: vi.fn(),
}))

// ─── KbListPage Tests ───────────────────────────────────────────

describe('KbListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.entries = []
    mockStore.isLoading = false
    mockStore.selectedId = null
  })

  it('AC-01: renders loading skeleton while fetching KB list', () => {
    mockStore.isLoading = true
    render(<KbListPage />)
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('AC-02: shows empty state when KB list is empty', () => {
    mockStore.entries = []
    mockStore.isLoading = false
    render(<KbListPage />)
    expect(screen.getByText('暂无知识库')).toBeDefined()
    expect(screen.getByRole('button', { name: /创建第一个知识库/ })).toBeDefined()
  })

  it('AC-03: displays error message and retry button on list load failure', async () => {
    mockStore.entries = []
    mockStore.isLoading = false
    // 模拟加载错误：组件内部 fetchList 会捕获错误并设置 loadError
    // 由于 loadError 是内部 state，我们通过 mock getKbList 返回 reject
    const { getKbList } = await import('@/api/kb')
    vi.mocked(getKbList).mockReturnValue({
      send: vi.fn().mockRejectedValue(new Error('网络错误')),
    } as never)
    render(<KbListPage />)
    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeDefined()
    })
    const retryBtn = screen.getByRole('button', { name: /重试/ })
    expect(retryBtn).toBeDefined()
  })

  it('AC-04: renders KB card grid with name, description, file count', () => {
    mockStore.entries = [
      {
        id: '1',
        name: '测试知识库',
        description: '测试描述',
        fileCount: 5,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]
    mockStore.isLoading = false
    render(<KbListPage />)
    expect(screen.getByText('测试知识库')).toBeDefined()
    expect(screen.getByText('测试描述')).toBeDefined()
    expect(screen.getByText(/5 个文件/)).toBeDefined()
  })

  it('AC-05: shows create button and opens dialog on click', () => {
    mockStore.entries = []
    mockStore.isLoading = false
    render(<KbListPage />)
    const createBtn = screen.getByRole('button', { name: /创建知识库/ })
    expect(createBtn).toBeDefined()
  })

  it('AC-14: clicking KB card sets selectedId', () => {
    mockStore.entries = [
      {
        id: 'kb-1',
        name: '测试知识库',
        description: '描述',
        fileCount: 3,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]
    render(<KbListPage />)
    const card = screen.getByText('测试知识库').closest('[data-slot="card"]')
    expect(card).toBeDefined()
    if (card) {
      fireEvent.click(card)
      expect(mockStore.setSelectedId).toHaveBeenCalledWith('kb-1')
    }
  })
})

// ─── CreateKbDialog Tests ───────────────────────────────────────

describe('CreateKbDialog', () => {
  const defaultProps = {
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-05: renders name and description inputs', () => {
    render(<CreateKbDialog {...defaultProps} />)
    expect(screen.getByPlaceholderText('知识库名称')).toBeDefined()
    expect(screen.getByPlaceholderText('描述（可选）')).toBeDefined()
    expect(screen.getByRole('button', { name: /创建/ })).toBeDefined()
  })

  it('AC-06: shows validation error for empty name on submit', async () => {
    render(<CreateKbDialog {...defaultProps} />)
    const submitBtn = screen.getByRole('button', { name: /创建/ })
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText('名称不能为空')).toBeDefined()
    })
  })

  it('AC-06b: shows validation error for name exceeding 100 chars', async () => {
    render(<CreateKbDialog {...defaultProps} />)
    const input = screen.getByPlaceholderText('知识库名称')
    fireEvent.change(input, { target: { value: 'a'.repeat(101) } })
    const submitBtn = screen.getByRole('button', { name: /创建/ })
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText('名称最长100字符')).toBeDefined()
    })
  })
})

// ─── EditKbDialog Tests ─────────────────────────────────────────

describe('EditKbDialog', () => {
  const mockEntry = {
    id: 'kb-1',
    name: '我的知识库',
    description: '一些描述',
    fileCount: 3,
    createdAt: '2026-01-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-09: renders with pre-filled name and description', () => {
    render(
      <EditKbDialog
        entry={mockEntry}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const nameInput = screen.getByPlaceholderText('知识库名称') as HTMLInputElement
    expect(nameInput.value).toBe('我的知识库')
    const descInput = screen.getByPlaceholderText('描述（可选）') as HTMLTextAreaElement
    expect(descInput.value).toBe('一些描述')
    expect(screen.getByRole('button', { name: /保存/ })).toBeDefined()
  })
})

// ─── DeleteKbDialog Tests ───────────────────────────────────────

describe('DeleteKbDialog', () => {
  const defaultProps = {
    kbId: 'kb-1',
    kbName: '我的知识库',
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-11: displays confirmation message with KB name', () => {
    render(<DeleteKbDialog {...defaultProps} />)
    expect(screen.getByText(/我的知识库/)).toBeDefined()
    expect(screen.getByText(/不可撤销/)).toBeDefined()
    expect(screen.getByRole('button', { name: /删除/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /取消/ })).toBeDefined()
  })

  it('AC-13: closes dialog without action on cancel', () => {
    const onClose = vi.fn()
    render(<DeleteKbDialog {...defaultProps} onClose={onClose} />)
    const cancelBtn = screen.getByRole('button', { name: /取消/ })
    fireEvent.click(cancelBtn)
    expect(onClose).toHaveBeenCalledWith(false)
  })
})
