# Issue #07 — Ollama 本地模型与全局错误处理 测试用例

**对应 Issue**: `.scratch/knowledge-base/issues/07-ollama-error-handling.md`
**状态**: ready-for-agent
**测试框架**: Vitest（前端 Unit + 组件）、Node 环境 Vitest（Sidecar API）

---

## 7.1 Sidecar API — Ollama 调用

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-07-001 | `streamChatCompletion` Ollama 无 API Key 调用 | config.provider = 'ollama', baseUrl = 'http://localhost:11434', apiKey = '' | 调用函数 | fetch 请求不携带 `Authorization` header，请求体包含 model/messages/stream |
| TC-07-002 | `streamChatCompletion` Ollama SSE 流式返回 | mock Ollama 返回 SSE 流（data: {choices:[{delta:{content:"hi"}}]}） | 调用函数并收集 onChunk | 回调收到 "hi"，解析逻辑与远程 LLM 一致 |
| TC-07-003 | `streamChatCompletion` 非 Ollama 仍发送 API Key | config.provider = 'deepseek', apiKey = 'sk-xxx' | 调用函数 | fetch 请求携带 `Authorization: Bearer sk-xxx` |
| TC-07-004 | `streamChatCompletion` Ollama 地址为空时抛出错误 | config.provider = 'ollama', baseUrl = '' | 调用函数 | 抛出 `Error('Unknown provider: ollama')` 或同等错误 |
| TC-07-005 | `chat.ts POST /chat` 使用 Ollama config 成功 | session 存在，config.provider = 'ollama' | 发送 POST /chat | SSE 正常输出，消息保存到数据库 |

**已有/待补充自动化测试**: `tests/unit/server/llm.test.ts`（扩展）
**覆盖范围**: TC-07-001 ~ TC-07-005

---

## 7.2 Sidecar API — 错误分类与 SSE 输出

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-07-006 | API 错误（401）输出 `type: api_error` | mock LLM 返回 401 | 发送 POST /chat | SSE `error` 事件数据包含 `{ type: 'api_error', message: '...' }` |
| TC-07-007 | API 错误（429）输出 `type: api_error` | mock LLM 返回 429 | 发送 POST /chat | SSE `error` 事件数据包含 `{ type: 'api_error', message: '...' }` |
| TC-07-008 | API 错误（500）输出 `type: api_error` | mock LLM 返回 500 | 发送 POST /chat | SSE `error` 事件数据包含 `{ type: 'api_error', message: '...' }` |
| TC-07-009 | 网络错误（ECONNREFUSED）输出 `type: network_error` | mock fetch 抛出 ECONNREFUSED | 发送 POST /chat | SSE `error` 事件数据包含 `{ type: 'network_error', message: '...' }` |
| TC-07-010 | 网络错误（fetch failed）输出 `type: network_error` | mock fetch 抛出 'fetch failed' | 发送 POST /chat | SSE `error` 事件数据包含 `{ type: 'network_error', message: '...' }` |
| TC-07-011 | 其他错误输出 `type: unknown` | mock fetch 抛出 'random error' | 发送 POST /chat | SSE `error` 事件数据包含 `{ type: 'unknown', message: '...' }` |
| TC-07-012 | 错误输出后 SSE stream 正常关闭 | 任意错误场景 | 观察 stream 结束 | `stream.close()` 被调用，连接正常关闭 |

**已有/待补充自动化测试**: `tests/unit/server/chat.test.ts`（扩展，若存在）或 `tests/unit/server/chatError.test.ts`（新建）
**覆盖范围**: TC-07-006 ~ TC-07-012

---

## 7.3 前端 — Session Store 错误处理

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-07-013 | `sendMessage` sidecar 未就绪时阻止发送 | mock `isSidecarReady` 返回 false | 调用 `sendMessage` | `isSending` = false，`sendError` = 'Sidecar 服务未就绪...'，`sendErrorType` = 'sidecar_error' |
| TC-07-014 | `sendMessage` LLM 未配置时阻止发送 | `getLLMConfig` 返回 null | 调用 `sendMessage` | `isSending` = false，`sendError` = '未配置 LLM 模型...' |
| TC-07-015 | `sendMessage` 解析 SSE error 事件类型 | mock `/chat` 返回 SSE error 事件 `{ type: 'api_error' }` | 调用 `sendMessage` | `sendErrorType` = 'api_error' |
| TC-07-016 | `sendMessage` 网络超时设置 `sendErrorType` | mock `/chat` 抛出 fetch 失败 | 调用 `sendMessage` | `sendErrorType` = 'network_error' |
| TC-07-017 | 每次发送前重置错误状态 | 上一条消息触发错误 | 调用 `sendMessage` | `sendError` = null，`sendErrorType` = null（发送前） |

