# 基础问答对话功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现端到端的基础问答对话功能（直连 LLM，不涉及 RAG），支持 SSE 流式响应、会话标签管理和首页占位符语义。

**Architecture:** 前端通过 `sidecarClient` 发送 SSE `POST /chat` 到 Hono sidecar，sidecar 直接调用 LLM API（OpenAI/DeepSeek 兼容格式）并流式返回。用户和 AI 消息存入 SQLite 的 `sessions` 和 `messages` 表。前端使用 Pinia `useSessionStore` 管理多标签状态和消息流，首页标签在首次发送后自动升格为真实会话并创建新的首页占位符。

**Tech Stack:** Vue 3 + TypeScript + Pinia, Tauri v2, Hono, better-sqlite3, nanoid, markdown-it, highlight.js, Vitest

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `server/src/utils.ts` | Sidecar 共享工具：获取应用数据目录 |
| `server/src/db.ts` | better-sqlite3 连接、`sessions` 和 `messages` Schema 初始化 |
| `server/src/types.ts` | Sidecar 共享类型：Session、Message、LLMConfig、ChatRequest |
| `server/src/services/llm.ts` | LLM API 流式调用封装（OpenAI/DeepSeek 兼容格式） |
| `server/src/routes/sessions.ts` | Hono 路由：`GET /sessions`、`GET /sessions/:id` |
| `server/src/routes/chat.ts` | Hono 路由：`POST /chat` SSE 流式响应 |
| `src/types/index.ts` | 前后端共享 TypeScript 类型 |
| `src/stores/settings.ts` | Pinia store：极简 LLM 配置（内存 + localStorage 持久化） |
| `src/stores/session.ts` | Pinia store：标签管理、消息列表、SSE 发送、首页升格逻辑 |
| `src/utils/markdown.ts` | markdown-it + highlight.js 配置与渲染函数 |
| `src/components/MarkdownRender.vue` | Markdown 渲染组件：语法高亮、复制按钮 |
| `src/components/ChatMessage.vue` | 单条消息组件：用户/AI 布局与样式区分 |
| `src/components/ChatMessageList.vue` | 消息流容器：可滚动、自动到底部 |
| `src/components/ChatInput.vue` | 输入框组件：多行文本、Enter 发送、Shift+Enter 换行、自动增高 |
| `src/components/EmptySession.vue` | 空会话态：居中输入框 + 快捷提问胶囊 |
| `src/components/TabBar.vue` | 顶部标签栏：横向滚动、切换、关闭、新建、首页固定 |
| `src/components/SideBar.vue` | 左侧 64px 边栏：问答/知识库/历史/设置图标 |
| `src/components/ChatPage.vue` | 聊天页面容器：空态与对话态切换 |
| `tests/unit/stores/session.test.ts` | `useSessionStore` 单元测试 |
| `tests/unit/components/ChatInput.test.ts` | `ChatInput` 组件测试 |
| `tests/unit/components/MarkdownRender.test.ts` | `MarkdownRender` 组件测试 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `server/package.json` | 添加 `better-sqlite3`、`nanoid` 依赖 |
| `server/src/index.ts` | 导入并注册 `chat`、`sessions` 路由；复用 `getAppDataDir` |
| `server/tsconfig.json` | 确保 `moduleResolution` 支持 `better-sqlite3`（NodeNext 即可） |
| `package.json` | 添加 `markdown-it`、`highlight.js` 依赖；更新 auto-import 配置 |
| `vite.config.ts` | `AutoImport` 增加 `@/stores/session` 和 `@/stores/settings` |
| `src/App.vue` | 替换为整体布局：侧边栏 + 标签栏 + 内容区 |
| `src/assets/main.css` | 添加滚动条隐藏、Markdown 基础样式 |

---

## Task 1: Sidecar 数据库层

**Files:**
- Create: `server/src/utils.ts`
- Create: `server/src/types.ts`
- Create: `server/src/db.ts`
- Modify: `server/package.json`

- [ ] **Step 1: 安装 sidecar 依赖**

Run:
```bash
cd server && pnpm add better-sqlite3 nanoid && pnpm add -D @types/node
```

Expected: `server/package.json` 中出现 `better-sqlite3` 和 `nanoid` 依赖。

- [ ] **Step 2: 创建 `server/src/utils.ts`**

提取现有 `index.ts` 中的 `getAppDataDir` 以便复用。

```typescript
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export function getAppDataDir(): string {
  const base = process.env.APP_DATA_DIR ?? os.homedir()
  const dir = path.join(base, 'knowledge-base')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}
```

- [ ] **Step 3: 创建 `server/src/types.ts`**

```typescript
export interface Session {
  id: string
  title: string
  provider: string | null
  model: string | null
  created_at: number
  updated_at: number
  message_count: number
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: number
}

export interface LLMConfig {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
}

export interface ChatRequest {
  message: string
  sessionId: string
  knowledgeBaseIds?: string[]
  config: LLMConfig
}
```

- [ ] **Step 4: 创建 `server/src/db.ts`**

```typescript
import Database from 'better-sqlite3'
import path from 'node:path'
import { getAppDataDir } from './utils'

const dbPath = path.join(getAppDataDir(), 'sidecar.db')
const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    message_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
`)

export default db
```

- [ ] **Step 5: 编译验证**

Run:
```bash
cd server && pnpm build
```

Expected: 无 TypeScript 编译错误。`server/dist/utils.js`、`server/dist/types.js`、`server/dist/db.js` 生成。

- [ ] **Step 6: Commit**

```bash
git add server/
git commit -m "feat(server): add SQLite schema for sessions and messages"
```

---

## Task 2: Sidecar Session API

**Files:**
- Create: `server/src/routes/sessions.ts`

- [ ] **Step 1: 创建 `server/src/routes/sessions.ts`**

```typescript
import { Hono } from 'hono'
import db from '../db'

const app = new Hono()

app.get('/', (c) => {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all()
  return c.json(rows)
})

