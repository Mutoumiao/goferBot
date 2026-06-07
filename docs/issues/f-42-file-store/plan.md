---
id: f-42
issue: issue.md
version: 1
---

# File Store (Pinia → Zustand) 实现计划

> **For agentic workers:** 步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 将 `packages/webui/src/stores/file.ts`（Pinia）迁移为 `packages/web/src/stores/file.ts`（Zustand）。管理文件上传队列（含并发控制）与文件浏览状态（folders/documents/breadcrumb），为 f-46 文件上传 UI 和 f-47 KB CRUD 提供数据层。

**架构：** 单 Store 双域模型：(A) 上传队列域 — UploadTask 状态机 + processQueue 并发调度；(B) 文件浏览域 — folders/documents CRUD + breadcrumb 派生。每个任务遵循 RED → GREEN 流程。

**技术栈：** Zustand + TypeScript + alova (alovaInstance) + Vitest

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/feature-spec.md](./specs/feature-spec.md) | [specs/behavior-spec.md](./specs/behavior-spec.md)
**PRD 引用：** [docs/prd/v3-frontend-migration.md](../../prd/v3-frontend-migration.md) §5.2 + §5.6

---

## PRD 一致性声明

| PRD 目标 | Plan 覆盖情况 | 说明 |
|----------|--------------|------|
| Pinia file.ts → Zustand file store | ✅ 已覆盖 | 任务 1-7 全部迁移，类型+上传队列+文件浏览 |
| 文件上传状态管理（含并发控制） | ✅ 已覆盖 | 任务 2-4: UploadTask 状态机 + maxConcurrent=3 |
| 为 f-46 文件上传 UI 提供数据层 | ✅ 已覆盖 | 任务 2-4 导出 addTask/updateProgress/markComplete/markFailed/processQueue |
| 为 f-47 KB CRUD 提供数据层 | ✅ 已覆盖 | 任务 5-7 导出 loadItems + 文档/文件夹 CRUD actions |

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | 前端状态管理改用 Zustand | ✅ 符合 | Pinia → Zustand 迁移，PRD §2.2 已批准 |
| ADR 0001 | 响应统一包装 `{ data: T }` | ✅ 符合 | alovaInstance responded.onSuccess 已解包，store 接收到的即原始数据 |
| ADR 0001 | 验证统一为 Zod | ⬚ 豁免 | Store 层不涉及 API 入参校验，Zod schema 由 packages/data/ 与 NestJS 端负责 |

---

## 任务列表

### 任务 1: 类型定义与 Store 骨架

**文件：**
- 创建：`packages/web/src/stores/file.ts`

**规格引用：**
- feature-spec §数据模型: `UploadTask` / `Folder` / `DocumentItem` / `FileState`
- behavior-spec §上传任务状态机

- [ ] **步骤 1: 编写失败测试**

```typescript
// packages/web/tests/file-store.spec.ts
import { describe, it, expect } from 'vitest'

describe('FileStore — 类型定义与 Store 骨架', () => {
  it('AC-01: store 可以被创建并导出 useFileStore', async () => {
    const { useFileStore } = await import('@/stores/file')
    expect(useFileStore).toBeDefined()
    expect(typeof useFileStore).toBe('function')
  })

  it('AC-01: 初始状态符合 FileState 定义', () => {
    const { useFileStore } = await import('@/stores/file')
    const state = useFileStore.getState()
    expect(state.uploadTasks).toEqual([])
    expect(state.maxConcurrent).toBe(3)
    expect(state.folders).toEqual([])
    expect(state.documents).toEqual([])
    expect(state.currentKbId).toBeNull()
    expect(state.currentFolderId).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```
预期：FAIL — 模块不存在或导出未定义

- [ ] **步骤 3: 实现类型定义与 Store 骨架**

