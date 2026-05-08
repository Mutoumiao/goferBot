# Issue #08 — 测试覆盖补全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全当前测试覆盖缺口，修复测试稳定性问题，运行覆盖率验证并确保满足阈值（lines ≥ 10%, branches ≥ 10%, statements ≥ 10%, functions ≥ 0%）。

**Architecture:** 当前项目已有 34 个测试文件、236 个用例全部通过，但存在 1 个未处理的 EnvironmentTeardownError，以及 sessions API、markdown 工具函数、confirm 工具函数、KbMentionPill 组件、MoveCopyDialog 组件尚无测试。计划通过增量补充测试 + 清理废弃代码 + 修复 teardown 错误来达成目标。

**Tech Stack:** Vitest + @vue/test-utils（前端组件测试）、happy-dom（DOM 环境）、Node 环境 Vitest（Sidecar API 测试）、v8 coverage provider

---

## 文件结构

| 文件 | 职责 | 动作 |
|------|------|------|
| `tests/unit/server/sessions.test.ts` | Sidecar sessions 路由 API 测试（GET /sessions, GET /sessions/:id） | 创建 |
| `tests/unit/utils/markdown.test.ts` | `renderMarkdown` 工具函数测试 | 创建 |
| `tests/unit/utils/confirm.test.ts` | `confirmDialog` 工具函数测试 | 创建 |
| `tests/unit/components/KbMentionPill.test.ts` | KbMentionPill 组件渲染和事件测试 | 创建 |
| `tests/unit/components/MoveCopyDialog.test.ts` | MoveCopyDialog 组件交互测试 | 创建 |
| `tests/unit/server/knowledgeBasesExtended.test.ts` | 现有扩展 API 测试 | 修改（补充 afterAll） |
| `src/components/GreetComponent.vue` | Tauri 模板遗留组件，未在任何地方引用 | 删除 |
| `components.d.ts` | 组件类型声明（自动生成） | 自动更新 |

---

## Task 1: 修复 knowledgeBasesExtended.test.ts 的 teardown 错误

**Files:**
- Modify: `tests/unit/server/knowledgeBasesExtended.test.ts`

- [ ] **Step 1: 补充 `afterAll` 清理代码**

在文件顶部导入后补充 `afterAll`，与 `knowledgeBases.test.ts` 保持一致：

```typescript
// 在文件第 2 行 import 后增加 afterAll
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
```

在 `beforeEach` 块之后添加：

```typescript
afterAll(() => {
  db.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})
```

- [ ] **Step 2: 运行测试验证 error 消失**

Run: `pnpm test -- tests/unit/server/knowledgeBasesExtended.test.ts`
Expected: 全部通过，无 "Unhandled Rejection" 或 "EnvironmentTeardownError"

- [ ] **Step 3: Commit**

```bash
git add tests/unit/server/knowledgeBasesExtended.test.ts
git commit -m "fix(test): add missing afterAll teardown in knowledgeBasesExtended test"
```

---

## Task 2: 添加 Sidecar sessions API 测试

**Files:**
- Create: `tests/unit/server/sessions.test.ts`

- [ ] **Step 1: 创建测试文件**

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
  it('should return empty list initially', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual([])
  })

  it('should return sessions ordered by updated_at DESC', async () => {
    const now = Date.now()
    db.prepare('INSERT INTO sessions (id, title, updated_at, created_at, message_count) VALUES (?, ?, ?, ?, ?)').run('s1', 'First', now, now, 0)
    db.prepare('INSERT INTO sessions (id, title, updated_at, created_at, message_count) VALUES (?, ?, ?, ?, ?)').run('s2', 'Second', now + 1000, now, 0)

    const res = await app.request('/')
    expect(res.status).toBe(200)
    const json = (await res.json()) as Array<{ title: string }>
    expect(json).toHaveLength(2)
    expect(json[0].title).toBe('Second')
    expect(json[1].title).toBe('First')
  })
})

