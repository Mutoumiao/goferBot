# Issue #02 — 基础问答对话功能 测试用例

**对应 Issue**: `.scratch/knowledge-base/issues/02-basic-chat.md`  
**状态**: closed  
**测试框架**: Vitest（前端 Unit + 组件）、Node 环境 Vitest（Sidecar API）

---

## 2.1 Sidecar API — 会话与消息

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-02-001 | SQLite Schema 存在 | sidecar 已启动 | 检查数据库表 | `sessions` 和 `messages` 表存在，字段与 PRD 一致 |
| TC-02-002 | `GET /sessions` 返回会话列表 | 数据库中有若干 session | 请求 `/sessions` | 返回 200，数组中包含所有会话的 id/title 等 |
| TC-02-003 | `GET /sessions/:id` 返回会话详情 | session 存在且有消息 | 请求 `/sessions/:id` | 返回 200，包含会话信息和 messages 数组 |
| TC-02-004 | `GET /sessions/:id` 不存在 | id 无效 | 请求 `/sessions/invalid-id` | 返回 404 |
| TC-02-005 | `POST /chat` SSE 流式返回 | config 有效（provider/model/apiKey） | 发送 POST /chat，读取 body | 返回 200，Content-Type 为 `text/event-stream`，数据格式 `data: {"content":"..."}` |
| TC-02-006 | `POST /chat` 保存用户消息 | 发送消息 | 完成后查询 messages 表 | 数据库中新增一条 role='user' 的记录 |
| TC-02-007 | `POST /chat` 保存 AI 消息 | 流式响应结束后 | 查询 messages 表 | 数据库中新增一条 role='assistant' 的记录，content 为完整回复 |
| TC-02-008 | `POST /chat` 无效配置报错 | apiKey 为空或无效 | 发送 POST /chat | 返回 400/401 等错误，不创建消息记录 |

## 2.2 前端 — useSessionStore（Pinia）

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-02-009 | 默认状态 | 新 store 实例 | 创建 store | `tabs` 长度为 1，第一个 tab 标题为"首页"，`closable = false`，`activeTabId = 'home'` |
| TC-02-010 | 切换标签 | 存在 home 和 t1 两个 tab | `switchTab('home')` | `activeTabId` 变为 `'home'` |
| TC-02-011 | 无法关闭首页 | 只有首页 tab | `closeTab('home')` | `tabs` 长度仍为 1 |
| TC-02-012 | 关闭可关闭标签并自动切换 | 有 home + t1 | `closeTab('t1')` | `tabs` 长度为 1，`activeTabId` 自动切回 `'home'` |
| TC-02-013 | 首页首次发送消息后升格 | home tab 无 sessionId，mock SSE 成功 | `sendMessage('你好', config)` | `tabs` 长度为 2：第一个 tab 获得 sessionId 且标题变为"你好"，新增一个"首页" tab |
| TC-02-014 | 已有会话追加消息 | t1 有 sessionId='sess-1'，已有一条消息 | `sendMessage('next', config)` | `tabs` 长度不变（不新建首页），该 session 的消息数变为 3 |
| TC-02-015 | 发送失败设置错误状态 | mock 返回 400 | `sendMessage('fail', config)` | `sendError` 包含错误文本，`isSending = false` |
| TC-02-016 | 发送过程中 isSending 为 true | mock SSE 延迟返回 | 开始 sendMessage | `isSending = true`，完成后变为 `false` |
| TC-02-017 | 流式追加内容到 assistant 消息 | mock SSE 分多段返回 | sendMessage | 最后一条消息的 content 随 SSE 数据流逐段拼接为完整文本 |
| TC-02-018 | 单例页面标签不重复 | 已存在 knowledge-base 标签 | `addTab({ type: 'knowledge-base' })` | 不重复添加，切换到已有标签（注：由 App.vue 或调用方保证） |

**已有自动化测试**: `tests/unit/stores/session.test.ts`  
**覆盖范围**: TC-02-009 ~ TC-02-017（TC-02-018 单例标签防重复由调用方/App.vue 保证，不在 store 层测试）

## 2.3 前端 — ChatPage 组件

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-02-019 | 首页空态显示 | home tab 无 sessionId | 挂载 ChatPage | 渲染 `EmptySession` 组件，不渲染 `ChatMessageList` 和 `ChatInput` |
| TC-02-020 | 对话态显示 | 当前 tab 有 sessionId 和消息 | 挂载 ChatPage | 渲染 `ChatMessageList` 和 `ChatInput`，不渲染 `EmptySession` |
| TC-02-021 | ChatMessageList 接收正确消息 | session 有 2 条消息 | 挂载并查看 props | `ChatMessageList` 的 `messages` prop 等于 store 的 `activeMessages` |
| TC-02-022 | ChatInput loading 状态 | `isSending = true` | 挂载 ChatPage | `ChatInput` 的 `loading` prop 为 `true` |
| TC-02-023 | 错误信息展示 | `sendError = 'Something went wrong'` | 挂载 ChatPage | 组件文本包含该错误信息 |
| TC-02-024 | EmptySession 发送消息触发 store | 无 | 触发 `EmptySession` 的 `send` 事件 | `sessionStore.sendMessage` 被调用，参数为消息内容和 settingsStore.llmConfig |
| TC-02-025 | ChatInput 发送消息触发 store | 当前为对话态 | 触发 `ChatInput` 的 `send` 事件 | `sessionStore.sendMessage` 被调用 |

**已有自动化测试**: `tests/unit/components/ChatPage.test.ts`  
**覆盖范围**: TC-02-019 ~ TC-02-025