app.get('/:id', (c) => {
  const id = c.req.param('id')
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
    | { id: string; title: string; provider: string | null; model: string | null; created_at: number; updated_at: number; message_count: number }
    | undefined

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const messages = db
    .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(id)

  return c.json({ ...session, messages })
})

export default app
```

- [ ] **Step 2: 编译验证**

Run:
```bash
cd server && pnpm build
```

Expected: 无编译错误。

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/sessions.ts
git commit -m "feat(server): add GET /sessions and GET /sessions/:id APIs"
```

---

## Task 3: Sidecar LLM 服务与 Chat API

**Files:**
- Create: `server/src/services/llm.ts`
- Create: `server/src/routes/chat.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: 创建 `server/src/services/llm.ts`**

```typescript
import type { LLMConfig } from '../types'

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com'
    case 'deepseek':
      return 'https://api.deepseek.com'
    default:
      return ''
  }
}

export async function streamChatCompletion(
  messages: Array<{ role: string; content: string }>,
  config: LLMConfig,
  onChunk: (content: string) => void | Promise<void>
): Promise<void> {
  const url = config.baseUrl || getDefaultBaseUrl(config.provider)
  if (!url) {
    throw new Error(`Unknown provider: ${config.provider}`)
  }

  const response = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.text().catch(() => 'Unknown error')
    throw new Error(`LLM API error: ${response.status} ${error}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          await onChunk(content)
        }
      } catch {
        // ignore parse errors
      }
    }
  }
}
```

- [ ] **Step 2: 创建 `server/src/routes/chat.ts`**

```typescript
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { nanoid } from 'nanoid'
import db from '../db'
import { streamChatCompletion } from '../services/llm'
import type { ChatRequest } from '../types'

const app = new Hono()

app.post('/', async (c) => {
  const body = await c.req.json<ChatRequest>()
  const { message, sessionId, config } = body

  // Auto-create session if it does not exist (home tab promotion)
  const existingSession = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)
  if (!existingSession) {
    const title = message.slice(0, 20) + (message.length > 20 ? '...' : '')
    const now = Date.now()
    db.prepare(
      'INSERT INTO sessions (id, title, provider, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(sessionId, title, config.provider, config.model, now, now)
  }

  // Save user message
  const now = Date.now()
  const userMessageId = nanoid()
  db.prepare(
    'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userMessageId, sessionId, 'user', message, now)

  // Update session
  db.prepare('UPDATE sessions SET updated_at = ?, message_count = message_count + 1 WHERE id = ?').run(
    now,
    sessionId
  )

  // Build history for LLM
  const history = db
    .prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 50')
    .all(sessionId) as Array<{ role: string; content: string }>

  return streamSSE(c, async (stream) => {
    let assistantContent = ''

    await streamChatCompletion(history, config, async (chunk) => {
      assistantContent += chunk
      await stream.writeSSE({ data: JSON.stringify({ content: chunk }) })
    })

    // Save assistant message after stream completes
    const assistantId = nanoid()
    db.prepare(
      'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(assistantId, sessionId, 'assistant', assistantContent, Date.now())

    db.prepare('UPDATE sessions SET updated_at = ?, message_count = message_count + 1 WHERE id = ?').run(
      Date.now(),
      sessionId
    )

    await stream.close()
  })
})

export default app
```

- [ ] **Step 3: 修改 `server/src/index.ts` 注册路由**

将现有 `index.ts` 中 `getAppDataDir` 的导入替换为从 `utils.ts` 导入，并注册新路由。

完整修改后的 `server/src/index.ts`：

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { getAppDataDir } from './utils'
import chatRoutes from './routes/chat'
import sessionRoutes from './routes/sessions'

const DEFAULT_PORT = 11451
const MAX_PORT_ATTEMPTS = 100

function writePortFile(port: number): void {
  const portFile = path.join(getAppDataDir(), '.sidecar-port')
  fs.writeFileSync(portFile, String(port), 'utf-8')
}

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    function tryPort(port: number, attempts: number): void {
      if (attempts <= 0) {
        reject(new Error('No available port found'))
        return
      }
      const server = net.createServer()
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          tryPort(port + 1, attempts - 1)
        } else {
          reject(err)
        }
      })
      server.once('listening', () => {
        server.close(() => resolve(port))
      })
      server.listen(port, '127.0.0.1')
    }
    tryPort(startPort, MAX_PORT_ATTEMPTS)
  })
}

async function main(): Promise<void> {
  const port = await findAvailablePort(DEFAULT_PORT)
  writePortFile(port)

  const app = new Hono()

  app.get('/health', (c) => {
    return c.json({ status: 'ok' })
  })

  app.route('/chat', chatRoutes)
  app.route('/sessions', sessionRoutes)

  serve({
    fetch: app.fetch,
    port,
    hostname: '127.0.0.1',
  })

  console.log(`Sidecar running on http://127.0.0.1:${port}`)
}

main().catch((err) => {
  console.error('Failed to start sidecar:', err)
  process.exit(1)
})
```

- [ ] **Step 4: 编译验证**

Run:
```bash
cd server && pnpm build
```

Expected: 无编译错误。`server/dist/routes/chat.js`、`server/dist/routes/sessions.js`、`server/dist/services/llm.js` 生成。

- [ ] **Step 5: Commit**

```bash
git add server/
git commit -m "feat(server): add POST /chat SSE endpoint and LLM streaming service"
```

---

## Task 4: 前端类型与 Settings Store

**Files:**
- Create: `src/types/index.ts`
- Create: `src/stores/settings.ts`

- [ ] **Step 1: 创建 `src/types/index.ts`**

```typescript
export interface Session {
  id: string
  title: string
  provider: string | null
  model: string | null
  created_at: number
  updated_at: number
  message_count: number
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: number
}

export interface LLMConfig {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
}

export interface ChatRequest {
  message: string
  sessionId: string
  knowledgeBaseIds?: string[]
  config: LLMConfig
}

