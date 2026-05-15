# 对话历史（Chat History）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现对话历史页面，支持查看历史会话列表、点击恢复续上对话、删除历史、重命名会话。

**Architecture:** Sidecar `sessions` 路由增强 `GET /`（附最近消息摘要）、新增 `POST /:id/rename` 与 `DELETE /:id`。前端 `session store` 扩展历史列表管理与恢复逻辑：`restoreSession` 优先复用空首页占位符，若已打开则激活对应标签；`deleteSession` 同步关闭标签并清理数据；`renameSession` 同步更新标签标题。`HistoryPage.vue` 提供列表视图、空状态、行内重命名与操作按钮。

**Tech Stack:** Vue 3 + Pinia + Tailwind CSS, Hono + better-sqlite3, Vitest + @vue/test-utils

---

## File Structure

| File | Action | Responsibility |
|------|--------|--------------|
| `server/src/routes/sessions.ts` | Modify | 增强 `GET /`（返回 summary）；新增 `POST /:id/rename`；新增 `DELETE /:id` |
| `src/stores/session.ts` | Modify | 新增 `historySessions`、`loadHistory`、`restoreSession`、`deleteSession`、`renameSession` |
| `src/components/HistoryPage.vue` | Create | 历史页 UI：Tabs、会话列表、空状态、重命名/删除/恢复交互 |
| `src/App.vue` | Modify | 引入 `HistoryPage` 组件替换 history 占位符 |
| `tests/unit/server/sessions.test.ts` | Create | Sidecar sessions API 测试（列表、摘要、重命名、删除） |
| `tests/unit/stores/sessionHistory.test.ts` | Create | Session store 历史相关方法测试 |
| `tests/unit/components/HistoryPage.test.ts` | Create | 历史页组件渲染与交互测试 |

---

### Task 1: Sidecar Sessions API 增强

**Files:**
- Modify: `server/src/routes/sessions.ts`
- Test: `tests/unit/server/sessions.test.ts`

- [ ] **Step 1: 增强 sessions 路由**

修改 `server/src/routes/sessions.ts`，替换为以下内容：

```typescript
import { Hono } from 'hono'
import db from '../db.js'

const app = new Hono()

app.get('/', (c) => {
  const rows = db
    .prepare(`
      SELECT
        s.id,
        s.title,
        s.provider,
        s.model,
        s.created_at,
        s.updated_at,
        s.message_count,
        (SELECT content FROM messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) as last_message
      FROM sessions s
      ORDER BY s.updated_at DESC
    `)
    .all() as Array<{
      id: string
      title: string
      provider: string | null
      model: string | null
      created_at: number
      updated_at: number
      message_count: number
      last_message: string | null
    }>

  const sessions = rows.map((r) => ({
    id: r.id,
    title: r.title,
    provider: r.provider,
    model: r.model,
    created_at: r.created_at,
    updated_at: r.updated_at,
    message_count: r.message_count,
    summary: r.last_message
      ? r.last_message.slice(0, 100) + (r.last_message.length > 100 ? '...' : '')
      : '',
  }))

  return c.json(sessions)
})

app.get('/:id', (c) => {
  const id = c.req.param('id')
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
    | {
        id: string
        title: string
        provider: string | null
        model: string | null
        created_at: number
        updated_at: number
        message_count: number
      }
    | undefined

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const messages = db
    .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(id)

  return c.json({ ...session, messages })
})

app.post('/:id/rename', async (c) => {
  const id = c.req.param('id')
  const { title } = await c.req.json<{ title: string }>()
  const trimmed = title?.trim()
  if (!trimmed) {
    return c.json({ error: 'Title is required' }, 400)
  }
  db.prepare('UPDATE sessions SET title = ? WHERE id = ?').run(trimmed, id)
  return c.json({ success: true })
})

app.delete('/:id', (c) => {
  const id = c.req.param('id')
  db.prepare('DELETE FROM messages WHERE session_id = ?').run(id)
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  return c.json({ success: true })
})

export default app
```

- [ ] **Step 2: 编写 Sidecar sessions API 测试**

创建 `tests/unit/server/sessions.test.ts`：

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-sessions-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: app } = await import('../../../../server/src/routes/sessions.js')
const { default: db } = await import('../../../../server/src/db.js')

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true })
})

afterAll(() => {
  db.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})