describe('GET /sessions/:id', () => {
  it('should return 404 for non-existent session', async () => {
    const res = await app.request('/nonexistent')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Session not found')
  })

  it('should return session with messages', async () => {
    const now = Date.now()
    db.prepare('INSERT INTO sessions (id, title, updated_at, created_at, message_count) VALUES (?, ?, ?, ?, ?)').run('s1', 'Test Session', now, now, 1)
    db.prepare('INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run('m1', 's1', 'user', 'hello', now)

    const res = await app.request('/s1')
    expect(res.status).toBe(200)
    const json = (await res.json()) as { title: string; messages: Array<{ content: string }> }
    expect(json.title).toBe('Test Session')
    expect(json.messages).toHaveLength(1)
    expect(json.messages[0].content).toBe('hello')
  })

  it('should return messages ordered by created_at ASC', async () => {
    const now = Date.now()
    db.prepare('INSERT INTO sessions (id, title, updated_at, created_at, message_count) VALUES (?, ?, ?, ?, ?)').run('s1', 'Order', now, now, 2)
    db.prepare('INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run('m1', 's1', 'user', 'first', now)
    db.prepare('INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run('m2', 's1', 'assistant', 'second', now + 100)

    const res = await app.request('/s1')
    const json = (await res.json()) as { messages: Array<{ content: string }> }
    expect(json.messages[0].content).toBe('first')
    expect(json.messages[1].content).toBe('second')
  })
})
```

- [ ] **Step 2: 运行测试确保通过**

Run: `pnpm test -- tests/unit/server/sessions.test.ts`
Expected: 4 tests passed

- [ ] **Step 3: Commit**

```bash
git add tests/unit/server/sessions.test.ts
git commit -m "test(server): add sessions API tests for GET /sessions and GET /sessions/:id"
```

---

## Task 3: 添加 markdown 工具函数测试

**Files:**
- Create: `tests/unit/utils/markdown.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/utils/markdown'

describe('renderMarkdown', () => {
  it('renders plain text to paragraph', () => {
    const html = renderMarkdown('hello world')
    expect(html.trim()).toBe('<p>hello world</p>\n')
  })

  it('renders bold text', () => {
    const html = renderMarkdown('**bold**')
    expect(html).toContain('<strong>bold</strong>')
  })

  it('renders code block with highlight classes', () => {
    const md = '```js\nconst x = 1;\n```'
    const html = renderMarkdown(md)
    expect(html).toContain('<pre>')
    expect(html).toContain('<code')
    expect(html).toContain('const x = 1')
  })

  it('renders inline code', () => {
    const html = renderMarkdown('use `renderMarkdown`')
    expect(html).toContain('<code>')
    expect(html).toContain('renderMarkdown')
  })

  it('renders unordered list', () => {
    const html = renderMarkdown('- item 1\n- item 2')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>item 1</li>')
  })

  it('renders ordered list', () => {
    const html = renderMarkdown('1. first\n2. second')
    expect(html).toContain('<ol>')
    expect(html).toContain('<li>first</li>')
  })

  it('renders links with anchor tags', () => {
    const html = renderMarkdown('[link](https://example.com)')
    expect(html).toContain('<a href="https://example.com">link</a>')
  })

  it('renders headings', () => {
    const html = renderMarkdown('# Title')
    expect(html).toContain('<h1>Title</h1>')
  })
})
```

- [ ] **Step 2: 运行测试确保通过**

Run: `pnpm test -- tests/unit/utils/markdown.test.ts`
Expected: 8 tests passed

- [ ] **Step 3: Commit**

```bash
git add tests/unit/utils/markdown.test.ts
git commit -m "test(utils): add markdown rendering tests"
```

---

## Task 4: 添加 confirm 工具函数测试

**Files:**
- Create: `tests/unit/utils/confirm.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { confirmDialog } from '@/utils/confirm'

// @ts-expect-error mock tauri dialog module
await vi.hoisted(() => vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn(),
})))

const { confirm: tauriConfirm } = await import('@tauri-apps/plugin-dialog')