export type TabType = 'chat' | 'knowledgeBase' | 'history' | 'settings'

export interface Tab {
  id: string
  type: TabType
  title: string
  sessionId?: string
  closable: boolean
}
```

- [ ] **Step 2: 创建 `src/stores/settings.ts`**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LLMConfig } from '@/types'

const STORAGE_KEY = 'kb_chat_config'

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
}

function loadConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_CONFIG }
}

export const useSettingsStore = defineStore('settings', () => {
  const llmConfig = ref<LLMConfig>(loadConfig())

  function saveConfig(config: Partial<LLMConfig>) {
    llmConfig.value = { ...llmConfig.value, ...config }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(llmConfig.value))
  }

  return {
    llmConfig,
    saveConfig,
  }
})
```

- [ ] **Step 3: 编译验证**

Run:
```bash
pnpm type-check
```

Expected: 无 TypeScript 类型错误。

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/stores/settings.ts
git commit -m "feat(types,store): add shared types and minimal settings store"
```

---

## Task 5: 前端 Markdown 渲染组件

**Files:**
- Modify: `package.json`（添加依赖）
- Create: `src/utils/markdown.ts`
- Create: `src/components/MarkdownRender.vue`
- Create: `tests/unit/components/MarkdownRender.test.ts`

- [ ] **Step 1: 安装前端依赖**

Run:
```bash
pnpm add markdown-it highlight.js && pnpm add -D @types/markdown-it
```

- [ ] **Step 2: 创建 `src/utils/markdown.ts`**

```typescript
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const md = new MarkdownIt({
  highlight(str, lang) {
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
    try {
      return hljs.highlight(str, { language }).value
    } catch {
      return hljs.highlight(str, { language: 'plaintext' }).value
    }
  },
  linkify: true,
})

export function renderMarkdown(content: string): string {
  return md.render(content)
}
```

- [ ] **Step 3: 创建 `src/components/MarkdownRender.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'
import 'highlight.js/styles/github.css'

const props = defineProps<{
  content: string
}>()

const html = computed(() => renderMarkdown(props.content))

function handleClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest('.copy-btn')
  if (!btn) return

  const code = decodeURIComponent((btn as HTMLElement).dataset.code || '')
  navigator.clipboard.writeText(code).catch(() => {
    // ignore clipboard errors
  })

  const original = btn.textContent
  btn.textContent = '已复制'
  setTimeout(() => {
    btn.textContent = original
  }, 2000)
}
</script>

<template>
  <div class="markdown-body" @click="handleClick" v-html="html" />
</template>

<style scoped>
.markdown-body :deep(h1) {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0.5rem 0;
}
.markdown-body :deep(h2) {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0.5rem 0;
}
.markdown-body :deep(h3) {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.5rem 0;
}
.markdown-body :deep(p) {
  margin: 0.375rem 0;
}
.markdown-body :deep(ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin: 0.375rem 0;
}
.markdown-body :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin: 0.375rem 0;
}
.markdown-body :deep(li) {
  margin: 0.125rem 0;
}
.markdown-body :deep(pre) {
  background: #f6f8fa;
  padding: 0.75rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  margin: 0.5rem 0;
}
.markdown-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
}
.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
}
.markdown-body :deep(:not(pre) > code) {
  background: #eff1f3;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
}
.markdown-body :deep(a) {
  color: #2563eb;
  text-decoration: underline;
}
.markdown-body :deep(blockquote) {
  border-left: 4px solid #e5e7eb;
  padding-left: 0.75rem;
  margin: 0.5rem 0;
  color: #4b5563;
}
.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 0.375rem 0.5rem;
  text-align: left;
}
.markdown-body :deep(th) {
  background: #f9fafb;
  font-weight: 600;
}
</style>
```

注意：`highlight.js/styles/github.css` 在构建时会自动被 Vite 处理。组件 scoped style 中的 `:deep()` 确保样式能穿透到 `v-html` 渲染的内容。

- [ ] **Step 4: 创建 `tests/unit/components/MarkdownRender.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownRender from '@/components/MarkdownRender.vue'

describe('MarkdownRender', () => {
  it('renders plain text in paragraph', () => {
    const wrapper = mount(MarkdownRender, {
      props: { content: 'hello world' },
    })
    expect(wrapper.html()).toContain('<p>hello world</p>')
  })

  it('renders bold text', () => {
    const wrapper = mount(MarkdownRender, {
      props: { content: '**bold**' },
    })
    expect(wrapper.html()).toContain('<strong>bold</strong>')
  })

  it('renders code block with highlight class', () => {
    const wrapper = mount(MarkdownRender, {
      props: { content: '```js\nconst x = 1;\n```' },
    })
    expect(wrapper.html()).toContain('<pre')
    expect(wrapper.html()).toContain('hljs')
  })
})
```

- [ ] **Step 5: 运行测试**

Run:
```bash
pnpm test tests/unit/components/MarkdownRender.test.ts
```

Expected: 3 tests passed, 0 failed。

- [ ] **Step 6: Commit**

```bash
git add src/utils/markdown.ts src/components/MarkdownRender.vue tests/unit/components/MarkdownRender.test.ts package.json pnpm-lock.yaml
git commit -m "feat(ui): add MarkdownRender with syntax highlighting and copy button"
```

---

## Task 6: 前端 Chat 消息组件

**Files:**
- Create: `src/components/ChatMessage.vue`
- Create: `src/components/ChatMessageList.vue`

- [ ] **Step 1: 创建 `src/components/ChatMessage.vue`**

```vue
<script setup lang="ts">
import type { Message } from '@/types'
import MarkdownRender from './MarkdownRender.vue'

defineProps<{
  message: Message
}>()
</script>

