---
issue: f-45
type: behavior-spec
status: draft
---

# f-45 Chat 会话管理 行为规格

## 入口

- **路由**：`/app/chat`
- **触发**：用户点击侧边栏 "Chat" 标签进入 ChatView 页面

## 组件树

```
ChatViewPage
├── SessionList                    # 左侧会话列表
│   ├── 标题栏（"会话" + 新建按钮）
│   ├── 会话项列表
│   │   ├── SessionItem（标题、消息数、相对时间、"..."菜单按钮）
│   │   └── ...更多会话项
│   └── 空态引导（无会话时）
├── 聊天主区域
│   ├── 标题栏（活跃会话标题，可双击编辑）
│   ├── 消息列表（MessageBubble[]）
│   │   ├── loading 态（加载历史中）
│   │   ├── empty 态（开始新对话引导）
│   │   └── streaming 态（SSE 实时输出）
│   └── ChatInput
│       ├── KbSelector（知识库选择器）
│       ├── 文本输入区
│       └── 发送按钮
└── ErrorToast（全局错误浮层）
```

## 初始状态

### 页面加载

| 阶段 | 视觉 | 交互 |
|------|------|------|
| 首屏 | `isLoadingSessions=true`，SessionList 显示骨架屏 (3 条占位) | 聊天区显示 `activeSession=null` 的空态引导 |
| 加载完成 → 有会话 | SessionList 渲染列表，首项高亮（若 `activeSession` 匹配） | 无 `activeSession` 时仍显示空态引导 |
| 加载完成 → 无会话 | SessionList 显示 "暂无会话" 空态 | 聊天区显示 "开始新对话" 引导，ChatInput 可用 |
| 加载失败 | SessionList 显示错误信息 + "重试" 按钮 | 聊天区仍可用（允许直接输入创建会话） |

### 会话状态

| 状态 | 视觉 | ChatInput |
|------|------|-----------|
| `activeSession = null` | 聊天区显示 "开始新对话" 引导（图标 + "在下方输入消息，开始与 AI 对话"） | 启用，"输入消息开始新对话..." |
| `activeSession != null` | 标题栏显示会话标题，消息列表加载历史 | 启用，"继续对话..." |

## 交互状态表

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| **SessionList loading** | 3 条骨架占位（shadcn Skeleton） | 不可交互 | `loadSessions()` 完成后自动切换 |
| **SessionList empty** | "暂无会话" 文案 + 新建按钮 | 点击 "+" 新建 | `createSession()` → loading → 新增到列表 + 激活 |
| **SessionList error** | 错误信息 + "重试" 按钮 | 点击 "重试" | 重新 `loadSessions()` → loading → 正常/继续报错 |
| **SessionList normal** | 会话列表（标题 + 消息数 + 时间） | 点击会话项 | `setActiveSession` → `loadHistory` → 渲染消息 |
| **新建会话 loading** | 列表顶部出现 "新会话" 占位项（带 spinner） | 禁用新建按钮 | API 返回后替换占位项 + 自动激活 |
| **删除确认** | Dialog：标题 "删除会话"、描述 "确定删除「xxx」？此操作不可撤销"、取消/删除按钮 | 点 "删除" | `deleteSession()` → loading → 移除 + activeSession 清理 |
| **重命名 inline** | 标题变为 `<input>`，自动 focus + 全选 | 输入新标题 → Enter/blur | `renameSession()` → 更新标题 → 退出编辑 |
| **重命名 inline（Esc）** | — | 按 Esc | 退出编辑，恢复原标题 |
| **KbSelector closed** | 输入框下方无弹窗 | 点击 "@" 按钮或输入框上方标签 | 打开下拉 |
| **KbSelector open** | 底部弹出知识库列表（多选 checkbox + 名称 + 文档数） | 勾选/取消 KB | 实时更新已选标签，不关闭下拉 |
| **KbSelector open** | — | 点击下拉外部 / Esc | 关闭下拉 |
| **KbSelector loading** | 列表区域骨架屏 | 无可用操作 | `useRequest` 完成后自动切换 |
| **KbSelector empty** | "请先创建知识库" 提示 | 无可用操作 | — |
| **KbSelector error** | 错误信息 + "重试" 按钮 | 点击 "重试" | 重新加载 KB 列表 |
| **Error toast** | 底部居中红色 toast（图标 + 消息 + 关闭按钮） | 点击 "关闭" | `clearError()` |

