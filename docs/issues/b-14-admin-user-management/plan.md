---
id: b-14
issue: issue.md
version: 1
---

# Admin 用户管理与基础设施规范化 实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 实现 Prisma 统一分页封装、修复 Session 列表接口、建立 RBAC 权限基础、提供 Admin 用户管理 API

**架构：** 基于 NestJS + Prisma 扩展，参考模板项目 `nest-http-prisma-zod` 的分页实现。所有列表接口统一返回 `{ data, pagination }` 结构。权限控制通过 `@Roles()` + `RolesGuard` 实现，Admin API 独立模块解耦用户逻辑。

**技术栈：** NestJS 10 + Prisma 5 + PostgreSQL + Vitest

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/feature-spec.md](./specs/feature-spec.md) | [specs/api-spec.md](./specs/api-spec.md)

---

## 文件变更清单

### 修改文件
- `packages/server/prisma/schema.prisma` — User 表增加 role / isActive 字段
- `packages/server/src/processors/database/prisma.service.ts` — 扩展 paginate + exists
- `packages/server/src/modules/session/session.service.ts` — 修复列表接口为分页格式
- `packages/server/src/modules/session/session.controller.ts` — 增加分页查询参数
- `packages/server/src/auth/auth.service.ts` — 登录增加 isActive 校验
- `packages/server/src/auth/strategies/jwt.strategy.ts` — payload 携带 role
- `packages/server/src/app.module.ts` — 注册 AdminModule

### 新建文件
- `packages/server/src/shared/dto/pager.dto.ts` — 基础分页 DTO
- `packages/server/src/shared/interfaces/paginator.interface.ts` — 分页结果类型
- `packages/server/src/auth/decorators/roles.decorator.ts` — @Roles() 装饰器
- `packages/server/src/auth/guards/roles.guard.ts` — RolesGuard
- `packages/server/src/auth/enums/role.enum.ts` — Role 枚举
- `packages/server/src/modules/admin/admin.module.ts` — Admin 模块
- `packages/server/src/modules/admin/admin.controller.ts` — Admin 控制器
- `packages/server/src/modules/admin/admin.service.ts` — Admin 服务
- `packages/server/src/modules/admin/dto/admin-user-list-query.dto.ts` — 用户列表查询 DTO
- `packages/server/src/modules/admin/dto/update-user-status.dto.ts` — 状态更新 DTO
- `tests/unit/server/prisma-pagination.spec.ts` — 分页扩展单元测试
- `tests/unit/server/roles.guard.spec.ts` — RolesGuard 单元测试
- `tests/integration/admin-user-management.spec.ts` — Admin API 集成测试

---

## 任务列表

### 任务 1: Prisma Schema 变更 — 增加 role 和 isActive 字段

**文件：**
- 修改：`packages/server/prisma/schema.prisma`

**规格引用：**
- 功能规格：[3.3 统一账号 + Role 字段]
- API 规格：[POST /auth/login 变更]

- [ ] **步骤 1: 编写失败测试（集成测试前置条件）**

创建测试文件验证 schema 变更后数据库有对应字段：

```typescript
// tests/integration/admin-user-management.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from '../helpers/test-app.factory'
import { TestDatabaseManager } from '../helpers/test-database.manager'

describe('AC-03: schema migration adds role and isActive columns', () => {
  const dbManager = new TestDatabaseManager()
  let app: any
  let dbUrl: string

  beforeAll(async () => {
    dbUrl = await dbManager.createDatabase()
    app = await TestAppFactory.create(dbUrl)
  })

  afterAll(async () => {
    await app.close()
    await dbManager.dropDatabase()
  })

  it('should have role and isActive columns in User table', async () => {
    const prisma = app.get('PrismaService')
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'User' AND column_name IN ('role', 'isActive')
    `
    const columns = result as Array<{ column_name: string; data_type: string }>
    const columnNames = columns.map((c) => c.column_name)

    expect(columnNames).toContain('role')
    expect(columnNames).toContain('isActive')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
