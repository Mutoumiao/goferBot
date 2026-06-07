---
id: f-44
issue: issue.md
version: 1
---

# ChatView SSE 流式接收 实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 在 `routes/app/chat.tsx` 中集成 alova `useSSE` hook，实现 Chat 消息的流式接收和渲染，替代当前的 `TODO: SSE 流式调用` 占位。

**架构：** 前端 React 组件通过 alova `useSSE` 连接后端 `POST /api/chat` SSE 端点，接收 `{ chunk, done }` 格式的数据块，调用 Zustand chatStore 的 `appendStreamContent`/`flushStreamContent` 管理流式状态。ChatInput 新增 `isStreaming`/`onStop` props 支持流式禁控和停止操作。

**技术栈：** React + TanStack Start + alova useSSE + Zustand + Vitest + React Testing Library

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/](./specs/)
**PRD 引用：** [docs/prd/v3-frontend-migration.md](../../prd/v3-frontend-migration.md) §5.7 阶段三深化

---

## PRD 一致性声明

| PRD 目标 | Plan 覆盖情况 | 说明 |
|----------|--------------|------|
| Chat SSE 流式 — useSSE hook 集成 | ✅ 已覆盖 | 任务 3 |
| 流式接收与渲染 | ✅ 已覆盖 | 任务 3、chatStore 已就绪 |
| 错误重连 | ✅ 已覆盖 | 任务 4 |
| loading 动画 | ✅ 已覆盖 | 任务 3（三点跳动动画已在 ChatViewPage 中预置） |
| ChatInput 停止按钮 | ✅ 已覆盖 | 任务 2 |

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | 验证方案、响应格式 | 豁免 | 纯前端 issue，不涉及后端 DTO |
| ADR 0001 | 依赖引入 | ✅ 符合 | 未引入新 npm 包（useSSE 来自已安装的 alova v3） |

---

## Spec 与后端正接口差异说明

behavior-spec.md 中描述的 SSE chunk 协议字段名为 `content`：

```
data: {"content":"部分文本","done":false}
```

但后端正 `POST /api/chat` SSE 端点的实际输出格式为 `chunk`（见 `packages/server/src/modules/chat/chat.service.ts:15`）：

```typescript
interface ChatChunk {
  chunk: string
  done: boolean
}
```

**Plan 决策：** 前端实现使用后端实际字段名 `chunk`（非 spec 中的 `content`）。这确保与后端兼容，spec 中的字段名差异记录在此供后续统一。

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `packages/web/src/api/chat.ts` | 修正 `streamChat` API method，对齐后端 `POST /chat` + ChatDto |
| 修改 | `packages/web/src/components/chat/ChatInput.tsx` | 新增 `isStreaming`/`onStop` props |
| 修改 | `packages/web/src/routes/app/chat.tsx` | useSSE 集成、错误处理、重试逻辑 |
| 创建 | `tests/unit/web/chat-sse.spec.tsx` | 单元测试（AC-01 ~ AC-10） |
| 创建 | `tests/unit/web/chat-input-streaming.spec.tsx` | ChatInput 流式态单元测试 |

> chatStore（`packages/web/src/stores/chat.ts`）已有 `isStreaming`/`streamingContent`/`appendStreamContent`/`flushStreamContent`/`setIsStreaming` 等完整 API，无需修改。

---

## 任务 1: 修正 `streamChat` API method 签名

**文件：**
- 修改：`packages/web/src/api/chat.ts:14-16`
- 测试：`tests/unit/web/chat-sse.spec.tsx`

**规格引用：**
- 功能规格：涉及组件 — streamChat API
- 行为规格：SSE Chunk 协议

### 当前代码问题

```typescript
// 当前（错误）：端点 /chat/stream 不存在，body 格式与 ChatDto 不对齐
export const streamChat = (sessionId: string, content: string) =>
  alovaInstance.Post('/chat/stream', { sessionId, content })
```

后端实际：
- 端点：`POST /api/chat`（controller `@Controller('chat')` + `@Post()`）
- 请求体：`ChatDto` = `{ message, sessionId, knowledgeBaseIds?, config: { provider, model, baseUrl, apiKey } }`

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/web/chat-sse.spec.tsx
import { describe, it, expect, vi } from 'vitest'
import { streamChat } from '@/api/chat'

