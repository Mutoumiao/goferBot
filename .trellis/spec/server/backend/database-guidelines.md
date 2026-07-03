# Database Guidelines

> GoferBot Prisma ORM 约定与数据访问模式

---

## Schema 命名约定

### 字段命名

| 层 | 规则 | 示例 |
|----|------|------|
| Prisma Model | camelCase | `userId`, `createdAt`, `mustChangePassword` |
| 数据库列 | snake_case 通过 `@map()` | `@map("user_id")`, `@map("created_at")` |
| 数据库表 | snake_case 复数 通过 `@@map()` | `@@map("users")`, `@@map("knowledge_bases")` |

```prisma
model User {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}
```

### 主键与时间戳

- **所有主键**：`@id @default(uuid())`，类型 `String`
- **所有模型**：必须包含 `createdAt` + `updatedAt`
  - `createdAt DateTime @default(now()) @map("created_at")`
  - `updatedAt DateTime @updatedAt @map("updated_at")`

### 外键与关系

```prisma
model Session {
  userId  String  @map("user_id")
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- FK 字段命名：`{entity}Id` → `@map("{entity}_id")`
- 关系删除策略：**统一 `onDelete: Cascade`**
- 可选 FK：`String?` + `@map("...")`

### 索引

```prisma
@@index([userId])                          // 单列索引
@@index([userId, companionId, createdAt])  // 复合索引
@@unique([userId, key])                    // 唯一约束
@@index([createdAt(sort: Desc)])           // 降序索引
```

**原则**：为 WHERE / JOIN / ORDER BY 中高频使用的列建索引。

---

## PrismaService 扩展

```typescript
// processors/database/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // $extends 注入通用方法
  paginate(page, size) → PaginationResult<T>
  exists(where) → boolean
}
```

### 模型代理

通过 23 个 getter 代理全部 Prisma 模型：

```typescript
get user() { return this.client.user }
get session() { return this.client.session }
// ...
```

### 使用方式

```typescript
// 直接注入 PrismaService（推荐，多数场景）
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}
}

// 使用 Repository 模式（跨模块导出场景）
@Injectable()
export class SessionRepository extends BaseRepository<Session, CreateInput, UpdateInput> {
  protected readonly modelName = 'session' as const
}
```

---

## BaseRepository

```typescript
// shared/repositories/base.repository.ts
export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  protected abstract readonly modelName: keyof PrismaService

  // 继承方法
  findAll(options?) → T[]
  findById(id) → T | null
  create(data) → T
  update(id, data) → T
  delete(id) → T
  paginate(where, { page, size, orderBy }) → PaginationResult<T>
  exists(where) → boolean
}
```

**`get model()`**: 返回 Prisma 模型代理，自动携带 `paginate()` / `exists()` 扩展方法。

---

## TransactionManager

```typescript
// shared/repositories/transaction-manager.ts
@Injectable()
export class TransactionManager {
  async run<R>(work: (tx: Prisma.TransactionClient) => Promise<R>, options?): Promise<R>
  async runBatch(operations: Array<(tx: Prisma.TransactionClient) => Promise<unknown>>): Promise<unknown[]>
}
```

**默认参数**: `maxWait: 5000, timeout: 10000`

**使用示例**（用户密码变更 — 单事务多操作）:

```typescript
await this.transactionManager.run(async (tx) => {
  await tx.user.update({ where: { id }, data: { password: hashed } })
  await tx.authSession.updateMany({ where: { userId }, data: { revokedAt: now } })
  await tx.refreshToken.updateMany({ where: { session: { userId } }, data: { revokedAt: now } })
})
```

**原则**：bcrypt/password hashing 在事务**外面**执行，缩短持锁时间。

---

## 数据访问模式选择

| 场景 | 推荐方式 | 示例 |
|------|---------|------|
| 单模块内简单 CRUD | 直接注入 `PrismaService` | SessionService, ChatService |
| 跨模块导出数据访问 | `BaseRepository` 子类 + 接口 | SessionRepository, MessageRepository |
| 事务性多操作 | `TransactionManager.run()` | UserService.doUpdatePassword() |
| 批量操作 | `TransactionManager.runBatch()` | 批量索引更新 |

---

## 不要做的事

- ❌ 在 Schema 中使用 Prisma 字段名作为数据库列名（必须 `@map` 到 snake_case）
- ❌ 忘记 `@@map` — 表名必须映射到 snake_case 复数
- ❌ 在 DB 列名中使用大写字母或特殊字符
- ❌ 遗漏 `@updatedAt` — 每个模型都需要
- ❌ 在事务内执行耗时操作（bcrypt、网络请求）— 移到事务外
- ❌ 使用 `$transaction` 不设置 timeout — 使用 `TransactionManager` 统一管理
- ❌ N+1 查询 — 使用 Prisma `include` 替代循环查询

## Common Mistakes

1. **忘记 `@map`**：Prisma 字段默认映射同名字段，但项目中强制 snake_case
2. **使用 `@default(autoincrement())`**：项目中统一 UUID，非自增
3. **`onDelete: Cascade` 遗漏**：新建关系时检查是否遗漏
4. **未建索引**：根据前端查询模式检查是否需要 `@@index`