**已有/待补充自动化测试**: `tests/unit/stores/sessionError.test.ts`（新建）
**覆盖范围**: TC-07-013 ~ TC-07-017

---

## 7.4 前端 — 错误卡片与重试

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-07-018 | 错误卡片渲染不同类型标签 | `ChatErrorCard` props: errorType = 'api_error' | 挂载组件 | 显示标签 "API 错误" |
| TC-07-019 | 错误卡片渲染网络错误标签 | `ChatErrorCard` props: errorType = 'network_error' | 挂载组件 | 显示标签 "网络错误" |
| TC-07-020 | 错误卡片显示错误消息 | `ChatErrorCard` props: message = '连接超时' | 挂载组件 | 显示 "连接超时" |
| TC-07-021 | 点击重试按钮触发 retry 事件 | `ChatErrorCard` 已挂载 | 点击 "重试" 按钮 | emit 'retry' 事件 |
| TC-07-022 | 消息流中 role='error' 时渲染 ChatErrorCard | messages 包含 `{ role: 'error', content: '...' }` | 渲染消息列表 | 该消息位置显示 `ChatErrorCard` 而非普通消息气泡 |

**已有/待补充自动化测试**: `tests/unit/components/ChatErrorCard.test.ts`（新建）
**覆盖范围**: TC-07-018 ~ TC-07-022

---

## 7.5 前端 — AI 思考 Loading 状态

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-07-023 | 发送消息后显示 Loading 指示器 | `isSending` = true，最后一条消息 role = 'user' | 渲染消息列表 | 显示 "思考中..." + loading 图标 |
| TC-07-024 | AI 回复后隐藏 Loading 指示器 | `isSending` = false | 渲染消息列表 | Loading 指示器消失 |
| TC-07-025 | 非发送状态不显示 Loading | `isSending` = false | 渲染消息列表 | 不显示 Loading |
| TC-07-026 | 最后一条非 user 消息时不显示 Loading | `isSending` = true，最后一条 role = 'assistant' | 渲染消息列表 | 不显示 Loading（防止异常状态） |

**已有/待补充自动化测试**: `tests/unit/components/ChatLoading.test.ts`（新建）
**覆盖范围**: TC-07-023 ~ TC-07-026

---

## 7.6 前端 — 输入框禁用状态

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-07-027 | LLM 未配置时输入框禁用 | `getLLMConfig()` = null | 渲染 ChatInput | input 和发送按钮 `disabled` = true，样式变灰 |
| TC-07-028 | 发送中输入框禁用 | `isSending` = true | 渲染 ChatInput | input 和发送按钮 `disabled` = true |
| TC-07-029 | LLM 配置正常时输入框可用 | `getLLMConfig()` 返回有效配置，`isSending` = false | 渲染 ChatInput | input 和发送按钮 `disabled` = false |
| TC-07-030 | 空内容时发送按钮禁用 | 输入框内容为空 | 渲染 ChatInput | 发送按钮 `disabled` = true |

**已有/待补充自动化测试**: `tests/unit/components/ChatInput.test.ts`（扩展）
**覆盖范围**: TC-07-027 ~ TC-07-030

---

## 7.7 前端 — 空状态引导

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-07-031 | 空知识库显示引导文案 | knowledgeBases = [] | 渲染 KnowledgeBasePage | 显示 "暂无知识库" 和 "点击添加文件导入文档" |
| TC-07-032 | 空历史显示引导文案 | historySessions = [] | 渲染 HistoryPage | 显示 "暂无对话历史" 和 "开始一次新对话..." |
| TC-07-033 | 空会话首页显示快捷胶囊 | 首页标签无 sessionId | 渲染 EmptySession | 显示快捷提问胶囊和引导文案 |

**已有/待补充自动化测试**: `tests/unit/components/KnowledgeBasePage.test.ts`（扩展）、`tests/unit/components/HistoryPage.test.ts`（扩展）、`tests/unit/components/EmptySession.test.ts`（扩展）
**覆盖范围**: TC-07-031 ~ TC-07-033

---

## 7.8 前端 — 全局 Toast

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|
| TC-07-034 | Toast 在 sendError 变化时显示 | `sendError` = '网络错误' | 渲染 GlobalToast | Toast 弹窗显示 "网络错误" |
| TC-07-035 | Toast 5 秒后自动消失 | Toast 已显示 | 等待 5s | Toast 消失 |
| TC-07-036 | 点击关闭按钮立即隐藏 Toast | Toast 已显示 | 点击关闭按钮 | Toast 立即消失 |
| TC-07-037 | sendError 为 null 时不显示 Toast | `sendError` = null | 渲染 GlobalToast | 不显示 Toast |

**已有/待补充自动化测试**: `tests/unit/components/GlobalToast.test.ts`（新建）
**覆盖范围**: TC-07-034 ~ TC-07-037