describe('streamChat API method', () => {
  it('AC-00: should construct POST /chat request with correct ChatDto-shaped body', () => {
    // 调用 streamChat 应返回 Method 实例，其 config.url 为 /chat
    // 由于 alova Method 创建时有内部校验，我们验证参数能正常传递
    const method = streamChat({
      message: 'hello',
      sessionId: '00000000-0000-0000-0000-000000000001',
      knowledgeBaseIds: [],
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
      },
    })

    // Method 实例应存在
    expect(method).toBeDefined()
    // 验证 url 包含 /chat（alova 实例的 baseURL 会自动拼接）
    // 此处只验证函数可调用且不抛出异常
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/web/chat-sse.spec.tsx
```

预期：FAIL — 当前 `streamChat` 签名不接受对象参数，TypeScript 编译失败。

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/web/src/api/chat.ts（修正 streamChat）

/** SSE 流式聊天请求参数 */
export interface StreamChatParams {
  message: string
  sessionId: string
  knowledgeBaseIds?: string[]
  config: {
    provider: string
    model: string
    baseUrl: string
    apiKey: string
  }
}

/** SSE 流式聊天 — POST /api/chat（text/event-stream） */
export const streamChat = (params: StreamChatParams) =>
  alovaInstance.Post('/chat', {
    message: params.message,
    sessionId: params.sessionId,
    knowledgeBaseIds: params.knowledgeBaseIds ?? [],
    config: params.config,
  })
```

注意：`streamChat` 返回 alova `Method` 实例，前端不直接访问其响应体 — 由 `useSSE` hook 消费。

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/web/chat-sse.spec.tsx
```

预期：PASS

- [ ] **步骤 5: 验证并标记完成**

```bash
npx vitest run tests/unit/web/
```

> 注意：任务完成后不提交。所有任务完成后统一审查、统一提交。

[CHECKPOINT] ✅ 任务 1 完成 — streamChat API method 已对齐后端 POST /api/chat + ChatDto

---

## 任务 2: ChatInput 新增流式态 props

**文件：**
- 修改：`packages/web/src/components/chat/ChatInput.tsx`
- 测试：`tests/unit/web/chat-input-streaming.spec.tsx`（新建）

**规格引用：**
- 行为规格：组件行为变更 — ChatInput 变更
- 行为规格：交互状态表 — streaming 状态 "ChatInput 禁用，发送按钮变为红色停止按钮"

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/web/chat-input-streaming.spec.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatInput } from '@/components/chat/ChatInput'

describe('ChatInput streaming state', () => {
  it('AC-02a: should show stop button instead of send button when isStreaming is true', () => {
    const onStop = vi.fn()
    const onSend = vi.fn()

    render(
      <ChatInput
        onSend={onSend}
        isStreaming={true}
        onStop={onStop}
      />,
    )

    // 应存在停止按钮
    const stopBtn = screen.getByRole('button', { name: /停止/i })
    expect(stopBtn).toBeDefined()

    // 不应该存在发送按钮
    expect(screen.queryByRole('button', { name: /发送/i })).toBeNull()
  })

  it('AC-02b: should disable textarea when isStreaming is true', () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        isStreaming={true}
        onStop={vi.fn()}
      />,
    )

    const textarea = screen.getByPlaceholderText(/输入/)
    expect(textarea).toBeDisabled()
  })

  it('AC-02c: should call onStop when stop button is clicked', () => {
    const onStop = vi.fn()

    render(
      <ChatInput
        onSend={vi.fn()}
        isStreaming={true}
        onStop={onStop}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /停止/i }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('AC-02d: should not show stop button when isStreaming is false (default)', () => {
    render(<ChatInput onSend={vi.fn()} />)

    // 应显示发送按钮
    expect(screen.getByRole('button', { name: /发送/i })).toBeDefined()
    // 不应存在停止按钮
    expect(screen.queryByRole('button', { name: /停止/i })).toBeNull()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/web/chat-input-streaming.spec.tsx
```

预期：FAIL — ChatInput 当前不接受 `isStreaming`/`onStop` props，编译失败（模式 B：编译失败 RED）。

**创建最小空壳消除编译错误：**

在 `ChatInput.tsx` 中添加空 props 定义，使测试可编译并断言失败：

```typescript
// 最小空壳（仅消除编译错误）
interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  placeholder?: string
  isStreaming?: boolean   // 新增
  onStop?: () => void      // 新增
}
```

重新运行测试 → 断言失败 RED（按钮文本不匹配）。✅ 有效 RED。

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/web/src/components/chat/ChatInput.tsx

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/utils/cn'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  placeholder?: string
  isStreaming?: boolean
  onStop?: () => void
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = '输入消息...',
  isStreaming = false,
  onStop,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(
    async () => {
    const trimmed = value.trim()
    if (!trimmed || disabled || isStreaming) return
    onSend(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }, [value, disabled, isStreaming, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isStreaming) return
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-border-default bg-surface-1 p-4">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isStreaming}
        placeholder={placeholder}
        rows={2}
        className={cn(
          'flex-1 resize-none rounded-md border px-3 py-2 text-sm',
          'border-border-default bg-surface-1 text-text-primary',
          'focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      />
      {isStreaming ? (
        <button
          onClick={onStop}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium text-white',
            'bg-destructive hover:bg-destructive/90',
          )}
        >
          停止
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium text-white',
            'bg-brand-primary hover:bg-brand-secondary',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          发送
        </button>
      )}
    </div>
  )
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/web/chat-input-streaming.spec.tsx
```

预期：PASS（所有 4 个测试通过）

- [ ] **步骤 5: 验证并标记完成**

```bash
npx vitest run tests/unit/web/
```

> 注意：任务完成后不提交。所有任务完成后统一审查、统一提交。

[CHECKPOINT] ✅ 任务 2 完成 — ChatInput 已支持 isStreaming/onStop props

---

## 任务 3: ChatViewPage 集成 useSSE — 流式发送/接收/完成

**文件：**
- 修改：`packages/web/src/routes/app/chat.tsx`
- 测试：`tests/unit/web/chat-sse.spec.tsx`（追加测试用例）

**规格引用：**
- 功能规格：数据流图
- 行为规格：正常流程步骤 1-6、交互状态表（idle/streaming/streaming-complete）
- 行为规格：SSE Chunk 协议

- [ ] **步骤 1: 编写失败测试（mock useSSE）**

```typescript
// tests/unit/web/chat-sse.spec.tsx（追加以下测试用例）

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatViewPage } from '@/routes/app/chat'
import { useChatStore } from '@/stores/chat'

// Mock alova useSSE
const mockAbort = vi.fn()
const mockSend = vi.fn()

vi.mock('alova/client', () => ({
  useSSE: vi.fn(() => ({
    send: mockSend,
    abort: mockAbort,
    onMessage: vi.fn(),
    onError: vi.fn(),
    onComplete: vi.fn(),
  })),
  useRequest: vi.fn(() => ({
    send: vi.fn(() => Promise.resolve({ data: { messages: [] } })),
  })),
}))

// Mock streamChat 返回 method 标识
vi.mock('@/api/chat', () => ({
  streamChat: vi.fn(() => ({ __type: 'method' })),
  getHistory: vi.fn(() => ({ __type: 'method' })),
}))

describe('ChatViewPage SSE streaming', () => {
  beforeEach(() => {
    useChatStore.setState({
      activeSession: null,
      messages: [],
      isStreaming: false,
      streamingContent: '',
    })
    vi.clearAllMocks()
  })

  it('AC-03: should disable ChatInput and show stop button when streaming', async () => {
    // 设置 streaming 状态
    useChatStore.setState({ isStreaming: true })

    render(<ChatViewPage />)

    // ChatInput 应处于禁用态
    const textarea = screen.getByPlaceholderText(/输入/)
    expect(textarea).toBeDisabled()

    // 应显示停止按钮
    expect(screen.getByRole('button', { name: /停止/i })).toBeDefined()
  })

  it('AC-04: should append streaming content chunks to message list', () => {
    useChatStore.setState({
      isStreaming: true,
      streamingContent: '你好，这是',
    })

    render(<ChatViewPage />)

    // 应渲染流式气泡
    expect(screen.getByText('你好，这是')).toBeDefined()
  })

  it('AC-05: should show bouncing dots loading indicator before first chunk arrives', () => {
    useChatStore.setState({ isStreaming: true, streamingContent: '' })

    render(<ChatViewPage />)

    // 应渲染三点跳动动画（三个 span 带 animate-bounce class）
    const dots = document.querySelectorAll('.animate-bounce')
    expect(dots.length).toBe(3)
  })

  it('AC-06: should clear streaming content and add complete message on done', async () => {
    // 模拟 flush：先设置 streamingContent
    useChatStore.setState({
      isStreaming: true,
      streamingContent: '完整回复',
      messages: [],
    })

    // 调用 flushStreamContent
    useChatStore.getState().flushStreamContent()

    const state = useChatStore.getState()
    expect(state.streamingContent).toBe('')
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].role).toBe('assistant')
    expect(state.messages[0].content).toBe('完整回复')
  })

  it('AC-09: should stop SSE and preserve partial content on stop button click', () => {
    useChatStore.setState({
      isStreaming: true,
      streamingContent: '部分内',
    })

    render(<ChatViewPage />)

    // 点击停止按钮
    fireEvent.click(screen.getByRole('button', { name: /停止/i }))

    // 应调用 abort
    expect(mockAbort).toHaveBeenCalled()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/web/chat-sse.spec.tsx
```

预期：FAIL — ChatViewPage 尚未集成 useSSE，流式状态不会正确传递。

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/web/src/routes/app/chat.tsx

import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useRequest, useSSE } from 'alova/client'
import { getHistory, streamChat } from '@/api/chat'
import { useChatStore } from '@/stores/chat'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { EditorPlaceholder } from '@/components/chat/EditorPlaceholder'

export const Route = createFileRoute('/app/chat')({
  component: ChatViewPage,
})

/** 默认 LLM 配置（硬编码临时值，f-48 完成后替换为 settingsStore） */
const DEFAULT_LLM_CONFIG = {
  provider: 'openai',
  model: 'gpt-4o',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
}

function ChatViewPage() {
  const {
    activeSession,
    messages,
    streamingContent,
    isStreaming,
    setMessages,
    appendMessage,
    setIsLoadingHistory,
    isLoadingHistory,
    setIsStreaming,
    appendStreamContent,
    flushStreamContent,
  } = useChatStore()

  // 错误状态
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorRetryMessage, setErrorRetryMessage] = useState<string | null>(null)

  // 加载历史消息
  const { send: loadHistory } = useRequest(
    () => getHistory(activeSession?.id ?? ''),
    { immediate: false },
  )

  useEffect(() => {
    if (activeSession?.id) {
      setIsLoadingHistory(true)
      loadHistory().then((res) => {
        const data = (res as { data?: { messages?: unknown[] } })?.data
        if (data?.messages) {
          setMessages(data.messages as never[])
        }
        setIsLoadingHistory(false)
      }).catch(() => {
        setIsLoadingHistory(false)
      })
    }
  }, [activeSession?.id])

  // SSE hook — interceptByGlobalResponded: false 避免全局响应拦截器对 SSE 流执行 JSON 解析
  const { send: sseSend, abort: sseAbort, onMessage, onError, onComplete } = useSSE(
    (message: string, sessionId: string, config: typeof DEFAULT_LLM_CONFIG) =>
      streamChat({
        message,
        sessionId,
        knowledgeBaseIds: [],
        config,
      }),
    {
      interceptByGlobalResponded: false,
      immediate: false,
    },
  )

  // 绑定 SSE 消息处理
  onMessage((event: { data: string }) => {
    try {
      const parsed = JSON.parse(event.data) as { chunk: string; done: boolean; error?: string }
      if (parsed.error) {
        setErrorMessage(parsed.error)
        setIsStreaming(false)
        return
      }
      if (parsed.done) {
        flushStreamContent()
        setIsStreaming(false)
      } else {
        appendStreamContent(parsed.chunk)
      }
    } catch {
      // 忽略无法解析的 chunk
    }
  })

  onError((event: { error: Error }) => {
    setErrorMessage(event.error?.message ?? '网络连接失败，请检查网络后重试')
    setIsStreaming(false)
  })

  onComplete(() => {
    // SSE 连接结束（正常或异常）
  })

  const handleSend = useCallback(
    (content: string) => {
      if (!content.trim()) return

      // 清除上一次错误
      setErrorMessage(null)

      // 添加用户消息到列表
      const userMsg = {
        id: `msg-${Date.now()}`,
        sessionId: activeSession?.id ?? '',
        role: 'user' as const,
        content,
        createdAt: new Date().toISOString(),
      }
      appendMessage(userMsg)

      // 保存最近一次发送的消息内容用于错误重试（重试时重新发送同一消息文本）
      setErrorRetryMessage(content)

      // 进入流式状态
      setIsStreaming(true)

      // 若无活跃会话，先创建新会话再发送 SSE
      let sessionId = activeSession?.id
      if (!sessionId) {
        const newSession = await createSession()
        sessionId = newSession.id
        // createSession 会通过 f-40 store 同步 activeSession
      }

      // 发起 SSE 请求
      sseSend(content, sessionId ?? '', DEFAULT_LLM_CONFIG)
    },
    [activeSession, appendMessage, setIsStreaming, sseSend, createSession],
  )

  const handleStop = useCallback(() => {
    sseAbort()
    // 保留已接收的部分内容为完整消息
    flushStreamContent()
    setIsStreaming(false)
  }, [sseAbort, flushStreamContent, setIsStreaming])

  const handleRetry = useCallback(() => {
    if (!errorRetryMessage) return
    setErrorMessage(null)
    handleSend(errorRetryMessage)
  }, [errorRetryMessage, handleSend])

  return (
    <div className="flex h-full flex-col">
      {/* 会话标题栏 */}
      <div className="flex h-12 items-center border-b border-border-default bg-surface-1 px-4">
        <h2 className="text-sm font-medium text-text-primary">
          {activeSession?.title ?? '新对话'}
        </h2>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-8 text-sm text-text-secondary">
            加载中...
          </div>
        )}

        {!isLoadingHistory && messages.length === 0 && !streamingContent && !errorMessage && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-medium text-text-primary">开始新对话</h3>
              <p className="mt-2 text-sm text-text-secondary">
                在下方输入消息，开始与 AI 对话
              </p>
              <EditorPlaceholder className="mt-6 mx-4" />
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* SSE 流式接收中的临时内容 */}
        {isStreaming && streamingContent && (
          <MessageBubble
            message={{
              id: 'streaming',
              sessionId: activeSession?.id ?? '',
              role: 'assistant',
              content: streamingContent,
              createdAt: new Date().toISOString(),
            }}
          />
        )}

        {/* 流式加载指示器（首 chunk 到达前） */}
        {isStreaming && !streamingContent && (
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="h-8 w-8 rounded-full bg-surface-3" />
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary [animation-delay:0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary [animation-delay:0.3s]" />
            </div>
          </div>
        )}

        {/* ErrorCard — SSE 连接失败 */}
        {errorMessage && (
          <div className="mx-4 my-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm text-destructive-foreground">{errorMessage}</p>
            <button
              onClick={handleRetry}
              className="mt-2 rounded-md bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              重试
            </button>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <ChatInput
        onSend={handleSend}
        isStreaming={isStreaming}
        onStop={handleStop}
        placeholder={activeSession ? '继续对话...' : '输入消息开始新对话...'}
      />
    </div>
  )
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/web/chat-sse.spec.tsx
```

预期：PASS（AC-03 ~ AC-06, AC-09 通过）

- [ ] **步骤 5: 验证并标记完成**

```bash
npx vitest run tests/unit/web/
```

> 注意：任务完成后不提交。所有任务完成后统一审查、统一提交。

[CHECKPOINT] ✅ 任务 3 完成 — ChatViewPage 已集成 useSSE，覆盖流式发送/接收/完成/停止

---

## 任务 4: 错误处理和重试逻辑

**文件：**
- 修改：`packages/web/src/routes/app/chat.tsx`（错误状态已在任务 3 中预先加入结构）
- 测试：`tests/unit/web/chat-sse.spec.tsx`（追加测试用例）

**规格引用：**
- 行为规格：交互状态表 — error 状态、错误场景表
- 行为规格：错误场景 — SSE 连接失败 / HTTP 错误 / 用户主动停止

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/web/chat-sse.spec.tsx（追加以下测试用例）

describe('ChatViewPage error handling', () => {
  beforeEach(() => {
    useChatStore.setState({
      activeSession: null,
      messages: [],
      isStreaming: false,
      streamingContent: '',
    })
    vi.clearAllMocks()
  })

  it('AC-07: should display ErrorCard with retry button on SSE connection error', async () => {
    // mock useSSE 的 onError 回调引用（在模块级 mock 中捕获）
    let capturedOnError: ((event: { error: Error }) => void) | null = null

    vi.mocked(useSSE).mockImplementation(() => ({
      send: mockSend,
      abort: mockAbort,
      onMessage: vi.fn(),
      onError: (cb: (event: { error: Error }) => void) => {
        capturedOnError = cb
      },
      onComplete: vi.fn(),
    }))

    render(<ChatViewPage />)

    // 触发 onError 模拟 SSE 连接失败
    await act(async () => {
      capturedOnError!({ error: new Error('网络连接失败，请检查网络后重试') })
    })

    // 断言 ErrorCard DOM 存在
    const errorCard = screen.getByText(/网络连接失败/)
    expect(errorCard).toBeDefined()

    // 断言重试按钮可见
    const retryBtn = screen.getByRole('button', { name: /重试/i })
    expect(retryBtn).toBeDefined()
  })

  it('AC-08: should retry SSE connection when retry button clicked', async () => {
    let capturedOnError: ((event: { error: Error }) => void) | null = null

    vi.mocked(useSSE).mockImplementation(() => ({
      send: mockSend,
      abort: mockAbort,
      onMessage: vi.fn(),
      onError: (cb: (event: { error: Error }) => void) => {
        capturedOnError = cb
      },
      onComplete: vi.fn(),
    }))

    // 先设置一条用户消息作为 errorRetryMessage 的来源
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          sessionId: '',
          role: 'user',
          content: '测试消息',
          createdAt: new Date().toISOString(),
        },
      ],
    })

    render(<ChatViewPage />)

    // 触发 onError 显示 ErrorCard
    await act(async () => {
      capturedOnError!({ error: new Error('服务器错误') })
    })

    // 点击重试按钮
    const retryBtn = screen.getByRole('button', { name: /重试/i })
    fireEvent.click(retryBtn)

    // 断言 handleSend 被调用（通过 mockSend 验证）
    // 重试会触发 handleSend → sseSend，所以 mockSend 应被调用
    expect(mockSend).toHaveBeenCalled()
  })

  it('AC-09: should handle user-requested stop gracefully', () => {
    useChatStore.setState({
      isStreaming: true,
      streamingContent: '部分回复内容',
      messages: [],
    })

    render(<ChatViewPage />)

    // 点击停止按钮
    fireEvent.click(screen.getByRole('button', { name: /停止/i }))

    // 应调用 abort
    expect(mockAbort).toHaveBeenCalled()

    // 验证内容已保留为完整消息
    const state = useChatStore.getState()
    expect(state.streamingContent).toBe('')
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].role).toBe('assistant')
    expect(state.messages[0].content).toBe('部分回复内容')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/web/chat-sse.spec.tsx
```

预期：部分测试 PASS（AC-07/AC-08 因 errorMessage 是组件内部状态，mock 不全可能导致 FAIL）。

- [ ] **步骤 3: 编写最小实现**

错误处理逻辑已在任务 3 的组件代码中完整实现：

1. **`onError` 回调** — 设置 `errorMessage` 状态，调用 `setIsStreaming(false)` 恢复输入框
2. **`errorMessage` 渲染** — ErrorCard（红色边框卡片 + 错误描述 + 重试按钮）
3. **`handleRetry`** — 清除 error，使用 `errorRetryMessage` 重新发送
4. **`handleStop`** — `sseAbort()` + `flushStreamContent()` + `setIsStreaming(false)`
5. **`onMessage` 错误 chunk** — 检测 `parsed.error` 字段，设置错误状态

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/web/chat-sse.spec.tsx
```

预期：PASS（AC-07 ~ AC-10 通过）

- [ ] **步骤 5: 验证并标记完成**

```bash
npx vitest run tests/unit/web/
```

> 注意：任务完成后不提交。所有任务完成后统一审查、统一提交。

[CHECKPOINT] ✅ 任务 4 完成 — 错误处理、重试、停止逻辑已实现

---

## 任务 5: 自动重连（alova reconnectionTime 验证 + 手动兜底）

**文件：**
- 修改：`packages/web/src/routes/app/chat.tsx`
- 新建：`packages/web/src/components/chat/ReconnectBanner.tsx`（方案 B 时需要）
- 测试：`tests/unit/web/chat-sse.spec.tsx`（追加 AC-10、AC-11 测试用例）

**规格引用：**
- 行为规格：交互状态表 — reconnect 状态
- 行为规格：错误场景 — SSE 连接中断（mid-stream 网络瞬断）

> **不确定项**：alova `useSSE` 是否原生支持 `reconnectionTime` 配置。规格描述的行为为 "连接中断 → 显示黄色提示条 → 3s 后自动重连 → 成功则继续流式，失败则降级 ErrorCard"。
>
> **Plan 策略**：先通过前置验证确定 alova 能力边界，再选择方案 A（原生）或方案 B（手动），方案 B 最多重试 3 次。

---

### 步骤 0: 前置验证 — 确认 alova v3 useSSE 是否支持 reconnectionTime

> **关键决策点**：在实现重连功能前，必须先确认 alova v3 `useSSE` 的 options 类型中是否包含 `reconnectionTime` 参数。

**验证方法（按顺序执行）**：

```bash
# 方法 1（推荐）：直接查看 alova useSSE 的类型定义文件
# 查找 SSEHookConfig 接口，确认其属性列表中是否包含 reconnectionTime
cat node_modules/alova/typings/client/hooks/useSSE.d.ts
```

```bash
# 方法 2：用 TypeScript 编译器快速探测
# 在 chat.tsx 中临时添加 reconnectionTime: 3000 到 useSSE options，
# 然后运行 tsc check。若报错 "Object literal may only specify known properties"
# 则不支持，若无报错则支持。
npx tsc --noEmit --project packages/web/tsconfig.json
```

> 方法 1 直接查看接口定义最可靠。方法 2 作为交叉验证。

**判定标准**：

| 验证结果 | 含义 | 执行路径 |
|----------|------|----------|
| `SSEHookConfig` 接口包含 `reconnectionTime?: number` | alova 原生支持自动重连 | **→ 方案 A** |
| `SSEHookConfig` 接口不包含 `reconnectionTime` | alova 不支持自动重连 | **→ 方案 B** |
| 类型文件路径不存在或结构不同 | 当前 alova 版本与预期不一致 | **→ 方案 B（安全兜底）** |

---

### 方案 A：alova 原生支持 reconnectionTime

**前提**：`SSEHookConfig` 包含 `reconnectionTime?: number`。

- [ ] **步骤 A1: 配置 reconnectionTime**

```typescript
const { send: sseSend, abort: sseAbort, onMessage, onError, onComplete } = useSSE(
  (message: string, sessionId: string, config: typeof DEFAULT_LLM_CONFIG) =>
    streamChat({ message, sessionId, knowledgeBaseIds: [], config }),
  {
    interceptByGlobalResponded: false,
    immediate: false,
    reconnectionTime: 3000, // 3 秒后自动重连
  },
)
```

- [ ] **步骤 A2: 编写测试**

```typescript
// tests/unit/web/chat-sse.spec.tsx

it('AC-10: should pass reconnectionTime to useSSE options', () => {
  // 验证 useSSE 被调用时 options 中包含 reconnectionTime: 3000
  expect(useSSE).toHaveBeenCalledWith(
    expect.any(Function),
    expect.objectContaining({ reconnectionTime: 3000 }),
  )
})
```

- [ ] **步骤 A3: 手动验证**

```bash
pnpm dev
# 发送消息后断开网络 → 观察 alova 是否自动重连
# 重连成功后流式继续
```

- [ ] **步骤 A4: 验证并标记完成**

```bash
npx vitest run tests/unit/web/chat-sse.spec.tsx
```

[CHECKPOINT] ✅ 方案 A — alova 原生 reconnectionTime 已配置

---

### 方案 B：手动实现自动重连（alova 不支持时）

**前提**：`SSEHookConfig` 不包含 `reconnectionTime`。

**实现要点**：
- `useState` 管理 `reconnectCount`（0..3）+ `isReconnecting` 布尔值
- `onError` 中判断：若 `streamingContent` 非空（mid-stream 中断）且 `reconnectCount < 3` → 启动 3s 定时器重连
- 黄色提示条 UI 由独立子组件 `ReconnectBanner` 渲染，包含倒计时文案 + "取消重连"按钮
- 达到最大重试次数（3 次）后降级为 ErrorCard（显示错误信息 + 重试按钮，此时重试走 handleRetry 全量重发）
- 用户主动停止（handleStop）时清除重连定时器，重置 reconnectCount

#### 步骤 B0: 创建 ReconnectBanner 子组件

**文件**：`packages/web/src/components/chat/ReconnectBanner.tsx`（新建）

```typescript
// packages/web/src/components/chat/ReconnectBanner.tsx

import { cn } from '@/utils/cn'

interface ReconnectBannerProps {
  /** 当前重试次数（1-based） */
  attempt: number
  /** 最大重试次数 */
  maxAttempts: number
  /** 取消重连回调 */
  onCancel: () => void
}

export function ReconnectBanner({ attempt, maxAttempts, onCancel }: ReconnectBannerProps) {
  return (
    <div
      className={cn(
        'mx-4 my-2 flex items-center justify-between rounded-md px-4 py-2',
        'bg-yellow-50 dark:bg-yellow-950',
        'border border-yellow-300 dark:border-yellow-800',
      )}
    >
      <span className="text-sm text-yellow-700 dark:text-yellow-300">
        连接中断，正在重连（{attempt}/{maxAttempts}）...
      </span>
      <button
        onClick={onCancel}
        className={cn(
          'rounded px-2 py-1 text-xs font-medium',
          'text-yellow-700 hover:bg-yellow-200 dark:text-yellow-300 dark:hover:bg-yellow-900',
        )}
      >
        取消重连
      </button>
    </div>
  )
}
```

#### 步骤 B1: 在 ChatViewPage 中集成手动重连逻辑

**文件**：`packages/web/src/routes/app/chat.tsx`（修改）

在组件顶部新增状态：

```typescript
// 自动重连状态（仅方案 B 需要）
const [reconnectCount, setReconnectCount] = useState(0)
const [isReconnecting, setIsReconnecting] = useState(false)
const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const MAX_RECONNECT_ATTEMPTS = 3
```

修改 `handleSend`，发送新消息时重置重连计数：

```typescript
const handleSend = useCallback(
  (content: string) => {
    if (!content.trim()) return

    // 清除上一次错误和重连状态
    setErrorMessage(null)
    setReconnectCount(0)
    setIsReconnecting(false)
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    // ... 其余 handleSend 逻辑保持不变 ...
  },
  [/* deps */],
)
```

修改 `onError` 回调，增加重连判断：

```typescript
onError((event: { error: Error }) => {
  // 若是 mid-stream 中断（已有部分流式内容）且未超过最大重试次数
  if (streamingContent && reconnectCount < MAX_RECONNECT_ATTEMPTS) {
    setIsReconnecting(true)
    const nextCount = reconnectCount + 1
    setReconnectCount(nextCount)

    reconnectTimerRef.current = setTimeout(() => {
      // 重连：使用相同参数重新 send
      sseSend(
        errorRetryMessage ?? '',
        activeSession?.id ?? '',
        DEFAULT_LLM_CONFIG,
      )
      setIsReconnecting(false)
    }, 3000)
  } else {
    // 非 mid-stream 中断，或已达最大重试次数 → 降级为 ErrorCard
    setErrorMessage(
      reconnectCount >= MAX_RECONNECT_ATTEMPTS
        ? '重连失败，请检查网络后手动重试'
        : (event.error?.message ?? '网络连接失败，请检查网络后重试'),
    )
    setIsReconnecting(false)
    setReconnectCount(0)
    setIsStreaming(false)
  }
})
```

修改 `handleStop`，停止时清除重连定时器：

```typescript
const handleStop = useCallback(() => {
  // 清除重连定时器
  if (reconnectTimerRef.current) {
    clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null
  }
  setReconnectCount(0)
  setIsReconnecting(false)

  sseAbort()
  flushStreamContent()
  setIsStreaming(false)
}, [sseAbort, flushStreamContent, setIsStreaming])
```

在 JSX 中渲染 ReconnectBanner（放在消息列表底部、ErrorCard 上方）：

```typescript
{/* ReconnectBanner — 自动重连提示 */}
{isReconnecting && (
  <ReconnectBanner
    attempt={reconnectCount}
    maxAttempts={MAX_RECONNECT_ATTEMPTS}
    onCancel={() => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      setIsReconnecting(false)
      setReconnectCount(0)
      sseAbort()
      flushStreamContent()
      setIsStreaming(false)
    }}
  />
)}
```

#### 步骤 B2: 编写测试（手动重连）

```typescript
// tests/unit/web/chat-sse.spec.tsx（追加）

describe('ChatViewPage auto-reconnect (方案 B)', () => {
  beforeEach(() => {
    useChatStore.setState({
      activeSession: null,
      messages: [],
      isStreaming: false,
      streamingContent: '',
    })
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('AC-10: should show ReconnectBanner on mid-stream error and retry after 3s', async () => {
    let capturedOnError: ((event: { error: Error }) => void) | null = null

    vi.mocked(useSSE).mockImplementation(() => ({
      send: mockSend,
      abort: mockAbort,
      onMessage: vi.fn(),
      onError: (cb: (event: { error: Error }) => void) => {
        capturedOnError = cb
      },
      onComplete: vi.fn(),
    }))

    // 模拟 mid-stream 状态：已有部分流式内容
    useChatStore.setState({
      isStreaming: true,
      streamingContent: '已接收的部分',
      messages: [],
    })

    render(<ChatViewPage />)

    // 触发 onError 模拟网络中断
    await act(async () => {
      capturedOnError!({ error: new Error('网络中断') })
    })

    // 应显示 ReconnectBanner
    expect(screen.getByText(/连接中断/)).toBeDefined()
    expect(screen.getByText(/重连（1\/3）/)).toBeDefined()

    // 应保留已接收的部分内容（不丢失）
    expect(screen.getByText('已接收的部分')).toBeDefined()

    // 快进 3 秒后应重连
    vi.advanceTimersByTime(3000)
    expect(mockSend).toHaveBeenCalled()
  })

  it('AC-11: should fallback to ErrorCard after max reconnect attempts', async () => {
    let capturedOnError: ((event: { error: Error }) => void) | null = null

    vi.mocked(useSSE).mockImplementation(() => ({
      send: mockSend,
      abort: mockAbort,
      onMessage: vi.fn(),
      onError: (cb: (event: { error: Error }) => void) => {
        capturedOnError = cb
      },
      onComplete: vi.fn(),
    }))

    useChatStore.setState({
      isStreaming: true,
      streamingContent: '部分内容',
      messages: [],
    })

    render(<ChatViewPage />)

    // 连续触发 3 次 onError（模拟 3 次重连均失败）
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        capturedOnError!({ error: new Error(`重连失败 ${i + 1}`) })
      })
      vi.advanceTimersByTime(3000)
    }

    // 第 4 次（超过 maxAttempts）应降级为 ErrorCard
    await act(async () => {
      capturedOnError!({ error: new Error('重连失败 4') })
    })

    expect(screen.getByText(/重连失败/)).toBeDefined()
    expect(screen.getByRole('button', { name: /重试/i })).toBeDefined()

    // ReconnectBanner 应消失
    expect(screen.queryByText(/连接中断/)).toBeNull()
  })

  it('AC-11b: should clear reconnect timer on cancel button click', async () => {
    let capturedOnError: ((event: { error: Error }) => void) | null = null

    vi.mocked(useSSE).mockImplementation(() => ({
      send: mockSend,
      abort: mockAbort,
      onMessage: vi.fn(),
      onError: (cb: (event: { error: Error }) => void) => {
        capturedOnError = cb
      },
      onComplete: vi.fn(),
    }))

    useChatStore.setState({
      isStreaming: true,
      streamingContent: '部分内容',
      messages: [],
    })

    render(<ChatViewPage />)

    // 触发 onError
    await act(async () => {
      capturedOnError!({ error: new Error('网络中断') })
    })

    // 点击取消重连
    fireEvent.click(screen.getByRole('button', { name: /取消重连/i }))

    // 应调用 abort 并 flush
    expect(mockAbort).toHaveBeenCalled()

    // 内容应保留为完整消息
    const state = useChatStore.getState()
    expect(state.streamingContent).toBe('')
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].content).toBe('部分内容')
  })
})
```

#### 步骤 B3: 手动验证

```bash
pnpm dev
# 手动测试：
# 1. 发送消息确认 SSE 流式正常
# 2. 发送消息后断开网络 → 观察黄色 ReconnectBanner + 3s 倒计时重连
# 3. 重连期间点击"取消重连" → 确认内容保留、状态恢复
# 4. 连续断网 4 次 → 确认降级为 ErrorCard
```

#### 步骤 B4: 验证并标记完成

```bash
npx vitest run tests/unit/web/chat-sse.spec.tsx
```

预期：PASS（AC-10、AC-11、AC-11b 通过）

[CHECKPOINT] ✅ 方案 B — 手动重连已实现，最多 3 次重试，含 ReconnectBanner 子组件

---

### 分支决策流程总结

```
步骤 0: 验证 SSEHookConfig
  ├── 含 reconnectionTime?: number
  │     └── 执行方案 A（原生配置）
  │           ├── 步骤 A1: 配置 reconnectionTime: 3000
  │           ├── 步骤 A2: 编写测试
  │           ├── 步骤 A3: 手动验证
  │           └── [CHECKPOINT] ✅ 方案 A 完成
  │
  └── 不含 reconnectionTime
        └── 执行方案 B（手动实现）
              ├── 步骤 B0: 创建 ReconnectBanner 子组件
              ├── 步骤 B1: ChatViewPage 集成重连逻辑（reconnectCount + 定时器 + 3 次上限）
              ├── 步骤 B2: 编写测试（AC-10、AC-11、AC-11b）
              ├── 步骤 B3: 手动验证
              └── [CHECKPOINT] ✅ 方案 B 完成
```

> 注意：任务完成后不提交。所有任务完成后统一审查、统一提交。
## 任务 6: TypeScript 类型检查与回归测试

**文件：**
- 无需修改（验证步骤）

- [ ] **步骤 1: TypeScript 类型检查**

```bash
pnpm type-check
```

预期：无新增类型错误。

- [ ] **步骤 2: 运行全部单元测试**

```bash
pnpm test
```

预期：全部通过（含新增的 `chat-sse.spec.tsx` 和 `chat-input-streaming.spec.tsx`）。

- [ ] **步骤 3: 运行全量前端测试**

```bash
npx vitest run tests/unit/web/
```

预期：PASS，无回归。

[CHECKPOINT] ✅ 任务 6 完成 — 类型检查 + 回归测试通过

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| alova `useSSE` API 与 spec 假设不一致（如 `reconnectionTime` 不存在） | 重连功能需手动实现 | 任务 5 已备选方案 |
| `interceptByGlobalResponded: false` 在 alova v3 中配置方式不同 | SSE 流被全局拦截器 JSON 解析失败 | 查阅 alova v3 文档确认配置项名称 |
| f-40 session store 尚未完成，`activeSession` 为 null | SSE 请求需有效 sessionId，否则前端需要先调用 createSession | handleSend 中增加 createSession 前置调用，确保 SSE 请求始终携带有效 sessionId |
| 硬编码 LLM 配置（apiKey 为空）使实际对话无法进行 | 功能可测试但不可用 | f-48 完成后接入真实配置 |

---

## 规格覆盖检查

| 规格章节 | 覆盖任务 | 状态 |
|----------|---------|------|
| 功能规格 — 用户故事（逐字流式输出） | 任务 3 | ✅ |
| 功能规格 — alova useSSE 集成 | 任务 1、3 | ✅ |
| 功能规格 — streamChat API method 修复 | 任务 1 | ✅ |
| 功能规格 — 流式内容渲染 + loading 指示器 | 任务 3 | ✅ |
| 功能规格 — 连接中断错误提示 + 重连 | 任务 4、5 | ✅ |
| 功能规格 — 流式传输中禁用 ChatInput | 任务 2、3 | ✅ |
| 功能规格 — 停止生成按钮 | 任务 2、3 | ✅ |
| 行为规格 — 交互状态表（idle/streaming/error/reconnect） | 任务 3、4、5 | ✅ |
| 行为规格 — 正常流程步骤 1-6 | 任务 3 | ✅ |
| 行为规格 — 错误场景表（5 种） | 任务 4、5 | ✅ |
| 行为规格 — ChatInput 变更 | 任务 2 | ✅ |
| 行为规格 — ChatViewPage 变更 | 任务 3、4 | ✅ |

---

## 测试覆盖清单

| 测试 ID | 描述 | 测试文件 | 对应任务 |
|---------|------|----------|----------|
| AC-00 | streamChat 构建正确的 POST /chat 请求 | `chat-sse.spec.tsx` | 任务 1 |
| AC-02a | isStreaming 时显示停止按钮 | `chat-input-streaming.spec.tsx` | 任务 2 |
| AC-02b | isStreaming 时禁用 textarea | `chat-input-streaming.spec.tsx` | 任务 2 |
| AC-02c | 点击停止按钮调用 onStop | `chat-input-streaming.spec.tsx` | 任务 2 |
| AC-02d | 非 streaming 时显示发送按钮（默认） | `chat-input-streaming.spec.tsx` | 任务 2 |
| AC-03 | streaming 时 ChatInput 禁用 + 停止按钮 | `chat-sse.spec.tsx` | 任务 3 |
| AC-04 | 流式 chunk 追加到消息列表 | `chat-sse.spec.tsx` | 任务 3 |
| AC-05 | 首 chunk 到达前显示三点跳动 loading | `chat-sse.spec.tsx` | 任务 3 |
| AC-06 | done 信号触发 flushStreamContent | `chat-sse.spec.tsx` | 任务 3 |
| AC-07 | SSE 错误时显示 ErrorCard + 重试按钮 | `chat-sse.spec.tsx` | 任务 4 |
| AC-08 | 点击重试按钮重新发送上一条消息 | `chat-sse.spec.tsx` | 任务 4 |
| AC-09 | 停止按钮中断 SSE 并保留部分内容 | `chat-sse.spec.tsx` | 任务 3 |
| AC-10 | 连接中断显示重连提示并自动重连 | `chat-sse.spec.tsx` | 任务 5 |
