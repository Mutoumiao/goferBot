---
issue: f-46
type: behavior-spec
status: draft
---

# f-46 KB 文件上传 行为规格

## 入口

- **路由**：`/app/kb`
- **触发**：用户点击侧边栏"知识库"标签，或直接导航到 `/app/kb`
- **前置条件**：用户已登录（JWT token 有效），`api/kb.ts` 通过 alova 实例自动注入 token

## 初始状态

用户进入 KB 页面时：
1. 页面触发 `useEffect`，调用 `fileStore.loadItems(kbId)`（kbId 来自当前选中的 KB，若有多 KB 则通过 kb store 获取）
2. 在 `loadItems` 完成前，FileManager 显示 loading 状态（骨架屏）
3. BreadcrumbNav 显示 KB 名称作为根路径（`[KB名称]`）

## 组件职责定义

| 组件 | 职责 | 不负责 |
|------|------|--------|
| **KbListPage** | 编排数据加载、协调子组件通信 | 不处理具体文件操作逻辑 |
| **UploadDropZone** | 处理拖拽/点击事件、提取文件列表、调用 `fileStore.addTask`、调用 `api/kb.uploadFile` 执行实际上传 | 不管理上传队列调度（由 file store 的 `processQueue` 负责） |
| **UploadProgressBar** | 订阅 `uploadTasks` 状态、渲染聚合进度条和任务列表 | 不执行上传 |
| **FileManager** | 渲染文件列表、响应排序/筛选/视图切换 | 不执行数据加载（由页面触发 `loadItems`） |
| **FileGridItem** | 渲染单个文件卡片的视觉 | 不处理点击后的导航逻辑（由 FileManager 回调上层） |
| **FileListItem** | 渲染单个文件行（列表视图） | 同上 |
| **BreadcrumbNav** | 渲染层级路径、响应点击导航 | 不计算面包屑路径（由 file store 的 `breadcrumb` 提供） |

## 交互状态

### 文件列表区域（FileManager）

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| **loading** | 骨架屏（skeleton cards）：4-6 个灰色占位卡片，带脉冲动画 | 拖拽区域仍可交互，上传操作不阻塞文件列表加载 | `fileStore.loadItems` 完成后状态切换 |
| **empty** | 居中的空状态插画 + 提示文案"暂无文件，拖拽文件到此处或点击上传" | 拖拽文件/点击"选择文件"按钮 | 触发 `addTask` + `uploadFile`，上传完成后 `loadItems` 刷新列表 |
| **error** | FileManager 区域内显示 Error Banner：错误信息 + "重试"按钮 | 点击"重试" → 重新调用 `loadItems`；拖拽上传仍可用 | 调用 `fileStore.clearError()` + `loadItems(kbId, folderId)` |
| **success** | 正常渲染文件/文件夹网格或列表 | 点击文件夹 → 进入该文件夹；点击文件 → 下载/预览（f-47）；排序/筛选/切换视图 | 点击文件夹 → `loadItems(kbId, folderId)`（BreadcrumbNav 同步更新） |
| **partial**（上传中） | 文件列表正常显示 + 顶部 UploadProgressBar 显示正在上传的任务 | 可继续添加新上传、浏览文件列表、进入文件夹 | 上传任务在后台队列中并发执行（最多 3 个），互不阻塞 |

### 上传区域（UploadDropZone）

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| **idle** | 虚线边框区域，中间图标 + "拖拽文件到此处，或点击选择" | 拖拽文件进入 / 点击区域 | — |
| **dragOver** | 边框高亮（主色）、背景色变化、图标放大 | 释放鼠标 | 提取 FileList，对每个文件调用 `fileStore.addTask`，然后执行 `uploadFile` |
| **uploading** | 区域内显示当前正在上传的文件名和单文件进度 | 拖拽更多文件（继续添加）、点击取消 | 新文件追加到队列末尾 |
| **error** | 上传失败的文件在 UploadProgressBar 中高亮显示，带重试按钮 | 点击"重试"（单个）/ "全部重试" | 重新调用 `addTask` + `uploadFile` 对该文件 |

> **文件类型白名单常量**（客户端预过滤）：