beforeEach(() => {
  db.exec('DELETE FROM messages')
  db.exec('DELETE FROM sessions')
})

describe('GET /sessions', () => {
  it('returns empty list initially', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it('returns sessions ordered by updated_at desc', async () => {
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s1', 'First', 1, 3, 0)
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s2', 'Second', 2, 2, 0)

    const res = await app.request('/')
    const data = await res.json()
    expect(data).toHaveLength(2)
    expect(data[0].id).toBe('s1')
    expect(data[1].id).toBe('s2')
  })

  it('includes summary from last message truncated to 100 chars', async () => {
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s1', 'Test', 1, 1, 1)
    db.prepare(
      'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(
      'm1',
      's1',
      'user',
      'This is a very long message that should be truncated for the summary view in the history page.',
      1
    )

    const res = await app.request('/')
    const data = await res.json()
    expect(data[0].summary).toBe(
      'This is a very long message that should be truncated for the summary view in the history page...'
    )
  })

  it('returns empty summary when no messages', async () => {
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s1', 'Empty', 1, 1, 0)

    const res = await app.request('/')
    const data = await res.json()
    expect(data[0].summary).toBe('')
  })
})

describe('POST /sessions/:id/rename', () => {
  it('updates session title', async () => {
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s1', 'Old', 1, 1, 0)

    const res = await app.request('/s1/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' }),
    })
    expect(res.status).toBe(200)

    const row = db.prepare('SELECT title FROM sessions WHERE id = ?').get('s1') as { title: string }
    expect(row.title).toBe('New Title')
  })

  it('returns 400 for empty title', async () => {
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s1', 'Old', 1, 1, 0)

    const res = await app.request('/s1/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '  ' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /sessions/:id', () => {
  it('removes session and its messages', async () => {
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s1', 'ToDelete', 1, 1, 1)
    db.prepare(
      'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('m1', 's1', 'user', 'hi', 1)

    const res = await app.request('/s1', { method: 'DELETE' })
    expect(res.status).toBe(200)

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get('s1')
    expect(session).toBeUndefined()
    const message = db.prepare('SELECT * FROM messages WHERE session_id = ?').get('s1')
    expect(message).toBeUndefined()
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test tests/unit/server/sessions.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/sessions.ts tests/unit/server/sessions.test.ts
git commit -m "feat(server): enhance sessions API with summary, rename and delete"
```

---

### Task 2: Session Store 历史管理方法

**Files:**
- Modify: `src/stores/session.ts`
- Test: `tests/unit/stores/sessionHistory.test.ts`

- [ ] **Step 1: 扩展 session store**

修改 `src/stores/session.ts`，在 `sendError` 下方新增 `historySessions` ref，并在 `return` 之前新增以下方法：

```typescript
const historySessions = ref<
  Array<{
    id: string
    title: string
    updated_at: number
    summary: string
    message_count: number
  }>
>([])

async function loadHistory() {
  const res = await sidecarFetch('/sessions')
  if (res.ok) {
    historySessions.value = await res.json()
  }
}

async function restoreSession(sessionId: string) {
  const existingTab = tabs.value.find((t) => t.sessionId === sessionId)
  if (existingTab) {
    activeTabId.value = existingTab.id
    return
  }

  const res = await sidecarFetch(`/sessions/${sessionId}`)
  if (!res.ok) return
  const data = (await res.json()) as {
    id: string
    title: string
    provider: string | null
    model: string | null
    messages: Message[]
  }

  messages.value.set(sessionId, data.messages ?? [])

  const homeTab = tabs.value.find((t) => t.type === 'chat' && !t.sessionId)
  if (homeTab) {
    homeTab.sessionId = sessionId
    homeTab.title = data.title
    activeTabId.value = homeTab.id
  } else {
    addTab({
      id: `chat-${Date.now()}`,
      type: 'chat',
      title: data.title,
      sessionId,
      closable: true,
    })
  }
}

async function deleteSession(sessionId: string) {
  const tab = tabs.value.find((t) => t.sessionId === sessionId)
  if (tab) {
    closeTab(tab.id)
  }
  messages.value.delete(sessionId)
  await sidecarFetch(`/sessions/${sessionId}`, { method: 'DELETE' })
  await loadHistory()
}

async function renameSession(sessionId: string, newTitle: string) {
  const trimmed = newTitle.trim()
  if (!trimmed) return

  await sidecarFetch(`/sessions/${sessionId}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: trimmed }),
  })

  const tab = tabs.value.find((t) => t.sessionId === sessionId)
  if (tab) {
    tab.title = trimmed
  }

  const entry = historySessions.value.find((h) => h.id === sessionId)
  if (entry) {
    entry.title = trimmed
  }
}
```

并将 `historySessions`、`loadHistory`、`restoreSession`、`deleteSession`、`renameSession` 加入 `return` 对象。

- [ ] **Step 2: 编写 session store 历史方法测试**

创建 `tests/unit/stores/sessionHistory.test.ts`：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session'
import { sidecarFetch } from '@/utils/sidecarClient'

vi.mock('@/utils/sidecarClient')

describe('session store history methods', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(sidecarFetch).mockReset()
  })

  it('loadHistory fetches sessions from API', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 's1', title: 'Hello', updated_at: 1, summary: 'summary', message_count: 2 },
      ],
    } as Response)

    const store = useSessionStore()
    await store.loadHistory()

    expect(store.historySessions).toHaveLength(1)
    expect(store.historySessions[0].title).toBe('Hello')
  })

  it('restoreSession activates existing tab if already open', async () => {
    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: 'Existing', closable: true, sessionId: 's1' })
    store.addTab({ id: 'home', type: 'chat', title: '首页', closable: true })
    store.switchTab('home')

    await store.restoreSession('s1')
    expect(store.activeTabId).toBe('t1')
    expect(sidecarFetch).not.toHaveBeenCalled()
  })

  it('restoreSession reuses home tab when empty', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 's1',
        title: 'Restored',
        provider: null,
        model: null,
        messages: [{ id: 'm1', session_id: 's1', role: 'user', content: 'hi', created_at: 1 }],
      }),
    } as Response)

    const store = useSessionStore()
    // home tab exists by default
    await store.restoreSession('s1')

    const homeTab = store.tabs.find((t) => t.id === 'home')
    expect(homeTab?.sessionId).toBe('s1')
    expect(homeTab?.title).toBe('Restored')
    expect(store.messages.get('s1')).toHaveLength(1)
  })

  it('restoreSession creates new tab when no home tab available', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 's1',
        title: 'Restored',
        provider: null,
        model: null,
        messages: [],
      }),
    } as Response)

    const store = useSessionStore()
    store.tabs[0].sessionId = 'existing'
    await store.restoreSession('s1')

    expect(store.tabs).toHaveLength(2)
    expect(store.tabs[1].sessionId).toBe('s1')
  })

  it('deleteSession closes tab, clears messages and refreshes history', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({ ok: true } as Response)

    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: 'ToDelete', closable: true, sessionId: 's1' })
    store.messages.set('s1', [{ id: 'm1', session_id: 's1', role: 'user', content: 'hi', created_at: 1 }])
    store.historySessions = [{ id: 's1', title: 'ToDelete', updated_at: 1, summary: '', message_count: 1 }]

    await store.deleteSession('s1')

    expect(store.tabs.find((t) => t.sessionId === 's1')).toBeUndefined()
    expect(store.messages.has('s1')).toBe(false)
    expect(sidecarFetch).toHaveBeenCalledWith('/sessions/s1', { method: 'DELETE' })
  })

  it('renameSession updates tab title and history entry', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({ ok: true } as Response)

    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: 'Old', closable: true, sessionId: 's1' })
    store.historySessions = [{ id: 's1', title: 'Old', updated_at: 1, summary: '', message_count: 1 }]

    await store.renameSession('s1', 'New Title')

    expect(store.tabs[0].title).toBe('New Title')
    expect(store.historySessions[0].title).toBe('New Title')
    expect(sidecarFetch).toHaveBeenCalledWith(
      '/sessions/s1/rename',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'New Title' }),
      })
    )
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test tests/unit/stores/sessionHistory.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/stores/session.ts tests/unit/stores/sessionHistory.test.ts
git commit -m "feat(store): add history management to session store"
```

---

### Task 3: 对话历史页组件

**Files:**
- Create: `src/components/HistoryPage.vue`
- Test: `tests/unit/components/HistoryPage.test.ts`

- [ ] **Step 1: 创建 HistoryPage 组件**

创建 `src/components/HistoryPage.vue`：

```vue
<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useSessionStore } from '@/stores/session'

