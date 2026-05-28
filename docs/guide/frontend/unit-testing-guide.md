# 前端单元测试指南

> 本文档定义 GoferBot 前端（Vue 3 + Vitest）单元测试的完整流程、规范与最佳实践。
> 适用于组件、组合式函数、Store 和工具函数的单元测试。

---

## 1. 测试体系概述

### 1.1 测试分层

| 层级 | 范围 | 运行命令 | 配置文件 | 数量 |
|------|------|----------|----------|------|
| 单元测试 | 组件/Store/工具/后端Service | `pnpm test` | `vitest.config.ts` | 141 |
| 集成测试 | API + 数据库 | `pnpm test:integration` | `vitest.integration.config.ts` | 113 |
| E2E 测试 | 完整用户流程 | `pnpm test:e2e` | Playwright | - |

### 1.2 前端测试覆盖范围

前端单元测试覆盖以下类别：

- **组件** (`tests/unit/components/`) — Vue 组件渲染、交互、事件
  - `ChatMessage`, `ChatMessageList`, `ChatInput`, `EmptySession`
  - `KnowledgeBasePage`, `FileExplorer`, `SettingsPage`
  - `EditKbDialog`, `MoveCopyDialog`, `ContextMenu`
- **Store** (`tests/unit/stores/`) — Pinia 状态管理
  - `session` — 会话、标签页、消息
  - `knowledgeBase` — 知识库 CRUD
  - `settings` — 配置加载与保存
- **组合式函数** (`tests/unit/composables/`) — Vue 组合式逻辑
  - `useSidecarStatus` — 侧边栏状态
- **工具函数** (`tests/unit/utils/`) — 纯函数
  - `markdown` — Markdown 渲染
  - `confirm` — 确认对话框

- **前端 Issue 验收测试** (`tests/unit/webui/`) — 按功能模块组织的 TDD 验收测试
  - KbSelector, ChatInput, ChatView — 知识库选择器 (f-16)

---

## 2. 核心基础设施

### 2.1 测试环境

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 测试框架 | Vitest | Vite 原生测试框架 |
| 浏览器环境 | happy-dom | 轻量级 DOM 实现，无真实浏览器 |
| Vue 插件 | `@vitejs/plugin-vue` | 编译 `.vue` 单文件组件 |
| 全局状态 | `@pinia/testing` | Pinia 测试辅助工具 |

### 2.2 路径别名

```typescript
// vitest.config.ts
resolve: {
  alias: {
    '@': fileURLToPath(new URL('./packages/webui/src', import.meta.url)),
    '@goferbot/rag-sdk': fileURLToPath(new URL('./packages/rag-sdk/dist/index.js', import.meta.url)),
  },
}
```

`@/` 指向 `packages/webui/src/`，与源码中的 import 路径一致。

### 2.3 全局 Setup

`tests/setup/testglobals.ts` 在每个测试文件前执行：

```typescript
import { installPinia } from './install-pinia'
installPinia({ stubActions: false })
global.runningTests = true
```

`installPinia` 使用 `@pinia/testing` 的 `createTestingPinia` 为所有测试自动注入 Pinia 实例。

---

## 3. 环境准备

### 3.1 安装依赖

```bash
pnpm install
```

### 3.2 构建依赖包

前端测试可能依赖 `rag-sdk` 等 workspace 包的构建产物：

```bash
pnpm -r build
```

### 3.3 无需数据库

前端单元测试在 `happy-dom` 虚拟环境中运行，**不需要** PostgreSQL、Redis 等后端服务。

---

## 4. 测试文件规范

### 4.1 文件位置

```
tests/unit/
  components/     # Vue 组件测试
  composables/    # 组合式函数测试
  stores/         # Pinia Store 测试
  utils/          # 工具函数测试
  webui/          # 前端 Issue 验收测试
```

### 4.2 文件命名

- 单元测试：`{name}.test.ts`
- 验收测试：`{name}.spec.ts`

### 4.3 用例命名规范

```typescript
// 组件测试
describe('ChatMessage', () => {
  it('renders user message with right alignment', () => {})
  it('renders assistant message with left alignment', () => {})
  it('emits edit event when edit button clicked', async () => {})
})

// Store 测试
describe('useSessionStore', () => {
  it('has home tab by default', () => {})
  it('adds new tab when opening session', () => {})
})
```

---

## 5. 组件测试

### 5.1 基础模板

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import MyComponent from '@/components/MyComponent.vue'

describe('MyComponent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders correctly with default props', () => {
    const wrapper = mount(MyComponent)
    expect(wrapper.text()).toContain('预期文本')
  })
})
```

### 5.2 传递 Props

```typescript
it('renders message content', () => {
  const wrapper = mount(ChatMessage, {
    props: {
      message: {
        id: '1',
        session_id: 's1',
        role: 'user',
        content: 'hello',
        created_at: 1,
      },
    },
  })
  expect(wrapper.text()).toContain('hello')
})
```

### 5.3 模拟用户交互

```typescript
it('emits send event on button click', async () => {
  const wrapper = mount(ChatInput)
  const input = wrapper.find('textarea')
  await input.setValue('test message')

  const btn = wrapper.find('[data-testid="send-btn"]')
  await btn.trigger('click')

  expect(wrapper.emitted('send')).toHaveLength(1)
  expect(wrapper.emitted('send')![0]).toEqual(['test message'])
})
```

### 5.4 使用 Stub 替代子组件

```typescript
const wrapper = mount(KnowledgeBasePage, {
  global: {
    stubs: {
      FileManager: true,  // 自动 stub 为 <file-manager-stub>
      Dialog: { template: '<div><slot /></div>' },
      Teleport: { template: '<div><slot /></div>' },
      Transition: { template: '<div><slot /></div>' },
    },
  },
})
```

### 5.5 测试 shadcn-vue 组件

shadcn-vue 组件（如 `Tabs`、`Dialog`、`Select`）在 happy-dom 中会正常渲染，但部分交互行为可能与真实浏览器有差异：

```typescript
// Tabs 组件测试示例
it('switches tab on click', async () => {
  const wrapper = mount(SettingsPage)
  const tabs = wrapper.findAll('[role="tab"]')
  await tabs[1].trigger('click')
  expect(wrapper.text()).toContain('账户设置')
})
```

---

## 6. Store 测试

### 6.1 基础模板

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session'

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('has home tab by default', () => {
    const store = useSessionStore()
    expect(store.tabs).toHaveLength(1)
    expect(store.tabs[0].title).toBe('首页')
  })
})
```

