# 功能规格：ChatView SSE 流式接收

## 用户故事
作为 GoferBot 用户，我希望在聊天页面发送消息后能看到 AI 的回复逐字流式输出，以便获得即时反馈并减少等待焦虑。

## 边界
- **范围内**：
  - alova `useSSE` hook 集成，替换 `chat.tsx` 中的 `TODO: SSE 流式调用` 占位
  - 流式 chunk 逐字追加到 `chatStore.appendStreamContent`
  - 当 `activeSession` 为 null 时，前端必须先调用 `createSession` 创建新会话，再发送 SSE 请求（sessionId 不可为空字符串）
  - 流式完成后调用 `chatStore.flushStreamContent` 生成完整 assistant message
  - 连接中断时显示错误提示 + 重连按钮
  - 流式传输中禁用 ChatInput（发送按钮灰化）
  - 停止生成按钮（通过 `useSSE.abort()` 中断 SSE 连接）
  - 修复 `streamChat` API method 使其请求体对齐后端 `ChatDto`
  - 流式内容渲染期间的 loading 指示器（已部分实现的三点跳动动画）
- **范围外**：
  - 不在此 issue 实现会话创建/切换（由 f-45 负责）
  - 不涉及后端 SSE 端点修改
  - 不实现 KbSelector（知识库选择器）与 SSE 携带 knowledgeBaseIds 的联动（f-49 之前保持空数组）
  - 不实现 LLM provider/model 配置选择 UI（由 f-48 Settings 负责，当前阶段使用硬编码默认值）
  - 不重写 MessageBubble 组件（已实现 Markdown 渲染）

## 涉及页面/组件
- **ChatViewPage** (`packages/web/src/routes/app/chat.tsx`) — 主聊天页面，SSE 流式逻辑的宿主
- **ChatInput** (`packages/web/src/components/chat/ChatInput.tsx`) — 输入框，流式中禁用 + 发送按钮切换为停止按钮
- **MessageBubble** (`packages/web/src/components/chat/MessageBubble.tsx`) — 消息气泡，复用渲染 streaming 临时消息
- **chatStore** (`packages/web/src/stores/chat.ts`) — Zustand store，流式状态管理（appendStreamContent/flushStreamContent/isStreaming/streamingContent）
- **streamChat API** (`packages/web/src/api/chat.ts`) — SSE 请求 method 声明

## 上游依赖
- **f-40 session store** — 提供 `activeSession.id`，SSE 请求需要 sessionId 参数。阻塞项：本 issue 必须在 f-40 关闭后启动
- **f-41 settings store** — 提供 LLM 配置（provider/model/baseUrl/apiKey），SSE 请求需要 config 参数。非严格阻塞：可在本 issue 中临时硬编码默认值（`provider: "openai"`, `model: "gpt-4o"`, `baseUrl: "https://api.openai.com/v1"`, `apiKey: ""`），等 f-48 完成后再接入真实配置
- **后端正 SSE 端点** (`POST /api/chat`) — 已实现，不需要修改。请求体为 `ChatDto`（含 message/sessionId/config），响应为 SSE text/event-stream

## 下游消费
- **f-45 Chat 会话管理** — 会话创建/切换后，本 feature 的 SSE 流能自动跟随 `activeSession` 变化

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 alova `useSSE`（而非手写 EventSource） | alova 内置 SSE hook，与现有 alova 实例一致，提供自动重连、事件绑定、readyState | 是（useSSE 与手动 EventSource 功能等价，切换成本低） |
| 设置 `interceptByGlobalResponded: false` | SSE 响应是流，非 JSON。全局 `responded.onSuccess` 会尝试 `response.json()` 导致解析失败 | 否（SSE 特性决定不可走 JSON 解析路径） |
| SSE 完成后由 `onMessage` 中检测 `done: true` 信号（chunk 格式为 `{ chunk, done }`），触发 `flushStreamContent` | 后端 SSE chunk 包含 `{ chunk: string, done: boolean }` 结构 | 是（检测逻辑可随后端协议调整） |
| 流式状态下发送按钮替换为停止按钮 | 用户需要中断长时间生成的能力，符合 Chat UI 惯例 | 是 |
| 默认 LLM 配置硬编码在 ChatViewPage 组件内 | f-41 settings store 尚未完成，硬编码临时方案可解耦依赖，后续接入时删除常量即可 | 是（后续 f-48 完成后删除硬编码常量） |
| 连接中断使用 `onError` + `readyState === 2` 检测，显示错误提示卡片 + 手动重连按钮 | alova `reconnectionTime` 自动重连只适用网络瞬断，对持久性错误（如 401/500）需要用户介入 | 否（错误分类与恢复策略不同） |

## 数据流

```
用户点击发送 / Enter
  ↓
handleSend(content)
  ↓
appendMessage(userMsg)              → 用户消息立即显示
  ↓
setIsStreaming(true)                → 禁用输入框
  ↓
useSSE send(sessionId, message, config)  → POST /api/chat (SSE)
  ↓
onMessage({ data: { chunk, done } })
  ├─ !done → appendStreamContent(chunk)  → streamingContent 累加 → UI 实时渲染
  └─ done  → flushStreamContent()          → messages[] 追加完整 assistant message
                setIsStreaming(false)       → 恢复输入框
  ↓
onError / 用户点击停止
  ↓
setIsStreaming(false)                → 恢复输入框
  └─ 错误时：显示 ErrorCard + 重连按钮
```