## 正常流程

### 流程 1: 新建会话

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击 SessionList 标题栏 "+" 按钮 | 调用 `useChatStore().createSession()` | 列表顶部出现占位项，spinner 旋转 |
| 2 | — | API 返回新 Session | 占位项替换为真实会话项，`activeSession` 设为新会话 |
| 3 | — | 聊天区自动 `loadHistory(newSessionId)` | 消息列表加载中 → 新会话空消息列表 |
| 4 | 在 ChatInput 中输入消息并发送 | `sendMessage()` → SSE 流式接收 | 用户消息 + AI 流式回复渲染 |

### 流程 2: 切换会话

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击 SessionList 中某个会话项 | `setActiveSession(session)` | 被点击项高亮，聊天区显示 "加载中..." |
| 2 | — | `loadHistory(sessionId)` 加载历史 | `isLoadingHistory=true`，消息区骨架屏 |
| 3 | — | 历史消息返回 | 消息列表渲染历史消息，滚动到底部 |
| 4 | 用户继续对话 | SSE 流式 | 新消息追加到列表 |

### 流程 3: 删除会话

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 会话项悬停 → 点击 "..." 按钮 → 选择"删除" | 调用 `openDialog(DeleteSessionDialog, { sessionTitle })` | 弹出确认 Dialog（OverlayHost 渲染遮罩+容器，Dialog 仅渲染内容） |
| 2 | 点击 "取消" / ESC / 点击遮罩 | `onClose('cancel')` → OverlayHost 移除 Dialog | Dialog 关闭，列表不变 |
| 3 | 点击 "删除" | `onClose('confirm')` → ChatView 的 `handleDeleteSession` 调用 `deleteSession(id)` | Dialog 关闭，列表移除对应项 |
| 4 | — | API 成功 | Dialog 关闭，会话从列表移除 |
| 4a | — | 被删会话是 activeSession | `activeSession=null`，聊天区回空态 |
| 4b | — | 被删会话不是 activeSession | `activeSession` 不变 |

### 流程 4: 重命名会话（inline）

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 双击聊天区标题栏会话名 | 标题变为 `<input>`，自动 focus + 全选 | 输入框显示原标题，光标闪烁 |
| 2 | 输入新标题（非空） | 无 | 输入框内容更新 |
| 3 | 按 Enter / blur | `renameSession(id, newTitle)` | 输入框退出，标题更新为新值 |
| 4 | — | API 成功 | 列表中对应会话项标题更新 |
| 3a | 按 Esc | 取消编辑 | 输入框退出，恢复原标题 |
| 3b | 输入空标题 → blur | 校验不通过 | 恢复为原标题（不调用 API） |

### 流程 5: KbSelector 选择知识库

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击 ChatInput 中 "@" 按钮 | 打开 KbSelector 下拉 | 下拉从底部弹出，加载 KB 列表 |
| 2 | 勾选一个 KB | `selectedIds` 更新 | 该 KB checkbox 选中，ChatInput 上方出现标签 |
| 3 | 再勾选另一个 KB | `selectedIds` 追加 | 第二个标签出现 |
| 4 | 取消勾选某个 KB | `selectedIds` 移除 | 该标签消失 |
| 5 | 发送消息 | `handleSend(content, selectedIds)` | 消息携带 `knowledgeBaseIds` 发出 |

## 错误场景

| 场景 | 触发 | 视觉 | 恢复 |
|------|------|------|------|
| 加载会话列表失败 | 网络异常 / 服务端错误 | SessionList 区域显示错误信息 + "重试" 按钮 | 点击 "重试" 重新 `loadSessions()` |
| 创建会话失败 | 网络异常 / 服务端错误 | 列表顶部占位项消失；底部 error toast "创建会话失败" | toast 自动消失（5s），用户可重试 |
| 删除会话失败 | 网络异常 / 服务端 404 | Dialog 关闭；底部 error toast "删除会话失败"；会话仍在列表 | toast 自动消失，用户可重试删除 |
| 重命名会话失败 | 网络异常 / 标题校验失败 | 标题回滚为原标题；error toast "重命名失败" | toast 自动消失 |
| KbSelector 加载 KB 失败 | 网络异常 | 下拉列表区域显示错误信息 + "重试" 按钮 | 点击 "重试" 重新加载 |
| 重复 loadSessions | 用户快速点击重试 | 每次独立请求，后者覆盖前者结果 | 最终展示最新结果 |

