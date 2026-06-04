# 单元测试指南

> 本文档定义项目单元测试的完整流程、规范与最佳实践。
> 涵盖前端（Vue 3 + Vitest）和后端（NestJS + Vitest）单元测试。

---

## 1. 测试体系概述

### 1.1 测试分层

| 层级 | 范围 | 运行命令 | 配置文件 | 数量 |
|------|------|----------|----------|------|
| 单元测试 | 组件/Store/工具/Service | `pnpm test` | `vitest.config.ts` | 141+ |
| 集成测试 | API + 数据库 | `pnpm test:integration` | `vitest.integration.config.ts` | 113+ |
| E2E 测试 | 完整用户流程 | `pnpm test:e2e` | `playwright.config.ts` | — |

### 1.2 单元测试覆盖范围

**前端单元测试：**

- **组件** (`tests/unit/components/`) — Vue 组件渲染、交互、事件
- **Store** (`tests/unit/stores/`) — Pinia 状态管理
- **组合式函数** (`tests/unit/composables/`) — Vue 组合式逻辑
- **工具函数** (`tests/unit/utils/`) — 纯函数
- **前端 Issue 验收测试** (`tests/unit/webui/`) — 按功能模块组织的 TDD 验收测试

**后端单元测试：**

- **Service** (`tests/unit/server/`) — NestJS Service 纯逻辑、依赖注入 mock
- **Worker** (`tests/unit/server/`) — BullMQ Worker 处理逻辑
- **DTO/Schema** (`tests/unit/server/`) — 数据验证规则
- **工具函数** (`tests/unit/server/`) — 纯函数、parser、formatter

---

## 2. 核心基础设施

### 2.1 测试环境

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 测试框架 | Vitest | Vite 原生测试框架 |
| 前端浏览器环境 | happy-dom | 轻量级 DOM 实现，无真实浏览器 |
| Vue 插件 | `@vitejs/plugin-vue` | 编译 `.vue` 单文件组件 |
| 全局状态 | `@pinia/testing` | Pinia 测试辅助工具 |
| 后端编译 | `unplugin-swc` | SWC 编译 NestJS TypeScript |

### 2.2 路径别名

**前端：**

```typescript
// vitest.config.ts
resolve: {
  alias: {
    '@': fileURLToPath(new URL('./packages/webui/src', import.meta.url)),
    '@goferbot/rag-sdk': fileURLToPath(new URL('./packages/rag-sdk/dist/index.js', import.meta.url)),
  },
}
```

**实际配置（前后端共用 `vitest.config.ts`）：**

```typescript
// vitest.config.ts
resolve: {
  alias: {
    '@': fileURLToPath(new URL('./packages/webui/src', import.meta.url)),
    '@goferbot/rag-sdk': fileURLToPath(new URL('./packages/rag-sdk/src/index.ts', import.meta.url)),
  },
}
```

> **注意**：后端单元测试（`tests/unit/server/`）通常通过相对路径 `../../../packages/server/src/...` 导入源码，而非路径别名。这是因为后端单元测试与前端单元测试共用同一个 `vitest.config.ts`，但后端源码不在 `@` 别名的覆盖范围内。

### 2.3 全局 Setup

`tests/setup/testglobals.ts` 在每个测试文件前执行：

```typescript
import { installPinia } from './install-pinia'
installPinia({ stubActions: false })
global.runningTests = true
```

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

单元测试**不需要** PostgreSQL、Redis 等后端服务。所有外部依赖通过 mock 隔离。

---

## 4. 测试文件规范

### 4.1 文件位置

```
tests/unit/
  server/        # 后端单元测试（Service/Worker/DTO）
    *.spec.ts    # Issue 验收测试
  webui/         # 前端 Issue 验收测试
    *.spec.ts
  components/    # Vue 组件测试
    *.test.ts
  stores/        # Pinia Store 测试
    *.test.ts
  composables/   # 组合式函数测试
    *.test.ts
  utils/         # 工具函数测试
    *.test.ts
```

### 4.2 文件命名

| 后缀 | 用途 | 位置 |
|------|------|------|
| `.spec.ts` | Issue 验收测试（TDD） | `tests/unit/server/`、`tests/unit/webui/` |
| `.test.ts` | 通用单元测试 | `tests/unit/components/`、`tests/unit/stores/`、`tests/unit/composables/`、`tests/unit/utils/` |

### 4.3 用例命名规范

**`.spec.ts` 文件（Issue 验收测试）：**

- 必须以 `AC-XX:` 开头，与验收清单的 `id` 对应
- 格式：`AC-XX: {行为描述} {预期结果}`

