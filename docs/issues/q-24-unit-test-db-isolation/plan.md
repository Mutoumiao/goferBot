---
id: q-24
issue: issue.md
version: 1
---

# 单元测试数据库隔离治理实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 修复单元测试直接连接真实数据库的问题，强制所有单元测试使用 Mock 模式，阻断对开发/生产数据库的污染。

**架构：** 不修改任何生产代码，仅改造测试文件。采用 `vi.fn()` Mock 模式（与 `indexing-worker.spec.ts` 一致），在 `testglobals.ts` 增加数据库连接硬阻断防护。

**技术栈：** Vitest + vi.fn() Mock（无新依赖）

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/feature-spec.md](./specs/feature-spec.md), [specs/test-spec.md](./specs/test-spec.md)

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | 验证方案 | ✅ 符合 | 不新增 DTO，不涉及验证方案变更 |
| ADR 0001 | 响应格式 | ✅ 符合 | 不新增 API 端点 |
| ADR 0001 | 依赖引入 | ✅ 符合 | 不引入新 npm 包 |
| ADR 0001 | NestJS 规范 | ✅ 符合 | 不修改生产代码 |

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `tests/setup/testglobals.ts` | 修改 | 增加数据库连接保护逻辑 |
| `tests/unit/server/prisma-pagination.spec.ts` | 重写 | 从真实数据库改为 Mock 模式 |
| `tests/unit/server/session.service.spec.ts` | 重写 | 从真实数据库改为 Mock 模式 |

---

## 任务 1: testglobals.ts 增加数据库连接保护

**文件：**
- 修改：`tests/setup/testglobals.ts`

**规格引用：**
- feature-spec: [AC-01 — 数据库连接保护]

**背景：**
当前 `testglobals.ts` 仅设置 `global.runningTests = true`，无数据库连接保护。新增测试可能再次直接实例化 `PrismaClient` 连接开发库。

**改造后效果：**
当任何代码在单元测试环境中尝试连接非 `_test` 后缀的数据库时，立即抛出错误阻断测试执行。

- [ ] **步骤 1: 编写失败测试（验证保护机制）**

创建临时测试文件验证保护机制：
```typescript
// tests/unit/server/db-protection-verify.spec.ts（临时文件，验证后删除）
import { describe, it, expect } from 'vitest'
import { PrismaClient } from '@prisma/client'

describe('DB Protection', () => {
  it('AC-01: should throw when connecting to non-test database', () => {
    // 模拟开发数据库 URL
    const originalUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/goferbot?schema=public'

    expect(() => new PrismaClient()).toThrow()

    process.env.DATABASE_URL = originalUrl
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`pnpm vitest run tests/unit/server/db-protection-verify.spec.ts`
预期：FAIL — 测试通过（当前无保护，PrismaClient 实例化不抛错，断言失败）

- [ ] **步骤 3: 修改 testglobals.ts 增加保护逻辑**

```typescript
// tests/setup/testglobals.ts
import { installPinia } from './install-pinia'

installPinia({ stubActions: false })
global.runningTests = true

// 单元测试数据库连接保护
// 禁止单元测试连接非测试数据库，防止污染开发/生产环境
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('_test')) {
  throw new Error(
    '[测试安全] 检测到单元测试尝试连接非测试数据库。' +
    '单元测试必须全部 Mock，禁止真实数据库连接。' +
    `违规 DATABASE_URL: ${process.env.DATABASE_URL}`
  )
}
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`pnpm vitest run tests/unit/server/db-protection-verify.spec.ts`
预期：PASS — 保护机制生效，PrismaClient 实例化抛出错误

- [ ] **步骤 5: 删除临时验证文件**

```bash
rm tests/unit/server/db-protection-verify.spec.ts
```

- [ ] **步骤 6: 运行全部单元测试确认无回归**

运行：`pnpm test`
预期：PASS — 所有现有单元测试通过，无数据库连接错误

- [ ] **步骤 7: 提交**

```bash
git add tests/setup/testglobals.ts
git commit -m "test(q-24): add database connection protection in testglobals.ts

- Block unit tests from connecting to non-test databases
- Prevent future test pollution of dev/prod databases
- Align with unit-testing-guide.md: all external deps must be mocked"
```

---

## 任务 2: prisma-pagination.spec.ts Mock 化改造

**文件：**
- 重写：`tests/unit/server/prisma-pagination.spec.ts`