describe('confirmDialog', () => {
  it('returns tauri confirm result when available', async () => {
    vi.mocked(tauriConfirm).mockResolvedValue(true)
    const result = await confirmDialog('Are you sure?')
    expect(result).toBe(true)
    expect(tauriConfirm).toHaveBeenCalledWith('Are you sure?')
  })

  it('falls back to window.confirm when tauri throws', async () => {
    vi.mocked(tauriConfirm).mockRejectedValue(new Error('not available'))
    const originalConfirm = window.confirm
    window.confirm = vi.fn(() => false)

    const result = await confirmDialog('Fallback?')
    expect(result).toBe(false)
    expect(window.confirm).toHaveBeenCalledWith('Fallback?')

    window.confirm = originalConfirm
  })
})
```

- [ ] **Step 2: 运行测试确保通过**

Run: `pnpm test -- tests/unit/utils/confirm.test.ts`
Expected: 2 tests passed

- [ ] **Step 3: Commit**

```bash
git add tests/unit/utils/confirm.test.ts
git commit -m "test(utils): add confirmDialog fallback tests"
```

---

## Task 5: 添加 KbMentionPill 组件测试

**Files:**
- Create: `tests/unit/components/KbMentionPill.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import KbMentionPill from '@/components/KbMentionPill.vue'