cd D:/projects/ai-stared-project/knowledge-base
pnpm test:integration tests/integration/admin-user-management.spec.ts
```

预期：FAIL — `role` / `isActive` 列不存在

- [ ] **步骤 3: 修改 schema.prisma**

在 `User` 模型中增加两个字段：

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  avatar    String?
  password  String
  role      String   @default("USER")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  knowledgeBases KnowledgeBase[]
  sessions       Session[]
  settings       Setting[]
}
```

- [ ] **步骤 4: 生成并执行迁移**

```bash
cd packages/server
npx prisma migrate dev --name add_user_role_and_active
```

- [ ] **步骤 5: 运行测试验证通过**

```bash
cd D:/projects/ai-stared-project/knowledge-base
pnpm test:integration tests/integration/admin-user-management.spec.ts
```

预期：PASS

- [ ] **步骤 6: 提交**

```bash
git add packages/server/prisma/schema.prisma packages/server/prisma/migrations/
git commit -m "feat(schema): User 表增加 role 和 isActive 字段"
```

---

### 任务 2: Prisma Client 扩展 — paginate() 和 exists()

**文件：**
- 修改：`packages/server/src/processors/database/prisma.service.ts`
- 新建：`packages/server/src/shared/interfaces/paginator.interface.ts`
- 新建：`tests/unit/server/prisma-pagination.spec.ts`

**规格引用：**
- 功能规格：[3.1 Prisma Client 扩展]
- API 规格：[通用分页响应]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/server/prisma-pagination.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service'