### 6.2 Mock API 调用

Store 中的 API 调用通过 `vi.mock` 或 `vi.fn()` 进行 mock：

```typescript
import { vi } from 'vitest'

// Mock API 模块
vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { id: '1' } }),
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})
```

### 6.3 使用 createTestingPinia

```typescript
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'

const wrapper = mount(MyComponent, {
  global: {
    plugins: [
      createTestingPinia({
        stubActions: true,  // 自动 mock 所有 actions
        initialState: {
          knowledgeBase: {
            knowledgeBases: [{ id: '1', name: 'Test' }],
          },
        },
      }),
    ],
  },
})
```

---

## 7. 工具函数测试

### 7.1 纯函数测试

```typescript
import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/utils/markdown'

describe('renderMarkdown', () => {
  it('renders plain text as paragraph', () => {
    const result = renderMarkdown('hello world')
    expect(result).toContain('<p>hello world</p>')
  })

  it('renders code block with highlight', () => {
    const result = renderMarkdown('```js\nconst x = 1;\n```')
    expect(result).toContain('<pre')
    expect(result).toContain('hljs-')
  })
})
```

---

## 8. 运行测试

### 8.1 全部前端单元测试

```bash
pnpm test
```

### 8.2 单个文件

```bash
pnpm vitest run tests/unit/components/ChatMessage.test.ts
```

### 8.3 按名称过滤

```bash
pnpm vitest run -t "renders user message"
```

### 8.4 监视模式

```bash
pnpm vitest
```

### 8.5 UI 模式

```bash
pnpm vitest --ui
```

---

## 9. 配置说明

### 9.1 vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./packages/webui/src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.spec.ts'],
    exclude: [
      'tests/e2e/**',
      'tests/e2e-full/**',
      'tests/integration/**',
      'packages/webui/**',
      'packages/server/**',
    ],
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/testglobals.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/webui/src/**/*.ts', 'packages/webui/src/**/*.vue'],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 55,
        statements: 70,
      },
    },
  },
})
```

**关键配置说明：**

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `environment: 'happy-dom'` | 虚拟 DOM | 轻量级，启动快，适合单元测试 |
| `globals: true` | 全局 API | 无需在每个文件 import `describe/it/expect` |
| `coverage.thresholds` | 行 70%/函数 60% | 最低覆盖率门槛 |

---

## 10. 常见问题

### 10.1 Cannot find module '@/components/...'

**原因**：路径别名未解析。
**解决**：确认 `vitest.config.ts` 中的 `resolve.alias` 配置正确。

### 10.2 Vue warn: Component is missing template or render function

**原因**：`.vue` 文件未被正确编译。
**解决**：确认 `plugins: [vue()]` 已配置。

### 10.3 [Vue warn]: inject() can only be used inside setup()

**原因**：在 `global.plugins` 中注入的依赖未正确设置。
**解决**：使用 `createTestingPinia()` 或在 `beforeEach` 中 `setActivePinia()`。

### 10.4 找不到 shadcn-vue 组件

**原因**：shadcn-vue 组件可能依赖全局注册或其他上下文。
**解决**：在测试的 `global.stubs` 中注册 stub，或检查组件是否正确导入。

### 10.5 happy-dom 与真实浏览器行为差异

happy-dom 不支持某些浏览器 API（如 `getBoundingClientRect`、`scrollIntoView`）。

**解决**：

```typescript
// Mock 缺失的 API
Element.prototype.getBoundingClientRect = vi.fn(() => ({
  width: 100, height: 100, top: 0, left: 0,
}))
```

---

## 11. 最佳实践

### 11.1 测试原则

1. **一个断言一个概念** — 每个 `it` 块只测试一个行为
2. **避免测试实现细节** — 测试用户可见的行为，而非内部状态
3. **使用 data-testid** — 为测试选择器添加 `data-testid`，避免依赖 CSS 类名
4. **及时清理** — 使用 `afterEach` 清理 mock、重置 Pinia 状态

### 11.2 选择器优先级

```typescript
// 推荐：data-testid（稳定，不受样式影响）
wrapper.find('[data-testid="send-btn"]')

// 次选：语义化标签
wrapper.find('button[type="submit"]')

// 避免：CSS 类名（易变）
wrapper.find('.bg-accent-500') // 不推荐
```

### 11.3 异步测试

```typescript
// 正确：await 异步操作
it('updates on async action', async () => {
  const wrapper = mount(MyComponent)
  await wrapper.find('button').trigger('click')
  await flushPromises()  // 等待所有 Promise 完成
  expect(wrapper.text()).toContain('Updated')
})
```