```typescript
// packages/web/src/stores/file.ts
import { create } from 'zustand'

// ============ 类型定义 ============

export interface UploadTask {
  id: string
  fileName: string
  fileSize: number
  progress: number        // 0-100
  status: 'queued' | 'uploading' | 'completed' | 'failed'
  error?: string
  kbId: string
  folderId?: string | null
}

export interface Folder {
  id: string
  kbId: string
  parentId: string | null
  name: string
  createdAt: string
  updatedAt: string
}

export interface DocumentItem {
  id: string
  kbId: string
  folderId: string | null
  name: string
  ext: string | null
  mimeType: string | null
  size: number | null
  status: 'uploaded' | 'parsing' | 'chunking' | 'indexing' | 'ready' | 'failed'
  createdAt: string
  updatedAt: string
}

export interface FileState {
  // 上传队列
  uploadTasks: UploadTask[]
  maxConcurrent: number

  // 文件浏览
  folders: Folder[]
  documents: DocumentItem[]
  currentKbId: string | null
  currentFolderId: string | null
  isLoading: boolean
  error: string | null

  // 派生
  breadcrumb: () => Folder[]
  activeUploadCount: () => number

  // 上传队列 Actions
  addTask: (task: Omit<UploadTask, 'id' | 'progress' | 'status'>) => string
  updateProgress: (taskId: string, progress: number) => void
  markComplete: (taskId: string) => void
  markFailed: (taskId: string, error: string) => void
  removeTask: (taskId: string) => void
  clearCompleted: () => void
  processQueue: () => void

  // 文件浏览 Actions
  loadItems: (kbId: string, folderId?: string | null) => Promise<void>
  deleteDocument: (docId: string) => Promise<void>
  renameDocument: (docId: string, name: string) => Promise<void>
  moveDocument: (docId: string, targetFolderId: string | null) => Promise<void>
  createFolder: (kbId: string, name: string, parentId?: string | null) => Promise<Folder>
  renameFolder: (kbId: string, folderId: string, name: string) => Promise<Folder>
  deleteFolder: (kbId: string, folderId: string) => Promise<void>
  clearError: () => void
  resetFileBrowse: () => void
}

export const useFileStore = create<FileState>((set, get) => ({
  // 初始状态
  uploadTasks: [],
  maxConcurrent: 3,
  folders: [],
  documents: [],
  currentKbId: null,
  currentFolderId: null,
  isLoading: false,
  error: null,

  // 派生 — 使用 get() 读取当前状态
  breadcrumb: () => {
    const { folders, currentFolderId } = get()
    const path: Folder[] = []
    let fid = currentFolderId
    while (fid) {
      const f = folders.find((x) => x.id === fid)
      if (!f) break
      path.unshift(f)
      fid = f.parentId
    }
    return path
  },

  activeUploadCount: () => {
    return get().uploadTasks.filter((t) => t.status === 'uploading').length
  },

  // Actions — 占位，后续任务逐一实现
  addTask: () => { throw new Error('not implemented') },
  updateProgress: () => {},
  markComplete: () => {},
  markFailed: () => {},
  removeTask: () => {},
  clearCompleted: () => {},
  processQueue: () => {},
  loadItems: async () => {},
  deleteDocument: async () => {},
  renameDocument: async () => {},
  moveDocument: async () => {},
  createFolder: async () => { throw new Error('not implemented') },
  renameFolder: async () => { throw new Error('not implemented') },
  deleteFolder: async () => {},
  clearError: () => set({ error: null }),
  resetFileBrowse: () => set({
    folders: [],
    documents: [],
    currentKbId: null,
    currentFolderId: null,
    isLoading: false,
    error: null,
  }),
}))
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```

- [ ] **步骤 5: 类型检查**

```bash
pnpm type-check
```

[CHECKPOINT] ✅ 任务 1 完成 — Store 骨架 + 类型定义就绪

---

### 任务 2: 上传队列基础操作 (addTask / updateProgress / markComplete / markFailed)

**文件：**
- 修改：`packages/web/src/stores/file.ts`

**规格引用：**
- feature-spec §API 契约 — 上传队列操作
- behavior-spec §交互状态表 — 上传队列操作
- issue.md §验收标准 AC-02, AC-03

- [ ] **步骤 1: 编写失败测试**

扩展 `packages/web/tests/file-store.spec.ts`，新增：
```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('FileStore — 上传队列操作', () => {
  beforeEach(() => {
    useFileStore.setState({
      uploadTasks: [],
      maxConcurrent: 3,
    })
  })

  it('AC-02: addTask 添加任务到队列，状态为 queued，返回 taskId', () => {
    const taskId = useFileStore.getState().addTask({
      fileName: 'doc.pdf',
      fileSize: 1024,
      kbId: 'kb-1',
    })
    expect(typeof taskId).toBe('string')
    expect(taskId.length).toBeGreaterThan(0)

    const tasks = useFileStore.getState().uploadTasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe(taskId)
    expect(tasks[0].fileName).toBe('doc.pdf')
    expect(tasks[0].status).toBe('queued')
    expect(tasks[0].progress).toBe(0)
  })

  it('AC-03: updateProgress 更新任务进度 (仅 uploading 状态有效)', () => {
    const taskId = useFileStore.getState().addTask({
      fileName: 'doc.pdf',
      fileSize: 1024,
      kbId: 'kb-1',
    })
    // 手动设置状态为 uploading
    useFileStore.setState((s) => ({
      uploadTasks: s.uploadTasks.map((t) =>
        t.id === taskId ? { ...t, status: 'uploading' as const } : t
      ),
    }))
    useFileStore.getState().updateProgress(taskId, 50)
    const task = useFileStore.getState().uploadTasks.find((t) => t.id === taskId)
    expect(task?.progress).toBe(50)
  })

  it('AC-03: markComplete 标记任务完成，progress=100，自动触发 processQueue', () => {
    const taskId = useFileStore.getState().addTask({
      fileName: 'doc.pdf',
      fileSize: 1024,
      kbId: 'kb-1',
    })
    useFileStore.setState((s) => ({
      uploadTasks: s.uploadTasks.map((t) =>
        t.id === taskId ? { ...t, status: 'uploading' as const } : t
      ),
    }))
    useFileStore.getState().markComplete(taskId)
    const task = useFileStore.getState().uploadTasks.find((t) => t.id === taskId)
    expect(task?.status).toBe('completed')
    expect(task?.progress).toBe(100)
  })

  it('AC-03: markFailed 标记任务失败，记录错误信息，自动触发 processQueue', () => {
    const taskId = useFileStore.getState().addTask({
      fileName: 'doc.pdf',
      fileSize: 1024,
      kbId: 'kb-1',
    })
    useFileStore.setState((s) => ({
      uploadTasks: s.uploadTasks.map((t) =>
        t.id === taskId ? { ...t, status: 'uploading' as const } : t
      ),
    }))
    useFileStore.getState().markFailed(taskId, 'Network error')
    const task = useFileStore.getState().uploadTasks.find((t) => t.id === taskId)
    expect(task?.status).toBe('failed')
    expect(task?.error).toBe('Network error')
  })

  it('边界: updateProgress 对不存在的 taskId 静默忽略', () => {
    expect(() => useFileStore.getState().updateProgress('nonexistent', 50)).not.toThrow()
  })

  it('边界: markComplete 对不存在的 taskId 静默忽略', () => {
    expect(() => useFileStore.getState().markComplete('nonexistent')).not.toThrow()
  })

  it('边界: markFailed 对不存在的 taskId 静默忽略', () => {
    expect(() => useFileStore.getState().markFailed('nonexistent', 'err')).not.toThrow()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```