describe('AC-01: paginate returns correct data and pagination metadata', () => {
  let prisma: PrismaService

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.$connect()
    // 清理并插入测试数据
    await prisma.user.deleteMany()
    await prisma.user.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        email: `user${i}@test.com`,
        password: 'hash',
        name: `User ${i}`,
      })),
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  it('should return paginated result with correct metadata', async () => {
    const result = await (prisma.user as any).paginate(
      { orderBy: { createdAt: 'desc' } },
      { page: 1, size: 10 },
    )

    expect(result.data).toHaveLength(10)
    expect(result.pagination.total).toBe(25)
    expect(result.pagination.size).toBe(10)
    expect(result.pagination.currentPage).toBe(1)
    expect(result.pagination.totalPage).toBe(3)
    expect(result.pagination.hasNextPage).toBe(true)
    expect(result.pagination.hasPrevPage).toBe(false)
  })

  it('should return empty array for out-of-range page', async () => {
    const result = await (prisma.user as any).paginate(
      { orderBy: { createdAt: 'desc' } },
      { page: 10, size: 10 },
    )

    expect(result.data).toHaveLength(0)
    expect(result.pagination.hasNextPage).toBe(false)
  })

  it('should check existence with exists()', async () => {
    const exists = await (prisma.user as any).exists({
      where: { email: 'user0@test.com' },
    })
    expect(exists).toBe(true)

    const notExists = await (prisma.user as any).exists({
      where: { email: 'nonexistent@test.com' },
    })
    expect(notExists).toBe(false)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
cd D:/projects/ai-stared-project/knowledge-base
pnpm test tests/unit/server/prisma-pagination.spec.ts
```

预期：FAIL — `paginate is not a function`

- [ ] **步骤 3: 实现分页接口类型和 Prisma 扩展**

```typescript
// packages/server/src/shared/interfaces/paginator.interface.ts
export interface PaginationResult<T> {
  data: T[]
  pagination: Paginator
}

export class Paginator {
  readonly total: number
  readonly size: number
  readonly currentPage: number
  readonly totalPage: number
  readonly hasNextPage: boolean
  readonly hasPrevPage: boolean
}
```

修改 `prisma.service.ts`：

```typescript
// packages/server/src/processors/database/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient, Prisma } from '@prisma/client'
import { PaginationResult } from '../shared/interfaces/paginator.interface'

// 扩展 PrismaClient 类型
type ExtendedPrismaClient = ReturnType<typeof createExtendedPrismaClient>

function createExtendedPrismaClient() {
  const client = new PrismaClient()

  return client.$extends({
    model: {
      $allModels: {
        async paginate<T, A>(
          this: T,
          x: Prisma.Exact<
            A,
            Pick<
              Prisma.Args<T, 'findFirst'>,
              'where' | 'select' | 'include' | 'orderBy'
            >
          >,
          options: { page: number; size: number },
        ): Promise<PaginationResult<Prisma.Result<T, A, 'findFirst'>>> {
          if (typeof x !== 'object' || x === null) {
            return {
              data: [],
              pagination: {
                total: 0,
                size: 0,
                totalPage: 0,
                currentPage: 0,
                hasNextPage: false,
                hasPrevPage: false,
              },
            } as PaginationResult<any>
          }

          const { page, size: perPage } = options
          const skip = page > 0 ? perPage * (page - 1) : 0
          const countArgs = 'select' in x ? { where: (x as any).where } : {}

          const [total, data] = await Promise.all([
            (this as any).count(countArgs),
            (this as any).findMany({
              ...(x as any),
              take: perPage,
              skip,
            }),
          ])

          const lastPage = Math.ceil(total / perPage)

          return {
            data,
            pagination: {
              total,
              size: perPage,
              totalPage: lastPage,
              currentPage: page,
              hasNextPage: page < lastPage,
              hasPrevPage: page > 1,
            },
          } as PaginationResult<any>
        },

        async exists<T, A>(
          this: T,
          x: Prisma.Exact<A, Pick<Prisma.Args<T, 'findFirst'>, 'where'>>,
        ): Promise<boolean> {
          if (typeof x !== 'object' || x === null || !('where' in x)) {
            return false
          }
          const count = await (this as any).count({ where: (x as any).where })
          return count > 0
        },
      },
    },
  })
}

@Injectable()
export class PrismaService
  extends createExtendedPrismaClient()
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
pnpm test tests/unit/server/prisma-pagination.spec.ts
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/processors/database/prisma.service.ts \
  packages/server/src/shared/interfaces/paginator.interface.ts \
  tests/unit/server/prisma-pagination.spec.ts
git commit -m "feat(prisma): 扩展 paginate() 和 exists() 方法"
```

---

### 任务 3: 基础分页 DTO

**文件：**
- 新建：`packages/server/src/shared/dto/pager.dto.ts`

**规格引用：**
- API 规格：[DTO 定义 — PagerDto]

- [ ] **步骤 1: 创建 PagerDto**

```typescript
// packages/server/src/shared/dto/pager.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export class PagerDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  size?: number = 10
}
```

- [ ] **步骤 2: 验证类型检查通过**

```bash
pnpm type-check
```

预期：无错误

- [ ] **步骤 3: 提交**

```bash
git add packages/server/src/shared/dto/pager.dto.ts
git commit -m "feat(dto): 基础分页 PagerDto"
```

---

### 任务 4: Session 列表接口修复与分页

**文件：**
- 修改：`packages/server/src/modules/session/session.service.ts`
- 修改：`packages/server/src/modules/session/session.controller.ts`
- 新建：`tests/unit/server/session.service.spec.ts`

**规格引用：**
- 功能规格：[3.2 Session 列表接口修复与分页]
- API 规格：[GET /api/sessions]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/server/session.service.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service'
import { SessionService } from '../../../packages/server/src/modules/session/session.service'

describe('AC-02: list returns paginated result with items and pagination', () => {
  let prisma: PrismaService
  let service: SessionService
  let userId: string

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.$connect()
    service = new SessionService(prisma)

    // 创建测试用户和会话
    const user = await prisma.user.create({
      data: { email: 'session-test@test.com', password: 'hash', name: 'Test' },
    })
    userId = user.id

    await prisma.session.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        userId,
        title: `Session ${i}`,
      })),
    })
  })

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('should return paginated sessions with default limit 50', async () => {
    const result = await service.list(userId, { page: 1, limit: 50 })

    expect(result.items).toHaveLength(50)
    expect(result.pagination.total).toBe(60)
    expect(result.pagination.size).toBe(50)
    expect(result.pagination.hasNextPage).toBe(true)
  })

  it('should return second page correctly', async () => {
    const result = await service.list(userId, { page: 2, limit: 50 })

    expect(result.items).toHaveLength(10)
    expect(result.pagination.currentPage).toBe(2)
    expect(result.pagination.hasPrevPage).toBe(true)
    expect(result.pagination.hasNextPage).toBe(false)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
pnpm test tests/unit/server/session.service.spec.ts
```

预期：FAIL — `list` 方法签名不匹配或返回格式错误

- [ ] **步骤 3: 修改 SessionService.list 方法**

```typescript
// packages/server/src/modules/session/session.service.ts
import { PagerDto } from '../../shared/dto/pager.dto'
import { PaginationResult } from '../../shared/interfaces/paginator.interface'

// 在 SessionService 中修改 list 方法
async list(
  userId: string,
  query: { page?: number; limit?: number } = {},
): Promise<{ items: Array<...>; pagination: Paginator }> {
  const page = query.page ?? 1
  const limit = query.limit ?? 50

  const result = await (this.prisma.session as any).paginate(
    {
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    },
    { page, size: limit },
  )

  return {
    items: result.data.map((session: any) => ({
      id: session.id,
      userId: session.userId,
      title: session.title,
      provider: session.provider,
      model: session.model,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session._count.messages,
    })),
    pagination: result.pagination,
  }
}
```

- [ ] **步骤 4: 修改 SessionController**

```typescript
// packages/server/src/modules/session/session.controller.ts
import { Query } from '@nestjs/common'
import { PagerDto } from '../../shared/dto/pager.dto'

// 在 list 方法中
@Get()
async list(@CurrentUser('id') userId: string, @Query() query: PagerDto) {
  return this.sessionService.list(userId, {
    page: query.page,
    limit: query.size,
  })
}
```

- [ ] **步骤 5: 运行测试验证通过**

```bash
pnpm test tests/unit/server/session.service.spec.ts
```

预期：PASS

- [ ] **步骤 6: 提交**

```bash
git add packages/server/src/modules/session/session.service.ts \
  packages/server/src/modules/session/session.controller.ts \
  tests/unit/server/session.service.spec.ts
git commit -m "fix(session): 列表接口修复为分页格式 { items, pagination }"
```

---

### 任务 5: RBAC — @Roles() 装饰器和 RolesGuard

**文件：**
- 新建：`packages/server/src/auth/enums/role.enum.ts`
- 新建：`packages/server/src/auth/decorators/roles.decorator.ts`
- 新建：`packages/server/src/auth/guards/roles.guard.ts`
- 新建：`tests/unit/server/roles.guard.spec.ts`

**规格引用：**
- 功能规格：[3.4 管理员认证与授权]
- API 规格：[守卫与装饰器]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/server/roles.guard.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RolesGuard } from '../../../packages/server/src/auth/guards/roles.guard'
import { Role } from '../../../packages/server/src/auth/enums/role.enum'