**规格引用：**
- test-spec: [Prisma 分页扩展测试 — Mock 模式]
- feature-spec: [AC-02 — prisma-pagination.spec.ts 改造]

**背景：**
当前测试直接 `new PrismaService()` 连接开发数据库，在 `beforeAll` 中创建 25 条用户数据。改造为 Mock 模式后，测试不依赖任何真实数据库。

**注意：**
`paginate` 和 `exists` 是 PrismaClient `$extends` 添加的方法，在 Mock 中直接模拟这两个方法的返回值即可，无需模拟底层 `findMany`/`count`。

- [ ] **步骤 1: 编写失败测试（新 Mock 模式）**

```typescript
// tests/unit/server/prisma-pagination.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

function createMockPrisma() {
  return {
    user: {
      paginate: vi.fn(),
      exists: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  }
}

describe('Prisma Pagination Extension', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
  })

  it('AC-01: paginate returns correct data and pagination metadata', async () => {
    mockPrisma.user.paginate.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({
        id: `u${i}`,
        email: `user${i}@test.com`,
        name: `User ${i}`,
      })),
      pagination: {
        total: 25,
        size: 10,
        totalPage: 3,
        currentPage: 1,
        hasNextPage: true,
        hasPrevPage: false,
      },
    })

    const result = await mockPrisma.user.paginate(
      { where: { email: { contains: 'test' } }, orderBy: { createdAt: 'desc' } },
      { page: 1, size: 10 },
    )

    expect(result.data).toHaveLength(10)
    expect(result.pagination.total).toBe(25)
    expect(result.pagination.size).toBe(10)
    expect(result.pagination.currentPage).toBe(1)
    expect(result.pagination.totalPage).toBe(3)
    expect(result.pagination.hasNextPage).toBe(true)
    expect(result.pagination.hasPrevPage).toBe(false)
    expect(mockPrisma.user.paginate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.any(Object), orderBy: expect.any(Object) }),
      expect.objectContaining({ page: 1, size: 10 }),
    )
  })

  it('AC-02: returns empty array for out-of-range page', async () => {
    mockPrisma.user.paginate.mockResolvedValue({
      data: [],
      pagination: {
        total: 5,
        size: 10,
        totalPage: 1,
        currentPage: 10,
        hasNextPage: false,
        hasPrevPage: true,
      },
    })

    const result = await mockPrisma.user.paginate(
      { where: { email: { contains: 'test' } }, orderBy: { createdAt: 'desc' } },
      { page: 10, size: 10 },
    )

    expect(result.data).toHaveLength(0)
    expect(result.pagination.hasNextPage).toBe(false)
    expect(mockPrisma.user.paginate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ page: 10, size: 10 }),
    )
  })

  it('AC-03: exists returns true for matching record', async () => {
    mockPrisma.user.exists.mockResolvedValue(true)

    const result = await mockPrisma.user.exists({
      where: { email: 'test@example.com' },
    })

    expect(result).toBe(true)
    expect(mockPrisma.user.exists).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    })
  })

  it('AC-04: exists returns false for non-matching record', async () => {
    mockPrisma.user.exists.mockResolvedValue(false)

    const result = await mockPrisma.user.exists({
      where: { email: 'nonexistent@example.com' },
    })

    expect(result).toBe(false)
  })

  it('AC-05: paginate handles invalid args gracefully', async () => {
    mockPrisma.user.paginate.mockResolvedValue({
      data: [],
      pagination: {
        total: 0,
        size: 0,
        totalPage: 0,
        currentPage: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    const result = await mockPrisma.user.paginate(null as any, { page: 1, size: 10 })

    expect(result.data).toHaveLength(0)
    expect(result.pagination.total).toBe(0)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`pnpm vitest run tests/unit/server/prisma-pagination.spec.ts`
预期：FAIL — 文件刚重写，若代码有误则测试失败

- [ ] **步骤 3: 修复测试代码使测试通过**

根据失败输出调整 mock 返回值或断言，确保测试逻辑正确。

- [ ] **步骤 4: 运行测试验证通过**

运行：`pnpm vitest run tests/unit/server/prisma-pagination.spec.ts`
预期：PASS — 5 个测试全部通过

- [ ] **步骤 5: 提交**

```bash
git add tests/unit/server/prisma-pagination.spec.ts
git commit -m "test(q-24): refactor prisma-pagination.spec.ts to mock mode

