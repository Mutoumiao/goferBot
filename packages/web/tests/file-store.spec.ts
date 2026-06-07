import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFileStore } from '@/stores/file'

// Mock @/api/file
const mockApiSend = vi.fn()
const mockApi = (returnValue?: unknown) => ({
  send: mockApiSend.mockResolvedValue(returnValue),
})

vi.mock('@/api/file', () => ({
  getFolders: vi.fn(() => mockApi([])),
  getDocuments: vi.fn(() => mockApi([])),
  deleteDocument: vi.fn(() => mockApi()),
  renameDocument: vi.fn(() => mockApi()),
  moveDocument: vi.fn(() => mockApi()),
  createFolder: vi.fn(() => mockApi()),
  renameFolder: vi.fn(() => mockApi()),
  deleteFolder: vi.fn(() => mockApi()),
}))

import * as fileApi from '@/api/file'

// Helper to create test task data
const makeTask = (overrides: Record<string, unknown> = {}) => ({
  fileName: 'test.pdf',
  fileSize: 1024,
  kbId: 'kb-1',
  folderId: null as string | null,
  ...overrides,
})

// Helper to reset API mocks
function resetApiMocks() {
  const defaults: Record<string, unknown> = {
    getFolders: [],
    getDocuments: [],
    deleteDocument: undefined,
    renameDocument: undefined,
    moveDocument: undefined,
    createFolder: undefined,
    renameFolder: undefined,
    deleteFolder: undefined,
  }
  for (const [key, val] of Object.entries(defaults)) {
    const fn = (fileApi as Record<string, unknown>)[key] as ReturnType<typeof vi.fn>
    if (fn?.mockReturnValue) {
      fn.mockReturnValue({ send: vi.fn().mockResolvedValue(val) })
    }
  }
}

describe('FileStore — 类型 + 队列基础（任务 1-2）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useFileStore.setState(useFileStore.getInitialState())
  })

  it('AC-01: store 导出 useFileStore', () => {
    expect(useFileStore).toBeDefined()
    expect(typeof useFileStore.getState).toBe('function')
  })

  it('AC-01: 初始状态 uploadTasks 为空数组', () => {
    expect(useFileStore.getState().uploadTasks).toEqual([])
  })

  it('AC-01: maxConcurrent 默认值为 3', () => {
    expect(useFileStore.getState().maxConcurrent).toBe(3)
  })

  it('AC-02: addTask 返回唯一 taskId 并将任务添加到队列', () => {
    const taskId = useFileStore.getState().addTask(makeTask())
    expect(taskId).toBeTruthy()
    expect(typeof taskId).toBe('string')
    const tasks = useFileStore.getState().uploadTasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe(taskId)
    expect(tasks[0].status).toBe('queued')
    expect(tasks[0].progress).toBe(0)
    expect(tasks[0].fileName).toBe('test.pdf')
  })

  it('AC-02: 多个 addTask 追加到队列末尾', () => {
    const store = useFileStore.getState()
    store.addTask(makeTask({ fileName: 'a.pdf' }))
    store.addTask(makeTask({ fileName: 'b.pdf' }))
    store.addTask(makeTask({ fileName: 'c.pdf' }))

    const tasks = useFileStore.getState().uploadTasks
    expect(tasks).toHaveLength(3)
    expect(tasks.map((t) => t.fileName)).toEqual(['a.pdf', 'b.pdf', 'c.pdf'])
    expect(tasks.every((t) => t.status === 'queued')).toBe(true)
  })

  it('AC-02: addTask 不自动启动上传（processQueue 手动调用）', () => {
    useFileStore.getState().addTask(makeTask())
    const tasks = useFileStore.getState().uploadTasks
    expect(tasks[0].status).toBe('queued')
  })
})