const store = useSessionStore()

const editingId = ref<string | null>(null)
const editValue = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  store.loadHistory()
})

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function startRename(id: string, title: string) {
  editingId.value = id
  editValue.value = title
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

function confirmRename(id: string) {
  if (editValue.value.trim()) {
    store.renameSession(id, editValue.value)
  }
  editingId.value = null
}

function cancelRename() {
  editingId.value = null
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div class="mx-auto max-w-3xl">
      <!-- Tabs -->
      <div class="mb-6 flex gap-2 border-b border-border-default">
        <button
          class="border-b-2 border-accent-500 px-3 py-2 text-sm font-medium text-accent-400"
        >
          问答历史
        </button>
      </div>

      <!-- Empty state -->
      <div
        v-if="store.historySessions.length === 0"
        class="flex flex-col items-center justify-center py-20"
      >
        <span class="i-mdi-history text-4xl text-text-tertiary" />
        <p class="mt-4 text-text-secondary">暂无对话历史</p>
        <p class="mt-1 text-xs text-text-tertiary">开始一段新对话，历史将出现在这里</p>
      </div>

      <!-- List -->
      <div v-else class="space-y-2">
        <div
          v-for="session in store.historySessions"
          :key="session.id"
          class="group flex cursor-pointer items-start gap-3 rounded-xl border border-border-default bg-surface-1 p-4 transition-all hover:border-accent-500/30 hover:bg-surface-2"
          @click="store.restoreSession(session.id)"
        >
          <span class="i-mdi-chat-outline mt-0.5 text-lg text-text-tertiary" />

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <input
                v-if="editingId === session.id"
                ref="editInputRef"
                v-model="editValue"
                class="h-7 rounded border border-accent-500 bg-surface-0 px-2 text-sm font-medium text-text-primary outline-none"
                @keyup.enter="confirmRename(session.id)"
                @keyup.esc="cancelRename"
                @blur="confirmRename(session.id)"
                @click.stop
              />
              <h3
                v-else
                class="truncate text-sm font-medium text-text-primary"
              >
                {{ session.title }}
              </h3>
            </div>

            <div class="mt-1 flex items-center gap-2 text-xs text-text-tertiary">
              <span>{{ formatTime(session.updated_at) }}</span>
              <span v-if="session.message_count">· {{ session.message_count }} 条消息</span>
            </div>

            <p class="mt-1 line-clamp-2 text-sm text-text-secondary">
              {{ session.summary }}
            </p>
          </div>

          <div
            class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <button
              class="rounded p-1.5 text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
              title="重命名"
              @click.stop="startRename(session.id, session.title)"
            >
              <span class="i-mdi-pencil text-sm" />
            </button>
            <button
              class="rounded p-1.5 text-text-tertiary transition-colors hover:bg-danger-500/10 hover:text-danger-400"
              title="删除"
              @click.stop="store.deleteSession(session.id)"
            >
              <span class="i-mdi-delete text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 编写 HistoryPage 组件测试**

创建 `tests/unit/components/HistoryPage.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import HistoryPage from '@/components/HistoryPage.vue'
import { useSessionStore } from '@/stores/session'

function mountPage(storeOverrides?: Record<string, unknown>) {
  const pinia = createTestingPinia({
    stubActions: false,
    initialState: {
      session: {
        tabs: [{ id: 'home', type: 'chat', title: '首页', closable: true }],
        activeTabId: 'home',
        messages: new Map(),
        historySessions: [],
        ...storeOverrides,
      },
    },
  })
  setActivePinia(pinia)

  return mount(HistoryPage, {
    global: {
      plugins: [pinia],
      stubs: {
        Transition: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no history', () => {
    const wrapper = mountPage()
    expect(wrapper.text()).toContain('暂无对话历史')
  })

  it('renders history list items', () => {
    const wrapper = mountPage({
      historySessions: [
        { id: 's1', title: 'First Chat', updated_at: Date.now(), summary: 'Hello world', message_count: 3 },
      ],
    })
    expect(wrapper.text()).toContain('First Chat')
    expect(wrapper.text()).toContain('Hello world')
    expect(wrapper.text()).toContain('3 条消息')
  })

  it('calls restoreSession when item clicked', async () => {
    const wrapper = mountPage({
      historySessions: [
        { id: 's1', title: 'Chat', updated_at: Date.now(), summary: '', message_count: 1 },
      ],
    })
    const store = useSessionStore()

    await wrapper.find('.group').trigger('click')
    expect(store.restoreSession).toHaveBeenCalledWith('s1')
  })

  it('calls deleteSession when delete button clicked', async () => {
    const wrapper = mountPage({
      historySessions: [
        { id: 's1', title: 'Chat', updated_at: Date.now(), summary: '', message_count: 1 },
      ],
    })
    const store = useSessionStore()

    const deleteBtn = wrapper.find('[title="删除"]')
    await deleteBtn.trigger('click')
    expect(store.deleteSession).toHaveBeenCalledWith('s1')
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test tests/unit/components/HistoryPage.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/HistoryPage.vue tests/unit/components/HistoryPage.test.ts
git commit -m "feat(ui): add HistoryPage with list, restore, rename and delete"
```

---

### Task 4: App.vue 集成

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: 引入 HistoryPage 组件**

修改 `src/App.vue`，在 `script setup` 的 import 区域添加：

```typescript
import HistoryPage from './components/HistoryPage.vue'
```

将模板中的 history 占位符：

```vue
<div
  v-else-if="sessionStore.activeTab?.type === 'history'"
  class="flex h-full items-center justify-center text-text-secondary"
>
  对话历史（由 #06 实现）
</div>
```

替换为：

```vue
<HistoryPage v-else-if="sessionStore.activeTab?.type === 'history'" />
```

- [ ] **Step 2: Commit**

```bash
git add src/App.vue
git commit -m "feat(app): wire HistoryPage component"
```

---

### Task 5: 端到端验证

- [ ] **Step 1: Type check**

Run: `pnpm type-check`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 3: Sidecar build check**

Run: `cd server && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Manual verification checklist**

启动应用（`pnpm tauri dev` 或仅前端 `pnpm dev`）：
- [ ] 点击左侧时钟图标，打开对话历史页
- [ ] 无历史时显示"暂无对话历史"空状态
- [ ] 发送几条消息后，历史页能看到会话列表（标题、时间、摘要、消息数）
- [ ] 点击历史项：未打开时复用当前空首页（或新建标签），加载该 session 的消息
- [ ] 再次点击同一历史项：直接激活已打开的标签
- [ ] 点击重命名按钮，修改标题后回车，列表和对应标签标题同步更新
- [ ] 点击删除按钮，列表移除该项，对应标签关闭，内存消息清理

- [ ] **Step 5: 更新进度文档**

更新 `PROGRESS.md` 将 #06 状态改为 `closed`：

```markdown
| 历史管理 | #06 对话历史 | closed | 历史列表、恢复会话、删除、重命名 |
```

```bash
git add PROGRESS.md
git commit -m "docs: mark #06 chat history as closed"
```

---

## Self-Review

### 1. Spec coverage

| Issue 要求 | 实现任务 |
|---|---|
| 前端对话历史页：Tabs + 历史列表 | Task 3 Step 1 (`HistoryPage.vue`) |
| 列表项：总结标题、最后消息时间、内容摘要 | Task 1 Step 1 (SQL 子查询 + 截断) + Task 3 Step 1 (模板渲染) |
| Sidecar API `GET /sessions` 含摘要 | Task 1 Step 1 |
| Sidecar API `POST /sessions/:id/rename` | Task 1 Step 1 |
| Sidecar API `DELETE /sessions/:id` | Task 1 Step 1 |
| 点击恢复：复用首页或新建；已打开则激活 | Task 2 Step 1 (`restoreSession`) |
| 删除历史：删数据 + 关标签 | Task 2 Step 1 (`deleteSession`) |
| 重命名：改数据 + 同步标签 | Task 2 Step 1 (`renameSession`) |
| 空状态引导 | Task 3 Step 1 (条件渲染) |

### 2. Placeholder scan

- 无 "TBD"、"TODO"、"implement later"
- 无模糊描述
- 所有步骤含完整代码或精确命令
- 所有文件路径精确

### 3. Type consistency

- `GET /sessions` 返回的 summary 字段与前端 `historySessions` 类型一致
- `renameSession` 参数签名与 API body 一致（`{ title: string }`）
- `restoreSession` 使用 `sidecarFetch('/sessions/:id')` 的响应结构与现有 `GET /:id` 一致
- `Tab` 的 `sessionId` 使用方式与 #02 完全一致（#05 的 provider/model 不影响 #06 逻辑）

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-chat-history.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**
