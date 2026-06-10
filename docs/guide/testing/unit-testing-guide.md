# 单元测试指南

> Vitest 单元测试规范。覆盖前端（React + Zustand）和后端（NestJS Service/Worker）。

## 1. 核心约束

| 规则 | 说明 |
|------|------|
| **文件位置** | `packages/{web,server,rag-sdk}/tests/**/*.{spec,test}.{ts,tsx}` |
| **导入** | 同目录用 `./`，跨目录用包内 `@/` 或跨包 `@server/@web/@rag-sdk` |
| **环境** | 前端 `happy-dom`，后端 `node`。全部 mock，零外部依赖 |
| **用例命名** | `.spec.ts`：`AC-XX: {描述}` / `.test.ts`：描述式，无 AC 前缀 |
| **Mock API** | `vi.mock('@/api/xxx')` 放文件最顶部（import 之前） |
| **Mock 格式** | `vi.fn(() => ({ send: vi.fn().mockResolvedValue(...) }))` |
| **禁止** | `jest-dom` matchers，只用 `toEqual/toBeDefined/toHaveLength` |

## 2. 路径别名

```ts
// 包内自引用（各包 vitest.config.ts 已有 @ → ./src）
import { useMyStore } from '@/stores/my'
import { MyService } from '@/auth/auth.service'

// 跨包引用（根 vitest.config.ts）
import { AuthService } from '@server/auth/auth.service'
import { runIndexing } from '@rag-sdk/pipelines/run-indexing'
```

## 3. 前端组件测试

```ts
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MyComponent from '@/components/MyComponent'

// Mock 子组件
vi.mock('@/components/Dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('预期文本')).toBeDefined()
  })

  it('handles user interaction', async () => {
    const onAction = vi.fn()
    render(<MyComponent onAction={onAction} />)
    fireEvent.click(screen.getByRole('button', { name: /确认/ }))
    expect(onAction).toHaveBeenCalled()
  })
})
```

## 4. Zustand Store 测试

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMyStore } from '@/stores/my'

// Mock API 放最顶部
vi.mock('@/api/chat', () => ({
  getSessions: vi.fn(() => ({ send: vi.fn().mockResolvedValue({ sessions: [] }) })),
}))

describe('useMyStore', () => {
  beforeEach(() => {
    useMyStore.setState(useMyStore.getInitialState())
    vi.clearAllMocks()
  })

  it('has default state', () => {
    expect(useMyStore.getState().items).toHaveLength(0)
  })
})

// Persist Store：使用 vi.resetModules() + await import()
describe('useAuthStore', () => {
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    const { useAuthStore } = await import('@/stores/auth')
    useAuthStore.setState({ token: null, user: null })
  })
})
```

## 5. 后端 Service 测试

```ts
import { describe, it, expect, vi } from 'vitest'
import { MyService } from '@/services/my.service'

describe('MyService', () => {
  it('AC-01: processes data correctly', async () => {
    // Arrange — 直接 new，不通过 NestJS 容器
    const mockRepo = { findById: vi.fn().mockResolvedValue({ id: '1' }) } as any
    const service = new MyService(mockRepo)

    // Act
    const result = await service.process('1')

    // Assert
    expect(result.id).toBe('1')
  })

  it('AC-02: throws when entity not found', async () => {
    const mockRepo = { findById: vi.fn().mockResolvedValue(null) } as any
    const service = new MyService(mockRepo)
    await expect(service.process('999')).rejects.toThrow('Entity not found')
  })
})
```

### Worker 测试（vi.hoisted + mock workspace 包）

```ts
import { IndexingWorker } from '@/processors/queue/indexing.worker'

const { mockRunIndexing } = vi.hoisted(() => ({ mockRunIndexing: vi.fn() }))
vi.mock('@goferbot/rag-sdk', async (imp) => ({ ...(await imp() as any), runIndexing: mockRunIndexing }))

// 然后按 Service 模式测试：new Worker(mockPrisma, mockStorage, ...)
```

## 6. 工具函数测试

```ts
import { describe, it, expect } from 'vitest'
import { cn } from '@/utils/cn'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })
})
```

## 7. 运行测试

```bash
pnpm test                              # 全部单元测试
pnpm vitest run packages/server/src/auth/auth.service.spec.ts
pnpm vitest run -t "AC-01"             # 按 AC 过滤
pnpm vitest                            # watch
pnpm vitest --ui                       # UI 模式
```

## 8. 必备用例清单（后端 Service）

| 场景 | 必测 | 说明 |
|------|------|------|
| 正常路径（happy path） | 是 | 核心功能验证 |
| 依赖返回 null / 不存在 | 是 | 空值处理 |
| 依赖抛出异常 | 是 | 错误传播 |
| 边界值（空数组、空字符串） | 视情况 | 边界条件 |
| 参数校验失败 | 视情况 | 非法输入 |