<template>
  <div
    :class="[
      'flex w-full',
      message.role === 'user' ? 'justify-end' : 'justify-start',
    ]"
  >
    <div
      :class="[
        'max-w-[85%] rounded-lg px-4 py-2.5 shadow-sm',
        message.role === 'user'
          ? 'bg-blue-100 text-gray-900'
          : 'bg-white text-gray-900',
      ]"
    >
      <div v-if="message.role === 'user'" class="whitespace-pre-wrap text-sm leading-relaxed">
        {{ message.content }}
      </div>
      <MarkdownRender v-else :content="message.content" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: 创建 `src/components/ChatMessageList.vue`**

```vue
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { Message } from '@/types'
import ChatMessage from './ChatMessage.vue'

const props = defineProps<{
  messages: Message[]
}>()

const containerRef = ref<HTMLDivElement>()

watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    containerRef.value?.scrollTo({
      top: containerRef.value.scrollHeight,
      behavior: 'smooth',
    })
  }
)
</script>

<template>
  <div ref="containerRef" class="flex-1 overflow-y-auto space-y-4 p-4">
    <ChatMessage
      v-for="msg in messages"
      :key="msg.id"
      :message="msg"
    />
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatMessage.vue src/components/ChatMessageList.vue
git commit -m "feat(ui): add ChatMessage and ChatMessageList components"
```

---

## Task 7: 前端 ChatInput 与 EmptySession

**Files:**
- Create: `src/components/ChatInput.vue`
- Create: `src/components/EmptySession.vue`
- Create: `tests/unit/components/ChatInput.test.ts`

- [ ] **Step 1: 创建 `src/components/ChatInput.vue`**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  send: [content: string]
}>()

const input = ref('')
const textareaRef = ref<HTMLTextAreaElement>()

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 128) + 'px'
}

watch(input, autoResize)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleSend() {
  const content = input.value.trim()
  if (!content || props.loading) return
  emit('send', content)
  input.value = ''
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}
</script>

<template>
  <div class="border-t border-gray-700 bg-gray-800 p-4">
    <div class="relative flex items-end gap-2 rounded-xl border border-gray-600 bg-gray-700 px-3 py-2">
      <textarea
        ref="textareaRef"
        v-model="input"
        rows="1"
        class="max-h-32 w-full resize-none bg-transparent text-sm text-gray-200 placeholder-gray-400 outline-none"
        placeholder="输入问题，Shift + Enter 换行，Enter 发送..."
        :disabled="loading"
        @keydown="handleKeydown"
      />
      <button
        :disabled="!input.trim() || loading"
        class="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        @click="handleSend"
      >
        发送
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 创建 `src/components/EmptySession.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  send: [content: string]
}>()

const input = ref('')

const quickQuestions = [
  '什么是 RAG 检索增强生成？',
  '如何导入 Markdown 文档？',
  '本地知识库的工作原理是什么？',
  '支持哪些大语言模型？',
]

function handleSend() {
  const content = input.value.trim()
  if (!content) return
  emit('send', content)
  input.value = ''
}

function sendQuick(content: string) {
  emit('send', content)
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center p-8">
    <div class="w-full max-w-2xl space-y-8">
      <h2 class="text-center text-2xl font-semibold text-gray-100">
        有什么可以帮你的？
      </h2>

      <div class="relative">
        <textarea
          v-model="input"
          rows="3"
          class="w-full resize-none rounded-xl border border-gray-600 bg-gray-700 p-4 pr-16 text-gray-200 placeholder-gray-400 outline-none transition-colors focus:border-blue-500"
          placeholder="输入你的问题..."
          @keydown.enter.prevent="handleSend"
        />
        <button
          class="absolute bottom-3 right-3 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          :disabled="!input.trim()"
          @click="handleSend"
        >
          发送
        </button>
      </div>

      <div class="flex flex-wrap justify-center gap-2">
        <button
          v-for="q in quickQuestions"
          :key="q"
          class="rounded-full border border-gray-600 bg-gray-700/50 px-4 py-1.5 text-sm text-gray-300 transition-colors hover:border-blue-500 hover:text-blue-400"
          @click="sendQuick(q)"
        >
          {{ q }}
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: 创建 `tests/unit/components/ChatInput.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatInput from '@/components/ChatInput.vue'

