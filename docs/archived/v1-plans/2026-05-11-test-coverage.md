# 测试覆盖补全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全缺失的单元测试文件，修复测试稳定性问题，清理废弃代码，提升覆盖率阈值。

**Architecture:** 采用 TDD 模式：先写失败测试 → 运行确认失败 → 实现代码（或调整测试环境）→ 运行确认通过 → 提交。测试按复杂度从低到高排序：工具函数 → 简单组件 → 复杂组件 → 稳定性修复 → 覆盖率验证。

**Tech Stack:** Vitest + @vue/test-utils + happy-dom + v8 coverage

---

## File Structure

| 文件 | 职责 |
|------|------|
| `tests/unit/utils/markdown.test.ts` | 新建：`renderMarkdown` 纯函数测试 |
| `tests/unit/utils/confirm.test.ts` | 新建：`confirmDialog` fallback 逻辑测试 |
| `tests/unit/components/KbMentionPill.test.ts` | 新建：KbMentionPill 展示组件测试 |
| `tests/unit/components/MoveCopyDialog.test.ts` | 新建：MoveCopyDialog 复杂交互测试 |
| `src/components/GreetComponent.vue` | 删除：废弃 Tauri 示例组件 |
| `components.d.ts` | 修改：移除 GreetComponent 声明 |
| `tests/unit/server/knowledgeBasesExtended.test.ts` | 修改：修复 teardown（不移除 db.close） |
| `vitest.config.ts` | 修改：提升覆盖率阈值 |

---

### Task 1: 删除废弃组件 GreetComponent.vue

**Files:**
- Delete: `src/components/GreetComponent.vue`
- Modify: `components.d.ts`
- Test: `pnpm test` 确认无回归

- [ ] **Step 1: 确认 GreetComponent 无引用**

Run: `grep -r "GreetComponent" src/ tests/ --include="*.ts" --include="*.vue"`
Expected: 无任何引用（除了组件自身和 components.d.ts）。

- [ ] **Step 2: 删除组件文件**

```bash
git rm src/components/GreetComponent.vue
```

- [ ] **Step 3: 从 components.d.ts 移除声明**

找到 `GreetComponent` 相关行并删除。

- [ ] **Step 4: 运行测试确认无回归**

Run: `pnpm test`
Expected: 41 passed (278 tests)，无新增失败。

- [ ] **Step 5: 提交**

```bash
git add components.d.ts src/components/GreetComponent.vue
git commit -m "chore(#08): 删除废弃 GreetComponent.vue"
```

---

### Task 2: 修复 knowledgeBasesExtended.test.ts teardown 稳定性

**Files:**
- Modify: `tests/unit/server/knowledgeBasesExtended.test.ts:34-37`
- Test: `pnpm test`

- [ ] **Step 1: 修改 afterAll 不关闭全局 db 连接**

```typescript
afterAll(() => {
  // db.close() // 注释掉：全局 db 连接不应在单个测试文件中关闭
  try { fs.rmSync(testDir, { recursive: true, force: true }) } catch { /* ignore */ }
})
```

- [ ] **Step 2: 运行测试两次确认稳定性**

Run: `pnpm test`
Expected: 全部通过，无 "EnvironmentTeardownError"、无 "Unhandled Rejection"。

再运行一次确认：
Run: `pnpm test`
Expected: 同样全部通过。

- [ ] **Step 3: 提交**

```bash
git add tests/unit/server/knowledgeBasesExtended.test.ts
git commit -m "fix(#08): knowledgeBasesExtended 测试 teardown 不关闭全局 db"
```

---

### Task 3: 工具函数测试 — markdown.ts

**Files:**
- Create: `tests/unit/utils/markdown.test.ts`
- Source: `src/utils/markdown.ts`

- [ ] **Step 1: 编写 renderMarkdown 测试**