describe('KbMentionPill', () => {
  const kb = { id: 'kb1', name: 'Docs', icon: 'mdi-books' }

  it('renders knowledge base name', () => {
    const wrapper = mount(KbMentionPill, { props: { kb } })
    expect(wrapper.text()).toContain('Docs')
  })

  it('renders custom icon class', () => {
    const wrapper = mount(KbMentionPill, { props: { kb } })
    const icon = wrapper.find('span.i-mdi-books')
    expect(icon.exists()).toBe(true)
  })

  it('renders default icon when none provided', () => {
    const wrapper = mount(KbMentionPill, {
      props: { kb: { id: 'kb2', name: 'Default' } },
    })
    const icon = wrapper.find('span.i-mdi-database')
    expect(icon.exists()).toBe(true)
  })

  it('emits remove on close button click', async () => {
    const wrapper = mount(KbMentionPill, { props: { kb } })
    const btn = wrapper.find('button')
    await btn.trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试确保通过**

Run: `pnpm test -- tests/unit/components/KbMentionPill.test.ts`
Expected: 4 tests passed

- [ ] **Step 3: Commit**

```bash
git add tests/unit/components/KbMentionPill.test.ts
git commit -m "test(components): add KbMentionPill render and remove event tests"
```

---

## Task 6: 添加 MoveCopyDialog 组件测试

**Files:**
- Create: `tests/unit/components/MoveCopyDialog.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MoveCopyDialog from '@/components/MoveCopyDialog.vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'

// Mock sidecarClient getSidecarPort
vi.mock('@/utils/sidecarClient', () => ({
  getSidecarPort: vi.fn(() => 11451),
  sidecarFetch: vi.fn(),
}))

describe('MoveCopyDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    global.fetch = vi.fn()
  })

  function createWrapper(props = {}) {
    const store = useKnowledgeBaseStore()
    store.knowledgeBases = [
      { id: 'kb1', name: 'Source', icon: 'mdi-database' },
      { id: 'kb2', name: 'Target', icon: 'mdi-folder' },
    ]

    return mount(MoveCopyDialog, {
      props: {
        visible: true,
        mode: 'move',
        sourceKbId: 'kb1',
        sourcePath: 'file.md',
        ...props,
      },
    })
  }

  it('renders title based on mode', () => {
    const wrapper = createWrapper({ mode: 'move' })
    expect(wrapper.text()).toContain('移动到')

    const wrapper2 = createWrapper({ mode: 'copy' })
    expect(wrapper2.text()).toContain('复制到')
  })

  it('renders knowledge base list in left panel', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Source')
    expect(wrapper.text()).toContain('Target')
  })

  it('highlights selected knowledge base', () => {
    const wrapper = createWrapper()
    const items = wrapper.findAll('.w-48 > div > div')
    const first = items[0]
    expect(first.classes().join(' ')).toContain('bg-accent-600/15')
  })

  it('emits close on cancel button click', async () => {
    const wrapper = createWrapper()
    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === '取消')
    await cancelBtn!.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close on overlay click', async () => {
    const wrapper = createWrapper()
    const overlay = wrapper.find('.fixed.inset-0')
    await overlay.trigger('click.self')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('loads target folders on mount when visible', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: async () => ({ items: [{ name: 'sub', type: 'directory' }] }),
    } as Response)

    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.text()).toContain('sub')
  })

  it('shows empty state when no folders', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: async () => ({ items: [] }),
    } as Response)

    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.text()).toContain('暂无子文件夹')
  })

  it('calls store.moveFile on confirm in move mode', async () => {
    const store = useKnowledgeBaseStore()
    store.moveFile = vi.fn().mockResolvedValue(undefined)

    const wrapper = createWrapper({ mode: 'move' })
    await flushPromises()

    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === '移动至此')
    await confirmBtn!.trigger('click')

    expect(store.moveFile).toHaveBeenCalledWith('kb1', 'file.md', 'kb1', '')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('calls store.copyFile on confirm in copy mode', async () => {
    const store = useKnowledgeBaseStore()
    store.copyFile = vi.fn().mockResolvedValue(undefined)

    const wrapper = createWrapper({ mode: 'copy' })
    await flushPromises()

    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === '复制至此')
    await confirmBtn!.trigger('click')

    expect(store.copyFile).toHaveBeenCalledWith('kb1', 'file.md', 'kb1', '')
  })
})
```

- [ ] **Step 2: 运行测试确保通过**

Run: `pnpm test -- tests/unit/components/MoveCopyDialog.test.ts`
Expected: 9 tests passed

- [ ] **Step 3: Commit**

```bash
git add tests/unit/components/MoveCopyDialog.test.ts
git commit -m "test(components): add MoveCopyDialog render and interaction tests"
```

---

## Task 7: 删除废弃的 GreetComponent.vue

**Files:**
- Delete: `src/components/GreetComponent.vue`

- [ ] **Step 1: 确认无引用后删除文件**

```bash
grep -r "GreetComponent" src/ --include="*.vue" --include="*.ts" || echo "No references found"
rm src/components/GreetComponent.vue
```

- [ ] **Step 2: 更新自动生成的类型声明**

`components.d.ts` 会在下次 `pnpm dev` 或 `pnpm type-check` 时自动更新。若未自动更新，手动移除其中的 `GreetComponent` 声明行。

- [ ] **Step 3: 运行测试和类型检查确认无破坏**

Run: `pnpm test && pnpm type-check`
Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
git add src/components/GreetComponent.vue components.d.ts
git commit -m "chore: remove unused GreetComponent template"
```

---

## Task 8: 运行覆盖率验证

**Files:**
- None (verification task)

- [ ] **Step 1: 运行全量测试 + coverage**

Run: `pnpm test -- --coverage`
Expected: 所有测试通过，无 unhandled errors，覆盖率报告输出到终端

- [ ] **Step 2: 验证阈值达标**

检查终端输出中的 coverage summary：
- `lines` ≥ 10%
- `branches` ≥ 10%
- `statements` ≥ 10%
- `functions` ≥ 0%

若任何一项未达标，定位缺口文件并补充测试（通常缺口在大型未测组件如 App.vue 或复杂分支）。

- [ ] **Step 3: Commit（如有新增测试）**

若 Step 2 中补充了额外测试，单独 commit。

---

## 自审清单

**1. Spec coverage:**
- Issue #08 验收标准中的 "前端组件测试"：已有 EmptySession、ChatInput、ChatMessage、MarkdownRender、TabBar、KbMentionDropdown、ChatInputMention 测试覆盖；本计划补充 KbMentionPill、MoveCopyDialog → **覆盖**
- "Pinia store 测试"：已有 session、settings、knowledgeBase（含 extended 和 remaining）测试覆盖；tab 逻辑在 session store 中，已由 session.test.ts 覆盖 → **覆盖**
- "Sidecar API 集成测试"：已有 chat、知识库 CRUD、文件列表、embedding、indexer、rag、dbSchema 测试；本计划补充 sessions API → **覆盖**
- "工具函数测试"：已有 sidecarClient 测试；本计划补充 markdown、confirm → **覆盖**
- "覆盖率达标"：Task 8 专门验证 → **覆盖**
- "测试配置适配"：testglobals.ts 已配置，无变更需求 → **覆盖**

**2. Placeholder scan:**
- 无 "TBD" / "TODO" / "implement later"
- 无 "Add appropriate error handling" 类模糊描述
- 每个测试步骤均包含完整代码
- 无 "Similar to Task N" 引用

**3. Type consistency:**
- `useKnowledgeBaseStore` mock 中调用的 `moveFile` / `copyFile` 签名与 store 实际导出一致（4 个 string 参数）
- sessions 测试中 `messages` 表 insert 字段与 schema 一致
- `renderMarkdown` 导入路径与源码一致

---

## 执行交接

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-test-coverage.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review

**Which approach?**