describe('ChatInput', () => {
  it('emits send on button click', async () => {
    const wrapper = mount(ChatInput)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('send')).toHaveLength(1)
    expect(wrapper.emitted('send')![0]).toEqual(['hello'])
  })

  it('emits send on Enter key', async () => {
    const wrapper = mount(ChatInput)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('world')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: false })
    expect(wrapper.emitted('send')).toHaveLength(1)
    expect(wrapper.emitted('send')![0]).toEqual(['world'])
  })

  it('does not emit send on Shift+Enter', async () => {
    const wrapper = mount(ChatInput)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('newline')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('does not emit send when empty', async () => {
    const wrapper = mount(ChatInput)
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('clears input after send', async () => {
    const wrapper = mount(ChatInput)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('test')
    await wrapper.find('button').trigger('click')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })

  it('does not emit when loading', async () => {
    const wrapper = mount(ChatInput, { props: { loading: true } })
    const textarea = wrapper.find('textarea')
    await textarea.setValue('test')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('send')).toBeUndefined()
  })
})
```

- [ ] **Step 4: 运行测试**

Run:
```bash
pnpm test tests/unit/components/ChatInput.test.ts
```

Expected: 6 tests passed, 0 failed。

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatInput.vue src/components/EmptySession.vue tests/unit/components/ChatInput.test.ts
git commit -m "feat(ui): add ChatInput and EmptySession components with tests"
```

---

## Task 8: 前端 useSessionStore

**Files:**
- Create: `src/stores/session.ts`
- Create: `tests/unit/stores/session.test.ts`

- [ ] **Step 1: 创建 `src/stores/session.ts`**

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { sidecarFetch } from '@/utils/sidecarClient'
import type { Message, Tab, LLMConfig } from '@/types'

export const useSessionStore = defineStore('session', () => {
  // Tabs
  const tabs = ref<Tab[]>([
    { id: 'home', type: 'chat', title: '首页', closable: false },
  ])
  const activeTabId = ref<string>('home')

  // Messages keyed by sessionId
  const messages = ref<Map<string, Message[]>>(new Map())
  const isSending = ref(false)
  const sendError = ref<string | null>(null)

  const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value))
  const activeMessages = computed(() => {
    const sessionId = activeTab.value?.sessionId
    return sessionId ? (messages.value.get(sessionId) ?? []) : []
  })

  function addTab(tab: Tab) {
    tabs.value.push(tab)
    activeTabId.value = tab.id
  }

  function closeTab(tabId: string) {
    const idx = tabs.value.findIndex((t) => t.id === tabId)
    if (idx === -1 || !tabs.value[idx].closable) return

    tabs.value.splice(idx, 1)
    if (activeTabId.value === tabId) {
      activeTabId.value = tabs.value[Math.min(idx, tabs.value.length - 1)]?.id ?? 'home'
    }
  }

  function switchTab(tabId: string) {
    activeTabId.value = tabId
  }

  async function loadSession(sessionId: string) {
    const res = await sidecarFetch(`/sessions/${sessionId}`)
    const data = (await res.json()) as { messages: Message[] }
    messages.value.set(sessionId, data.messages ?? [])
  }

  async function sendMessage(content: string, config: LLMConfig) {
    sendError.value = null
    isSending.value = true

    try {
      let sessionId = activeTab.value?.sessionId
      const isNewSession = !sessionId

      if (!sessionId) {
        sessionId = crypto.randomUUID()
      }

      // Optimistically add user message
      const userMsg: Message = {
        id: `temp-user-${Date.now()}`,
        session_id: sessionId,
        role: 'user',
        content,
        created_at: Date.now(),
      }

      if (isNewSession) {
        messages.value.set(sessionId, [userMsg])
      } else {
        const list = messages.value.get(sessionId) ?? []
        list.push(userMsg)
        messages.value.set(sessionId, list)
      }

      const response = await sidecarFetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, sessionId, config }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '请求失败')
        throw new Error(errText)
      }

      // Promote home tab after first successful request
      if (isNewSession) {
        const activeIdx = tabs.value.findIndex((t) => t.id === activeTabId.value)
        if (activeIdx !== -1) {
          tabs.value[activeIdx].sessionId = sessionId
          tabs.value[activeIdx].title = content.slice(0, 20) + (content.length > 20 ? '...' : '')
        }

        const newHomeId = `home-${Date.now()}`
        tabs.value.push({
          id: newHomeId,
          type: 'chat',
          title: '首页',
          closable: false,
        })
      }

      // Read SSE stream
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let assistantContent = ''
      const assistantId = `temp-assistant-${Date.now()}`

      const currentList = messages.value.get(sessionId) ?? []
      currentList.push({
        id: assistantId,
        session_id: sessionId,
        role: 'assistant',
        content: '',
        created_at: Date.now(),
      })
      messages.value.set(sessionId, currentList)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              assistantContent += parsed.content
              const list = messages.value.get(sessionId) ?? []
              const last = list[list.length - 1]
              if (last && last.role === 'assistant' && last.id === assistantId) {
                last.content = assistantContent
              }
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      sendError.value = e instanceof Error ? e.message : String(e)
    } finally {
      isSending.value = false
    }
  }

  return {
    tabs,
    activeTabId,
    messages,
    isSending,
    sendError,
    activeTab,
    activeMessages,
    addTab,
    closeTab,
    switchTab,
    loadSession,
    sendMessage,
  }
})
```

- [ ] **Step 2: 创建 `tests/unit/stores/session.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session'
import { sidecarFetch } from '@/utils/sidecarClient'

vi.mock('@/utils/sidecarClient')

function createMockStream(text: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(sidecarFetch).mockReset()
  })

  it('has home tab by default', () => {
    const store = useSessionStore()
    expect(store.tabs).toHaveLength(1)
    expect(store.tabs[0].title).toBe('首页')
    expect(store.tabs[0].closable).toBe(false)
  })

  it('switches active tab', () => {
    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: '新会话', closable: true })
    expect(store.activeTabId).toBe('t1')
    store.switchTab('home')
    expect(store.activeTabId).toBe('home')
  })

  it('does not close home tab', () => {
    const store = useSessionStore()
    store.closeTab('home')
    expect(store.tabs).toHaveLength(1)
  })

  it('closes closable tab and switches to remaining tab', () => {
    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: '新会话', closable: true })
    store.closeTab('t1')
    expect(store.tabs).toHaveLength(1)
    expect(store.activeTabId).toBe('home')
  })

  it('promotes home tab on first message and creates new home', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      body: createMockStream('data: {"content":"你好"}\n\n'),
    } as Response)

    const store = useSessionStore()
    await store.sendMessage('你好', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    })

    expect(store.tabs).toHaveLength(2)
    expect(store.tabs[0].sessionId).toBeDefined()
    expect(store.tabs[0].title).toBe('你好')
    expect(store.tabs[1].title).toBe('首页')
    expect(store.activeMessages).toHaveLength(2)
    expect(store.activeMessages[1].content).toBe('你好')
  })

  it('appends messages to existing session', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      body: createMockStream('data: {"content":"reply"}\n\n'),
    } as Response)

    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: '已有会话', closable: true, sessionId: 'sess-1' })
    store.messages.set('sess-1', [
      { id: 'm1', session_id: 'sess-1', role: 'user', content: 'prev', created_at: 1 },
    ])

    await store.sendMessage('next', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    })

    expect(store.tabs).toHaveLength(3) // home + t1 + new home not created
    expect(store.messages.get('sess-1')).toHaveLength(3)
  })

  it('sets sendError on failed request', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: false,
      text: async () => 'Bad Request',
    } as Response)

    const store = useSessionStore()
    await store.sendMessage('fail', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    })

    expect(store.sendError).toContain('Bad Request')
    expect(store.isSending).toBe(false)
  })
})
```

- [ ] **Step 3: 运行测试**

Run:
```bash
pnpm test tests/unit/stores/session.test.ts
```

Expected: 6+ tests passed, 0 failed。

- [ ] **Step 4: Commit**

```bash
git add src/stores/session.ts tests/unit/stores/session.test.ts
git commit -m "feat(store): add useSessionStore with tab management and SSE chat"
```

---

## Task 9: 前端标签栏与侧边栏

**Files:**
- Create: `src/components/TabBar.vue`
- Create: `src/components/SideBar.vue`
- Modify: `src/assets/main.css`

- [ ] **Step 1: 创建 `src/components/TabBar.vue`**

```vue
<script setup lang="ts">
import type { Tab } from '@/types'