```typescript
import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/utils/markdown'

describe('renderMarkdown', () => {
  it('renders plain text as paragraph', () => {
    const result = renderMarkdown('hello world')
    expect(result).toContain('<p>hello world</p>')
  })

  it('renders bold text with strong tag', () => {
    const result = renderMarkdown('**bold**')
    expect(result).toContain('<strong>bold</strong>')
  })

  it('renders code block with highlight', () => {
    const result = renderMarkdown('```js\nconst x = 1;\n```')
    expect(result).toContain('<pre>')
    expect(result).toContain('<code')
    expect(result).toContain('const x = 1')
  })

  it('renders inline code', () => {
    const result = renderMarkdown('use `renderMarkdown`')
    expect(result).toContain('<code>renderMarkdown</code>')
  })

  it('renders unordered list', () => {
    const result = renderMarkdown('- item 1\n- item 2')
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>item 1</li>')
  })

  it('renders ordered list', () => {
    const result = renderMarkdown('1. first\n2. second')
    expect(result).toContain('<ol>')
    expect(result).toContain('<li>first</li>')
  })

  it('renders link as anchor', () => {
    const result = renderMarkdown('[link](https://example.com)')
    expect(result).toContain('<a href="https://example.com">link</a>')
  })

  it('renders heading', () => {
    const result = renderMarkdown('# Title')
    expect(result).toContain('<h1>Title</h1>')
  })
})
```

- [ ] **Step 2: 运行测试确认通过**

Run: `pnpm test -- tests/unit/utils/markdown.test.ts`
Expected: 8 tests passed。

- [ ] **Step 3: 提交**

```bash
git add tests/unit/utils/markdown.test.ts
git commit -m "test(#08): markdown.ts renderMarkdown 工具函数测试"
```

---

### Task 4: 工具函数测试 — confirm.ts

**Files:**
- Create: `tests/unit/utils/confirm.test.ts`
- Source: `src/utils/confirm.ts`

- [ ] **Step 1: 编写 confirmDialog 测试**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { confirmDialog } from '@/utils/confirm'

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn(),
}))

import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'