describe('FileStore — 上传状态管理（任务 3）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useFileStore.setState(useFileStore.getInitialState())
  })

  it('AC-03: updateProgress 更新任务进度', () => {
    const store = useFileStore.getState()
    const taskId = store.addTask(makeTask())
    store.processQueue()

    store.updateProgress(taskId, 50)
    expect(useFileStore.getState().uploadTasks[0].progress).toBe(50)
  })

  it('AC-03: updateProgress 对不存在的 taskId 静默忽略', () => {
    expect(() => useFileStore.getState().updateProgress('nonexistent', 50)).not.toThrow()
  })

  it('AC-03: markComplete 设置 status=completed + progress=100', () => {
    const store = useFileStore.getState()
    const taskId = store.addTask(makeTask())
    store.processQueue()

    store.markComplete(taskId)
    const task = useFileStore.getState().uploadTasks[0]
    expect(task.status).toBe('completed')
    expect(task.progress).toBe(100)
  })

  it('AC-03: markComplete 后自动调用 processQueue', () => {
    const store = useFileStore.getState()
    const t1 = store.addTask(makeTask({ fileName: 'a.pdf' }))
    const t2 = store.addTask(makeTask({ fileName: 'b.pdf' }))
    store.processQueue()

    store.markComplete(t1)
    const tasks = useFileStore.getState().uploadTasks
    const t2Task = tasks.find((t) => t.id === t2)
    expect(t2Task?.status).toBe('uploading')
  })

  it('AC-03: markFailed 设置 error + 自动调用 processQueue', () => {
    const store = useFileStore.getState()
    const t1 = store.addTask(makeTask({ fileName: 'a.pdf' }))
    const t2 = store.addTask(makeTask({ fileName: 'b.pdf' }))
    store.processQueue()

    store.markFailed(t1, '网络错误')
    const tasks = useFileStore.getState().uploadTasks
    const t1Task = tasks.find((t) => t.id === t1)
    expect(t1Task?.status).toBe('failed')
    expect(t1Task?.error).toBe('网络错误')
    const t2Task = tasks.find((t) => t.id === t2)
    expect(t2Task?.status).toBe('uploading')
  })

  it('AC-03: markFailed 对不存在的 taskId 静默忽略', () => {
    expect(() => useFileStore.getState().markFailed('nonexistent', 'err')).not.toThrow()
  })

  it('AC-03: markComplete 对不存在的 taskId 静默忽略', () => {
    expect(() => useFileStore.getState().markComplete('nonexistent')).not.toThrow()
  })
})

describe('FileStore — 并发控制（任务 4）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useFileStore.setState(useFileStore.getInitialState())
  })

  it('AC-04: activeUploadCount 返回 uploading 状态的任务数', () => {
    const store = useFileStore.getState()
    expect(store.activeUploadCount()).toBe(0)

    store.addTask(makeTask())
    store.processQueue()
    expect(useFileStore.getState().activeUploadCount()).toBe(1)
  })

  it('AC-04: maxConcurrent=3 时最多 3 个任务同时 uploading', () => {
    const store = useFileStore.getState()
    for (let i = 0; i < 5; i++) {
      store.addTask(makeTask({ fileName: `f${i}.pdf` }))
    }
    store.processQueue()

    const tasks = useFileStore.getState().uploadTasks
    const uploading = tasks.filter((t) => t.status === 'uploading')
    expect(uploading).toHaveLength(3)
    const queued = tasks.filter((t) => t.status === 'queued')
    expect(queued).toHaveLength(2)
  })

  it('AC-10: 槽位满时新任务保持 queued', () => {
    const store = useFileStore.getState()
    for (let i = 0; i < 3; i++) {
      const tid = store.addTask(makeTask({ fileName: `f${i}.pdf` }))
      store.updateProgress(tid, 0)
    }
    store.processQueue()
    store.addTask(makeTask({ fileName: 'f4.pdf' }))

    const tasks = useFileStore.getState().uploadTasks
    const last = tasks[tasks.length - 1]
    expect(last.status).toBe('queued')
  })

  it('AC-10: processQueue 在空队列时无操作', () => {
    expect(() => useFileStore.getState().processQueue()).not.toThrow()
    expect(useFileStore.getState().uploadTasks).toHaveLength(0)
  })

  it('AC-10: 所有任务失败后 activeCount=0', () => {
    const store = useFileStore.getState()
    const t1 = store.addTask(makeTask())
    store.processQueue()
    store.markFailed(t1, 'err')

    expect(useFileStore.getState().activeUploadCount()).toBe(0)
  })

  it('AC-10: maxConcurrent=0 时所有任务保持 queued', () => {
    useFileStore.setState({ maxConcurrent: 0 })
    const store = useFileStore.getState()
    store.addTask(makeTask())
    store.processQueue()

    expect(useFileStore.getState().uploadTasks[0].status).toBe('queued')
  })
})

describe('FileStore — 队列清理（任务 5）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useFileStore.setState(useFileStore.getInitialState())
  })

  it('AC-05: removeTask 从队列移除指定任务', () => {
    const store = useFileStore.getState()
    const t1 = store.addTask(makeTask({ fileName: 'a.pdf' }))
    store.addTask(makeTask({ fileName: 'b.pdf' }))

    store.removeTask(t1)
    const tasks = useFileStore.getState().uploadTasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0].fileName).toBe('b.pdf')
  })

  it('AC-05: clearCompleted 移除所有 completed/failed 任务，不影响 uploading/queued', () => {
    const store = useFileStore.getState()
    const t1 = store.addTask(makeTask({ fileName: 'a.pdf' }))
    store.addTask(makeTask({ fileName: 'b.pdf' }))

    store.processQueue()
    store.markComplete(t1)
    const t3 = store.addTask(makeTask({ fileName: 'c.pdf' }))
    store.processQueue()
    store.markFailed(t3, 'err')

    store.clearCompleted()
    const tasks = useFileStore.getState().uploadTasks
    expect(tasks.every((t) => t.status === 'uploading')).toBe(true)
    expect(tasks).toHaveLength(1)
  })

  it('AC-05: removeTask 对不存在的 taskId 静默忽略', () => {
    expect(() => useFileStore.getState().removeTask('nonexistent')).not.toThrow()
  })
})

