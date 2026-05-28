# q-18 行为规格：E2E 聊天 SSE 流式响应与会话管理

## 入口

- 触发：运行 `pnpm test:e2e` 或 `pnpm test:e2e:ui`
- 测试文件：
  - `tests/e2e/flows/chat-with-rag.spec.ts`
  - `tests/e2e/flows/session-management.spec.ts`
- 前置依赖：q-16 E2E 基础设施已就绪（docker / webServer / 登录态）

## 初始状态

- 浏览器已登录，位于 `/app/chat`
- 页面加载完成，聊天输入框 `[data-testid="chat-input"]` 可见
- 标签栏 `[data-testid="tab-bar"]` 仅显示「首页」标签
- 消息列表 `[data-testid="chat-message-list"]` 为空
- LLM API 已被 `page.route()` 拦截，返回 SSE 流

## 交互状态

### SSE 流式聊天

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| empty | 消息列表为空，输入框 placeholder 可见 | 聚焦输入框 | 光标闪烁，可输入 |
| typing | 输入框显示文本，发送按钮高亮 | 继续输入或点击发送 | 若内容非空，发送按钮可点击 |
| loading | 用户消息立即出现在列表底部，AI 消息区域显示流式指示器 | 等待 | SSE 连接建立，逐字接收内容 |
| streaming | AI 消息区域文字逐字追加，光标跟随 | 观察 | 每收到一个 SSE chunk，DOM 追加文本 |
| success | 流结束，AI 消息完整显示，输入框清空 | 可继续输入 | 会话自动保存到后端 |
| error | AI 消息区域显示错误提示（红色），流中断 | 点击重试或重新输入 | 重新建立 SSE 连接 |
| partial | 流中途断开，AI 消息显示不完整 | 刷新页面 | 重新加载会话历史，可能丢失未完成的最后一条 |

### @提及知识库

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| idle | 输入框正常 | 输入 `@` | 触发知识库选择器下拉 |
| dropdown-open | 下拉列表 `[data-testid="kb-mention-dropdown"]` 显示知识库选项 | 键盘上下选择或鼠标点击 | 高亮选项 |
| selected | 输入框内出现 pill `[data-testid="kb-mention-pill"]`，显示知识库名称 | 继续输入消息文本 | pill 与文本共存 |
| multi-selected | 多个 pill 横向排列，输入框可继续输入 | 再次输入 `@` | 再次打开下拉，可选择另一个 |
| delete-pill | pill 右侧显示删除图标（×） | 点击 × 或 Backspace | pill 移除，请求中不再携带该 knowledgeBaseId |
| send-with-kb | 消息发送，列表显示用户消息（含 pill 文本） | 等待 AI 响应 | `POST /api/chat` 的 body 携带 `knowledgeBaseIds` 数组 |

### 会话标签管理

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| single-tab | 仅「首页」标签，不可关闭 | 点击「新建聊天」按钮 | 创建新会话，新增标签 |
| multi-tab | 多个标签横向排列，当前标签高亮 | 点击非当前标签 | 切换会话，加载对应历史消息 |
| renaming | 标签变为输入框，文本全选 | 输入新名称，按 Enter | 调用重命名 API，标签显示新名称 |
| closing | 标签右侧显示关闭图标（×） | 点击 ×（首页不可关闭） | 标签移除，自动切换到左侧标签 |
| close-prevented | 「首页」标签无 × 图标 | 尝试关闭首页 | 无响应，首页不可关闭 |

### 历史记录管理

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| list-empty | 历史列表为空，显示空状态 | — | — |
| list-loaded | 列表显示多条会话 `[data-testid="session-item"]` | 滚动浏览 | 分页或虚拟滚动加载更多 |
| click-restore | 列表项可点击 | 点击某条会话 | 路由跳转到 `/app/chat`，加载该会话消息 |
| delete-confirm | 删除按钮触发确认弹窗 | 点击确认 | 会话软删除，列表移除该项 |
| rename-inline | 列表项出现重命名输入框 | 输入新名称确认 | 调用 API，列表项更新显示 |

## 正常流程

### 流程 A：SSE 流式聊天

| 步骤 | 系统操作 | 预期状态 | 验证点 |
|------|----------|----------|--------|
| 1 | 用户聚焦输入框，输入 "Hello" | typing 状态 | 输入框文本为 "Hello" |
| 2 | 用户点击发送按钮 | 用户消息出现在列表底部 | `[data-testid="chat-message"]` 数量为 1，角色为 user |
| 3 | 前端建立 SSE 连接，发送 `POST /api/chat` | loading 状态 | 网络面板显示 event-stream 请求 |
| 4 | mock 返回 SSE chunk | streaming 状态 | AI 消息区域逐字显示 "Hello" |
| 5 | mock 发送 `[DONE]` | success 状态 | AI 消息完整显示，输入框清空 |
| 6 | 会话自动保存 | 标签栏可能更新会话标题 | 后端 `GET /api/sessions` 包含该会话 |

### 流程 B：@提及知识库