预期：新增测试 FAIL — `addTask` 抛出 "not implemented"

- [ ] **步骤 3: 实现上传队列 actions**

```typescript
addTask: (task) => {
  const id = crypto.randomUUID()
  set((s) => ({
    uploadTasks: [
      ...s.uploadTasks,
      {
        ...task,
        id,
        progress: 0,
        status: 'queued' as const,
      },
    ],
  }))
  // 自动尝试调度
  get().processQueue()
  return id
},

updateProgress: (taskId, progress) => {
  set((s) => ({
    uploadTasks: s.uploadTasks.map((t) =>
      t.id === taskId && t.status === 'uploading'
        ? { ...t, progress }
        : t
    ),
  }))
},

markComplete: (taskId) => {
  set((s) => ({
    uploadTasks: s.uploadTasks.map((t) =>
      t.id === taskId
        ? { ...t, status: 'completed' as const, progress: 100 }
        : t
    ),
  }))
  get().processQueue()
},

markFailed: (taskId, error) => {
  set((s) => ({
    uploadTasks: s.uploadTasks.map((t) =>
      t.id === taskId
        ? { ...t, status: 'failed' as const, error }
        : t
    ),
  }))
  get().processQueue()
},
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```

[CHECKPOINT] ✅ 任务 2 完成 — 上传队列基本操作就绪

---

### 任务 3: 并发控制 (processQueue + maxConcurrent + activeUploadCount)

**文件：**
- 修改：`packages/web/src/stores/file.ts`

**规格引用：**
- feature-spec §并发控制模型
- behavior-spec §并发控制 示例流程
- issue.md §验收标准 AC-04

- [ ] **步骤 1: 编写失败测试**

```typescript
describe('FileStore — 并发控制', () => {
  beforeEach(() => {
    useFileStore.setState({
      uploadTasks: [],
      maxConcurrent: 3,
    })
  })

  it('AC-04: processQueue 在槽位空闲时启动 queued 任务 → uploading', () => {
    useFileStore.getState().addTask({ fileName: 'a.txt', fileSize: 1, kbId: 'kb-1' })
    useFileStore.getState().addTask({ fileName: 'b.txt', fileSize: 2, kbId: 'kb-1' })
    const tasks = useFileStore.getState().uploadTasks
    expect(tasks.filter((t) => t.status === 'uploading')).toHaveLength(2)
  })

  it('AC-04: activeUploadCount 返回当前 uploading 数量', () => {
    useFileStore.getState().addTask({ fileName: 'a.txt', fileSize: 1, kbId: 'kb-1' })
    expect(useFileStore.getState().activeUploadCount()).toBe(1)
  })

  it('AC-04: 超过 maxConcurrent=3 的任务保持 queued', () => {
    for (let i = 0; i < 5; i++) {
      useFileStore.getState().addTask({ fileName: `f${i}.txt`, fileSize: i, kbId: 'kb-1' })
    }
    const tasks = useFileStore.getState().uploadTasks
    expect(tasks.filter((t) => t.status === 'uploading')).toHaveLength(3)
    expect(tasks.filter((t) => t.status === 'queued')).toHaveLength(2)
  })

  it('AC-04: 任务完成后自动调度下一个 queued 任务', () => {
    for (let i = 0; i < 4; i++) {
      useFileStore.getState().addTask({ fileName: `f${i}.txt`, fileSize: i, kbId: 'kb-1' })
    }
    // 前 3 个 uploading，第 4 个 queued
    const tasks = useFileStore.getState().uploadTasks
    const firstTaskId = tasks[0].id
    useFileStore.getState().markComplete(firstTaskId)

    const updated = useFileStore.getState().uploadTasks
    expect(updated.filter((t) => t.status === 'uploading')).toHaveLength(3)
  })

  it('边界: 并发数为 0 时所有任务保持 queued', () => {
    useFileStore.setState({ maxConcurrent: 0 })
    useFileStore.getState().addTask({ fileName: 'a.txt', fileSize: 1, kbId: 'kb-1' })
    const tasks = useFileStore.getState().uploadTasks
    expect(tasks[0].status).toBe('queued')
  })

  it('边界: 空队列 processQueue 无操作', () => {
    expect(() => useFileStore.getState().processQueue()).not.toThrow()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```