```typescript
// 后端示例
it('AC-01: POST /api/{资源} returns SSE stream with chunks', async () => {})
it('AC-02: returns 401 without valid JWT', async () => {})

// 前端示例
it('AC-01: renders {ComponentName} with options', () => {})
it('AC-02: emits select event on option click', async () => {})
```

**`.test.ts` 文件（通用单元测试）：**

- 描述式命名，清晰表达测试意图
- 无需 AC-XX 前缀

```typescript
// 组件测试
it('renders user message with right alignment', () => {})
it('emits edit event when edit button clicked', async () => {})

// Store 测试
it('has default state', () => {})
it('adds new item when opening session', () => {})

// Service 测试
it('parses markdown with code blocks', () => {})
it('returns empty array for invalid input', () => {})
```

---

## 5. 前端组件测试

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
  const wrapper = mount(MyComponent, {
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
  const wrapper = mount(MyInput)
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
const wrapper = mount(MyPage, {
  global: {
    stubs: {
      ChildComponent: true,  // 自动 stub 为 <child-component-stub>
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

## 6. 前端 Store 测试

### 6.1 基础模板

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMyStore } from '@/stores/my'

describe('useMyStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('has default state', () => {
    const store = useMyStore()
    expect(store.items).toHaveLength(1)
    expect(store.items[0].title).toBe('默认项')
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
          myStore: {
            items: [{ id: '1', name: 'Test' }],
          },
        },
      }),
    ],
  },
})
```

---

## 7. 后端 Service 单元测试

### 7.1 基础模板

```typescript
import { describe, it, expect, vi } from 'vitest'
import { MyService } from '@/services/my.service'
import { MyRepository } from '@/repositories/my.repository'

describe('MyService', () => {
  it('AC-01: processes data correctly', async () => {
    // Arrange
    const mockRepo = {
      findById: vi.fn().mockResolvedValue({ id: '1', name: 'Test' }),
    } as unknown as MyRepository
    const service = new MyService(mockRepo)

    // Act
    const result = await service.process('1')

    // Assert
    expect(result.name).toBe('Test')
    expect(mockRepo.findById).toHaveBeenCalledWith('1')
  })
})
```

### 7.2 Mock 依赖注入

NestJS Service 通常通过构造函数注入依赖。单元测试中直接传入 mock 对象：

```typescript
it('AC-02: throws error when entity not found', async () => {
  const mockRepo = {
    findById: vi.fn().mockResolvedValue(null),
  } as unknown as MyRepository
  const service = new MyService(mockRepo)

  await expect(service.process('999')).rejects.toThrow('Entity not found')
})
```

### 7.3 DTO Schema 验证

```typescript
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { CreateXxxDto } from '@/dto/create-xxx.dto'