| 步骤 | 系统操作 | 预期状态 | 验证点 |
|------|----------|----------|--------|
| 1 | 用户输入 `@` | dropdown-open 状态 | `[data-testid="kb-mention-dropdown"]` 可见 |
| 2 | 用户选择知识库 A | selected 状态 | 输入框出现 pill A |
| 3 | 用户再次输入 `@` 并选择知识库 B | multi-selected 状态 | 输入框出现 pill A + pill B |
| 4 | 用户输入消息文本并发送 | send-with-kb 状态 | `POST /api/chat` 的 body 含 `knowledgeBaseIds: [A.id, B.id]` |
| 5 | 用户点击 pill B 的删除图标 | delete-pill 状态 | pill B 消失，仅 pill A 保留 |

### 流程 C：会话标签管理

| 步骤 | 系统操作 | 预期状态 | 验证点 |
|------|----------|----------|--------|
| 1 | 页面初始加载 | single-tab 状态 | 仅「首页」标签，无关闭按钮 |
| 2 | 用户点击「新建聊天」 | multi-tab 状态 | 新增标签「新会话」，自动切换 |
| 3 | 用户发送消息，会话产生标题 | 标签显示自动标题或默认标题 | 标签文本非空 |
| 4 | 用户双击标签 | renaming 状态 | 标签变为输入框，文本全选 |
| 5 | 用户输入 "测试会话" 按 Enter | 标签显示 "测试会话" | `POST /api/sessions/:id/rename` 返回 200 |
| 6 | 用户点击非首页标签的 × | 标签移除，自动切换到左侧标签 | `DELETE /api/sessions/:id` 返回 200 |

### 流程 D：历史记录管理

| 步骤 | 系统操作 | 预期状态 | 验证点 |
|------|----------|----------|--------|
| 1 | 用户导航到 `/app/history` | list-loaded 或 list-empty | `[data-testid="session-list"]` 可见 |
| 2 | 列表显示已有会话 | list-loaded 状态 | `[data-testid="session-item"]` 数量 > 0 |
| 3 | 用户点击某条会话 | 路由跳转至 `/app/chat` | 消息列表加载该会话历史 |
| 4 | 用户点击删除按钮并确认 | delete-confirm 状态 | 列表项消失，后端该会话标记删除 |
| 5 | 用户点击重命名，输入新名称 | rename-inline 状态 | 列表项文本更新 |

## 错误场景

| 场景 | 触发 | 表现 | 恢复 |
|------|------|------|------|
| SSE 连接失败 | mock 返回 500 或网络断开 | AI 消息区域显示错误提示，流中断 | 用户可重新发送消息 |
| SSE 中途断开 | mock 只发送部分 chunk | AI 消息不完整，显示 partial 状态 | 刷新页面重新加载会话 |
| LLM 超时 | mock 延迟超过测试超时 | 测试超时失败 | 调整 mock 响应时间或测试 timeout |
| 知识库下拉空 | 用户无知识库 | 下拉列表显示空状态 | 不阻止发送，knowledgeBaseIds 为空数组 |
| 标签重命名冲突 | 快速双击多个标签 | 仅一个标签进入编辑模式 | 失焦时取消其他编辑状态 |
| 首页关闭拦截 | 自动化脚本误点首页关闭 | 无网络请求，无标签变化 | 断言首页始终存在 |
| 历史列表加载失败 | 后端返回 500 | 显示错误状态或空状态 | 重试加载或报错提示 |
| 删除后恢复点击 | 删除会话后列表未刷新，用户点击已删会话 | 跳转后加载空会话或报错 | 列表应实时移除已删项 |

## 测试映射

| 交互状态 | 测试文件 | 测试用例 |
|----------|----------|----------|
| empty / typing / success | `tests/e2e/flows/chat-with-rag.spec.ts` | `it('sends a message and receives SSE streaming response', ...)` |
| streaming | `tests/e2e/flows/chat-with-rag.spec.ts` | `it('displays AI response word by word via SSE', ...)` |
| error (SSE 500) | `tests/e2e/flows/chat-with-rag.spec.ts` | `it('shows error when SSE connection fails', ...)` |
| partial (SSE 断开) | `tests/e2e/flows/chat-with-rag.spec.ts` | `it('handles incomplete SSE stream gracefully', ...)` |
| dropdown-open / selected / multi-selected | `tests/e2e/flows/chat-with-rag.spec.ts` | `it('opens kb dropdown on @ and selects multiple items', ...)` |
| delete-pill | `tests/e2e/flows/chat-with-rag.spec.ts` | `it('removes kb pill when clicking delete', ...)` |
| send-with-kb | `tests/e2e/flows/chat-with-rag.spec.ts` | `it('sends request with knowledgeBaseIds', ...)` |
| single-tab / multi-tab | `tests/e2e/flows/session-management.spec.ts` | `it('creates new session tab on new chat', ...)` |
| switching | `tests/e2e/flows/session-management.spec.ts` | `it('switches between tabs and loads session history', ...)` |
| renaming | `tests/e2e/flows/session-management.spec.ts` | `it('renames session tab on double click', ...)` |
| closing | `tests/e2e/flows/session-management.spec.ts` | `it('closes tab and switches to left tab', ...)` |
| close-prevented | `tests/e2e/flows/session-management.spec.ts` | `it('prevents closing the home tab', ...)` |
| list-loaded / click-restore | `tests/e2e/flows/session-management.spec.ts` | `it('restores session from history list', ...)` |
| delete-confirm | `tests/e2e/flows/session-management.spec.ts` | `it('deletes session from history with confirmation', ...)` |
| rename-inline | `tests/e2e/flows/session-management.spec.ts` | `it('renames session from history list', ...)` |