describe('confirmDialog', () => {
  it('returns tauriConfirm result when available', async () => {
    vi.mocked(tauriConfirm).mockResolvedValue(true)
    const result = await confirmDialog('Are you sure?')
    expect(result).toBe(true)
    expect(tauriConfirm).toHaveBeenCalledWith('Are you sure?')
  })

  it('falls back to window.confirm when tauriConfirm throws', async () => {
    vi.mocked(tauriConfirm).mockRejectedValue(new Error('not available'))
    const windowConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const result = await confirmDialog('Fallback?')
    expect(result).toBe(false)
    expect(windowConfirm).toHaveBeenCalledWith('Fallback?')
    windowConfirm.mockRestore()
  })
})
```

- [ ] **Step 2: 运行测试确认通过**

Run: `pnpm test -- tests/unit/utils/confirm.test.ts`
Expected: 2 tests passed。

- [ ] **Step 3: 提交**

```bash
git add tests/unit/utils/confirm.test.ts
git commit -m "test(#08): confirm.ts fallback 逻辑测试"
```

---

### Task 5: 组件测试 — KbMentionPill

**Files:**
- Create: `tests/unit/components/KbMentionPill.test.ts`
- Source: `src/components/KbMentionPill.vue`

- [ ] **Step 1: 编写 KbMentionPill 测试**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import KbMentionPill from '@/components/KbMentionPill.vue'

describe('KbMentionPill', () => {
  const kb = { id: 'kb1', name: 'Docs', icon: 'mdi-books', path: '/docs', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0 }

  it('renders knowledge base name', () => {
    const wrapper = mount(KbMentionPill, { props: { kb } })
    expect(wrapper.text()).toContain('Docs')
  })

  it('renders custom icon', () => {
    const wrapper = mount(KbMentionPill, { props: { kb } })
    const icon = wrapper.find('span.i-mdi-books')
    expect(icon.exists()).toBe(true)
  })

  it('renders default database icon when no icon', () => {
    const kbNoIcon = { ...kb, icon: '' }
    const wrapper = mount(KbMentionPill, { props: { kb: kbNoIcon } })
    const icon = wrapper.find('span.i-mdi-database')
    expect(icon.exists()).toBe(true)
  })

  it('emits remove on close button click', async () => {
    const wrapper = mount(KbMentionPill, { props: { kb } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试确认通过**

Run: `pnpm test -- tests/unit/components/KbMentionPill.test.ts`
Expected: 4 tests passed。

- [ ] **Step 3: 提交**

```bash
git add tests/unit/components/KbMentionPill.test.ts
git commit -m "test(#08): KbMentionPill 组件测试"
```

---

### Task 6: 组件测试 — MoveCopyDialog

**Files:**
- Create: `tests/unit/components/MoveCopyDialog.test.ts`
- Source: `src/components/MoveCopyDialog.vue`
- Modify: 可能需要 mock `getSidecarPort`

- [ ] **Step 1: 编写 MoveCopyDialog 测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import MoveCopyDialog from '@/components/MoveCopyDialog.vue'
import { getSidecarPort } from '@/utils/sidecarClient'

vi.mock('@/utils/sidecarClient', () => ({
  getSidecarPort: vi.fn(),
}))

describe('MoveCopyDialog', () => {
  beforeEach(() => {
    vi.mocked(getSidecarPort).mockReturnValue(11451)
  })

  function mountDialog(props: { visible: boolean; mode: 'move' | 'copy'; sourceKbId: string; sourcePath: string }) {
    return mount(MoveCopyDialog, {
      props,
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
      attachTo: document.body,
    })
  }

  it('shows move title in move mode', () => {
    const wrapper = mountDialog({ visible: true, mode: 'move', sourceKbId: 'kb1', sourcePath: 'file.txt' })
    expect(wrapper.text()).toContain('移动到')
  })

  it('shows copy title in copy mode', () => {
    const wrapper = mountDialog({ visible: true, mode: 'copy', sourceKbId: 'kb1', sourcePath: 'file.txt' })
    expect(wrapper.text()).toContain('复制到')
  })

  it('emits close on cancel button click', async () => {
    const wrapper = mountDialog({ visible: true, mode: 'move', sourceKbId: 'kb1', sourcePath: 'file.txt' })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close on overlay click', async () => {
    const wrapper = mountDialog({ visible: true, mode: 'move', sourceKbId: 'kb1', sourcePath: 'file.txt' })
    await wrapper.find('.bg-black\\/50').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试确认通过**

Run: `pnpm test -- tests/unit/components/MoveCopyDialog.test.ts`
Expected: 4 tests passed（若部分因 Teleport/mock 复杂度过高可先标记 todo）。

- [ ] **Step 3: 提交**

```bash
git add tests/unit/components/MoveCopyDialog.test.ts
git commit -m "test(#08): MoveCopyDialog 组件测试"
```

---

### Task 7: 覆盖率验证与阈值提升

**Files:**
- Modify: `vitest.config.ts:38-42`
- Test: `pnpm test -- --coverage`

- [ ] **Step 1: 运行覆盖率检查获取基线**

Run: `pnpm test -- --coverage`
Expected: 全部测试通过，查看输出的 coverage 百分比。

- [ ] **Step 2: 根据实际覆盖率调整阈值**

查看 Step 1 输出。如果 lines/branches/statements 已超过 30%，将阈值提升至实际值的 90%（向下取整到最近的 5%）。

示例（若实际 lines=45%）：
```typescript
thresholds: {
  lines: 40,
  functions: 0,
  branches: 35,
  statements: 40,
},
```

- [ ] **Step 3: 重新运行覆盖率验证阈值通过**

Run: `pnpm test -- --coverage`
Expected: 全部测试通过，Coverage 输出中无 "FAIL" 阈值提示。

- [ ] **Step 4: 提交**

```bash
git add vitest.config.ts
git commit -m "chore(#08): 提升覆盖率阈值至实际水平"
```

---

## Self-Review

**1. Spec coverage:**

| 验收标准 | 对应 Task |
|----------|-----------|
| 前端组件测试（空会话态、消息输入、标签栏等） | #01~#07 已有，#08 新增 KbMentionPill + MoveCopyDialog（Task 5, 6） |
| Pinia store 测试 | 已有 session/knowledgeBase/settings 测试，#08 未新增 |
| Sidecar API 集成测试 | 已有 sessions/chatRag/knowledgeBases 等测试，#08 未新增 |
| 工具函数测试 | 新增 markdown + confirm（Task 3, 4） |
| 覆盖率达标 | Task 7 |
| 测试配置适配 | testglobals.ts 已有，无需修改 |
| 代码清理（GreetComponent） | Task 1 |
| 测试稳定性 | Task 2 |

**2. Placeholder scan:** 无 TBD/TODO，所有步骤包含完整代码和命令。

**3. Type consistency:** `getSidecarPort` mock 在 MoveCopyDialog 测试中与 sidecarClient.test.ts 中一致。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-test-coverage.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