> ```typescript
> const ALLOWED_EXTENSIONS = ['.md', '.txt', '.pdf']
> const ALLOWED_MIME_TYPES = ['text/markdown', 'text/plain', 'application/pdf']
> ```

### 面包屑导航（BreadcrumbNav）


| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| **根目录** | `🏠 KB名称` | 无（已在根） | — |
| **子目录** | `🏠 KB名称 > 文件夹A > 文件夹B` | 点击任意层级 | 调用 `loadItems(kbId, 对应folderId)`，FileManager 切换为该目录内容 |
| **loading 切换** | 点击层级后，FileManager 显示 loading，面包屑保持当前显示 | — | `loadItems` 完成后面包屑更新 |

## 正常流程

### 流程 1：拖拽上传文件

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 在文件管理器中选中文件，拖拽到 KB 页面上方 | 客户端检查扩展名/MIME 类型 | 不在白名单 → 拒绝并提示"不支持的文件类型"；在白名单 → 继续 |
| 2 | 释放鼠标（通过类型检查后） | `dragEnter` 事件触发 | UploadDropZone 边框高亮、背景变色 |
| 3 | 释放鼠标 | 提取 FileList，对每个文件调用 `fileStore.addTask({fileName, fileSize, kbId})`，然后执行 `api/kb.uploadFile(kbId, formData)` | UploadProgressBar 出现，显示"正在上传 3 个文件" |
| 4 | — | 文件逐一上传完成，`fileStore.markComplete(taskId)` 被调用 | UploadProgressBar 进度条递增 |
| 5 | 全部上传完成 | `fileStore.clearCompleted()` 延迟 3s 自动清除已完成任务，`loadItems` 刷新 | UploadProgressBar 消失，新文件出现在 FileManager 列表中 |

### 流程 2：点击选择文件上传

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击 UploadDropZone 区域 | 触发隐藏的 `<input type="file" multiple>` 点击 | 系统文件选择对话框弹出 |
| 2 | 在对话框中选择 N 个文件，点击"打开" | 客户端检查扩展名/MIME 类型 | 不在白名单 → 拒绝并提示"不支持的文件类型"；在白名单 → 继续 |
| 3 | — | `onChange` 事件触发，后续流程与拖拽流程步骤 3-5 相同 | 同拖拽流程 |

### 流程 3：浏览文件夹

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 看到 FileManager 中的文件夹卡片 | — | FileGridItem 显示文件夹图标 + 文件夹名 |
| 2 | 点击文件夹卡片 | `loadItems(kbId, folderId)` 被调用 | FileManager 切换为 loading 骨架屏 |
| 3 | — | 加载完成 | FileManager 显示该文件夹内文件，BreadcrumbNav 添加当前文件夹层级 |
| 4 | 点击 BreadcrumbNav 中的"KB名称" | `loadItems(kbId, null)` 回到根目录 | FileManager 显示根目录内容，BreadcrumbNav 重置为根 |

### 流程 4：排序、筛选与视图切换

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击 FileManager 工具栏中的排序下拉框 | 展开排序选项：按名称/日期/大小/类型，升序/降序 | 下拉菜单展开 |
| 2 | 选择"按日期降序" | 客户端对 `documents` 数组排序 | 文件列表重新排列 |
| 3 | 点击筛选下拉框/按钮组，选择筛选类型（全部/文档/图片/其他） | 客户端对 `documents` 按文件类型过滤 | 文件列表仅显示选中类型的文件，筛选按钮组高亮当前选中 |
| 4 | 点击视图切换按钮（网格 ↔ 列表） | `FileGridItem[]` ↔ `FileListItem[]` 切换 | 视图切换 |

## 错误场景