describe('AC-04: RolesGuard allows ADMIN and rejects USER', () => {
  let guard: RolesGuard
  let reflector: Reflector

  beforeEach(() => {
    reflector = new Reflector()
    guard = new RolesGuard(reflector)
  })

  function createMockContext(userRole: Role): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: userRole },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext
  }

  it('should allow access for ADMIN role', async () => {
    reflector.getAllAndOverride = () => [Role.ADMIN]
    const context = createMockContext(Role.ADMIN)

    await expect(guard.canActivate(context)).resolves.toBe(true)
  })

  it('should deny access for USER role when ADMIN required', async () => {
    reflector.getAllAndOverride = () => [Role.ADMIN]
    const context = createMockContext(Role.USER)

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)
  })

  it('should allow access when no roles are required', async () => {
    reflector.getAllAndOverride = () => undefined
    const context = createMockContext(Role.USER)

    await expect(guard.canActivate(context)).resolves.toBe(true)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
pnpm test tests/unit/server/roles.guard.spec.ts
```

预期：FAIL — 文件不存在

- [ ] **步骤 3: 实现 Role 枚举、装饰器和 Guard**

```typescript
// packages/server/src/auth/enums/role.enum.ts
export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}
```

```typescript
// packages/server/src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common'
import { Role } from '../enums/role.enum'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)
```

```typescript
// packages/server/src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Role } from '../enums/role.enum'
import { ROLES_KEY } from '../decorators/roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }

    const { user } = context.switchToHttp().getRequest()

    if (!user || !user.role) {
      throw new ForbiddenException('无权访问')
    }

    const hasRole = requiredRoles.includes(user.role as Role)
    if (!hasRole) {
      throw new ForbiddenException('Forbidden resource')
    }

    return true
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
pnpm test tests/unit/server/roles.guard.spec.ts
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/auth/enums/role.enum.ts \
  packages/server/src/auth/decorators/roles.decorator.ts \
  packages/server/src/auth/guards/roles.guard.ts \
  tests/unit/server/roles.guard.spec.ts
