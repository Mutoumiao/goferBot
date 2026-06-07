---
issue: f-45
type: feature-spec
status: draft
---

# f-45 Chat 会话管理 功能规格

## 用户故事

**作为** 聊天用户
**我希望** 管理我的会话（新建/切换/删除/重命名）并选择关联的知识库
**以便** 有序组织多轮对话、快速切换上下文、精准限定 AI 回答的知识范围

## 功能边界

### 范围内

- **SessionList 组件**：会话列表渲染（标题、消息数、相对时间）、"+ 新建会话"按钮、会话项点击切换、悬停显示"..."菜单按钮（删除/重命名入口）
- **会话 CRUD 交互**：
  - 新建会话：调用 `createSession()` → 自动激活新会话
  - 切换会话：点击会话项 → `setActiveSession()` → `loadHistory()`
  - 删除会话：触发确认弹窗 → 确认后 `deleteSession()` → 从列表移除
  - 重命名会话：inline 编辑（双击或编辑按钮触发）
- **KbSelector 组件**：知识库下拉多选、已选标签展示、loading/empty/error 状态
- **ChatView 集成**：
  - 会话列表布局（左侧 Sidebar 区域）
  - 空会话引导：无会话时显示 "开始新对话" 引导
  - 错误恢复：操作失败时 error toast + 状态回滚
- **DeleteSessionDialog**：通过 overlay 系统的 `openDialog()` 命令式调用，支持确认/取消。
  - OverlayHost 已提供遮罩层（`fixed inset-0 bg-black/40`）和全屏居中容器（`flex items-center justify-center`）。
  - Dialog 组件只渲染内部弹窗盒子（标题 + 描述 + 按钮组），通过 `onClose: (result: 'confirm' | 'cancel') => void` prop 通信。
  - 不存在 `useDialog()` hook；状态管理由 OverlayHost + overlay-store 统一处理。

### 范围外

- Session Store 实现（f-40 负责 `sessions` / `createSession` / `deleteSession` / `renameSession` 等 store actions）
- SSE 流式接收（f-44 负责 `useSSE` hook）
- 后端会话 API 修改（仅消费已有 API，如需 PATCH `/chat/sessions/:id` 重命名端点由后端协调提供）
- 消息发送核心逻辑（`sendMessage` 由 f-44 对接）
- 会话搜索/筛选（P2 功能，不在本 issue 范围）

## 涉及页面/组件

| 组件 | 路径 | 类型 | 说明 |
|------|------|------|------|
| ChatView | `routes/app/chat.tsx` | 改造 | 集成 SessionList + 会话管理逻辑 |
| SessionList | `components/chat/SessionList.tsx` | 新建 | 会话列表、新建按钮、会话项 |
| KbSelector | `components/chat/KbSelector.tsx` | 新建 | 知识库下拉多选组件 |
| ChatInput | `components/chat/ChatInput.tsx` | 改造 | 集成 KbSelector，透传 knowledgeBaseIds |
| DeleteSessionDialog | `overlays/dialogs/DeleteSessionDialog.tsx` | 新建 | 删除二次确认弹窗 |

## 依赖关系

| 依赖 | 提供 | 消费方式 |
|------|------|----------|
| f-40 Session Store | `useChatStore` 的 `sessions` / `isLoadingSessions` / `error` / `loadSessions` / `createSession` / `deleteSession` / `renameSession` / `clearError` | 组件通过 Zustand selector 订阅 |
| f-44 SSE 流式 | `useSSE` hook（预期） | ChatView 在切换会话后调用以接收流式消息 |
| `api/chat.ts` | `getSessions` / `createSession` / `deleteSession` / `getHistory` / `renameSession`（待新增） | Store actions 间接调用，组件不直接使用 |
| `api/kb.ts` | `getKbList` | KbSelector 通过 `useRequest` 调用 |
| Overlay 系统 | `openDialog(component, props)` / `closeDialog(id, result?)` | DeleteSessionDialog 命令式调用。OverlayHost 注入 `onClose` prop，组件通过 `onClose('confirm'|'cancel')` 返回结果 |

> **注意**：`renameSession` API 方法在现有 `api/chat.ts` 中不存在。
> - 若后端已有 `PATCH /api/chat/sessions/:id` 端点 → 在 `api/chat.ts` 中新增 `renameSession(id, title)` 方法
> - 若后端无此端点 → 需协调后端新增，前端 method 定义为 `alovaInstance.Patch('/chat/sessions/' + id, { title })`

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 会话列表放左侧 Sidebar 区域 | PRD §2.1 已规划 `components/sidebar/` 目录；Vue 旧版无独立会话列表，新版提供更好导航 | 是（可改为顶部下拉） |
| KbSelector 集成到 ChatInput 底部 | Vue 旧版 KbSelector 为 ChatInput 子组件，保持交互一致性；通过 `position: absolute; bottom-full` 定位 | 是 |
| 删除使用 `openDialog` Promise 模式 | 符合 overlay-conventions.md 命令式调用规范，避免内联声明 Dialog。组件通过 `onClose` prop 返回结果，不自行渲染遮罩/容器 | 否（规范强制） |
| 重命名使用 inline 编辑 | 减少弹窗打断、inline 交互更轻量；双击标题进入编辑态 | 是（可改为 Dialog） |
| 重命名 API 方法在 `api/chat.ts` 中新增 | 不修改后端，前端仅封装 HTTP 调用 | —（功能性需要） |
| 空会话时仍渲染 ChatInput | 允许用户在无会话时直接输入消息创建首个会话，参考 ChatGPT 交互模式 | 是 |
| KbSelector 通过 alova `useRequest` 获取 KB 列表 | 与 PRD §6.2 数据获取策略一致，统一 loading/error 状态管理 | 否（架构规范） |

## 验收标准映射

| AC | 描述 | 优先级 |
|----|------|--------|
| AC-01 | SessionList 渲染会话列表（标题、消息数、时间），加载态和空态正确 | p0 |
| AC-02 | "+ 新建会话"按钮 → `createSession` → 自动激活新会话 | p0 |
| AC-03 | 点击会话项 → `setActiveSession` → `loadHistory` 加载对应历史消息 | p0 |
| AC-04 | 删除会话（二次确认弹窗） → `deleteSession` → 从列表移除 | p0 |
| AC-05 | 删除 activeSession 时，activeSession 置 null，UI 回空会话引导 | p0 |
| AC-06 | 重命名会话（inline 编辑）：双击 → 编辑 → blur/Enter 确认 | p1 |
| AC-07 | KbSelector 组件：下拉多选知识库、已选标签展示、loading/empty/error 状态 | p0 |
| AC-08 | 空会话状态：无会话时显示引导提示 | p1 |
| AC-09 | 操作失败时 error toast 展示，clearError 可清除 | p0 |
| AC-10 | 新建会话失败不污染列表，错误可恢复 | p0 |