| 场景 | 触发条件 | 视觉表现 | 恢复路径 |
|------|----------|----------|----------|
| **文件列表加载失败** | `loadItems` API 返回非 2xx / 网络异常 | FileManager 区域显示 Error Banner：`"加载文件列表失败：{错误信息}"` + "重试"按钮 | 用户点击"重试" → 重新调用 `loadItems` |
| **上传网络错误** | `uploadFile` 因网络中断失败 | UploadProgressBar 中该任务状态变为红色 `✕`，文件名旁显示"上传失败" + "重试"链接 | 用户点击"重试" → 对该文件重新调用 `addTask` + `uploadFile` |
| **文件过大（>50MB）** | 客户端检查 `file.size > 50 * 1024 * 1024` | 文件不加入队列，UploadDropZone 下方显示警告："文件 {name} 超过 50MB 限制，已跳过" | 用户压缩文件后重新上传 |
| **不支持的文件类型** | 拖入/选择不在白名单（.md/.txt/.pdf）的文件 | 文件项标记为红色 + "不支持的文件类型"提示，不发起上传请求 | 用户转换格式后重新上传 |
| **并发上传部分失败** | 3 个文件中 1 个失败 | 成功的正常显示完成，失败的显示重试按钮，互不影响 | 用户点击失败文件的重试按钮 |
| **token 过期导致上传 401** | alova 拦截器触发 refresh 流程，refresh 也失败 | 跳转到 /login，上传队列清空 | 用户重新登录后重新上传 |

## 边界条件

- **空文件夹上传**：空目录的 empty 状态下，UploadDropZone 仍可交互，上传完成后自动刷新列表
- **多 KB 场景**：通过 kb store 的 `selectedId` 获取当前 KB，切换 KB 时调用 `fileStore.resetFileBrowse()` 重置状态
- **拖拽无效内容**：拖拽非文件内容（如页面文本）到上传区域 → 忽略，不做任何反应
- **同时拖拽文件和文件夹**：只提取文件，忽略文件夹（浏览器限制，不支持拖拽上传文件夹）
- **文件名特殊字符**：不做前端校验，由后端处理；前端透传原始文件名
- **上传过程中离开页面**：`beforeunload` 事件提示"有文件正在上传，确定离开吗？"（若 `activeUploadCount > 0`）
- **重复上传同名文件**：不阻止，允许上传（file store 不做去重），后端生成唯一 ID
- **视图切换保持排序/筛选状态**：切换视图时保持当前排序和筛选条件

## 测试映射

> 测试文件位于 `tests/unit/web/`，使用 `.spec.tsx` 后缀，测试用例名以 `AC-XX:` 开头。

| 交互状态/场景 | 测试文件 | 测试用例 |
|---------------|----------|----------|
| UploadDropZone 拖拽上传 | `tests/unit/web/UploadDropZone.spec.tsx` | `AC-01: FileDragDropZone accepts files via drag & drop` |
| UploadDropZone 点击选择 | `tests/unit/web/UploadDropZone.spec.tsx` | `AC-01: FileDragDropZone accepts files via click-to-select` |
| FileManager 渲染文件列表 | `tests/unit/web/FileManager.spec.tsx` | `AC-02: FileManager renders files and folders in grid view` |
| FileManager 排序 | `tests/unit/web/FileManager.spec.tsx` | `AC-02: FileManager sorts files by name/date/size` |
| FileManager 筛选 | `tests/unit/web/FileManager.spec.tsx` | `AC-02: FileManager filters files by type` |
| FileGridItem 展示信息 | `tests/unit/web/FileGridItem.spec.tsx` | `AC-03: FileGridItem renders icon, filename, size, and date` |
| BreadcrumbNav 导航 | `tests/unit/web/BreadcrumbNav.spec.tsx` | `AC-04: BreadcrumbNav renders directory path and navigates on click` |
| UploadProgressBar 进度 | `tests/unit/web/UploadProgressBar.spec.tsx` | `AC-05: UploadProgressBar displays progress from file store` |
| 上传失败重试 | `tests/unit/web/UploadProgressBar.spec.tsx` | `AC-06: shows error state with retry button on upload failure` |
| 空目录状态 | `tests/unit/web/FileManager.spec.tsx` | `AC-07: FileManager shows empty state when no files` |
| loading 状态 | `tests/unit/web/FileManager.spec.tsx` | `AC-07: FileManager shows skeleton loading state` |
| 进入文件夹更新 | `tests/unit/web/KbListPage.spec.tsx` | `AC-08: navigates into folder updates BreadcrumbNav and FileManager` |
| 并发上传进度聚合 | `tests/unit/web/UploadProgressBar.spec.tsx` | `AC-09: aggregates progress across multiple concurrent uploads` |
| 拒绝不支持的文件类型 | `tests/unit/web/upload-drop-zone.spec.tsx` | `AC-10: rejects unsupported file types` |
