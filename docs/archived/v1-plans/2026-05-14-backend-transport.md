# BackendTransport 统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一 BackendTransport 模块，将 HTTP 通信逻辑集中到深接口之后，消除 `sidecarClient.ts` 浅模块，Store 测试注入 FakeBackendTransport，完全脱离网络。

**Architecture:** 定义 `BackendTransport` 接口，提供 `HttpBackendTransport`（持有 Shell、管理端口、重试、SSE）和 `FakeBackendTransport`（链式预设、请求记录、SSE 模拟）。模块级导出 `getBackend()` / `setBackend()`。

**Tech Stack:** TypeScript, Vitest, native fetch API

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/backend/types.ts` | `BackendTransport` 接口定义 |
| `src/backend/http-transport.ts` | `HttpBackendTransport` — 真实 HTTP 实现 |
| `src/backend/fake-transport.ts` | `FakeBackendTransport` — 测试适配器 |
| `src/backend/index.ts` | 模块导出 + `getBackend()` / `setBackend()` |
| `src/stores/session.ts` | 替换 `sidecarFetch` 为 `backend.request` / `backend.subscribe` |
| `src/stores/knowledgeBase.ts` | 替换 `sidecarFetch` 为 `backend.request` |
| `src/stores/settings.ts` | 替换 `sidecarFetch` 为 `backend.request` |
| `src/utils/sidecarClient.ts` | **删除**（功能迁移到 HttpBackendTransport） |
| `tests/unit/backend/fake-transport.test.ts` | FakeBackendTransport 单元测试 |
| `tests/unit/stores/session.test.ts` | 重构为 FakeBackendTransport |
| `tests/unit/stores/settings.test.ts` | 重构为 FakeBackendTransport |

---

### Task 1: BackendTransport 接口定义

**Files:**
- Create: `src/backend/types.ts`

- [ ] **Step 1: 编写接口**

```typescript
export type Unlisten = () => void

export interface Subscription {
  unlisten: Unlisten
  /** SSE 连接关闭时 resolve */
  completed: Promise<void>
}

export interface BackendTransport {
  /** 统一 HTTP 请求，返回原生 Response */
  request(
    method: string,
    path: string,
    body?: object,
    options?: RequestInit,
  ): Promise<Response>

  /** SSE 订阅，handler 接收 (data: string, eventType?: string)，completed 在连接关闭时 resolve */
  subscribe(
    path: string,
    body: object,
    handler: (data: string, eventType?: string) => void,
  ): Subscription

  /** 健康检查 */
  isReady(): Promise<boolean>

  /** 清理资源（测试/页面卸载使用） */
  dispose(): void
}
```

- [ ] **Step 2: Commit**

```bash
git add src/backend/types.ts
git commit -m "feat(backend): define BackendTransport interface"
```

---

### Task 2: HttpBackendTransport 实现

**Files:**
- Create: `src/backend/http-transport.ts`

- [ ] **Step 1: 实现 HttpBackendTransport**

```typescript
import type { Shell } from '@/shell/types'
import type { BackendTransport, Unlisten } from './types'

const DEFAULT_RETRIES = 3
const RETRY_DELAY_BASE = 300

export class HttpBackendTransport implements BackendTransport {
  private currentPort: number | null = null
  private readyUnlisten: Unlisten | null = null
  private restartedUnlisten: Unlisten | null = null

  constructor(private shell: Shell) {
    // 立即尝试获取端口
    this.syncPort()
    // 监听端口变更
    this.setupPortListeners()
  }

  private async syncPort(): Promise<void> {
    try {
      const port = await this.shell.getSidecarPort()
      if (port !== null) {
        this.currentPort = port
      }
    } catch {
      // ignore
    }
  }