预期：并发控制测试 FAIL — processQueue 未实现

- [ ] **步骤 3: 实现 processQueue 并发调度**

```typescript
processQueue: () => {
  const { uploadTasks, maxConcurrent } = get()
  const active = uploadTasks.filter((t) => t.status === 'uploading').length

  if (active >= maxConcurrent) return

  // 找下一个 queued 任务
  const nextIndex = uploadTasks.findIndex((t) => t.status === 'queued')
  if (nextIndex === -1) return

  // 标记为 uploading（递归处理直到槽位满或无 queued 任务）
  set((s) => ({
    uploadTasks: s.uploadTasks.map((t, i) =>
      i === nextIndex ? { ...t, status: 'uploading' as const } : t
    ),
  }))

  // 递归检查是否还有空槽位
  get().processQueue()
},
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```

[CHECKPOINT] ✅ 任务 3 完成 — 并发控制就绪

---

### 任务 4: 队列清理 (removeTask / clearCompleted)

**文件：**
- 修改：`packages/web/src/stores/file.ts`

**规格引用：**
- feature-spec §API 契约: removeTask / clearCompleted
- behavior-spec §交互状态表 — removeTask / clearCompleted
- issue.md §验收标准 AC-05

- [ ] **步骤 1: 编写失败测试**

```typescript
describe('FileStore — 队列清理', () => {
  beforeEach(() => {
    useFileStore.setState({
      uploadTasks: [],
      maxConcurrent: 3,
    })
  })

  it('AC-05: removeTask 从队列移除指定任务', () => {
    const taskId = useFileStore.getState().addTask({ fileName: 'a.txt', fileSize: 1, kbId: 'kb-1' })
    expect(useFileStore.getState().uploadTasks).toHaveLength(1)

    useFileStore.getState().removeTask(taskId)
    expect(useFileStore.getState().uploadTasks).toHaveLength(0)
  })

  it('AC-05: removeTask 对不存在的 taskId 静默忽略', () => {
    useFileStore.getState().addTask({ fileName: 'a.txt', fileSize: 1, kbId: 'kb-1' })
    expect(() => useFileStore.getState().removeTask('nonexistent')).not.toThrow()
    expect(useFileStore.getState().uploadTasks).toHaveLength(1)
  })

  it('AC-05: clearCompleted 清除所有 completed 和 failed 任务', () => {
    // 添加 3 个任务并设置为不同状态
    const t1 = useFileStore.getState().addTask({ fileName: 'a.txt', fileSize: 1, kbId: 'kb-1' })
    const t2 = useFileStore.getState().addTask({ fileName: 'b.txt', fileSize: 2, kbId: 'kb-1' })
    const t3 = useFileStore.getState().addTask({ fileName: 'c.txt', fileSize: 3, kbId: 'kb-1' })

    // 模拟状态：t1=completed, t2=failed, t3=uploading
    useFileStore.setState((s) => ({
      uploadTasks: s.uploadTasks.map((t) => {
        if (t.id === t1) return { ...t, status: 'completed' as const, progress: 100 }
        if (t.id === t2) return { ...t, status: 'failed' as const, error: 'err' }
        return { ...t, status: 'uploading' as const }
      }),
    }))

    useFileStore.getState().clearCompleted()
    const remaining = useFileStore.getState().uploadTasks
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(t3)
    expect(remaining[0].status).toBe('uploading')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```
预期：清理测试 FAIL — removeTask / clearCompleted 未实现

- [ ] **步骤 3: 实现队列清理 actions**

```typescript
removeTask: (taskId) => {
  set((s) => ({
    uploadTasks: s.uploadTasks.filter((t) => t.id !== taskId),
  }))
},

clearCompleted: () => {
  set((s) => ({
    uploadTasks: s.uploadTasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'failed'
    ),
  }))
},
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```

[CHECKPOINT] ✅ 任务 4 完成 — 队列清理就绪

---

### 任务 5: 文件浏览加载 (loadItems)