defineProps<{
  tabs: Tab[]
  activeTabId: string
}>()

const emit = defineEmits<{
  switch: [tabId: string]
  close: [tabId: string]
  newChat: []
}>()
</script>

<template>
  <div class="flex h-[38px] shrink-0 items-center gap-1 border-b border-gray-700 bg-gray-800 px-2">
    <div class="flex flex-1 gap-1 overflow-x-auto" style="scrollbar-width: none;">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="[
          'flex shrink-0 items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm transition-colors',
          activeTabId === tab.id
            ? 'bg-gray-700 text-gray-200'
            : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200',
        ]"
        @click="emit('switch', tab.id)"
      >
        <span class="max-w-[120px] truncate">{{ tab.title }}</span>
        <span
          v-if="tab.closable"
          class="icon-[mdi--close] ml-0.5 cursor-pointer rounded p-0.5 text-xs hover:bg-gray-600 hover:text-red-400"
          @click.stop="emit('close', tab.id)"
        />
      </button>
    </div>
    <button
      class="icon-[mdi--plus] shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
      title="新建会话"
      @click="emit('newChat')"
    />
  </div>
</template>
```

- [ ] **Step 2: 创建 `src/components/SideBar.vue`**

```vue
<script setup lang="ts">
const emit = defineEmits<{
  openChat: []
  openKnowledgeBase: []
  openHistory: []
  openSettings: []
}>()
</script>

<template>
  <div class="flex w-16 shrink-0 flex-col items-center gap-4 border-r border-gray-700 bg-gray-800 py-4">
    <div class="flex flex-col gap-4">
      <button
        class="icon-[mdi--message-text] text-2xl text-gray-400 transition-colors hover:text-blue-400"
        title="问答"
        @click="emit('openChat')"
      />
      <button
        class="icon-[mdi--folder] text-2xl text-gray-400 transition-colors hover:text-blue-400"
        title="知识库"
        @click="emit('openKnowledgeBase')"
      />
    </div>
    <div class="mt-auto flex flex-col gap-4">
      <button
        class="icon-[mdi--history] text-2xl text-gray-400 transition-colors hover:text-blue-400"
        title="历史"
        @click="emit('openHistory')"
      />
      <button
        class="icon-[mdi--cog] text-2xl text-gray-400 transition-colors hover:text-blue-400"
        title="设置"
        @click="emit('openSettings')"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 3: 修改 `src/assets/main.css` 添加滚动条隐藏**

在现有内容末尾追加：

```css
/* Hide scrollbar for tab bar */
scrollbar-width: none;
::-webkit-scrollbar {
  display: none;
}
```

等等，这个 CSS 写法有问题。`scrollbar-width` 不是全局属性，`::-webkit-scrollbar` 应该放在某个选择器下。实际上我们已经在 TabBar 的行内样式中用了 `style="scrollbar-width: none;"`。对于 WebKit，可以在 `main.css` 中加一个通用类：

```css
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

然后 TabBar 中使用这个类。但 Tailwind CSS v4 可能不支持自定义 utility 类... 不，`@tailwindcss/vite` 支持在 CSS 中定义 `@utility`：

```css
@utility scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
@utility scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

但 Tailwind v4 的 `@utility` 语法可能不支持伪元素。为了安全，直接在 `main.css` 中用原始 CSS：

```css
/* Global utility for hiding scrollbars */
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
```

这是标准 CSS，Tailwind v4 不会处理它，但浏览器会正常应用。然后 TabBar 中用这个类：

```vue
<div class="flex flex-1 gap-1 overflow-x-auto no-scrollbar">
```

这比行内样式更好。让我更新计划。

在 `src/assets/main.css` 末尾追加：

```css
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
```

然后修改 TabBar.vue 的 div class：

```vue
<div class="flex flex-1 gap-1 overflow-x-auto no-scrollbar">
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TabBar.vue src/components/SideBar.vue src/assets/main.css
git commit -m "feat(ui): add TabBar and SideBar components"
```

---

## Task 10: App.vue 集成与整体布局

**Files:**
- Modify: `src/App.vue`
- Create: `src/components/ChatPage.vue`
- Modify: `vite.config.ts`

- [ ] **Step 1: 修改 `vite.config.ts` 扩展 auto-import**

在 `AutoImport` 配置的 `imports` 数组中，将 `@/store` 条目扩展为包含新 store：

```typescript
AutoImport({
  imports: [
    'vue',
    'vue-router',
    'pinia',
    {
      '@/store': ['useStore'],
      '@/stores/session': ['useSessionStore'],
      '@/stores/settings': ['useSettingsStore'],
    },
  ],
  dts: 'auto-imports.d.ts',
  vueTemplate: true,
}),
```

- [ ] **Step 2: 创建 `src/components/ChatPage.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import EmptySession from './EmptySession.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatInput from './ChatInput.vue'

const store = useSessionStore()

const isEmpty = computed(() => !store.activeTab?.sessionId && store.activeMessages.length === 0)

function handleSend(content: string) {
  // config will be injected by parent or from settings store in real usage
  // For now, emit up to App.vue which has access to settings
}

const emit = defineEmits<{
  send: [content: string]
}>()

function onSend(content: string) {
  emit('send', content)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <EmptySession v-if="isEmpty" @send="onSend" />
    <template v-else>
      <ChatMessageList :messages="store.activeMessages" />
      <ChatInput :loading="store.isSending" @send="onSend" />
    </template>

    <div
      v-if="store.sendError"
      class="border-t border-red-800 bg-red-900/30 px-4 py-2 text-sm text-red-300"
    >
      {{ store.sendError }}
    </div>
  </div>
</template>
```