describe('FileStore — 文件浏览（任务 6-8）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useFileStore.setState(useFileStore.getInitialState())
    resetApiMocks()
  })

  describe('loadItems', () => {
    it('AC-06: loadItems 成功 → folders + documents 更新', async () => {
      const folders = [{ id: 'f1', kbId: 'kb1', parentId: null, name: 'Docs', createdAt: '', updatedAt: '' }]
      const documents = [{ id: 'd1', kbId: 'kb1', folderId: null, name: 'a.pdf', ext: 'pdf', mimeType: 'application/pdf', size: 100, status: 'ready' as const, createdAt: '', updatedAt: '' }]

      const mockGetFolders = fileApi.getFolders as ReturnType<typeof vi.fn>
      const mockGetDocs = fileApi.getDocuments as ReturnType<typeof vi.fn>
      mockGetFolders.mockReturnValue({ send: vi.fn().mockResolvedValue(folders) })
      mockGetDocs.mockReturnValue({ send: vi.fn().mockResolvedValue(documents) })

      await useFileStore.getState().loadItems('kb1')

      const state = useFileStore.getState()
      expect(state.folders).toHaveLength(1)
      expect(state.documents).toHaveLength(1)
      expect(state.currentKbId).toBe('kb1')
      expect(state.isLoading).toBe(false)
    })

    it('AC-06: loadItems 空目录 → folders + documents 均为 []', async () => {
      const mockGetFolders = fileApi.getFolders as ReturnType<typeof vi.fn>
      const mockGetDocs = fileApi.getDocuments as ReturnType<typeof vi.fn>
      mockGetFolders.mockReturnValue({ send: vi.fn().mockResolvedValue([]) })
      mockGetDocs.mockReturnValue({ send: vi.fn().mockResolvedValue([]) })

      await useFileStore.getState().loadItems('kb1', null)

      const state = useFileStore.getState()
      expect(state.folders).toEqual([])
      expect(state.documents).toEqual([])
    })

    it('AC-06: loadItems 失败 → error 设置，isLoading=false', async () => {
      const mockGetFolders = fileApi.getFolders as ReturnType<typeof vi.fn>
      mockGetFolders.mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('Network error')) })

      await useFileStore.getState().loadItems('kb1')

      const state = useFileStore.getState()
      expect(state.error).toBeTruthy()
      expect(state.isLoading).toBe(false)
    })
  })

  describe('文档 CRUD', () => {
    it('AC-07: deleteDocument 成功 → documents 列表移除', async () => {
      const doc = { id: 'd1', kbId: 'kb1', folderId: null, name: 'a.pdf', ext: 'pdf', mimeType: 'application/pdf', size: 100, status: 'ready' as const, createdAt: '', updatedAt: '' }
      useFileStore.setState({ documents: [doc], currentKbId: 'kb1' })

      const mockDeleteDoc = fileApi.deleteDocument as ReturnType<typeof vi.fn>
      mockDeleteDoc.mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) })

      await useFileStore.getState().deleteDocument('d1')
      expect(useFileStore.getState().documents).toHaveLength(0)
    })

    it('AC-07: currentKbId 为空时 deleteDocument 静默 return', async () => {
      await expect(useFileStore.getState().deleteDocument('d1')).resolves.toBeUndefined()
    })

    it('AC-07: renameDocument 成功 → 对应文档名称更新', async () => {
      const doc = { id: 'd1', kbId: 'kb1', folderId: null, name: 'old.pdf', ext: 'pdf', mimeType: 'application/pdf', size: 100, status: 'ready' as const, createdAt: '', updatedAt: '' }
      useFileStore.setState({ documents: [doc], currentKbId: 'kb1' })
      const updated = { ...doc, name: 'new.pdf' }

      const mockRenameDoc = fileApi.renameDocument as ReturnType<typeof vi.fn>
      mockRenameDoc.mockReturnValue({ send: vi.fn().mockResolvedValue(updated) })

      await useFileStore.getState().renameDocument('d1', 'new.pdf')
      expect(useFileStore.getState().documents[0].name).toBe('new.pdf')
    })

    it('AC-07: moveDocument 成功 → 文档从当前列表移除', async () => {
      const doc = { id: 'd1', kbId: 'kb1', folderId: null, name: 'a.pdf', ext: 'pdf', mimeType: 'application/pdf', size: 100, status: 'ready' as const, createdAt: '', updatedAt: '' }
      useFileStore.setState({ documents: [doc], currentKbId: 'kb1' })

      const mockMoveDoc = fileApi.moveDocument as ReturnType<typeof vi.fn>
      mockMoveDoc.mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) })

      await useFileStore.getState().moveDocument('d1', 'folder-2')
      expect(useFileStore.getState().documents).toHaveLength(0)
    })
  })

  describe('文件夹 CRUD', () => {
    it('AC-08: createFolder 返回创建的 Folder 对象', async () => {
      const newFolder = { id: 'nf1', kbId: 'kb1', parentId: null, name: 'NewFolder', createdAt: '', updatedAt: '' }

      const mockCreateFolder = fileApi.createFolder as ReturnType<typeof vi.fn>
      mockCreateFolder.mockReturnValue({ send: vi.fn().mockResolvedValue(newFolder) })

      const result = await useFileStore.getState().createFolder('kb1', 'NewFolder')
      expect(result).toEqual(newFolder)
    })

    it('AC-08: renameFolder 返回更新后的 Folder', async () => {
      const updated = { id: 'f1', kbId: 'kb1', parentId: null, name: 'Renamed', createdAt: '', updatedAt: '' }

      const mockRenameFolder = fileApi.renameFolder as ReturnType<typeof vi.fn>
      mockRenameFolder.mockReturnValue({ send: vi.fn().mockResolvedValue(updated) })

      const result = await useFileStore.getState().renameFolder('kb1', 'f1', 'Renamed')
      expect(result).toEqual(updated)
    })

    it('AC-08: deleteFolder 完成后无错误', async () => {
      const mockDeleteFolder = fileApi.deleteFolder as ReturnType<typeof vi.fn>
      mockDeleteFolder.mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) })

      await expect(useFileStore.getState().deleteFolder('kb1', 'f1')).resolves.toBeUndefined()
    })
  })
})

