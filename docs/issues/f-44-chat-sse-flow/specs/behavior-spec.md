# 行为规格：ChatView SSE 流式接收

## 入口
- **路由**：`/app/chat`
- **触发**：用户在 ChatInput 中输入消息并按 Enter 或点击发送按钮

## 前置条件
- 用户已登录（路由守卫 `beforeLoad` 已验证 JWT）
- `activeSession` 已设置（由 f-40 session store 提供，在聊天页面中可选为空以触发 "新对话" 空态）
- 若 `activeSession` 为 null，前端必须先调用 `createSession` 创建新会话，获取有效 sessionId 后再发起 SSE 请求（sessionId 不可为空字符串）

## 初始状态（无活跃 session 时）
- 页面显示 "开始新对话" 标题
- 提示文字 "在下方输入消息，开始与 AI 对话"
- EditorPlaceholder 示例卡片
- ChatInput 正常可用（发送按钮可点击）
- 消息列表为空

## 初始状态（有活跃 session 时）
- 页面标题显示 `activeSession.title`
- 历史消息通过 `getHistory` 加载并显示
- 加载历史时显示 "加载中..." 提示

## 交互状态

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| idle | ChatInput 正常可用，发送按钮可点击。消息列表显示历史消息或空态引导 | 输入文字，点击发送/按 Enter | 进入 streaming 状态 |
| streaming | ChatInput 禁用（textarea disabled + 按钮灰化），发送按钮变为红色 "停止" 按钮。消息列表末尾显示流式气泡（assistant role，内容逐字追加）。流式首 chunk 到达前显示三点跳动 loading 指示器 | 点击 "停止" 按钮 | 调用 `useSSE.abort()` 中断连接，已接收的部分内容通过 `flushStreamContent` 保留为 assistant 消息，恢复 idle 状态 |
| streaming-complete | 和 idle 相同。最后一条 assistant 消息内容完整（Markdown 渲染）。若有 `files` 附件则显示文件卡片 | 继续输入新消息 | 进入新一轮 streaming |
| error | 消息列表末尾显示 ErrorCard（红色边框卡片），内容含错误描述文字和 "重试" 按钮。ChatInput 恢复可用 | 点击 "重试" 按钮 | 移除 ErrorCard，调用 `streamChat` 重新发送**上一条**消息（含相同 content 和 sessionId）。若选中 "编辑消息后重试" 则进入编辑模式 |
| reconnect | 与 streaming 类似但消息列表顶部显示黄色提示条 "连接中断，正在重连..."。三点 loading 动画可见 | 等待 / 点击 "取消" | `reconnectionTime` 到期后自动重连，成功则隐藏提示条继续流式；失败则进入 error 状态 |

## 正常流程

| 步骤 | 用户操作 | 系统响应 | 视觉效果 |
|------|----------|----------|----------|
| 1 | 输入消息并点击发送 | `appendMessage(userMsg)` 立即将用户消息插入消息列表；`setIsStreaming(true)` 禁用输入框 | 用户消息气泡从右侧滑入；发送按钮变灰并切换为红色停止按钮 |
| 2 | （自动） | `useSSE.send()` 发起 `POST /api/chat` SSE 请求，请求体包含 `{ message, sessionId, config }` | 消息列表底部出现三点跳动动画 |
| 3 | （自动） | 后端返回首个 SSE chunk：`{ chunk: "你好", done: false }`，触发 `onMessage` → `appendStreamContent("你好")` | 三点动画消失，assistant 消息气泡出现，显示 "你好"，后续 chunk 逐字追加 |
| 4 | （自动） | 后端持续返回 chunk，`streamingContent` 逐字累加 | 消息气泡内容实时增长，Markdown 在流式完成后渲染 |
| 5 | （自动） | 后端返回最终 chunk：`{ chunk: "...", done: true }`，触发 `flushStreamContent()` | 流式气泡转为完整消息，停止按钮恢复为发送按钮 |
| 6 | 输入新消息继续对话 | 重复步骤 1-5 | — |

## 错误场景

