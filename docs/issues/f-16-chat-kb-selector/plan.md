---
id: f-16
issue: issue.md
version: 1
---

# 聊天知识库选择器实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 在聊天输入区增加常驻知识库多选选择器，选中项以 pill 形式展示，发送时随请求携带 `knowledgeBaseIds`，未选择时行为与现有完全一致。

**架构：** 复用已存在的 `KbSelector.vue`（浮层 checkbox 列表）和 `KbMentionPill.vue`（选中标签），将其从 `@` 触发模式扩展为常驻「知识库」按钮触发模式。选中状态保存在 `ChatInput.vue` 组件本地，会话切换时由 `ChatView.vue` 的 `:key` 机制自动重建清空。

**技术栈：** Vue 3 + TypeScript + Pinia + shadcn-vue + Vitest

**Issue 引用：** [docs/issues/f-16-chat-kb-selector/issue.md](./issue.md)
**Spec 引用：** [docs/issues/f-16-chat-kb-selector/specs/behavior-spec.md](./specs/behavior-spec.md)、[docs/issues/f-16-chat-kb-selector/specs/feature-spec.md](./specs/feature-spec.md)

---

## 文件结构

### 修改文件
- `packages/webui/src/components/ChatInput.vue` — 添加常驻「知识库」按钮，管理 `selectedKbs` 状态，发送时提取 kbIds
- `packages/webui/src/components/chat/KbSelector.vue` — 扩展 `error` 状态展示与重试按钮；添加 `error` prop
- `packages/webui/src/views/ChatView.vue` — 为 `ChatInput` 绑定 `:key="activeSessionId"`，注入 `kbStore` 的 `isLoading` / `error`
- `packages/webui/src/components/EmptySession.vue` — 知识库按钮改为纯 UI 占位（无交互），点击不触发选择器

### 测试文件
- `tests/issues/f-16-chat-kb-selector/KbSelector.spec.ts` — KbSelector 浮层状态测试
- `tests/issues/f-16-chat-kb-selector/ChatInput.spec.ts` — ChatInput 选中/发送/清空测试
- `tests/issues/f-16-chat-kb-selector/ChatView.spec.ts` — 会话切换状态清空测试

---

## 前置条件

- [ ] 确认 `b-09-chat-rag-retrieval` 已完成，后端 `POST /api/chat` 的 DTO 支持 `knowledgeBaseIds?: string[]`
- [ ] 确认 `packages/webui/src/types/index.ts` 中 `KnowledgeBase` 类型包含 `id`、`name`、`documentCount`

---

## 任务 1: KbSelector 扩展 error 状态与重试按钮

**文件：**
- 修改：`packages/webui/src/components/chat/KbSelector.vue`
- 测试：`tests/issues/f-16-chat-kb-selector/KbSelector.spec.ts`

**规格引用：**
- 行为规格：[错误场景 — 知识库列表加载失败]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-16-chat-kb-selector/KbSelector.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import KbSelector from '@/components/chat/KbSelector.vue'

const mockKb = { id: 'kb-1', name: '测试知识库', documentCount: 3 }