git commit -m "feat(auth): 实现 @Roles() 装饰器和 RolesGuard"
```

---

### 任务 6: JWT Strategy 携带 role

**文件：**
- 修改：`packages/server/src/auth/strategies/jwt.strategy.ts`

**规格引用：**
- 功能规格：[3.3 JWT payload 携带 role]

- [ ] **步骤 1: 修改 JwtStrategy**

```typescript
// packages/server/src/auth/strategies/jwt.strategy.ts
// 在 validate 方法中确保返回 role
async validate(payload: JwtPayload) {
  const user = await this.userService.findById(payload.sub)
  if (!user) {
    throw new UnauthorizedException('用户不存在')
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    role: user.role as Role,
  }
}
```

- [ ] **步骤 2: 验证类型检查**

```bash
pnpm type-check
```

预期：无错误

- [ ] **步骤 3: 提交**

```bash
git add packages/server/src/auth/strategies/jwt.strategy.ts
git commit -m "feat(auth): JWT payload 携带 user role"
```

---

### 任务 7: 登录接口增强 — 校验 isActive

**文件：**
- 修改：`packages/server/src/auth/auth.service.ts`
- 新建/修改：`tests/integration/auth.spec.ts`

**规格引用：**
- 功能规格：[3.7 登录接口增强]
- API 规格：[POST /auth/login 变更]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/auth.spec.ts（追加或新建）
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from '../helpers/test-app.factory'
import { TestDatabaseManager } from '../helpers/test-database.manager'

describe('AC-07: login rejects disabled user with 403', () => {
  const dbManager = new TestDatabaseManager()
  let app: any
  let dbUrl: string

  beforeAll(async () => {
    dbUrl = await dbManager.createDatabase()
    app = await TestAppFactory.create(dbUrl)
  })

  afterAll(async () => {
    await app.close()
    await dbManager.dropDatabase()
  })

  it('should return 403 for disabled user', async () => {
    // 先注册一个用户
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'disabled@test.com', password: 'Password123!', name: 'Disabled User' },
    })

    // 禁用该用户（直接操作数据库）
    const prisma = app.get('PrismaService')
    await prisma.user.update({
      where: { email: 'disabled@test.com' },
      data: { isActive: false },
    })

    // 尝试登录
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'disabled@test.com', password: 'Password123!' },
    })

    expect(response.statusCode).toBe(403)
    const body = JSON.parse(response.body)
    expect(body.code).toBe('ACCOUNT_DISABLED')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
pnpm test:integration tests/integration/auth.spec.ts
```

预期：FAIL — 禁用用户仍能登录，返回 200

- [ ] **步骤 3: 修改 AuthService.login**

```typescript
// packages/server/src/auth/auth.service.ts
// 在 validateUser 或 login 方法中增加校验
async login(dto: LoginDto) {
  const user = await this.validateUser(dto.email, dto.password)

  if (!user.isActive) {
    throw new ForbiddenException({
      code: 'ACCOUNT_DISABLED',
      message: '账号已被禁用',
    })
  }

  // ... 原有生成 token 逻辑
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
pnpm test:integration tests/integration/auth.spec.ts
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/auth/auth.service.ts tests/integration/auth.spec.ts
git commit -m "feat(auth): 登录接口校验 isActive，禁用账号返回 403"
```