| 场景 | 触发 | 视觉效果 | 恢复方式 |
|------|------|----------|----------|
| SSE 连接失败（网络断开） | 发送请求后网络不可达 | ErrorCard 显示 "网络连接失败，请检查网络后重试"，红色边框 | 点击 "重试" 按钮重新发起 SSE 请求 |
| 后端返回 HTTP 错误（401/500） | 鉴权过期 / 服务端异常 | ErrorCard 显示具体错误信息（从 `onError` 的 error.message 提取） | 点击 "重试" 重新发起。401 由 alova 全局拦截自动处理 token 刷新 |
| SSE 连接中断（mid-stream 网络瞬断） | 流式传输中网络中断 | 黄色提示条 "连接中断，正在重连..."，3 秒后自动重连 | `reconnectionTime: 3000` 自动重连成功则继续流式；失败则降级为 ErrorCard |
| 流式内容为空（后端返回空 chunk 或仅 done） | 后端未生成内容 | 消息列表无 assistant 消息，流式状态结束，输入框恢复 | 正常状态，用户可重新发送 |
| 用户主动停止生成 | 点击停止按钮 | 已接收的部分内容保留为 assistant 消息。`abort()` 中断连接 | 用户可继续输入新消息 |
| activeSession 为 null 时发送消息 | 未创建/未选择会话 | 前端先调用 `createSession` 创建新会话，获取有效 sessionId 后再发起 SSE。流式完成后会话信息通过 f-40 store 同步 | 等功能实现后由 f-45 完善 |

## SSE Chunk 协议

后端 SSE 端点 `POST /api/chat` 发送的 chunk 格式（`text/event-stream`）：

```
data: {"chunk":"部分文本","done":false}

data: {"chunk":"剩余文本","done":true}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `chunk` | string | 本次 chunk 的文本内容 |
| `done` | boolean | 是否为最后一个 chunk |
| `error` | string（可选） | 仅在异常终止时出现，此时 `done: true` |

## 组件行为变更

### ChatInput 变更（packages/web/src/components/chat/ChatInput.tsx）
- 新增 prop：`isStreaming?: boolean`，控制禁用态和按钮切换
- `disabled` 语义扩展：`disabled || isStreaming` 时 textarea 禁用
- 发送按钮在 `isStreaming` 时变为红色停止按钮（`onStop` callback）
- 新增 prop：`onStop?: () => void`，停止生成回调

### ChatViewPage 变更（packages/web/src/routes/app/chat.tsx）
- 替换 `handleSend` 中的 TODO 为 `useSSE` 集成
- 新增 `handleStop` 函数，调用 `abort()`
- 新增 `handleRetry` 函数，重新发送上一条消息
- 新增 `errorRetryMessage` 状态，保存最近一次发送的用户消息内容用于重试（重试时重新发送同一消息文本，行为可预期）
- 新增 `errorMessage` 状态，保存错误描述用于 ErrorCard 展示

## 测试映射

| 交互状态 | 测试文件 | 测试用例 |
|----------|----------|----------|
| idle — 初始空态 | `tests/unit/web/chat-sse.spec.tsx` | `AC-01: renders empty state when no active session` |
| idle — 有历史消息 | `tests/unit/web/chat-sse.spec.tsx` | `AC-02: renders history messages when active session exists` |
| streaming — 发送后进入流式状态 | `tests/unit/web/chat-sse.spec.tsx` | `AC-03: disables ChatInput and shows stop button when streaming` |
| streaming — chunk 追加 | `tests/unit/web/chat-sse.spec.tsx` | `AC-04: appends streaming content chunks to message list` |
| streaming — 显示 loading 动画 | `tests/unit/web/chat-sse.spec.tsx` | `AC-05: shows bouncing dots loading indicator before first chunk arrives` |
| streaming-complete — 消息终结 | `tests/unit/web/chat-sse.spec.tsx` | `AC-06: flushes streaming content to complete message on done` |
| error — SSE 连接失败 | `tests/unit/web/chat-sse.spec.tsx` | `AC-07: displays ErrorCard with retry button on SSE connection error` |
| error — 重试 | `tests/unit/web/chat-sse.spec.tsx` | `AC-08: retries SSE connection when retry button clicked` |
| stop — 用户停止生成 | `tests/unit/web/chat-sse.spec.tsx` | `AC-09: stops SSE and preserves partial content on stop button click` |
| reconnect — 自动重连 | `tests/unit/web/chat-sse.spec.tsx` | `AC-10: shows reconnect banner and auto-reconnects after connection drop` |