## 2.4 前端 — ChatInput 组件

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-02-026 | 输入框渲染 | 无 | 挂载组件 | 存在 textarea 或 input 元素 |
| TC-02-027 | Enter 发送 | 输入内容"hello"，按 Enter | 模拟键盘事件 | 触发 `send` 事件，payload 为 `"hello"`，输入框清空 |
| TC-02-028 | Shift+Enter 换行 | 输入内容，按 Shift+Enter | 模拟键盘事件 | 不触发 `send`，输入框内容增加换行 |
| TC-02-029 | 空内容不发送 | 输入框为空，按 Enter | 模拟键盘事件 | 不触发 `send` 事件 |
| TC-02-030 | loading 时禁用发送 | `loading = true` | 尝试点击发送按钮 | 按钮 disabled 或点击无响应 |

**已有自动化测试**: `tests/unit/components/ChatInput.test.ts`  
**覆盖范围**: TC-02-026 ~ TC-02-030（全部覆盖）

## 2.5 前端 — MarkdownRender 组件

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-02-031 | 渲染 Markdown 文本 | content = `# 标题\n\n正文` | 挂载组件 | HTML 中包含 `<h1>标题</h1>` 和 `<p>正文</p>` |
| TC-02-032 | 代码块语法高亮 | content = "```js\nconst a = 1;\n```" | 挂载组件 | HTML 中存在 code 元素，包含高亮相关的 class 或样式 |
| TC-02-033 | 代码块复制按钮 | content 包含代码块 | 挂载组件 | 每个代码块旁存在复制按钮 |
| TC-02-034 | 点击复制按钮 | 点击复制按钮 | 模拟点击 | 调用 clipboard API，复制代码内容 |
| TC-02-035 | 行内代码渲染 | content = "使用 `npm install`" | 挂载组件 | 存在 `<code>npm install</code>` |
| TC-02-036 | 列表渲染 | content = "- a\n- b" | 挂载组件 | 存在 `<ul><li>a</li><li>b</li></ul>` |

**已有自动化测试**: `tests/unit/components/MarkdownRender.test.ts`  
**覆盖范围**: TC-02-031、TC-02-032、TC-02-035、TC-02-036  
**待实现**: TC-02-033（代码块复制按钮渲染）、TC-02-034（点击复制按钮）—— 复制按钮生成逻辑尚未接入 `renderMarkdown`

## 2.6 前端 — ChatMessage 组件

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-02-037 | 用户消息右对齐白色背景 | message.role = 'user' | 挂载组件 | 根元素有 justify-end 类，消息气泡有 bg-accent-600 类 |
| TC-02-038 | AI 消息左对齐边框背景 | message.role = 'assistant' | 挂载组件 | 根元素有 justify-start 类，消息气泡有 border-border-subtle 类 |
| TC-02-039 | 用户头像显示 | user 消息 | 挂载组件 | 显示用户头像（i-mdi-account），不显示 AI 头像 |
| TC-02-040 | AI 头像和 accent 线显示 | assistant 消息 | 挂载组件 | 显示 AI 头像（i-mdi-robot），左侧有 accent 装饰线 |
| TC-02-041 | AI 消息 Markdown 渲染 | assistant 内容含 Markdown | 挂载组件 | 使用 MarkdownRender 组件渲染内容 |
| TC-02-042 | 用户消息纯文本渲染 | user 内容 | 挂载组件 | 使用 whitespace-pre-wrap 显示纯文本 |

**已有自动化测试**: `tests/unit/components/ChatMessage.test.ts`  
**覆盖范围**: TC-02-037 ~ TC-02-042

## 2.7 前端 — ChatMessageList 组件

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-02-043 | 空消息列表 | messages = [] | 挂载组件 | 不渲染 ChatMessage |
| TC-02-044 | 消息列表渲染 | messages 有两条 | 挂载组件 | 渲染两个 ChatMessage，顺序正确 |
| TC-02-045 | 新消息自动滚动到底部 | 消息列表更新 | setProps 新增消息 | 容器调用 scrollTo 滚动到底部 |
| TC-02-046 | 消息数不变时不滚动 | 消息数相同 | setProps 替换内容 | 不触发 scrollTo |

**已有自动化测试**: `tests/unit/components/ChatMessageList.test.ts`  
**覆盖范围**: TC-02-043 ~ TC-02-046

## 2.8 前端 — EmptySession 组件

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-02-047 | 快捷提问胶囊渲染 | 无 | 挂载组件 | 存在多个快捷提问按钮 |
| TC-02-048 | 点击胶囊发送对应问题 | 无 | 点击胶囊 | 触发 send 事件，payload 为胶囊文案 |
| TC-02-049 | Enter 发送 | 输入内容 | 按 Enter | 触发 send 事件，清空输入框 |
| TC-02-050 | Shift+Enter 不发送 | 输入内容 | 按 Shift+Enter | 不触发 send |
| TC-02-051 | 空输入禁用发送按钮 | 输入框为空 | 挂载组件 | 发送按钮 disabled |
| TC-02-052 | 点击发送按钮发送并清空 | 输入内容 | 点击发送 | 触发 send，输入框清空 |

**已有自动化测试**: `tests/unit/components/EmptySession.test.ts`  
**覆盖范围**: TC-02-047 ~ TC-02-052

---

## 待补充的自动化测试

| TC-ID 范围 | 测试层 | 建议方案 |
|---|---|---|
| TC-02-001 ~ TC-02-008 | Sidecar API / SQLite | 为 `POST /chat`、`GET /sessions` 添加 Hono 路由测试，验证 SSE 格式和数据库写入 |

---

*文档生成日期：2026-05-08*  
*对应 Issue：#02-basic-chat*