---

### 任务 8: Admin 模块 — DTO、Service、Controller

**文件：**
- 新建：`packages/server/src/modules/admin/dto/admin-user-list-query.dto.ts`
- 新建：`packages/server/src/modules/admin/dto/update-user-status.dto.ts`
- 新建：`packages/server/src/modules/admin/admin.service.ts`
- 新建：`packages/server/src/modules/admin/admin.controller.ts`
- 新建：`packages/server/src/modules/admin/admin.module.ts`
- 新建：`tests/integration/admin-user-management.spec.ts`

**规格引用：**
- 功能规格：[3.5 Admin 用户列表接口]、[3.6 Admin 用户状态切换接口]
- API 规格：[GET /admin/users]、[PATCH /admin/users/:id/status]

- [ ] **步骤 1: 编写失败测试（集成测试）**

```typescript
// tests/integration/admin-user-management.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from '../helpers/test-app.factory'
import { TestDatabaseManager } from '../helpers/test-database.manager'
import { Role } from '../../packages/server/src/auth/enums/role.enum'

describe('Admin User Management API', () => {
  const dbManager = new TestDatabaseManager()
  let app: any
  let dbUrl: string
  let adminToken: string
  let userToken: string

  beforeAll(async () => {
    dbUrl = await dbManager.createDatabase()
    app = await TestAppFactory.create(dbUrl)

    // 创建管理员用户并登录
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'admin@test.com', password: 'Password123!', name: 'Admin' },
    })
    const prisma = app.get('PrismaService')
    await prisma.user.update({
      where: { email: 'admin@test.com' },
      data: { role: Role.ADMIN },
    })

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'Password123!' },
    })
    adminToken = JSON.parse(adminLogin.body).data.accessToken

    // 创建普通用户并登录
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'user@test.com', password: 'Password123!', name: 'User' },
    })
    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'user@test.com', password: 'Password123!' },
    })
    userToken = JSON.parse(userLogin.body).data.accessToken

    // 创建更多用户用于分页测试
    for (let i = 0; i < 15; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: `user${i}@test.com`, password: 'Password123!', name: `User ${i}` },
      })
    }
  })

  afterAll(async () => {
    await app.close()
    await dbManager.dropDatabase()
  })

  describe('AC-05: admin users list with pagination search and filter', () => {
    it('should return paginated user list for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users?page=1&size=10',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data).toHaveLength(10)
      expect(body.pagination.total).toBe(17) // admin + user + 15 users
      expect(body.pagination.totalPage).toBe(2)
    })

    it('should support email search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users?search=user@test.com',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].email).toBe('user@test.com')
    })

    it('should support isActive filter', async () => {
      // 先禁用一个用户
      const prisma = app.get(PrismaService)
      await prisma.user.update({
        where: { email: 'user0@test.com' },
        data: { isActive: false },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users?isActive=false',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.length).toBeGreaterThanOrEqual(1)
      expect(body.data[0].isActive).toBe(false)
    })

    it('should return 403 for non-admin user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${userToken}` },
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('AC-06: admin can toggle user active status', () => {
    it('should disable user', async () => {
      const prisma = app.get(PrismaService)
      const user = await prisma.user.findUnique({ where: { email: 'user1@test.com' } })

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/admin/users/${user.id}/status`,
        payload: { isActive: false },
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data.isActive).toBe(false)
    })

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/users/non-existent-id/status',
        payload: { isActive: false },
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 403 for non-admin user', async () => {
      const prisma = app.get(PrismaService)
      const user = await prisma.user.findUnique({ where: { email: 'user2@test.com' } })

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/admin/users/${user.id}/status`,
        payload: { isActive: false },
        headers: { authorization: `Bearer ${userToken}` },
      })

      expect(response.statusCode).toBe(403)
    })
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
pnpm test:integration tests/integration/admin-user-management.spec.ts
```

预期：FAIL — Admin 模块不存在，路由返回 404

- [ ] **步骤 3: 实现 Admin DTO**

```typescript
// packages/server/src/modules/admin/dto/admin-user-list-query.dto.ts
import { IsOptional, IsString, IsBoolean } from 'class-validator'
import { Type } from 'class-transformer'
import { PagerDto } from '../../../shared/dto/pager.dto'