## 边界条件

### SessionList

- 会话数量 > 50：列表区域内部滚动（`overflow-y: auto`），不撑开页面
- 极长标题：CSS `truncate` 截断 + `title` tooltip 展示完整标题
- 会话时间：使用 `date-fns` 的 `formatDistanceToNow` 显示相对时间（中文 locale），若 `createdAt` 为空则不显示时间行
- 并发操作：同一会话删除后仍有点击事件 → 检查 sessions.find 存在性再操作
- "..." 菜单按钮：通过 `e.stopPropagation()` 阻止事件冒泡，避免触发会话切换；`onMoreClick` 回调负责弹出 ContextMenu 或 Dialog

### KbSelector

- 知识库数量 > 20：下拉列表内部滚动（`max-h-48 overflow-y-auto`）
- 无知识库时：不阻止发送消息（KB 是可选增强）
- 键盘导航：ArrowUp / ArrowDown 在下拉列表中移动焦点，Enter 选中/取消选中当前项，Esc 关闭下拉（与 Vue 旧版行为一致）。
  - 实现要点：在下拉容器上监听 `onKeyDown`，维护 `focusedIndex` 状态；`ArrowUp`/`ArrowDown` 时调用 `e.preventDefault()` 防止页面滚动。

### 重命名

- 空标题 / 纯空格：校验不通过，不调用 API，恢复原标题
- 标题未变化：不调用 API，直接退出编辑
- 快速连续重命名：每次独立请求，后者覆盖前者

### ChatInput

- disabled 状态（streaming 中）：不允许发送，不允许打开 KbSelector
- 空消息发送：内容 trim 后为空不发送

## 测试映射

| 交互状态 | 测试文件 | 测试用例 |
|----------|----------|----------|
| SessionList loading → empty | `tests/unit/web/SessionList.spec.tsx` | `AC-01: renders skeleton while loading, shows empty state when no sessions` |
| SessionList normal（含会话） | `tests/unit/web/SessionList.spec.tsx` | `AC-01: renders session items with title, messageCount, and time` |
| 新建会话 | `tests/unit/web/SessionList.spec.tsx` | `AC-02: calls createSession on "+" button click, activates new session` |
| 切换会话 | `tests/unit/web/SessionList.spec.tsx` | `AC-03: calls setActiveSession on session item click, triggers loadHistory` |
| 删除会话确认弹窗 | `tests/unit/web/DeleteSessionDialog.spec.tsx` | `AC-04: renders dialog with session title, confirm calls deleteSession, cancel closes` |
| 删除 activeSession | `tests/unit/web/ChatView.spec.tsx` | `AC-05: deleting activeSession sets activeSession to null, shows empty guide` |
| 重命名 inline | `tests/unit/web/ChatView.spec.tsx` | `AC-06: double-click title enters edit mode, Enter confirms rename, Esc cancels` |
| KbSelector 各状态 | `tests/unit/web/KbSelector.spec.tsx` | `AC-07: renders dropdown with multi-select, loading skeleton, empty hint, error+retry` |
| 空会话引导 | `tests/unit/web/ChatView.spec.tsx` | `AC-08: shows empty guide when no sessions and no activeSession` |
| 错误 toast | `tests/unit/web/ChatView.spec.tsx` | `AC-09: displays error toast on operation failure, clearError dismisses` |
| SessionList "..." 菜单（重命名入口） | `tests/unit/web/SessionList.spec.tsx` | `shows rename option in DropdownMenu and calls onRenameClick` |
| SessionList "..." 菜单（删除入口） | `tests/unit/web/SessionList.spec.tsx` | `shows delete option in DropdownMenu and calls onDeleteClick` |

> 测试规范参见 `docs/guide/testing/unit-testing-guide.md` 第 5-6 章。
> 测试路径规范：`f-*` React 项目 → `tests/unit/web/{name}.spec.tsx`。