describe('KbSelector', () => {
  it('AC-01: renders list with checkboxes when data is available', () => {
    const wrapper = mount(KbSelector, {
      props: {
        knowledgeBases: [mockKb],
        selectedIds: [],
        visible: true,
        loading: false,
        error: null,
      },
    })
    expect(wrapper.findAll('[data-testid="kb-selector-item"]').length).toBe(1)
    expect(wrapper.text()).toContain('测试知识库')
    expect(wrapper.text()).toContain('3 文档')
  })

  it('AC-02: displays skeleton while loading knowledge bases', () => {
    const wrapper = mount(KbSelector, {
      props: {
        knowledgeBases: [],
        selectedIds: [],
        visible: true,
        loading: true,
        error: null,
      },
    })
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('AC-03: shows empty hint when no knowledge bases exist', () => {
    const wrapper = mount(KbSelector, {
      props: {
        knowledgeBases: [],
        selectedIds: [],
        visible: true,
        loading: false,
        error: null,
      },
    })
    expect(wrapper.text()).toContain('请先创建知识库')
  })

  it('AC-04: shows error and retry button on load failure', async () => {
    const wrapper = mount(KbSelector, {
      props: {
        knowledgeBases: [],
        selectedIds: [],
        visible: true,
        loading: false,
        error: '加载失败',
      },
    })
    expect(wrapper.text()).toContain('加载失败')
    const retryBtn = wrapper.find('[data-testid="kb-selector-retry"]')
    expect(retryBtn.exists()).toBe(true)
    await retryBtn.trigger('click')
    expect(wrapper.emitted('retry')).toBeTruthy()
  })

  it('AC-05: keyboard navigation works in dropdown', async () => {
    const wrapper = mount(KbSelector, {
      props: {
        knowledgeBases: [
          { id: 'kb-1', name: 'A', documentCount: 0 },
          { id: 'kb-2', name: 'B', documentCount: 0 },
        ],
        selectedIds: [],
        visible: true,
        loading: false,
        error: null,
      },
    })
    await wrapper.find('[data-testid="kb-selector-dropdown"]').trigger('keydown', { key: 'ArrowDown' })
    // selectedIndex moves to 1
    await wrapper.find('[data-testid="kb-selector-dropdown"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual([expect.objectContaining({ id: 'kb-2' })])
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/f-16-chat-kb-selector/KbSelector.spec.ts
```
预期：FAIL — `error` prop 不存在、`retry` 事件未定义、error UI 未渲染

- [ ] **步骤 3: 编写最小实现**

修改 `packages/webui/src/components/chat/KbSelector.vue`：

1. 在 `props` 中添加 `error?: string | null`
2. 在 `emit` 中添加 `retry: []`
3. 在模板 `loading` 和 `empty` 分支之间插入 error 分支：

```vue
<div v-else-if="error" class="space-y-2 p-4 text-center text-sm">
  <p class="text-text-secondary">{{ error }}</p>
  <button
    data-testid="kb-selector-retry"
    class="text-accent-500 hover:underline"
    @click="$emit('retry')"
  >
    重试
  </button>
</div>
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/f-16-chat-kb-selector/KbSelector.spec.ts
```
预期：PASS（所有测试通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/components/chat/KbSelector.vue tests/issues/f-16-chat-kb-selector/KbSelector.spec.ts
git commit -m "feat(f-16): add error state and retry to KbSelector"
```

---

## 任务 2: ChatInput 添加常驻「知识库」按钮与选中状态管理

**文件：**
- 修改：`packages/webui/src/components/ChatInput.vue`
- 测试：`tests/issues/f-16-chat-kb-selector/ChatInput.spec.ts`

**规格引用：**
- 行为规格：[正常流程 步骤 1-5]、[边界与约束 — 会话切换]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-16-chat-kb-selector/ChatInput.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChatInput from '@/components/ChatInput.vue'

const mockKbs = [
  { id: 'kb-1', name: 'KB A', documentCount: 2 },
  { id: 'kb-2', name: 'KB B', documentCount: 5 },
]

describe('ChatInput KB selection', () => {
  it('AC-01: renders KbSelector and toggles selection', async () => {
    const wrapper = mount(ChatInput, {
      props: { knowledgeBases: mockKbs, loading: false, disabled: false },
    })
    const btn = wrapper.find('[data-testid="chat-kb-btn"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(wrapper.find('[data-testid="kb-selector-dropdown"]').isVisible()).toBe(true)
  })

  it('AC-06: sends message with selected knowledgeBaseIds', async () => {
    const wrapper = mount(ChatInput, {
      props: { knowledgeBases: mockKbs, loading: false, disabled: false },
    })
    // open dropdown and select first kb
    await wrapper.find('[data-testid="chat-kb-btn"]').trigger('click')
    const items = wrapper.findAll('[data-testid="kb-selector-item"]')
    await items[0].trigger('mousedown')
    await nextTick()

    // type and send
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await wrapper.find('[data-testid="chat-send-btn"]').trigger('click')

    expect(wrapper.emitted('send')).toBeTruthy()
    expect(wrapper.emitted('send')![0]).toEqual(['hello', ['kb-1']])
  })

  it('AC-07: sends message without knowledgeBaseIds when none selected', async () => {
    const wrapper = mount(ChatInput, {
      props: { knowledgeBases: mockKbs, loading: false, disabled: false },
    })
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await wrapper.find('[data-testid="chat-send-btn"]').trigger('click')

    expect(wrapper.emitted('send')).toBeTruthy()
    expect(wrapper.emitted('send')![0]).toEqual(['hello', []])
  })

  it('AC-08: removes pill when clicking X', async () => {
    const wrapper = mount(ChatInput, {
      props: { knowledgeBases: mockKbs, loading: false, disabled: false },
    })
    await wrapper.find('[data-testid="chat-kb-btn"]').trigger('click')
    await wrapper.findAll('[data-testid="kb-selector-item"]')[0].trigger('mousedown')
    await nextTick()
    expect(wrapper.findAll('[data-testid="kb-mention-pill"]').length).toBe(1)

    await wrapper.find('[data-testid="kb-mention-pill-remove"]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-testid="kb-mention-pill"]').length).toBe(0)
  })

  it('AC-09: clears selected KBs after send', async () => {
    const wrapper = mount(ChatInput, {
      props: { knowledgeBases: mockKbs, loading: false, disabled: false },
    })
    await wrapper.find('[data-testid="chat-kb-btn"]').trigger('click')
    await wrapper.findAll('[data-testid="kb-selector-item"]')[0].trigger('mousedown')
    await nextTick()

    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await wrapper.find('[data-testid="chat-send-btn"]').trigger('click')
    await nextTick()

    expect(wrapper.findAll('[data-testid="kb-mention-pill"]').length).toBe(0)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/f-16-chat-kb-selector/ChatInput.spec.ts
```
预期：FAIL — `data-testid="chat-kb-btn"` 不存在、点击后 dropdown 未打开、send 事件未携带 kbIds

- [ ] **步骤 3: 编写最小实现**

修改 `packages/webui/src/components/ChatInput.vue`：

1. 在 `<script setup>` 中引入 `DatabaseIcon`：
```typescript
import { PaperclipIcon, SendIcon, LoaderIcon, DatabaseIcon } from 'lucide-vue-next'
```

2. 添加新的响应式状态（与现有的 `mentionVisible` 区分）：
```typescript
const kbDropdownVisible = ref(false)
```

3. 添加切换函数：
```typescript
function toggleKbDropdown() {
  kbDropdownVisible.value = !kbDropdownVisible.value
}
function onCloseKbDropdown() {
  kbDropdownVisible.value = false
}
```

4. 修改 `handleKeydown`，当 `kbDropdownVisible` 打开时也拦截键盘事件：
```typescript
function handleKeydown(e: KeyboardEvent) {
  if (mentionVisible.value) {
    dropdownRef.value?.handleKeydown(e)
    return
  }
  if (kbDropdownVisible.value) {
    kbDropdownRef.value?.handleKeydown(e)
    return
  }
  // ... existing Enter handling
}
```

5. 在模板中 textarea 上方已存在的 pills 区域保持不变；在底栏左侧按钮组添加「知识库」按钮：

```vue
<Button
  data-testid="chat-kb-btn"
  variant="ghost"
  size="sm"
  class="h-[34px] gap-1.5 rounded-[14px] bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3"
  title="知识库"
  @click="toggleKbDropdown"
>
  <DatabaseIcon class="size-4" />
  <span>知识库</span>
</Button>
```

6. 在 `KbSelector` 组件旁（或同一 `relative` 容器内）添加第二个 `KbSelector` 实例用于常驻按钮：

```vue
<KbSelector
  ref="kbDropdownRef"
  :knowledge-bases="knowledgeBases ?? []"
  :selected-ids="selectedKbs.map((k) => k.id)"
  :visible="kbDropdownVisible"
  :loading="false"
  @select="onSelectKb"
  @unselect="onUnselectKb"
  @close="onCloseKbDropdown"
/>
```

注意：保留原有的 `@` 触发逻辑（`mentionVisible`、`dropdownRef`）不删除，确保无回归。

7. `handleSend` 保持不变（已提取 `selectedKbs.value.map((k) => k.id)` 并清空）。

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/f-16-chat-kb-selector/ChatInput.spec.ts
```
预期：PASS（所有测试通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/components/ChatInput.vue tests/issues/f-16-chat-kb-selector/ChatInput.spec.ts
git commit -m "feat(f-16): add persistent KB selector button to ChatInput"
```

---

## 任务 3: ChatView 绑定 `:key` 与会话级状态注入

**文件：**
- 修改：`packages/webui/src/views/ChatView.vue`
- 测试：`tests/issues/f-16-chat-kb-selector/ChatView.spec.ts`

**规格引用：**
- 行为规格：[边界与约束 — 会话切换]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-16-chat-kb-selector/ChatView.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatView from '@/views/ChatView.vue'

vi.mock('@/stores/session', () => ({
  useSessionStore: () => ({
    activeSessionId: 'session-a',
    activeMessages: [],
    activeSession: null,
    isLoading: false,
    error: null,
    sendMessage: vi.fn(),
    loadSessions: vi.fn(),
  }),
}))
vi.mock('@/stores/knowledgeBase', () => ({
  useKnowledgeBaseStore: () => ({
    knowledgeBases: [],
    isLoading: false,
    error: null,
    loadKnowledgeBases: vi.fn(),
  }),
}))
vi.mock('@/stores/tabs', () => ({
  useTabsStore: () => ({
    updateActiveTabSession: vi.fn(),
  }),
}))
vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    getLLMConfig: () => null,
  }),
}))

describe('ChatView session switch', () => {
  it('AC-05: clears selected KBs on session switch', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(ChatView)
    const chatInput = wrapper.findComponent({ name: 'ChatInput' })
    expect(chatInput.exists()).toBe(true)
    // key binding ensures remount on session change
    expect(chatInput.attributes('key')).toBe('session-a')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/f-16-chat-kb-selector/ChatView.spec.ts
```
预期：FAIL — `ChatInput` 缺少 `:key` 属性

- [ ] **步骤 3: 编写最小实现**

修改 `packages/webui/src/views/ChatView.vue`：

1. 为 `ChatInput` 绑定 `:key`：
```vue
<ChatInput
  :key="sessionStore.activeSessionId ?? 'empty'"
  :knowledge-bases="kbStore.knowledgeBases"
  :loading="sessionStore.isLoading"
  @send="handleSend"
/>
```

2. 将 `kbStore.isLoading` 和 `kbStore.error` 注入 `ChatInput`（可选，若 `KbSelector` 需要展示全局 loading/error）：
```vue
<ChatInput
  :key="sessionStore.activeSessionId ?? 'empty'"
  :knowledge-bases="kbStore.knowledgeBases"
  :kb-loading="kbStore.isLoading"
  :kb-error="kbStore.error"
  :loading="sessionStore.isLoading"
  @send="handleSend"
/>
```
对应地，在 `ChatInput.vue` 的 props 中新增 `kbLoading?: boolean` 和 `kbError?: string | null`，并透传给常驻 `KbSelector`。

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/f-16-chat-kb-selector/ChatView.spec.ts
```
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/views/ChatView.vue tests/issues/f-16-chat-kb-selector/ChatView.spec.ts
git commit -m "feat(f-16): bind ChatInput key to activeSessionId for per-session KB state"
```

---

## 任务 4: EmptySession 知识库按钮改为纯 UI 占位

**文件：**
- 修改：`packages/webui/src/components/EmptySession.vue`

**规格引用：**
- 功能规格：[边界 — EmptySession.vue 输入区的知识库选择入口为 UI 占位]

- [ ] **步骤 1: 编写失败测试**

在 `tests/issues/f-16-chat-kb-selector/ChatInput.spec.ts` 中追加：

```typescript
import EmptySession from '@/components/EmptySession.vue'

describe('EmptySession', () => {
  it('AC-10: KB button is UI placeholder without selector', () => {
    const wrapper = mount(EmptySession)
    const btn = wrapper.find('[data-testid="chat-kb-btn"]')
    expect(btn.exists()).toBe(true)
    // clicking does not open any dropdown
    expect(wrapper.find('[data-testid="kb-selector-dropdown"]').exists()).toBe(false)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/f-16-chat-kb-selector/ChatInput.spec.ts
```
预期：FAIL — `EmptySession` 无 `data-testid="chat-kb-btn"`

- [ ] **步骤 3: 编写最小实现**

修改 `packages/webui/src/components/EmptySession.vue`：

1. 为现有的「知识库」按钮添加 `data-testid="chat-kb-btn"`：
```vue
<Button
  data-testid="chat-kb-btn"
  variant="ghost"
  size="sm"
  class="..."
  title="知识库"
>
  <DatabaseIcon class="size-4" />
  <span>知识库</span>
</Button>
```

2. 不引入 `KbSelector`，不添加任何点击交互逻辑。保持现有行为：用户输入内容点击发送后进入 `ChatInput`，在 `ChatInput` 中进行知识库选择。

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/f-16-chat-kb-selector/ChatInput.spec.ts
```
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/components/EmptySession.vue tests/issues/f-16-chat-kb-selector/ChatInput.spec.ts
git commit -m "feat(f-16): mark EmptySession KB button as UI placeholder"
```

---

## 任务 5: 端到端集成验证

**文件：**
- 运行测试：全部三个 spec 文件

- [ ] **步骤 1: 运行全部测试**

```bash
npx vitest run tests/issues/f-16-chat-kb-selector/
```
预期：PASS（所有测试通过）

- [ ] **步骤 2: TypeScript 类型检查**

```bash
pnpm type-check
```
预期：无类型错误

- [ ] **步骤 3: 提交**

```bash
git add -A
git commit -m "test(f-16): complete Chat KB selector unit tests"
```

---

## 自检

### 1. 规格覆盖

| 规格章节 | 对应任务 |
|----------|----------|
| 行为规格 — 初始状态（底部工具栏「知识库」按钮） | 任务 2 |
| 行为规格 — loading 状态 | 任务 1 |
| 行为规格 — empty 状态 | 任务 1 |
| 行为规格 — error 状态（重试按钮） | 任务 1 |
| 行为规格 — success 状态（checkbox 列表、toggle） | 任务 1、2 |
| 行为规格 — partial 状态（键盘导航） | 任务 1 |
| 行为规格 — 正常流程（选择 → pill → 发送 → 清空） | 任务 2 |
| 行为规格 — 错误场景（加载失败） | 任务 1 |
| 行为规格 — 空选时发送无回归 | 任务 2（AC-07） |
| 行为规格 — 会话切换清空 | 任务 3 |
| 功能规格 — EmptySession UI 占位 | 任务 4 |
| 功能规格 — 选中状态组件级、不持久化 | 任务 2、3 |

### 2. 占位符扫描

- 无 "TBD" / "TODO" / "稍后实现"
- 无 "添加适当的错误处理" 等模糊描述
- 每个任务包含具体代码块和运行命令

### 3. 类型一致性

- `KnowledgeBase` 类型使用 `packages/webui/src/types/index.ts` 中的定义
- `knowledgeBaseIds` 为 `string[]`，与 `session.ts` 的 `sendMessage` 签名一致
- `KbSelector` 的 `error` prop 类型为 `string | null`，与 `kbStore.error` 一致

---

## 执行交接

**计划已保存到 `docs/issues/f-16-chat-kb-selector/plan.md`。两种执行方式：**

1. **子代理驱动（推荐）** — 每个任务新子代理，任务间审查
2. **内联执行** — 当前会话顺序执行，带检查点

**选择哪种？**
