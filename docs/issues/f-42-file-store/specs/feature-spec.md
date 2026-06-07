---
issue: f-42
type: feature-spec
status: draft
---

# f-42 File Store 功能规格

## 用户故事

**作为** 前端开发者
**我需要** 一个管理文件上传队列和文件浏览状态的 Zustand store
**以便** KB 文件上传 UI 能追踪上传进度、控制并发、浏览文件列表

## 功能边界

### 包含

- 上传队列管理：`UploadTask` 类型、进度追踪、状态转换
- 并发控制：`maxConcurrent: 3`，自动调度队列
- 文件浏览状态：`folders` / `documents` / `currentKbId` / `currentFolderId`
- 文件夹/文档 CRUD actions
- `breadcrumb` 面包屑计算

### 不包括

- 上传 UI 组件（f-46 负责）
- 后端文件处理逻辑
- 拖拽交互实现

## 数据模型

```typescript
// 上传任务
interface UploadTask {
  id: string              // 唯一标识 (uuid)
  fileName: string        // 文件名
  fileSize: number        // 文件大小 (bytes)
  progress: number        // 0-100
  status: 'queued' | 'uploading' | 'completed' | 'failed'
  error?: string          // 失败原因
  kbId: string            // 目标知识库 ID
  folderId?: string | null // 目标文件夹 ID
}

// 文件夹（与旧 Vue store 兼容）
interface Folder {
  id: string
  kbId: string
  parentId: string | null
  name: string
  createdAt: string
  updatedAt: string
}

// 文档项（与旧 Vue store 兼容）
interface DocumentItem {
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

// Store 状态
interface FileState {
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
  processQueue: () => void  // 内部方法：调度队列

  // 文件浏览 Actions
  loadItems: (kbId: string, folderId?: string | null) => Promise<void>
  deleteDocument: (docId: string) => Promise<void>
  renameDocument: (docId: string, name: string) => Promise<void>
  moveDocument: (docId: string, targetFolderId: string | null) => Promise<void>
  createFolder: (kbId: string, name: string, parentId?: string | null) => Promise<Folder>
  renameFolder: (kbId: string, folderId: string, name: string) => Promise<Folder>
  deleteFolder: (kbId: string, folderId: string) => Promise<void>
  clearError: () => void
  resetFileBrowse: () => void  // 切换 KB 时重置浏览状态
}
```

## API 契约

### 上传队列操作

| 方法 | 签名 | 说明 |
|------|------|------|
| `addTask` | `(task) => string` | 添加上传任务到队列，返回 taskId |
| `updateProgress` | `(taskId, progress)` | 更新任务进度 (0-100) |
| `markComplete` | `(taskId)` | 标记任务完成，status='completed' |
| `markFailed` | `(taskId, error)` | 标记任务失败，记录错误信息 |
| `removeTask` | `(taskId)` | 从队列移除任务 |
| `clearCompleted` | `()` | 清除所有已完成/失败的任务 |
| `processQueue` | `()` | 检查并发槽位，启动等待中的任务 |

### 并发控制模型

```
maxConcurrent = 3
activeUploadCount() = uploadTasks.filter(t => t.status === 'uploading').length

processQueue():
  while activeUploadCount() < maxConcurrent:
    nextTask = uploadTasks.find(t => t.status === 'queued')
    if !nextTask → break
    markTaskAsUploading(nextTask.id)
    // 实际上传由调用方（f-46）通过 api/kb.ts 执行，store 只管理状态
```

## 验收标准映射

| AC | 描述 | 优先级 |
|----|------|--------|
| AC-01 | 定义 `UploadTask` 类型（id/fileName/progress/status/error/kbId） | p0 |
| AC-02 | 实现 `addTask` 添加任务到队列，返回唯一 taskId | p0 |
| AC-03 | 实现 `updateProgress` / `markComplete` / `markFailed` 状态转换 | p0 |
| AC-04 | 实现 `maxConcurrent: 3` 并发控制（`activeUploadCount` + `processQueue`） | p0 |
| AC-05 | 实现 `removeTask` / `clearCompleted` 队列清理 | p0 |
| AC-06 | 实现 `loadItems` 加载 folders + documents | p1 |
| AC-07 | 实现 `deleteDocument` / `renameDocument` / `moveDocument` | p1 |
| AC-08 | 实现 `createFolder` / `renameFolder` / `deleteFolder` | p1 |
| AC-09 | 实现 `breadcrumb` 从 folders 和 currentFolderId 计算路径 | p1 |
| AC-10 | 并发控制边界：队列空、全部失败、部分成功场景 | p0 |