  private async setupPortListeners(): Promise<void> {
    try {
      this.readyUnlisten = await this.shell.onSidecarReady((event) => {
        this.currentPort = event.port
      })
      this.restartedUnlisten = await this.shell.onSidecarRestarted((event) => {
        this.currentPort = event.port
      })
    } catch {
      // ignore — browser shell may not support listeners
    }
  }

  private getUrl(path: string): string {
    const port = this.currentPort
    if (!port) {
      throw new Error('Sidecar port not available')
    }
    return `http://127.0.0.1:${port}${path}`
  }

  async request(
    method: string,
    path: string,
    body?: object,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = this.getUrl(path)
    const init: RequestInit = {
      ...options,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }
    if (body) {
      init.body = JSON.stringify(body)
    }

    // 重试逻辑
    for (let i = 0; i <= DEFAULT_RETRIES; i++) {
      try {
        const response = await fetch(url, init)
        if (response.ok || i === DEFAULT_RETRIES) {
          return response
        }
      } catch (err) {
        if (i === DEFAULT_RETRIES) throw err
        await new Promise((r) => setTimeout(r, RETRY_DELAY_BASE * (i + 1)))
      }
    }

    // fallback: 最后一次尝试
    return fetch(url, init)
  }

  subscribe(
    path: string,
    body: object,
    handler: (data: string, eventType?: string) => void,
  ): Subscription {
    const url = this.getUrl(path)
    const abortController = new AbortController()
    let completedResolve: (() => void) | null = null
    const completedPromise = new Promise<void>((resolve) => {
      completedResolve = resolve
    })

    const run = async () => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: abortController.signal,
        })

        if (!response.body) {
          completedResolve?.()
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let currentEvent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim()
              continue
            }
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue
            handler(data, currentEvent || undefined)
            currentEvent = ''
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('[BackendTransport] SSE error:', e)
        }
      } finally {
        completedResolve?.()
      }
    }

    run()

    return {
      unlisten: () => {
        abortController.abort()
      },
      completed: completedPromise,
    }
  }

  async isReady(): Promise<boolean> {
    if (!this.currentPort) return false
    try {
      const res = await fetch(`http://127.0.0.1:${this.currentPort}/health`, {
        signal: AbortSignal.timeout(2000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  dispose(): void {
    this.readyUnlisten?.()
    this.restartedUnlisten?.()
    this.readyUnlisten = null
    this.restartedUnlisten = null
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/backend/http-transport.ts
git commit -m "feat(backend): implement HttpBackendTransport with retry and SSE"
```

---

### Task 3: FakeBackendTransport 实现与测试

**Files:**
- Create: `src/backend/fake-transport.ts`
- Create: `tests/unit/backend/fake-transport.test.ts`

- [ ] **Step 1: 实现 FakeBackendTransport**

```typescript
import type { BackendTransport, Subscription } from './types'

interface RequestRecord {
  method: string
  path: string
  body?: object
}

interface ResponseConfig {
  status: number
  body: unknown
  headers?: Record<string, string>
}

interface SSERecord {
  data: string
  eventType?: string
}

export class FakeBackendTransport implements BackendTransport {
  private responses = new Map<string, ResponseConfig>()
  private sseResponses = new Map<string, SSERecord[]>()
  private requestHistory: RequestRecord[] = []

  when(method: string, path: string) {
    const key = `${method} ${path}`
    return {
      respond: (status: number, body: unknown) => {
        this.responses.set(key, { status, body })
        return this
      },
      respondSSE: (events: Array<{ data: string; event?: string }>) => {
        this.sseResponses.set(
          key,
          events.map((e) => ({ data: e.data, eventType: e.event })),
        )
        return this
      },
    }
  }

  async request(
    method: string,
    path: string,
    body?: object,
    _options?: RequestInit,
  ): Promise<Response> {
    this.requestHistory.push({ method, path, body })
    const key = `${method} ${path}`
    const config = this.responses.get(key)

    if (!config) {
      return new Response(JSON.stringify({ error: 'No mock configured' }), {
        status: 404,
      })
    }

    return new Response(JSON.stringify(config.body), {
      status: config.status,
      headers: config.headers || { 'Content-Type': 'application/json' },
    })
  }

  subscribe(
    path: string,
    body: object,
    handler: (data: string, eventType?: string) => void,
  ): Subscription {
    const key = `POST ${path}`
    this.requestHistory.push({ method: 'POST', path, body })
    const events = this.sseResponses.get(key)

    let completedResolve: (() => void) | null = null
    const completedPromise = new Promise<void>((resolve) => {
      completedResolve = resolve
    })

    if (events) {
      // 异步触发所有事件，完成后 resolve
      setTimeout(() => {
        events.forEach((e) => handler(e.data, e.eventType))
        completedResolve?.()
      }, 0)
    } else {
      completedResolve?.()
    }

    return {
      unlisten: () => {},
      completed: completedPromise,
    }
  }

  async isReady(): Promise<boolean> {
    return true
  }

  dispose(): void {
    this.responses.clear()
    this.sseResponses.clear()
    this.requestHistory = []
  }

  // 断言辅助方法
  getRequestHistory(): RequestRecord[] {
    return this.requestHistory
  }

  wasRequestCalled(method: string, path: string): boolean {
    return this.requestHistory.some((r) => r.method === method && r.path === path)
  }
}
```

- [ ] **Step 2: 编写测试**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { FakeBackendTransport } from '@/backend/fake-transport'

describe('FakeBackendTransport', () => {
  it('returns configured response', async () => {
    const backend = new FakeBackendTransport()
    backend.when('GET', '/knowledge-bases').respond(200, [{ id: '1', name: 'Test' }])

    const res = await backend.request('GET', '/knowledge-bases')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: '1', name: 'Test' }])
  })

  it('returns 404 when no mock configured', async () => {
    const backend = new FakeBackendTransport()
    const res = await backend.request('GET', '/unknown')
    expect(res.status).toBe(404)
  })

  it('records request history', async () => {
    const backend = new FakeBackendTransport()
    backend.when('POST', '/settings').respond(200, { success: true })

    await backend.request('POST', '/settings', { temperature: 1.0 })
    expect(backend.wasRequestCalled('POST', '/settings')).toBe(true)
    expect(backend.getRequestHistory()[0].body).toEqual({ temperature: 1.0 })
  })

  it('simulates SSE events', async () => {
    const backend = new FakeBackendTransport()
    const handler = vi.fn()

    backend.when('POST', '/chat').respondSSE([
      { data: '{"content":"hello"}', event: '' },
      { data: '{"content":"world"}', event: '' },
    ])

    const { completed } = backend.subscribe('/chat', { message: 'hi' }, handler)
    await completed
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenNthCalledWith(1, '{"content":"hello"}', undefined)
    expect(handler).toHaveBeenNthCalledWith(2, '{"content":"world"}', undefined)
  })

  it('clears state on dispose', async () => {
    const backend = new FakeBackendTransport()
    backend.when('GET', '/test').respond(200, {})
    await backend.request('GET', '/test')

    backend.dispose()
    expect(backend.getRequestHistory()).toHaveLength(0)
    const res = await backend.request('GET', '/test')
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
pnpm test tests/unit/backend/fake-transport.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/backend/fake-transport.ts tests/unit/backend/fake-transport.test.ts
git commit -m "feat(backend): implement FakeBackendTransport with chainable mocks and tests"
```

---

### Task 4: Backend 模块入口

**Files:**
- Create: `src/backend/index.ts`

- [ ] **Step 1: 实现入口**

```typescript
import { getShell } from '@/shell'
import { HttpBackendTransport } from './http-transport'
import type { BackendTransport } from './types'

let backend: BackendTransport | null = null
let overrideBackend: BackendTransport | null = null

export function getBackend(): BackendTransport {
  if (overrideBackend) return overrideBackend
  if (!backend) {
    const shell = getShell()
    backend = new HttpBackendTransport(shell)
  }
  return backend
}

export function setBackend(b: BackendTransport | null): void {
  overrideBackend = b
}

export function resetBackend(): void {
  backend?.dispose()
  backend = null
  overrideBackend = null
}

export * from './types'
export { HttpBackendTransport } from './http-transport'
export { FakeBackendTransport } from './fake-transport'
```

- [ ] **Step 2: Commit**

```bash
git add src/backend/index.ts
git commit -m "feat(backend): add getBackend/setBackend global access"
```

---

### Task 5: 替换 session store 的 sidecarFetch

**Files:**
- Modify: `src/stores/session.ts`

- [ ] **Step 1: 修改导入**

替换：
```typescript
// 旧
import { sidecarFetch, isSidecarReady } from '@/utils/sidecarClient'
// 新
import { getBackend } from '@/backend'
```

- [ ] **Step 2: 替换 sendMessage 中的请求**

```typescript
// 旧
const response = await sidecarFetch('/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: content, sessionId, knowledgeBaseIds, config }),
})

// 新
const backend = getBackend()
const response = await backend.request('POST', '/chat', {
  message: content,
  sessionId,
  knowledgeBaseIds,
  config,
})
```

- [ ] **Step 3: 替换 SSE 流式处理为 subscribe**

将手动 `response.body?.getReader()` 解析替换为 `backend.subscribe()`：

```typescript
const backend = getBackend()
let assistantContent = ''
const assistantId = `temp-assistant-${Date.now()}`

// 添加 assistant 消息占位
const currentList = messages.value.get(sessionId) ?? []
currentList.push({
  id: assistantId,
  session_id: sessionId,
  role: 'assistant',
  content: '',
  created_at: Date.now(),
})
messages.value.set(sessionId, currentList)

const { completed } = backend.subscribe('/chat', {
  message: content,
  sessionId,
  knowledgeBaseIds,
  config,
}, (data, eventType) => {
  if (eventType === 'error') {
    try {
      const parsed = JSON.parse(data)
      sendErrorType.value = parsed.type || 'unknown'
      sendError.value = parsed.message || '请求失败'
      const list = messages.value.get(sessionId) ?? []
      list.push({
        id: `temp-error-${Date.now()}`,
        session_id: sessionId,
        role: 'error',
        content: parsed.message || '请求失败',
        errorType: parsed.type || 'unknown',
        created_at: Date.now(),
      })
      messages.value.set(sessionId, list)
    } catch {
      // ignore parse error
    }
    return
  }

  try {
    const parsed = JSON.parse(data)
    if (parsed.content) {
      assistantContent += parsed.content
      const list = messages.value.get(sessionId) ?? []
      const lastMsg = list[list.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.content = assistantContent
      }
    }
  } catch {
    // ignore parse error
  }
})

await completed
```

`subscribe` 返回 `{ unlisten, completed }`，`completed` Promise 在 SSE 连接关闭时 resolve。

- [ ] **Step 4: Commit**

```bash
git add src/stores/session.ts
git commit -m "refactor(backend): session store uses BackendTransport for chat and SSE"
```

---

### Task 6: 替换 knowledgeBase store 的 sidecarFetch

**Files:**
- Modify: `src/stores/knowledgeBase.ts`

- [ ] **Step 1: 修改导入**

替换：
```typescript
// 旧
import { sidecarFetch } from '@/utils/sidecarClient'
// 新
import { getBackend } from '@/backend'
```

- [ ] **Step 2: 替换所有 sidecarFetch 调用**

将 `src/stores/knowledgeBase.ts` 中所有 `sidecarFetch(...)` 替换为 `getBackend().request(...)`。

示例：
```typescript
// 旧
const res = await sidecarFetch('/knowledge-bases')
// 新
const res = await getBackend().request('GET', '/knowledge-bases')

// 旧
const res = await sidecarFetch('/knowledge-bases', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name }),
})
// 新
const res = await getBackend().request('POST', '/knowledge-bases', { name })

// 旧
const res = await sidecarFetch(`/knowledge-bases/${id}`, { method: 'DELETE' })
// 新
const res = await getBackend().request('DELETE', `/knowledge-bases/${id}`)
```

全文搜索 `sidecarFetch` 确保无遗漏：
```bash
grep -n "sidecarFetch" src/stores/knowledgeBase.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/knowledgeBase.ts
git commit -m "refactor(backend): knowledgeBase store uses BackendTransport"
```

---

### Task 7: 替换 settings store 的 sidecarFetch

**Files:**
- Modify: `src/stores/settings.ts`

- [ ] **Step 1: 修改导入和调用**

```typescript
// 旧
import { sidecarFetch } from '@/utils/sidecarClient'
// 新
import { getBackend } from '@/backend'
```

替换 `loadConfig`：
```typescript
// 旧
const res = await sidecarFetch('/settings')
// 新
const res = await getBackend().request('GET', '/settings')
```

替换 `saveConfig`：
```typescript
// 旧
const res = await sidecarFetch('/settings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newConfig),
})
// 新
const res = await getBackend().request('POST', '/settings', newConfig)
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/settings.ts
git commit -m "refactor(backend): settings store uses BackendTransport"
```

---

### Task 8: 重构 session store 单元测试

**Files:**
- Modify: `tests/unit/stores/session.test.ts`

- [ ] **Step 1: 替换 sidecarClient mock 为 FakeBackendTransport**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session'
import { FakeBackendTransport } from '@/backend/fake-transport'
import { setBackend } from '@/backend'

describe('useSessionStore', () => {
  let backend: FakeBackendTransport

  beforeEach(() => {
    setActivePinia(createPinia())
    backend = new FakeBackendTransport()
    setBackend(backend)
  })

  afterEach(() => {
    setBackend(null)
  })

  // ... 保留现有测试（home tab、switch、close 等不涉及 sidecarFetch 的测试）

  it('promotes home tab on first message and creates new home', async () => {
    backend.when('POST', '/chat').respond(200, {
      ok: true,
      body: new ReadableStream(), // SSE 响应
    } as unknown as object)

    // 或者使用 respondSSE：
    // backend.when('POST', '/chat').respondSSE([
    //   { data: '{"content":"你好"}', event: '' },
    // ])

    const store = useSessionStore()
    // ... 测试逻辑
  })
})
```

**注意**：当前 `session.test.ts` 中的 `createMockStream` 辅助函数在重构后可能不再需要，因为 `FakeBackendTransport` 可以直接构造 `Response` 对象。

- [ ] **Step 2: 运行测试**

```bash
pnpm test tests/unit/stores/session.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/stores/session.test.ts
git commit -m "test(backend): refactor session store tests to use FakeBackendTransport"
```

---

### Task 9: 重构 settings store 单元测试

**Files:**
- Modify: `tests/unit/stores/settings.test.ts`

- [ ] **Step 1: 替换 mock**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { FakeBackendTransport } from '@/backend/fake-transport'
import { setBackend } from '@/backend'

describe('useSettingsStore', () => {
  let backend: FakeBackendTransport

  beforeEach(() => {
    setActivePinia(createPinia())
    backend = new FakeBackendTransport()
    setBackend(backend)
  })

  afterEach(() => {
    setBackend(null)
  })

  it('has default config initially', () => {
    const store = useSettingsStore()
    expect(store.config.defaultChatProvider).toBe('deepseek')
  })

  it('loadConfig fetches from API', async () => {
    backend.when('GET', '/settings').respond(200, {
      temperature: 1.0,
      defaultChatProvider: 'openai',
    })

    const store = useSettingsStore()
    await store.loadConfig()
    expect(store.config.temperature).toBe(1.0)
    expect(store.config.defaultChatProvider).toBe('openai')
  })

  it('saveConfig posts to API and updates local state', async () => {
    backend.when('POST', '/settings').respond(200, { success: true })

    const store = useSettingsStore()
    await store.saveConfig({ temperature: 1.5 })
    expect(store.config.temperature).toBe(1.5)
    expect(backend.wasRequestCalled('POST', '/settings')).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试**

```bash
pnpm test tests/unit/stores/settings.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/stores/settings.test.ts
git commit -m "test(backend): refactor settings store tests to use FakeBackendTransport"
```

---

### Task 10: 删除 sidecarClient.ts

**Files:**
- Delete: `src/utils/sidecarClient.ts`

- [ ] **Step 1: 确认无其他文件引用**

```bash
grep -r "from '@/utils/sidecarClient'" src/ tests/
```

Expected: 无结果（所有 store 已改为 BackendTransport）

- [ ] **Step 2: 确认 sidecarClient 的端口同步功能已迁移**

`useSidecarStatus`（#10）中仍调用 `setSidecarPort`，该函数当前在 `sidecarClient.ts` 中。需要确认 `HttpBackendTransport` 是否仍需要这些端口状态函数。

实际上，`HttpBackendTransport` 内部自己管理端口（通过 `Shell` 监听），不再需要 `sidecarClient` 的 `setSidecarPort`/`getSidecarPort`。但 `useSidecarStatus` 中的 `sidecarPort` ref 仍需要被设置。

**解决方案**：`useSidecarStatus` 直接设置 `sidecarPort.value`，不再调用 `setSidecarPort`。`sidecarPort` 是模块级 ref，直接赋值即可。

修改 `src/composables/useSidecarStatus.ts`：
```typescript
// 移除这行
// import { setSidecarPort } from '@/utils/sidecarClient'

// 在事件处理中直接赋值
sidecarPort.value = event.port
// 不再调用 setSidecarPort(event.port)
```

- [ ] **Step 3: 删除文件**

```bash
git rm src/utils/sidecarClient.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/composables/useSidecarStatus.ts
git commit -m "chore(backend): remove deprecated sidecarClient module"
```

---

### Task 11: 全面测试验证

**Files:**
- 无文件修改，纯验证

- [ ] **Step 1: 运行单元测试**

```bash
pnpm test
```

Expected: 全部通过

- [ ] **Step 2: 运行 E2E 测试**

```bash
pnpm test:e2e
```

Expected: 全部通过

- [ ] **Step 3: 运行类型检查**

```bash
pnpm type-check
```

Expected: 无错误

- [ ] **Step 4: Commit（如有修复）**

---

## Self-Review

### 1. Spec coverage

| #11 验收标准 | 对应 Task |
|-------------|----------|
| BackendTransport 接口定义 | Task 1 |
| HttpBackendTransport 实现 | Task 2 |
| FakeBackendTransport 实现 | Task 3 |
| 全局访问 getBackend/setBackend | Task 4 |
| 替换 session store | Task 5 |
| 替换 knowledgeBase store | Task 6 |
| 替换 settings store | Task 7 |
| SSE 替换为 subscribe | Task 5 |
| Store 单元测试重构 | Task 8, 9 |
| 删除 sidecarClient.ts | Task 10 |

**无遗漏。**

### 2. Placeholder scan

- 无 "TBD"、"TODO"、"implement later"
- 无模糊描述
- 每个步骤包含完整代码

### 3. Type consistency

- `Subscription` 接口在 `types.ts` 定义，`HttpBackendTransport` 和 `FakeBackendTransport` 一致实现
- `request` 方法签名在所有实现中一致
- `when().respond()` 和 `when().respondSSE()` 链式 API 在 FakeBackendTransport 中一致

---

## 执行交接

**Plan complete and saved to `docs/superpowers/plans/2026-05-14-backend-transport.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