describe('FileStore — 派生方法（任务 9）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useFileStore.setState(useFileStore.getInitialState())
  })

  it('AC-09: breadcrumb 从 currentFolderId 计算路径（含当前文件夹）', () => {
    const root = { id: 'root', kbId: 'kb1', parentId: null, name: 'Root', createdAt: '', updatedAt: '' }
    const child = { id: 'child', kbId: 'kb1', parentId: 'root', name: 'Child', createdAt: '', updatedAt: '' }
    const grandchild = { id: 'gc', kbId: 'kb1', parentId: 'child', name: 'Grand', createdAt: '', updatedAt: '' }

    useFileStore.setState({
      folders: [root, child, grandchild],
      currentFolderId: 'gc',
    })

    const bc = useFileStore.getState().breadcrumb()
    expect(bc).toHaveLength(3)
    expect(bc[0].id).toBe('root')
    expect(bc[1].id).toBe('child')
    expect(bc[2].id).toBe('gc')
  })

  it('AC-09: currentFolderId 为 null 时 breadcrumb 返回空数组', () => {
    const bc = useFileStore.getState().breadcrumb()
    expect(bc).toEqual([])
  })

  it('AC-09: 循环引用保护 — 找不到 parent 时停止', () => {
    const orphan = { id: 'orphan', kbId: 'kb1', parentId: 'nonexistent', name: 'Orphan', createdAt: '', updatedAt: '' }
    useFileStore.setState({ folders: [orphan], currentFolderId: 'orphan' })

    const bc = useFileStore.getState().breadcrumb()
    expect(bc).toHaveLength(1)
  })

  it('AC-10: resetFileBrowse 清空 folders/documents/currentKbId/currentFolderId', () => {
    useFileStore.setState({
      folders: [{ id: 'f1', kbId: 'kb1', parentId: null, name: 'D', createdAt: '', updatedAt: '' }],
      documents: [{ id: 'd1', kbId: 'kb1', folderId: null, name: 'a.pdf', ext: 'pdf', mimeType: null, size: 1, status: 'ready', createdAt: '', updatedAt: '' }],
      currentKbId: 'kb1',
      currentFolderId: 'f1',
    })

    useFileStore.getState().resetFileBrowse()
    const state = useFileStore.getState()
    expect(state.folders).toEqual([])
    expect(state.documents).toEqual([])
    expect(state.currentKbId).toBeNull()
    expect(state.currentFolderId).toBeNull()
  })

  it('AC-10: clearError 清除错误状态', () => {
    useFileStore.setState({ error: 'some error' })
    useFileStore.getState().clearError()
    expect(useFileStore.getState().error).toBeNull()
  })
})