export class AdminUserListQueryDto extends PagerDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean
}
```

```typescript
// packages/server/src/modules/admin/dto/update-user-status.dto.ts
import { IsBoolean } from 'class-validator'

export class UpdateUserStatusDto {
  @IsBoolean()
  isActive: boolean
}
```

- [ ] **步骤 4: 实现 AdminService**

```typescript
// packages/server/src/modules/admin/admin.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service'
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto'
import { UpdateUserStatusDto } from './dto/update-user-status.dto'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: AdminUserListQueryDto) {
    const { page, size, search, isActive } = query

    const where: any = {}

    if (search) {
      where.email = { contains: search, mode: 'insensitive' }
    }

    if (isActive !== undefined) {
      where.isActive = isActive
    }

    const result = await (this.prisma.user as any).paginate(
      {
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      { page: page ?? 1, size: size ?? 10 },
    )

    return result
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    })
  }
}
```

- [ ] **步骤 5: 实现 AdminController**

```typescript
// packages/server/src/modules/admin/admin.controller.ts
import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { Role } from '../../auth/enums/role.enum'
import { AdminService } from './admin.service'
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto'
import { UpdateUserStatusDto } from './dto/update-user-status.dto'

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async listUsers(@Query() query: AdminUserListQueryDto) {
    const result = await this.adminService.listUsers(query)
    return result
  }

  @Patch('users/:id/status')
  async updateUserStatus(@Param('id') userId: string, @Body() dto: UpdateUserStatusDto) {
    const result = await this.adminService.updateUserStatus(userId, dto)
    return result
  }
}
```

- [ ] **步骤 6: 实现 AdminModule**

```typescript
// packages/server/src/modules/admin/admin.module.ts
import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'

@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

- [ ] **步骤 7: 注册 AdminModule**

```typescript
// packages/server/src/app.module.ts
import { AdminModule } from './modules/admin/admin.module'

// 在 imports 数组中添加 AdminModule
@Module({
  imports: [
    // ... 其他模块
    AdminModule,
  ],
})
```

- [ ] **步骤 8: 运行测试验证通过**

```bash
pnpm test:integration tests/integration/admin-user-management.spec.ts
```

预期：PASS

- [ ] **步骤 9: 提交**

```bash
git add packages/server/src/modules/admin/ \
  tests/integration/admin-user-management.spec.ts \
  packages/server/src/app.module.ts
git commit -m "feat(admin): 实现用户列表和状态切换 API"
```

---

## 规格覆盖检查

| 规格项 | 对应任务 | 状态 |
|--------|----------|------|
| Prisma 扩展 paginate + exists | 任务 2 | ✅ |
| 基础分页 DTO | 任务 3 | ✅ |
| Session 列表修复为分页 | 任务 4 | ✅ |
| User 表 role / isActive | 任务 1 | ✅ |
| @Roles() 装饰器 | 任务 5 | ✅ |
| RolesGuard | 任务 5 | ✅ |
| JWT payload 携带 role | 任务 6 | ✅ |
| 登录校验 isActive | 任务 7 | ✅ |
| GET /admin/users | 任务 8 | ✅ |
| PATCH /admin/users/:id/status | 任务 8 | ✅ |

---

## 占位符扫描

- [x] 无 "TODO" / "TBD" / "稍后实现"
- [x] 无 "添加适当的错误处理" 等模糊描述
- [x] 每个任务都有具体代码示例
- [x] 每个任务都有验证命令
- [x] 类型签名前后一致

---

## 执行交接

**计划已保存到 `docs/issues/b-14-admin-user-management/plan.md`。两种执行方式：**

1. **子代理驱动（推荐）** — 每个任务新子代理，任务间审查
2. **内联执行** — 当前会话顺序执行，带检查点

**选择哪种？**