describe('CreateXxxDto', () => {
  it('validates correct input', () => {
    const result = CreateXxxDto.safeParse({
      email: 'test@example.com',
      password: 'Test1234!',
      name: 'Test',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = CreateXxxDto.safeParse({
      email: 'not-an-email',
      password: 'Test1234!',
    })
    expect(result.success).toBe(false)
  })
})
```

### 7.4 Worker 测试

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MyWorker } from '../../../packages/server/src/processors/queue/my.worker.js'

// Mock @goferbot/rag-sdk 模块 — 使用 vi.hoisted 确保变量在 vi.mock 提升前初始化
const { mockRunIndexing } = vi.hoisted(() => ({
  mockRunIndexing: vi.fn(),
}))

vi.mock('@goferbot/rag-sdk', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as any),
    runIndexing: mockRunIndexing,
  }
})

describe('MyWorker', () => {
  let worker: MyWorker
  let mockPrisma: any
  let mockStorage: any
  let mockParser: any
  let mockIndexer: any
  let mockConfig: any

  beforeEach(() => {
    vi.resetAllMocks()
    mockPrisma = {
      document: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    mockStorage = { downloadFile: vi.fn().mockResolvedValue(Buffer.from('test')) }
    mockParser = { parse: vi.fn().mockResolvedValue('test') }
    mockIndexer = {}
    mockConfig = { get: vi.fn().mockReturnValue('mock'), getOrThrow: vi.fn().mockReturnValue('mock') }
    // 构造函数签名：(prisma, storage, parser, indexer, config)
    worker = new MyWorker(mockPrisma, mockStorage, mockParser, mockIndexer, mockConfig)
  })

  it('AC-01: processes document and sets status to ready', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'd1', kbId: 'kb1', storageKey: 'k1', mimeType: 'text/plain', status: 'uploaded',
    })
    mockRunIndexing.mockImplementation(async (_doc: any, options: any) => {
      const { onStageChange } = options
      await onStageChange?.([
        { name: 'chunk', status: 'completed' },
        { name: 'embed', status: 'completed' },
        { name: 'index', status: 'completed' },
      ])
    })

    await worker.handleIndexJob({ data: { documentId: 'd1', type: 'index' } } as any)

    expect(mockPrisma.document.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'd1' },
      data: expect.objectContaining({ status: 'ready' }),
    }))
  })
})
```

**关键模式：**
- **`vi.hoisted`**：确保 mock 变量在 `vi.mock` 提升（hoist）前已初始化，避免引用错误
- **`vi.mock('@goferbot/rag-sdk', ...)`**：mock workspace 包中的模块
- **相对路径导入**：后端单元测试使用 `../../../packages/server/src/...` 而非 `@` 别名

---

## 8. 工具函数测试

### 8.1 纯函数测试

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

## 9. 测试数据管理

### 9.1 前端测试数据

**组件 Props Fixture：**

```typescript
// tests/unit/fixtures/message.fixture.ts
export const createMessageFixture = (overrides?: Partial<Message>) => ({
  id: '1',
  session_id: 's1',
  role: 'user' as const,
  content: 'hello',
  created_at: Date.now(),
  ...overrides,
})
```

**Pinia 初始状态 Fixture：**

```typescript
// tests/unit/fixtures/store-state.fixture.ts
export const createStoreState = (overrides?: Partial<MyState>) => ({
  items: [],
  currentItem: null,
  loading: false,
  ...overrides,
})
```

### 9.2 后端测试数据

**Service Mock Fixture：**

```typescript
// tests/unit/fixtures/service-mock.fixture.ts
export const createMockRepository = <T>(methods: Partial<Record<keyof T, any>>) =>
  methods as unknown as T
```

---

## 10. 运行测试

### 10.1 全部单元测试

```bash
pnpm test
```

### 10.2 单个文件

```bash
# 前端
pnpm vitest run tests/unit/components/MyComponent.test.ts

# 后端
pnpm vitest run tests/unit/server/my-service.spec.ts
```

### 10.3 按名称过滤

```bash
pnpm vitest run -t "AC-01"
```

### 10.4 监视模式

```bash
pnpm vitest
```

### 10.5 UI 模式

```bash
pnpm vitest --ui
```

---

## 11. 配置说明

### 11.1 vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import AIReporter from 'vitest-ai-reporter'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./packages/webui/src', import.meta.url)),
      '@goferbot/rag-sdk': fileURLToPath(new URL('./packages/rag-sdk/src/index.ts', import.meta.url)),
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
    reporters: [new AIReporter()],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary'],
      include: [
        'packages/webui/src/**/*.ts',
        'packages/webui/src/**/*.vue',
        'packages/rag-sdk/src/**/*.ts',
      ],
      exclude: ['packages/webui/src/main.ts', 'packages/rag-sdk/src/index.ts'],
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
| `reporters` | `AIReporter` | 自定义 AI reporter，输出结构化测试结果 |
| `coverage.thresholds` | 行 70%/函数 60% | 最低覆盖率门槛 |

---

## 12. 常见问题

### 12.1 Cannot find module '@/components/...'

**原因**：路径别名未解析。
**解决**：确认 `vitest.config.ts` 中的 `resolve.alias` 配置正确。

### 12.2 组件测试找不到 Pinia

**原因**：未在测试前初始化 Pinia。
**解决**：在 `beforeEach` 中调用 `setActivePinia(createPinia())`，或使用 `createTestingPinia`。

### 12.3 Mock 未重置导致测试间污染

**原因**：上一个测试的 mock 状态残留。
**解决**：在 `beforeEach` 中调用 `vi.clearAllMocks()` 或 `vi.resetAllMocks()`。

### 12.4 后端 Service 测试依赖未注入

**原因**：NestJS 依赖注入容器未启动。
**解决**：单元测试中直接 `new Service(mockDependency)`，不通过 NestJS 容器。

---

## 13. 必备用例清单（后端 Service）

每个新 Service 至少覆盖以下场景：

| 场景 | 必测 | 说明 |
|------|------|------|
| 正常路径（happy path） | 是 | 核心功能验证 |
| 依赖返回 null / 不存在 | 是 | 空值处理 |
| 依赖抛出异常 | 是 | 错误传播 |
| 边界值（空数组、空字符串） | 视情况 | 边界条件 |
| 参数校验失败 | 视情况 | 非法输入处理 |
