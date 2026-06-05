---
name: q-24-test-spec
description: 单元测试数据库隔离治理测试规格
metadata:
  type: spec
  issue: q-24
---

# 测试规格：单元测试数据库隔离治理

## 测试策略

本次改造不涉及新增业务功能，而是**现有测试的合规化改造**。测试策略为：

1. **防护机制测试**：验证 testglobals.ts 的数据库连接保护是否有效
2. **改造后单元测试**：验证 prisma-pagination.spec.ts 和 session.service.spec.ts 在 Mock 模式下行为一致
3. **回归测试**：验证全部现有单元测试未受改造影响

## 测试映射

### 防护机制测试

| 场景 | 测试文件 | 测试用例 | 说明 |
|------|----------|----------|------|
| 检测到非 _test 数据库连接 | `tests/unit/server/prisma-pagination.spec.ts`（改造后） | `AC-01: 运行测试不触发数据库连接保护` | 改造后的测试不应触发保护 |
| 保护机制本身有效性 | 手动验证 | `尝试在测试中使用 new PrismaClient() 连接开发库` | 应抛出错误阻断 |

### Prisma 分页扩展测试（Mock 模式）

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 正常分页 | `tests/unit/server/prisma-pagination.spec.ts` | `AC-01: paginate returns correct data and pagination metadata` |
| 空页返回 | `tests/unit/server/prisma-pagination.spec.ts` | `AC-02: returns empty array for out-of-range page` |
| exists 查询存在 | `tests/unit/server/prisma-pagination.spec.ts` | `AC-03: exists returns true for matching record` |
| exists 查询不存在 | `tests/unit/server/prisma-pagination.spec.ts` | `AC-04: exists returns false for non-matching record` |
| 非法参数处理 | `tests/unit/server/prisma-pagination.spec.ts` | `AC-05: paginate handles invalid args gracefully` |

### SessionService 测试（Mock 模式）

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 正常列表查询 | `tests/unit/server/session.service.spec.ts` | `AC-01: list returns paginated result with default limit 50` |
| 第二页查询 | `tests/unit/server/session.service.spec.ts` | `AC-02: returns second page correctly` |
| 空列表 | `tests/unit/server/session.service.spec.ts` | `AC-03: returns empty array when no sessions` |
| 查询结果映射 | `tests/unit/server/session.service.spec.ts` | `AC-04: maps _count.messages to messageCount` |

## Mock 策略

### Prisma Client Mock 结构

```typescript
// 通用 mockPrisma 工厂
function createMockPrisma(overrides = {}) {
  return {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      // paginate 和 exists 是 $extends 添加的方法
      paginate: vi.fn(),
      exists: vi.fn(),
      ...overrides.user,
    },
    session: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      paginate: vi.fn(),
      ...overrides.session,
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    ...overrides,
  }
}
```

### 关键改造点

#### prisma-pagination.spec.ts

**改造前**：
```typescript
beforeAll(async () => {
  prisma = new PrismaService()
  await prisma.$connect()
  // 创建真实数据库记录...
})
```

**改造后**：
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma = createMockPrisma()
})

it('AC-01: paginate returns correct data and pagination metadata', async () => {
  // Arrange: 设置 mock 返回值
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

  // Act: 调用被测方法
  const result = await mockPrisma.user.paginate(
    { where: { email: { contains: 'test' } }, orderBy: { createdAt: 'desc' } },
    { page: 1, size: 10 },
  )

  // Assert: 验证返回结构和 mock 调用
  expect(result.data).toHaveLength(10)
  expect(result.pagination.total).toBe(25)
  expect(mockPrisma.user.paginate).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.any(Object) }),
    expect.objectContaining({ page: 1, size: 10 }),
  )
})
```

#### session.service.spec.ts

**改造前**：
```typescript
beforeAll(async () => {
  prisma = new PrismaService()
  await prisma.$connect()
  service = new SessionService(prisma)
  // 创建真实用户和会话...
})
```

**改造后**：
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma = createMockPrisma()
  service = new SessionService(mockPrisma as any)
})

it('AC-01: list returns paginated result with default limit 50', async () => {
  // Arrange
  const userId = 'user-123'
  mockPrisma.session.paginate.mockResolvedValue({
    data: Array.from({ length: 50 }, (_, i) => ({
      id: `s${i}`,
      userId,
      title: `Session ${i}`,
      provider: null,
      model: null,
      createdAt: new Date(),
      updatedAt: new Date(),
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

  // Act
  const result = await service.list(userId, { page: 1, limit: 50 })

  // Assert
  expect(result.items).toHaveLength(50)
  expect(result.pagination.total).toBe(60)
  expect(result.items[0].messageCount).toBe(0)
})
```

## 数据清理验证

### 残留数据查询

```sql
-- 清理前验证：应返回 >0 条
SELECT email, created_at FROM users 
WHERE email LIKE '%session-test%' 
   OR email LIKE '%paginate-%' 
   OR email LIKE '%exists-%'
ORDER BY created_at DESC;

-- 清理后验证：应返回 0 条
SELECT COUNT(*) FROM users 
WHERE email LIKE '%session-test%' 
   OR email LIKE '%paginate-%' 
   OR email LIKE '%exists-%';
```

## 回归测试范围

改造完成后，运行以下命令验证无回归：

```bash
# 全部单元测试
pnpm test

# 仅后端单元测试
pnpm vitest run tests/unit/server/

# 覆盖率报告（确认包含后端）
pnpm test --coverage
```