**文件：**
- 修改：`packages/web/src/stores/file.ts`

**规格引用：**
- feature-spec §API 契约: loadItems
- behavior-spec §交互状态表 — 文件浏览操作
- issue.md §验收标准 AC-06

**依赖说明：** loadItems 需要调用后端 API 获取 folders 和 documents。本 store 使用 `alovaInstance`（来自 `@/utils/server`）直接发起 HTTP 请求，与旧 Pinia store 的 API 调用模式一致。后续 f-47 可抽取为 `api/kb.ts` 中的独立方法。

- [ ] **步骤 1: 编写失败测试**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock alovaInstance
vi.mock('@/utils/server', () => ({
  alovaInstance: {
    Get: vi.fn(),
  },
}))

describe('FileStore — 文件浏览加载', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useFileStore.setState({
      folders: [],
      documents: [],
      currentKbId: null,
      currentFolderId: null,
      isLoading: false,
      error: null,
    })
  })

  it('AC-06: loadItems 设置 isLoading=true，成功后填充 folders 和 documents', async () => {
    const { alovaInstance } = await import('@/utils/server')
    const mockGet = alovaInstance.Get as ReturnType<typeof vi.fn>

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/folders')) {
        return Promise.resolve([
          { id: 'f1', kbId: 'kb-1', parentId: null, name: 'Docs', createdAt: '', updatedAt: '' },
        ])
      }
      if (url.includes('/documents')) {
        return Promise.resolve([
          { id: 'd1', kbId: 'kb-1', folderId: null, name: 'readme.md', ext: '.md', mimeType: 'text/markdown', size: 100, status: 'ready', createdAt: '', updatedAt: '' },
        ])
      }
    })

    await useFileStore.getState().loadItems('kb-1')

    const state = useFileStore.getState()
    expect(state.currentKbId).toBe('kb-1')
    expect(state.currentFolderId).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.folders).toHaveLength(1)
    expect(state.folders[0].name).toBe('Docs')
    expect(state.documents).toHaveLength(1)
    expect(state.documents[0].name).toBe('readme.md')
  })

  it('AC-06: loadItems 失败时设置 error', async () => {
    const { alovaInstance } = await import('@/utils/server')
    const mockGet = alovaInstance.Get as ReturnType<typeof vi.fn>
    mockGet.mockRejectedValue(new Error('Network error'))

    await useFileStore.getState().loadItems('kb-1')

    const state = useFileStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe('Network error')
  })

  it('边界: loadItems 空目录 — folders 和 documents 为 []', async () => {
    const { alovaInstance } = await import('@/utils/server')
    const mockGet = alovaInstance.Get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue([])

    await useFileStore.getState().loadItems('kb-1')

    const state = useFileStore.getState()
    expect(state.folders).toEqual([])
    expect(state.documents).toEqual([])
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```
预期：loadItems 测试 FAIL — 当前为空实现

- [ ] **步骤 3: 实现 loadItems**

```typescript
import { alovaInstance } from '@/utils/server'

// 在 create() 中：
loadItems: async (kbId, folderId) => {
  set({ isLoading: true, error: null, currentKbId: kbId, currentFolderId: folderId ?? null })
  try {
    const [fRes, dRes] = await Promise.all([
      alovaInstance.Get<Folder[]>(`/knowledge-base/${kbId}/folders?parentId=${folderId ?? ''}`),
      alovaInstance.Get<DocumentItem[]>(`/knowledge-base/${kbId}/documents?folderId=${folderId ?? ''}`),
    ])
    set({ folders: (fRes as unknown as Folder[]) ?? [], documents: (dRes as unknown as DocumentItem[]) ?? [] })
  } catch (e) {
    set({ error: e instanceof Error ? e.message : '加载失败' })
  } finally {
    set({ isLoading: false })
  }
},
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```

[CHECKPOINT] ✅ 任务 5 完成 — 文件浏览加载就绪

---

### 任务 6: 文件浏览 CRUD (deleteDocument / renameDocument / moveDocument + breadcrumb)

**文件：**
- 修改：`packages/web/src/stores/file.ts`

**规格引用：**
- feature-spec §API 契约: deleteDocument / renameDocument / moveDocument / breadcrumb
- behavior-spec §面包屑计算 + §交互状态表 — 文件浏览操作
- issue.md §验收标准 AC-07, AC-09

- [ ] **步骤 1: 编写失败测试**

```typescript
describe('FileStore — 文档 CRUD + breadcrumb', () => {
  beforeEach(() => {
    useFileStore.setState({
      folders: [
        { id: 'f1', kbId: 'kb-1', parentId: null, name: 'Docs', createdAt: '', updatedAt: '' },
        { id: 'f2', kbId: 'kb-1', parentId: 'f1', name: 'Sub', createdAt: '', updatedAt: '' },
      ],
      documents: [
        { id: 'd1', kbId: 'kb-1', folderId: null, name: 'readme.md', ext: '.md', mimeType: 'text/markdown', size: 100, status: 'ready', createdAt: '', updatedAt: '' },
        { id: 'd2', kbId: 'kb-1', folderId: 'f1', name: 'notes.txt', ext: '.txt', mimeType: 'text/plain', size: 200, status: 'ready', createdAt: '', updatedAt: '' },
      ],
      currentKbId: 'kb-1',
      currentFolderId: null,
      isLoading: false,
      error: null,
    })
  })

  it('AC-07: deleteDocument 移除文档并保持 isLoading=false', async () => {
    // Mock alovaInstance.Delete
    const { alovaInstance: mockAlova } = await import('@/utils/server')
    const mockDel = mockAlova.Delete as ReturnType<typeof vi.fn>
    mockDel.mockResolvedValue(undefined)

    await useFileStore.getState().deleteDocument('d1')
    const state = useFileStore.getState()
    expect(state.documents).toHaveLength(1)
    expect(state.documents[0].id).toBe('d2')
  })

  it('AC-07: renameDocument 更新文档名称', async () => {
    const { alovaInstance: mockAlova } = await import('@/utils/server')
    const mockPatch = mockAlova.Patch as ReturnType<typeof vi.fn>
    mockPatch.mockResolvedValue({ id: 'd1', name: 'renamed.md' })

    await useFileStore.getState().renameDocument('d1', 'renamed.md')
    const state = useFileStore.getState()
    expect(state.documents[0].name).toBe('renamed.md')
  })

  it('AC-07: moveDocument 将文档从当前列表移除（移到其他文件夹）', async () => {
    const { alovaInstance: mockAlova } = await import('@/utils/server')
    const mockPatch = mockAlova.Patch as ReturnType<typeof vi.fn>
    mockPatch.mockResolvedValue(undefined)

    await useFileStore.getState().moveDocument('d1', 'f1')
    const state = useFileStore.getState()
    expect(state.documents).toHaveLength(1)
    expect(state.documents[0].id).toBe('d2')
  })

  it('边界: currentKbId 为空时 deleteDocument 静默 return', async () => {
    useFileStore.setState({ currentKbId: null })
    await expect(useFileStore.getState().deleteDocument('d1')).resolves.toBeUndefined()
    expect(useFileStore.getState().documents).toHaveLength(2) // 未变化
  })

  it('AC-09: breadcrumb 正确计算当前文件夹路径', () => {
    useFileStore.setState({ currentFolderId: 'f2' })
    const path = useFileStore.getState().breadcrumb()
    expect(path).toHaveLength(2)
    expect(path[0].id).toBe('f1') // parent
    expect(path[1].id).toBe('f2') // current
  })

  it('AC-09: 根目录 breadcrumb 返回空数组', () => {
    useFileStore.setState({ currentFolderId: null })
    const path = useFileStore.getState().breadcrumb()
    expect(path).toEqual([])
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```
预期：CRUD 测试 FAIL — deleteDocument 等未实现

- [ ] **步骤 3: 实现文档 CRUD actions**

```typescript
deleteDocument: async (docId) => {
  const kbId = get().currentKbId
  if (!kbId) return
  set({ isLoading: true, error: null })
  try {
    await alovaInstance.Delete(`/knowledge-base/${kbId}/documents/${docId}`)
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== docId),
    }))
  } catch (e) {
    set({ error: e instanceof Error ? e.message : '删除失败' })
  } finally {
    set({ isLoading: false })
  }
},

renameDocument: async (docId, name) => {
  const kbId = get().currentKbId
  if (!kbId) return
  set({ isLoading: true, error: null })
  try {
    const updated = await alovaInstance.Patch<DocumentItem>(
      `/knowledge-base/${kbId}/documents/${docId}`,
      { name }
    )
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === docId ? (updated as unknown as DocumentItem) : d
      ),
    }))
  } catch (e) {
    set({ error: e instanceof Error ? e.message : '重命名失败' })
  } finally {
    set({ isLoading: false })
  }
},

