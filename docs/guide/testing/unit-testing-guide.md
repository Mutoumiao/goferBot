# 单元测试指南

> 本文档定义项目单元测试的完整流程、规范与最佳实践。
> 涵盖前端（React + Vitest）和后端（NestJS + Vitest）单元测试。

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

- **组件** (`packages/web/tests/`) — React 组件渲染、交互、事件
- **Store** (`packages/web/tests/`) — Zustand 状态管理
- **工具函数** (`packages/web/tests/`) — 纯函数
- **前端 Issue 验收测试** (`packages/web/tests/`) — 按功能模块组织的 TDD 验收测试（`.spec.tsx`）

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
| React 插件 | `@vitejs/plugin-react` | 编译 JSX |
| 全局状态 | Zustand `setState` | Store 测试辅助 |
| 后端编译 | `unplugin-swc` | SWC 编译 NestJS TypeScript |

### 2.2 路径别名

**前端（`packages/web/vitest.config.ts`）：**

```typescript
// packages/web/vitest.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

**根目录（`vitest.config.ts`，前后端共用）：**

```typescript
// vitest.config.ts
resolve: {
  alias: {
    '@goferbot/rag-sdk': fileURLToPath(new URL('./packages/rag-sdk/src/index.ts', import.meta.url)),
  },
}
```

> **注意**：后端单元测试（`tests/unit/server/`）通常通过相对路径 `../../../packages/server/src/...` 导入源码，而非路径别名。这是因为后端单元测试与前端单元测试共用同一个 `vitest.config.ts`，但后端源码不在 `@` 别名的覆盖范围内。

### 2.3 全局 Setup

`tests/setup/testglobals.ts` 在每个测试文件前执行：

```typescript
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
packages/web/tests/
  *.spec.tsx     # 前端 Issue 验收测试（React）
  *.test.ts      # 通用组件/Store/工具测试

tests/unit/
  server/        # 后端单元测试（Service/Worker/DTO）
    *.spec.ts    # Issue 验收测试
  components/    # 历史 Vue 组件测试（已冻结）
    *.test.ts
  stores/        # 历史 Pinia Store 测试（已冻结）
    *.test.ts
  composables/   # 历史组合式函数测试（已冻结）
    *.test.ts
  utils/         # 工具函数测试
    *.test.ts
```

### 4.2 文件命名

| 后缀 | 用途 | 位置 |
|------|------|------|
| `.spec.ts` / `.spec.tsx` | Issue 验收测试（TDD） | `tests/unit/server/`、`packages/web/tests/` |
| `.test.ts` | 通用单元测试 | `packages/web/tests/`、`tests/unit/utils/` |

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

## 5. 前端组件测试（React）

### 5.1 基础模板

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MyComponent from '@/components/MyComponent'

describe('MyComponent', () => {
  it('renders correctly with default props', () => {
    render(<MyComponent />)
    expect(screen.getByText('预期文本')).toBeDefined()
  })
})
```

### 5.2 传递 Props

```typescript
it('renders message content', () => {
  render(<MessageBubble message={{ id: '1', role: 'user', content: 'hello' }} />)
  expect(screen.getByText('hello')).toBeDefined()
})
```

### 5.3 模拟用户交互

```typescript
import { fireEvent } from '@testing-library/react'

it('calls onSend when button clicked', async () => {
  const onSend = vi.fn()
  render(<ChatInput onSend={onSend} />)

  const input = screen.getByPlaceholderText('输入消息')
  fireEvent.change(input, { target: { value: 'test message' } })

  const btn = screen.getByRole('button', { name: /发送/ })
  fireEvent.click(btn)

  expect(onSend).toHaveBeenCalledWith('test message')
})
```

### 5.4 Mock 子组件

```typescript
vi.mock('@/components/Dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
```

### 5.5 测试 shadcn/ui 组件

shadcn/ui 组件基于 Radix UI，在 happy-dom 中可正常渲染：

```typescript
it('opens dialog on button click', async () => {
  render(<DeleteKbDialog kbId="1" kbName="测试" onClose={vi.fn()} onConfirm={vi.fn()} />)
  expect(screen.getByText(/测试/)).toBeDefined()
  expect(screen.getByRole('button', { name: /删除/ })).toBeDefined()
})
```

---

## 6. 前端 Store 测试（Zustand）

### 6.1 基础模板

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useMyStore } from '@/stores/my'

describe('useMyStore', () => {
  beforeEach(() => {
    useMyStore.setState(useMyStore.getInitialState())
  })

  it('has default state', () => {
    const state = useMyStore.getState()
    expect(state.items).toHaveLength(0)
  })
})
```

### 6.2 Mock API 调用

Store 中的 API 调用通过 `vi.mock` 或 `vi.fn()` 进行 mock：

```typescript
import { vi } from 'vitest'

// Mock API 模块（必须放在文件最顶部）
vi.mock('@/api/chat', () => ({
  getSessions: vi.fn(() => ({ send: vi.fn().mockResolvedValue({ sessions: [] }) })),
  createSession: vi.fn(() => ({ send: vi.fn().mockResolvedValue({ id: '1' }) })),
}))

beforeEach(() => {
  useMyStore.setState(useMyStore.getInitialState())
  vi.clearAllMocks()
})
```

### 6.3 Persist Store 测试

```typescript
beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  const { useAuthStore } = await import('@/stores/auth')
  useAuthStore.setState({ token: null, user: null })
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
// packages/web/tests/fixtures/message.fixture.ts
export const createMessageFixture = (overrides?: Partial<Message>) => ({
  id: '1',
  sessionId: 's1',
  role: 'user' as const,
  content: 'hello',
  createdAt: Date.now(),
  ...overrides,
})
```

**Zustand 初始状态 Fixture：**

```typescript
// packages/web/tests/fixtures/store-state.fixture.ts
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
# 前端（packages/web）
cd packages/web && pnpm vitest run tests/kb-crud.spec.tsx

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
import { fileURLToPath, URL } from 'node:url'
import AIReporter from 'vitest-ai-reporter'

export default defineConfig({
  resolve: {
    alias: {
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
      'packages/webui/**'  # 已冻结，不纳入测试,
      'packages/server/**',
    ],
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/testglobals.ts'],
    reporters: [new AIReporter()],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary'],
      include: [
        'packages/rag-sdk/src/**/*.ts',
      ],
      exclude: ['packages/rag-sdk/src/index.ts'],
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
**解决**：确认 `packages/web/vitest.config.ts` 中的 `resolve.alias` 配置正确（`@` → `./src`）。

### 12.2 组件测试找不到 Zustand Store

**原因**：未在测试前重置 Store 状态。
**解决**：在 `beforeEach` 中调用 `useStore.setState(useStore.getInitialState())`。对于 persist store，使用 `vi.resetModules() + await import()` 模式。

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