等等，ChatPage 作为中间层，需要从 App.vue 拿到 settings 的 config 再传给 sendMessage。但这样 prop drilling 不好。更简洁的方式是让 ChatPage 自己引入 useSettingsStore：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import EmptySession from './EmptySession.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatInput from './ChatInput.vue'

const store = useSessionStore()
const settings = useSettingsStore()

const isEmpty = computed(() => !store.activeTab?.sessionId && store.activeMessages.length === 0)

function handleSend(content: string) {
  store.sendMessage(content, settings.llmConfig)
}
</script>
```

这样更好。ChatPage 自包含。更新计划。

- [ ] **Step 3: 重写 `src/App.vue`**

```vue
<script setup lang="ts">
import { onMounted, watch } from 'vue'
import SplashScreen from './components/SplashScreen.vue'
import SideBar from './components/SideBar.vue'
import TabBar from './components/TabBar.vue'
import ChatPage from './components/ChatPage.vue'
import { initSidecar, sidecarStatus } from './composables/useSidecar'
import { useSessionStore } from './stores/session'

const sessionStore = useSessionStore()

onMounted(() => {
  initSidecar()
})

function ensureHomeTab() {
  const homeTab = sessionStore.tabs.find((t) => t.type === 'chat' && !t.sessionId)
  if (homeTab) {
    sessionStore.switchTab(homeTab.id)
  } else {
    const newHomeId = `home-${Date.now()}`
    sessionStore.addTab({ id: newHomeId, type: 'chat', title: '首页', closable: false })
  }
}

function openKnowledgeBase() {
  const existing = sessionStore.tabs.find((t) => t.type === 'knowledgeBase')
  if (existing) {
    sessionStore.switchTab(existing.id)
  } else {
    sessionStore.addTab({ id: 'kb', type: 'knowledgeBase', title: '知识库', closable: true })
  }
}

function openHistory() {
  const existing = sessionStore.tabs.find((t) => t.type === 'history')
  if (existing) {
    sessionStore.switchTab(existing.id)
  } else {
    sessionStore.addTab({ id: 'history', type: 'history', title: '历史', closable: true })
  }
}

function openSettings() {
  const existing = sessionStore.tabs.find((t) => t.type === 'settings')
  if (existing) {
    sessionStore.switchTab(existing.id)
  } else {
    sessionStore.addTab({ id: 'settings', type: 'settings', title: '设置', closable: true })
  }
}
</script>

<template>
  <SplashScreen />
  <div
    v-if="sidecarStatus === 'ready'"
    class="flex h-screen bg-gray-800 text-gray-200"
  >
    <SideBar
      @open-chat="ensureHomeTab"
      @open-knowledge-base="openKnowledgeBase"
      @open-history="openHistory"
      @open-settings="openSettings"
    />
    <div class="flex flex-1 flex-col overflow-hidden">
      <TabBar
        :tabs="sessionStore.tabs"
        :active-tab-id="sessionStore.activeTabId"
        @switch="sessionStore.switchTab"
        @close="sessionStore.closeTab"
        @new-chat="ensureHomeTab"
      />
      <main class="flex-1 overflow-hidden">
        <ChatPage v-if="sessionStore.activeTab?.type === 'chat'" />
        <div
          v-else-if="sessionStore.activeTab?.type === 'knowledgeBase'"
          class="flex h-full items-center justify-center text-gray-400"
        >
          知识库管理（由 #03 实现）
        </div>
        <div
          v-else-if="sessionStore.activeTab?.type === 'history'"
          class="flex h-full items-center justify-center text-gray-400"
        >
          对话历史（由 #06 实现）
        </div>
        <div
          v-else-if="sessionStore.activeTab?.type === 'settings'"
          class="flex h-full items-center justify-center text-gray-400"
        >
          设置（由 #05 实现）
        </div>
      </main>
    </div>
  </div>