moveDocument: async (docId, targetFolderId) => {
  const kbId = get().currentKbId
  if (!kbId) return
  set({ isLoading: true, error: null })
  try {
    await alovaInstance.Patch(
      `/knowledge-base/${kbId}/documents/${docId}`,
      { folderId: targetFolderId }
    )
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== docId),
    }))
  } catch (e) {
    set({ error: e instanceof Error ? e.message : '移动失败' })
  } finally {
    set({ isLoading: false })
  }
},
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```

[CHECKPOINT] ✅ 任务 6 完成 — 文档 CRUD + breadcrumb 就绪

---

### 任务 7: 文件夹 CRUD + 边界条件 + 完整性验证

**文件：**
- 修改：`packages/web/src/stores/file.ts`

**规格引用：**
- feature-spec §API 契约: createFolder / renameFolder / deleteFolder
- behavior-spec §错误隔离 + §边界条件
- issue.md §验收标准 AC-08, AC-10

- [ ] **步骤 1: 编写失败测试**

```typescript
describe('FileStore — 文件夹 CRUD + 边界', () => {
  beforeEach(() => {
    useFileStore.setState({
      folders: [],
      documents: [],
      currentKbId: 'kb-1',
      currentFolderId: null,
      isLoading: false,
      error: null,
    })
  })

  it('AC-08: createFolder 创建文件夹并返回 Folder 对象', async () => {
    const { alovaInstance: mockAlova } = await import('@/utils/server')
    const mockPost = mockAlova.Post as ReturnType<typeof vi.fn>
    mockPost.mockResolvedValue({
      id: 'new-f1', kbId: 'kb-1', parentId: null, name: 'New Folder', createdAt: '', updatedAt: '',
    })

    const folder = await useFileStore.getState().createFolder('kb-1', 'New Folder')
    expect(folder.id).toBe('new-f1')
    expect(folder.name).toBe('New Folder')
  })

  it('AC-08: renameFolder 返回更新后的 Folder', async () => {
    const { alovaInstance: mockAlova } = await import('@/utils/server')
    const mockPatch = mockAlova.Patch as ReturnType<typeof vi.fn>
    mockPatch.mockResolvedValue({
      id: 'f1', kbId: 'kb-1', parentId: null, name: 'Renamed', createdAt: '', updatedAt: '',
    })

    const folder = await useFileStore.getState().renameFolder('kb-1', 'f1', 'Renamed')
    expect(folder.name).toBe('Renamed')
  })

  it('AC-08: deleteFolder 不返回值', async () => {
    const { alovaInstance: mockAlova } = await import('@/utils/server')
    const mockDel = mockAlova.Delete as ReturnType<typeof vi.fn>
    mockDel.mockResolvedValue(undefined)

    await expect(useFileStore.getState().deleteFolder('kb-1', 'f1')).resolves.toBeUndefined()
  })

  it('AC-10: 上传任务失败不影响其他任务（错误隔离）', () => {
    useFileStore.getState().addTask({ fileName: 'a.txt', fileSize: 1, kbId: 'kb-1' })
    useFileStore.getState().addTask({ fileName: 'b.txt', fileSize: 2, kbId: 'kb-1' })

    const tasks = useFileStore.getState().uploadTasks
    const taskA = tasks[0]
    const taskB = tasks[1]

    // 模拟 A 正在上传
    useFileStore.setState((s) => ({
      uploadTasks: s.uploadTasks.map((t) =>
        t.id === taskA.id ? { ...t, status: 'uploading' as const } : t
      ),
    }))

    useFileStore.getState().markFailed(taskA.id, 'Upload error')
    // B 应不受影响，保持 queued 状态
    const updated = useFileStore.getState().uploadTasks
    const taskBAfter = updated.find((t) => t.id === taskB.id)
    expect(taskBAfter?.status).toBe('queued')
  })

  it('AC-10: 文件浏览 error 不影响上传队列', async () => {
    useFileStore.getState().addTask({ fileName: 'a.txt', fileSize: 1, kbId: 'kb-1' })
    const { alovaInstance: mockAlova } = await import('@/utils/server')
    const mockGet = mockAlova.Get as ReturnType<typeof vi.fn>
    mockGet.mockRejectedValue(new Error('Browse error'))

    await useFileStore.getState().loadItems('kb-1')
    // loadItems 失败，但 uploadTasks 不变
    expect(useFileStore.getState().uploadTasks).toHaveLength(1)
    expect(useFileStore.getState().uploadTasks[0].status).toBe('uploading')
  })

  it('clearError 清除 error 状态', () => {
    useFileStore.setState({ error: 'some error' })
    useFileStore.getState().clearError()
    expect(useFileStore.getState().error).toBeNull()
  })

  it('resetFileBrowse 清空文件浏览状态并保留上传队列', () => {
    useFileStore.getState().addTask({ fileName: 'a.txt', fileSize: 1, kbId: 'kb-1' })
    useFileStore.setState({
      folders: [{ id: 'f1', kbId: 'kb-1', parentId: null, name: 'D', createdAt: '', updatedAt: '' }],
      documents: [{ id: 'd1', kbId: 'kb-1', folderId: null, name: 'f.txt', ext: '.txt', mimeType: null, size: 10, status: 'ready', createdAt: '', updatedAt: '' }],
      currentKbId: 'kb-1',
      currentFolderId: 'f1',
      error: 'some error',
    })

    useFileStore.getState().resetFileBrowse()
    const state = useFileStore.getState()
    expect(state.folders).toEqual([])
    expect(state.documents).toEqual([])
    expect(state.currentKbId).toBeNull()
    expect(state.currentFolderId).toBeNull()
    expect(state.error).toBeNull()
    // 上传队列不受影响
    expect(state.uploadTasks).toHaveLength(1)
  })

  it('边界: 同名文件允许添加（不做去重）', () => {
    useFileStore.getState().addTask({ fileName: 'a.txt', fileSize: 1, kbId: 'kb-1' })
    useFileStore.getState().addTask({ fileName: 'a.txt', fileSize: 1, kbId: 'kb-1' })
    expect(useFileStore.getState().uploadTasks).toHaveLength(2)
  })

  it('边界: 全部失败后 activeCount=0，无新任务启动', () => {
    useFileStore.getState().addTask({ fileName: 'a.txt', fileSize: 1, kbId: 'kb-1' })
    useFileStore.getState().addTask({ fileName: 'b.txt', fileSize: 2, kbId: 'kb-1' })

    const tasks = useFileStore.getState().uploadTasks
    // 全部标记为 uploading 然后全部失败
    useFileStore.setState((s) => ({
      uploadTasks: s.uploadTasks.map((t) => ({ ...t, status: 'uploading' as const })),
    }))
    tasks.forEach((t) => useFileStore.getState().markFailed(t.id, 'fail'))

    expect(useFileStore.getState().activeUploadCount()).toBe(0)
    const allFailed = useFileStore.getState().uploadTasks.every((t) => t.status === 'failed')
    expect(allFailed).toBe(true)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```
预期：文件夹 CRUD 测试 FAIL — createFolder / renameFolder / deleteFolder 未实现

- [ ] **步骤 3: 实现文件夹 CRUD actions + 补全所有边界逻辑**

```typescript
createFolder: async (kbId, name, parentId) => {
  const folder = await alovaInstance.Post<Folder>(
    `/knowledge-base/${kbId}/folders`,
    { name, parentId: parentId ?? null }
  )
  return folder as unknown as Folder
},

renameFolder: async (kbId, folderId, name) => {
  const folder = await alovaInstance.Patch<Folder>(
    `/knowledge-base/${kbId}/folders/${folderId}`,
    { name }
  )
  return folder as unknown as Folder
},

deleteFolder: async (kbId, folderId) => {
  await alovaInstance.Delete(`/knowledge-base/${kbId}/folders/${folderId}`)
},
```

- [ ] **步骤 4: 运行全部测试验证通过**

```bash
npx vitest run packages/web/tests/file-store.spec.ts
```

- [ ] **步骤 5: 类型检查最终验证**

```bash
pnpm type-check
```

[CHECKPOINT] ✅ 任务 7 完成 — 文件夹 CRUD + 边界条件 + 完整性验证通过

---

## 自检

### 规格覆盖
- [x] feature-spec §数据模型 (UploadTask/Folder/DocumentItem/FileState) → 任务 1
- [x] feature-spec §API 契约 — 上传队列操作 → 任务 2-4
- [x] feature-spec §并发控制模型 → 任务 3
- [x] feature-spec §API 契约 — 文件浏览操作 → 任务 5-7
- [x] behavior-spec §上传任务状态机 → 任务 2
- [x] behavior-spec §并发控制示例 → 任务 3
- [x] behavior-spec §面包屑计算 → 任务 6
- [x] behavior-spec §边界条件 (全部 10 条) → 任务 2/3/4/5/6/7 均有覆盖
- [x] behavior-spec §错误隔离 → 任务 7 (AC-10)

### 验收标准对照

| AC | 描述 | 对应任务 | 优先级 |
|----|------|---------|--------|
| AC-01 | 定义 UploadTask 类型 | 任务 1 | p0 |
| AC-02 | addTask 添加任务到队列 | 任务 2 | p0 |
| AC-03 | updateProgress/markComplete/markFailed 状态转换 | 任务 2 | p0 |
| AC-04 | maxConcurrent=3 并发控制 | 任务 3 | p0 |
| AC-05 | removeTask/clearCompleted 队列清理 | 任务 4 | p0 |
| AC-06 | loadItems 加载 folders+documents | 任务 5 | p1 |
| AC-07 | deleteDocument/renameDocument/moveDocument | 任务 6 | p1 |
| AC-08 | createFolder/renameFolder/deleteFolder | 任务 7 | p1 |
| AC-09 | breadcrumb 面包屑计算 | 任务 6 | p1 |
| AC-10 | 并发控制边界 + 错误隔离 | 任务 7 | p0 |

### 占位符扫描
- 无 TODO/TBD/稍后实现
- 所有步骤有具体代码或命令
- story-ignore 文件中没有未经处理的条目

### PRD 偏差
- 无偏差 — 严格按 PRD §5.2 + §5.6 迁移 Pinia file.ts → Zustand
- 旧 Pinia store (`packages/webui/src/stores/file.ts`) 全部功能已映射到新 Zustand store
- 新增功能（上传队列 + 并发控制）为 PRD §5.6 验收标准明确要求

### 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/web/src/stores/file.ts` | 创建 | Zustand file store（含类型定义 + 全部 actions） |
| `packages/web/tests/file-store.spec.ts` | 创建 | 单元测试（覆盖 7 个任务全部测试用例） |