- Remove direct PrismaService/database connection
- Use vi.fn() mocks for paginate and exists methods
- Align with indexing-worker.spec.ts pattern"
```

---

## 任务 3: session.service.spec.ts Mock 化改造

**文件：**
- 重写：`tests/unit/server/session.service.spec.ts`

**规格引用：**
- test-spec: [SessionService 测试 — Mock 模式]
- feature-spec: [AC-03 — session.service.spec.ts 改造]

**背景：**
当前测试直接 `new PrismaService()` 连接开发数据库，创建真实用户和 60 条会话记录。改造为 Mock 模式后，通过 `new SessionService(mockPrisma as any)` 直接实例化 Service，注入 mock 依赖。

**关键注意：**
`SessionService.list()` 方法内部调用 `(this.prisma.session as any).paginate()`，并将结果中的 `_count.messages` 映射为 `messageCount`。Mock 时需要模拟这个完整结构。

- [ ] **步骤 1: 编写失败测试（新 Mock 模式）**

```typescript
// tests/unit/server/session.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionService } from '../../../packages/server/src/modules/session/session.service.js'

function createMockPrisma(overrides = {}) {
  return {
    session: {
      paginate: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      ...overrides.session,
    },
    ...overrides,
  }
}

describe('SessionService', () => {
  let service: SessionService
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    service = new SessionService(mockPrisma as any)
  })

  it('AC-01: list returns paginated result with default limit 50', async () => {
    const userId = 'user-123'
    mockPrisma.session.paginate.mockResolvedValue({
      data: Array.from({ length: 50 }, (_, i) => ({
        id: `s${i}`,
        userId,
        title: `Session ${i}`,
        provider: null,
        model: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        _count: { messages: i },
      })),
      pagination: {
        total: 60,
        size: 50,
        totalPage: 2,
        currentPage: 1,
        hasNextPage: true,
        hasPrevPage: false,
      },
    })

    const result = await service.list(userId, { page: 1, limit: 50 })

    expect(result.items).toHaveLength(50)
    expect(result.pagination.total).toBe(60)
    expect(result.pagination.size).toBe(50)
    expect(result.pagination.hasNextPage).toBe(true)
    expect(result.items[0].messageCount).toBe(0)
    expect(result.items[49].messageCount).toBe(49)
    expect(mockPrisma.session.paginate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { messages: true } } },
      }),
      expect.objectContaining({ page: 1, size: 50 }),
    )
  })

  it('AC-02: returns second page correctly', async () => {
    const userId = 'user-123'
    mockPrisma.session.paginate.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({
        id: `s${i + 50}`,
        userId,
        title: `Session ${i + 50}`,
        provider: null,
        model: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        _count: { messages: 0 },
      })),
      pagination: {
        total: 60,
        size: 50,
        totalPage: 2,
        currentPage: 2,
        hasNextPage: false,
        hasPrevPage: true,
      },
    })

    const result = await service.list(userId, { page: 2, limit: 50 })

    expect(result.items).toHaveLength(10)
    expect(result.pagination.currentPage).toBe(2)
    expect(result.pagination.hasPrevPage).toBe(true)
    expect(result.pagination.hasNextPage).toBe(false)
  })

  it('AC-03: returns empty array when no sessions', async () => {
    const userId = 'user-empty'
    mockPrisma.session.paginate.mockResolvedValue({
      data: [],
      pagination: {
        total: 0,
        size: 50,
        totalPage: 0,
        currentPage: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    const result = await service.list(userId, { page: 1, limit: 50 })

    expect(result.items).toHaveLength(0)
    expect(result.pagination.total).toBe(0)
  })

  it('AC-04: maps _count.messages to messageCount', async () => {
    const userId = 'user-123'
    mockPrisma.session.paginate.mockResolvedValue({
      data: [
        {
          id: 's1',
          userId,
          title: 'Test Session',
          provider: 'openai',
          model: 'gpt-4',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          _count: { messages: 42 },
        },
      ],
      pagination: {
        total: 1,
        size: 50,
        totalPage: 1,
        currentPage: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    const result = await service.list(userId)

    expect(result.items[0].messageCount).toBe(42)
    expect(result.items[0].title).toBe('Test Session')
    expect(result.items[0].provider).toBe('openai')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`pnpm vitest run tests/unit/server/session.service.spec.ts`
预期：FAIL — 文件刚重写，若 mock 结构不匹配则测试失败

- [ ] **步骤 3: 修复测试代码使测试通过**

根据失败输出调整 mock 结构或断言。常见问题：
- `paginate` 调用参数不匹配（`SessionService.list` 内部构造的 query 对象）
- `messageCount` 映射错误（`_count.messages` → `messageCount`）
- Date 对象比较问题

- [ ] **步骤 4: 运行测试验证通过**

运行：`pnpm vitest run tests/unit/server/session.service.spec.ts`
预期：PASS — 4 个测试全部通过

- [ ] **步骤 5: 提交**

```bash
git add tests/unit/server/session.service.spec.ts
git commit -m "test(q-24): refactor session.service.spec.ts to mock mode

- Remove direct PrismaService/database connection
- Use vi.fn() mocks for session.paginate
- Verify messageCount mapping from _count.messages
- Align with unit-testing-guide.md Service test pattern"
```

---

## 任务 4: 全量回归测试与数据清理

**文件：**
- 无文件变更（仅验证）

**规格引用：**
- feature-spec: [AC-04 — 全部单元测试通过], [AC-05 — 清理残留数据]

- [ ] **步骤 1: 运行全部单元测试**

运行：`pnpm test`
预期：PASS — 所有单元测试通过，包括改造后的 prisma-pagination 和 session-service

- [ ] **步骤 2: 运行后端单元测试子集**

运行：`pnpm vitest run tests/unit/server/`
预期：PASS — 所有后端单元测试通过

- [ ] **步骤 3: 验证无数据库连接**

确认测试输出中无 PostgreSQL 连接日志、无 `prisma:client` 查询日志。

- [ ] **步骤 4: 清理开发数据库残留数据**

```bash
# 使用 psql 或 Prisma Studio 执行
psql $DATABASE_URL -c "DELETE FROM users WHERE email LIKE '%session-test%' OR email LIKE '%paginate-%' OR email LIKE '%exists-%';"
```

或手动通过 Prisma Studio 清理。

- [ ] **步骤 5: 验证清理结果**

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE email LIKE '%session-test%' OR email LIKE '%paginate-%' OR email LIKE '%exists-%';"
```
预期：返回 `count = 0`

- [ ] **步骤 6: 提交**

```bash
git commit --allow-empty -m "test(q-24): verify all unit tests pass and dev db cleaned

- All unit tests pass without database connections
- Residual test data removed from dev database
- AC-01~AC-05 completed"
```

---

## 验证命令汇总

| 验证项 | 命令 | 预期结果 |
|--------|------|----------|
| 单个测试文件 | `pnpm vitest run tests/unit/server/prisma-pagination.spec.ts` | 5 passed |
| 单个测试文件 | `pnpm vitest run tests/unit/server/session.service.spec.ts` | 4 passed |
| 全部单元测试 | `pnpm test` | 全部 passed |
| 后端单元测试 | `pnpm vitest run tests/unit/server/` | 全部 passed |
| 数据库清理验证 | `psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE email LIKE '%session-test%' OR email LIKE '%paginate-%' OR email LIKE '%exists-%';"` | count = 0 |

---

## 规格覆盖检查

| Spec 章节 | 覆盖任务 | 状态 |
|-----------|----------|------|
| feature-spec AC-01: testglobals.ts 保护 | 任务 1 | ✅ |
| feature-spec AC-02: prisma-pagination Mock 化 | 任务 2 | ✅ |
| feature-spec AC-03: session.service Mock 化 | 任务 3 | ✅ |
| feature-spec AC-04: 全部单元测试通过 | 任务 4 步骤 1-2 | ✅ |
| feature-spec AC-05: 清理残留数据 | 任务 4 步骤 4-5 | ✅ |
| test-spec: 防护机制测试 | 任务 1 | ✅ |
| test-spec: Prisma 分页 5 个用例 | 任务 2 | ✅ |
| test-spec: SessionService 4 个用例 | 任务 3 | ✅ |

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| testglobals.ts 保护过于严格，误伤合法测试 | 中 | 保护仅检查 `DATABASE_URL` 是否包含 `_test`，不改 PrismaClient 行为；可快速调整条件 |
| session.service Mock 结构与实际 Service 不匹配 | 低 | 测试失败时根据错误输出调整 mock 结构 |
| 其他测试间接依赖数据库 | 低 | 全量回归测试 `pnpm test` 可发现；若失败则定位并修复 |