</template>
```

注意：移除了 `useStore` 的导入（不再需要），`watch` 由 auto-import 提供。

- [ ] **Step 4: 编译验证**

Run:
```bash
pnpm type-check
```

Expected: 无 TypeScript 类型错误。`auto-imports.d.ts` 应该自动更新以包含新的 store 导入。

- [ ] **Step 5: Commit**

```bash
git add src/App.vue src/components/ChatPage.vue vite.config.ts auto-imports.d.ts components.d.ts
git commit -m "feat(ui): integrate layout with sidebar, tab bar, and chat page"
```

---

## Task 11: 端到端验证

**Files:** 无文件变更，纯验证。

- [ ] **Step 1: 重新编译 sidecar**

Run:
```bash
pnpm server:build
```

Expected: `server/dist/` 包含更新后的路由文件。

- [ ] **Step 2: 启动 Tauri 开发模式**

Run:
```bash
pnpm tauri dev
```

Expected:
1. 窗口打开，SplashScreen 显示约 1-3 秒后消失。
2. 显示整体布局：左侧深色边栏（4 个图标）、顶部标签栏（一个"首页"标签，无法关闭）、中间空会话态（"有什么可以帮你的？" + 大输入框 + 4 个快捷胶囊）。

- [ ] **Step 3: 验证快捷提问**

点击任意快捷提问胶囊。

Expected:
1. 输入框内容变为该胶囊文案并自动发送。
2. 如果 `llmConfig.apiKey` 为空（默认），底部显示错误提示（如 `LLM API error: 401`）。
3. 当前"首页"标签 title 变为该问题前 20 字，并分配了 `sessionId`。
4. 标签栏末尾自动出现一个新的"首页"标签。

- [ ] **Step 4: 验证 LLM 流式响应**

在设置中填入有效的 DeepSeek API Key（或修改 `useSettingsStore` 的默认 `apiKey` 为有效值用于测试）。重新发送消息。

Expected:
1. 用户消息出现在右侧，浅色背景。
2. AI 消息出现在左侧，白色背景，内容逐字增加（流式效果）。
3. AI 消息中的 Markdown（如加粗、代码块）正确渲染。
4. 代码块右上角显示"复制"按钮，hover 时可见，点击后变为"已复制"。
5. 消息可滚动，新消息自动滚动到底部。

- [ ] **Step 5: 验证标签管理**

1. 点击侧边栏"问答"图标 → 切换到已有的空首页（如果没有则创建）。
2. 点击侧边栏"知识库"图标 → 打开"知识库"标签；再次点击 → 切换到已有标签（不重复创建）。
3. 点击知识库标签的关闭按钮 → 标签关闭，自动切换到左侧相邻标签。
4. 尝试关闭"首页"标签 → 无法关闭。
5. 点击标签栏右侧 `+` 按钮 → 新建一个首页标签。

- [ ] **Step 6: 验证会话持久化**

发送几条消息后，刷新页面（或重启 sidecar）。

Expected:
1. 由于前端只存内存状态，刷新后标签会重置为默认首页。
2. 但后端 SQLite 中 `sessions` 和 `messages` 表已持久化数据。
3. 通过 curl 验证：

```bash
curl http://127.0.0.1:<port>/sessions
```

Expected: 返回 JSON 数组，包含刚刚创建的会话。

```bash
curl http://127.0.0.1:<port>/sessions/<session-id>
```

Expected: 返回会话详情，包含完整的 messages 列表。

- [ ] **Step 7: Commit（如有调试产生的必要变更）**

如有仅用于验证的临时变更（如 hardcode API Key），回滚它们。如没有文件变更则跳过。

```bash
git checkout -- src/stores/settings.ts # if modified for testing
git add -A && git commit -m "chore: e2e validation fixes" || true
```

---

## Task 12: 运行全量测试与收尾

**Files:** 全项目。

- [ ] **Step 1: 运行全部单元测试**

Run:
```bash
pnpm test
```

Expected: 所有现有测试（useSidecar、sidecarClient）和新测试（session store、ChatInput、MarkdownRender）均通过。

- [ ] **Step 2: 运行 TypeScript 类型检查**

Run:
```bash
pnpm type-check
```

Expected: 0 errors。

- [ ] **Step 3: 运行 Rust 检查**

Run:
```bash
pnpm check
```

Expected: `cargo check` 通过（本 plan 未修改 Rust 代码，应无变化）。

- [ ] **Step 4: 最终 Commit**

如果所有验证通过，创建一个最终 commit（如无未提交变更则跳过）：

```bash
git add -A
git commit -m "feat(chat): implement end-to-end basic chat with SSE streaming, tabs, and home promotion"
```

---

## 自审检查

### 1. Spec 覆盖

对照 issue #02 acceptance criteria：

| Criteria | 实现位置 |
|----------|----------|
| SQLite Schema：`sessions` 表和 `messages` 表 | `server/src/db.ts` |
| Sidecar `POST /chat` API：SSE 流 | `server/src/routes/chat.ts` |
| Sidecar `GET /sessions` 和 `GET /sessions/:id` | `server/src/routes/sessions.ts` |
| 前端空会话态：大输入框 + 快捷胶囊 | `src/components/EmptySession.vue` |
| 前端对话态：底部输入框 + 消息流 | `src/components/ChatInput.vue` + `ChatMessageList.vue` |
| 消息流：用户靠右浅色背景，AI 靠左白色背景 | `src/components/ChatMessage.vue` |
| Markdown 渲染 + 代码语法高亮 + 复制按钮 | `src/components/MarkdownRender.vue` + `src/utils/markdown.ts` |
| Pinia store：`useSessionStore` | `src/stores/session.ts` |
| 首页占位符语义：首次发送后升格，创建新首页 | `src/stores/session.ts:sendMessage()` |
| 顶部标签栏：横向滚动、新建/切换/关闭、首页无法关闭 | `src/components/TabBar.vue` |
| 单例页面标签（知识库、设置、历史）只能开一个 | `src/App.vue:openKnowledgeBase/openHistory/openSettings` |

**无遗漏。**

### 2. Placeholder 扫描

- [x] 无 "TBD"/"TODO"/"implement later"/"fill in details"
- [x] 无 "Add appropriate error handling" 等模糊描述
- [x] 无 "Write tests for the above"（已附具体测试代码）
- [x] 无 "Similar to Task N" 引用
- [x] 每个代码步骤都包含完整可复制的代码

### 3. 类型一致性

| 接口 | 定义位置 | 使用位置 | 一致？ |
|------|----------|----------|--------|
| `Session` / `Message` / `LLMConfig` | `server/src/types.ts` | `src/types/index.ts` 复制定义 | 字段完全一致 |
| `ChatRequest` | `server/src/types.ts` | `server/src/routes/chat.ts` body 解析 | 字段一致 |
| `POST /chat` body | `src/stores/session.ts:sendMessage()` | `server/src/routes/chat.ts` | `{ message, sessionId, config }` |
| `Tab` / `TabType` | `src/types/index.ts` | `src/stores/session.ts`、`TabBar.vue`、`App.vue` | 一致 |
| `useSessionStore` state | `src/stores/session.ts` | `App.vue`、`ChatPage.vue`、`tests/unit/stores/session.test.ts` | 一致 |
| `useSettingsStore.llmConfig` | `src/stores/settings.ts` | `src/components/ChatPage.vue` | 一致 |

---

## 执行交接

**Plan complete and saved to `docs/superpowers/plans/2026-05-07-basic-chat.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — 我按 Task 逐个 dispatch 新鲜 subagent，每 Task 完成后 review，快速迭代。

**2. Inline Execution** — 在当前 session 中使用 `executing-plans` skill 批量执行，中间设 checkpoint 供 review。

**Which approach?**
