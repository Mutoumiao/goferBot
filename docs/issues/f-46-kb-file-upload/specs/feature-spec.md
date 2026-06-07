---
issue: f-46
type: feature-spec
status: draft
---

# f-46 KB 文件上传 功能规格

## 用户故事

**作为** GoferBot 用户
**我需要** 在知识库（KB）页面中通过拖拽或点击上传文件、查看文件列表、按目录层级导航
**以便** 我能高效地将文档导入知识库，为后续 RAG 问答提供素材

## 功能边界

### 包含

- **UploadDropZone** 组件：拖拽区域 + 点击选择文件，支持多文件同时选择
- **FileManager** 组件：文件/文件夹列表容器，支持排序、筛选、视图切换
- **FileGridItem** 组件：单个文件卡片，展示缩略图/图标、文件名、大小、日期
- **BreadcrumbNav** 组件：目录层级导航，支持点击跳转到任意层级
- **UploadProgressBar** 组件：上传进度条，对接 file store 的 `UploadTask.progress`
- 上传失败错误提示 + 单文件重试按钮
- 空目录状态（尚无文件/文件夹时的引导提示）
- loading 状态（加载文件列表时的骨架屏/加载指示器）

### 不包括

- KB 的创建/编辑/删除（由 f-47 负责）
- 文件/文件夹的删除/重命名/移动（由 f-47 负责；f-46 只做展示和上传）
- file store 本身（由 f-42 负责，f-46 消费其状态和 actions）
- 后端文件处理、解析、chunking、索引（后端职责）
- KB 选择器 / 跨 KB 浏览（f-47）
- 文件夹创建（f-47）

## 涉及页面/组件

| 组件 | 路径 | 类型 | 说明 |
|------|------|------|------|
| `KbListPage` | `packages/web/src/routes/app/kb.tsx` | 页面 | 已有骨架，本次升级为完整文档管理页 |
| `UploadDropZone` | `packages/web/src/components/kb/UploadDropZone.tsx` | 新建 | 拖拽上传区域 |
| `FileManager` | `packages/web/src/components/kb/FileManager.tsx` | 新建 | 文件列表容器 |
| `FileGridItem` | `packages/web/src/components/kb/FileGridItem.tsx` | 新建 | 文件卡片 |
| `FileListItem` | `packages/web/src/components/kb/FileListItem.tsx` | 新建 | 文件列表行（列表视图时使用） |
| `BreadcrumbNav` | `packages/web/src/components/kb/BreadcrumbNav.tsx` | 新建 | 目录导航 |
| `UploadProgressBar` | `packages/web/src/components/kb/UploadProgressBar.tsx` | 新建 | 上传进度条 |

## 相关功能

| 功能 | 关系 | 说明 |
|------|------|------|
| f-42 file store | **上游/阻塞** | 提供 `uploadTasks`、`folders`、`documents`、`breadcrumb`、`loadItems`、上传队列 actions；f-46 是纯粹的消费者 |
| f-33 auth | **上游** | 提供 JWT token，`api/kb.ts` 通过 alova 实例自动注入 |
| f-47 KB CRUD | **下游** | f-46 提供的文件列表视图和导航是 f-47 中 CRUD 操作的基础 |

## 数据模型（消费自 f-42 file store）

f-46 消费 f-42 store 的以下接口：

```typescript
// 来自 file store 的选择器（f-46 只读消费）
interface FileStoreForUI {
  // 上传队列
  uploadTasks: UploadTask[]
  activeUploadCount: number

  // 文件浏览
  folders: Folder[]
  documents: DocumentItem[]
  currentKbId: string | null
  currentFolderId: string | null
  isLoading: boolean
  error: string | null

  // 面包屑
  breadcrumb: Folder[]

  // Actions（f-46 调用）
  addTask: (task: Omit<UploadTask, 'id' | 'progress' | 'status'>) => string
  removeTask: (taskId: string) => void
  clearCompleted: () => void
  loadItems: (kbId: string, folderId?: string | null) => Promise<void>
  clearError: () => void
}
```

> 注：`UploadTask`、`Folder`、`DocumentItem` 等类型定义参见 f-42 feature-spec。f-46 不定义新类型，直接引用 f-42 的类型。

## 组件树

```
/app/kb (KbListPage)
├── BreadcrumbNav          # 目录导航 ["KB名称" > "父文件夹" > "当前文件夹"]
├── UploadDropZone         # 拖拽上传区域
├── UploadProgressBar      # 全局上传进度条（显示活跃任务数和总进度）
├── FileManager            # 文件列表容器
│   ├── 工具栏              # 排序/筛选/视图切换（列表/网格）
│   ├── FileGridItem[]     # 网格视图：文件卡片
│   │   ├── 缩略图/图标
│   │   ├── 文件名
│   │   └── 文件大小 + 日期
│   ├── FileListItem[]     # 列表视图：文件行
│   └── 空状态 / loading 态
└── 上传错误提示区（内联 Error Banner）  # 上传失败提示 + 重试按钮
```

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 Zustand store（f-42）管理上传状态，组件只做 UI 渲染 | 与项目架构一致：Zustand 管理客户端状态，组件纯展示+事件派发 | 否 |
| UploadDropZone 直接读取 file store 的 `addTask`，组件本身不管理文件队列 | 避免组件层和 store 层状态重复，简化数据流 | 否 |
| 上传错误提示使用内联 Error Banner 而非 Toast | 上传错误需要重试按钮，Toast 的短暂显示不适合需要用户操作的错误 | 是（可改为 Toast 但需重新设计重试交互） |
| BreadcrumbNav 使用 file store 的 `breadcrumb` computed 值 | 与 f-42 的契约一致，面包屑由 store 从 folders+currentFolderId 计算 | 否 |
| FileManager 的 `loadItems` 由页面级 `useEffect` 触发，传入 kbId 和 folderId | 与 React 数据获取模式一致，页面负责协调数据加载时机 | 否 |
| 缩略图使用文件扩展名映射的图标（lucide-react），不做真实缩略图生成 | 真实缩略图需要后端支持，超出本 issue 范围；后续可扩展 | 是 |
| 文件上传通过 `api/kb.ts` 的 `uploadFile` 方法，FormData 格式 | 后端已定义此接口，保持契约一致 | 否 |

## 验收标准映射

| AC | 描述 | 来源 | 优先级 |
|----|------|------|--------|
| AC-01 | UploadDropZone 支持拖拽文件 + 点击选择文件（多文件） | issue | P0 |
| AC-02 | FileManager 渲染文件/文件夹列表，支持排序和筛选 | issue | P0 |
| AC-03 | FileGridItem 展示缩略图/图标、文件名、大小、日期 | issue | P0 |
| AC-04 | BreadcrumbNav 展示目录层级，支持点击导航 | issue | P1 |
| AC-05 | UploadProgressBar 对接 file store progress 状态 | issue | P0 |
| AC-06 | 上传失败显示错误提示 + 重试按钮 | issue | P0 |
| AC-07 | 空目录状态 + loading 状态 | issue | P1 |
| AC-08 | 进入文件夹时 BreadcrumbNav 更新，FileManager 重新加载 | 隐式 | P1 |
| AC-09 | 多文件并发上传时进度条聚合显示 | 隐式 | P1 |
