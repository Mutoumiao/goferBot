# API Spec: Prisma ORM Setup

> 本任务为基础设施层（Database Infrastructure），不暴露 HTTP API，因此 API 规格聚焦于 **PrismaService 的公共接口** 和 **模块间契约**。

---

## 1. PrismaService 接口

### 1.1 类定义

```typescript
// src/processors/database/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### 1.2 继承与扩展

- `PrismaService` 继承自 `PrismaClient`，因此所有 Prisma Client 的查询方法（`user.findMany`、`document.create` 等）直接可用。
- 通过 `OnModuleInit` / `OnModuleDestroy` 实现 NestJS 生命周期管理，确保应用启动时建立数据库连接、关闭时优雅断开。

### 1.3 可选：扩展方法（预留）

```typescript
// 后续可按需添加，如健康检查
async healthCheck(): Promise<boolean> {
  try {
    await this.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
```

---

## 2. DatabaseModule 接口

### 2.1 模块定义

```typescript
// src/processors/database/database.module.ts

import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

### 2.2 使用方式

其他模块通过导入 `DatabaseModule` 使用 `PrismaService`：

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../processors/database/database.module';
import { KnowledgeBaseService } from './knowledge-base.service';

@Module({
  imports: [DatabaseModule],
  providers: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
```

在 Service 中注入：

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../processors/database/prisma.service';

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.knowledgeBase.findMany();
  }
}
```

---

## 3. Prisma Client 生成类型

### 3.1 自动生成类型

执行 `pnpm prisma:generate` 后，`@prisma/client` 自动生成以下类型：

| 类型 | 说明 | 示例 |
|------|------|------|
| `PrismaClient` | 客户端类 | `new PrismaClient()` |
| `{Model}CreateInput` | 创建输入 | `UserCreateInput` |
| `{Model}UpdateInput` | 更新输入 | `UserUpdateInput` |
| `{Model}WhereInput` | 查询条件 | `UserWhereInput` |
| `{Model}WhereUniqueInput` | 唯一查询条件 | `UserWhereUniqueInput` |
| `{Model}OrderByWithRelationInput` | 排序 | `UserOrderByWithRelationInput` |
| `{Model}Delegate` | 模型代理 | `prisma.user` |
| `{Model}` | 实体类型 | `User` |
| `{Model}Payload` | 查询载荷 | `UserPayload` |

### 3.2 类型使用示例

```typescript
import { Prisma, User } from '@prisma/client';

// 创建输入
const createInput: Prisma.UserCreateInput = {
  email: 'user@example.com',
  password: 'hashed_password',
};

// 查询条件
const where: Prisma.UserWhereInput = {
  email: { contains: '@example.com' },
};

// 返回类型
const user: User = await prisma.user.create({ data: createInput });
```

---

## 4. 环境变量契约

### 4.1 必需变量

| 变量名 | 格式 | 示例 |
|--------|------|------|
| `DATABASE_URL` | `postgresql://user:password@host:port/database` | `postgresql://gofer:gofer@localhost:5432/goferbot` |

### 4.2 `.env.example`

```
DATABASE_URL=postgresql://gofer:gofer@localhost:5432/goferbot
```

---

## 5. package.json Scripts 契约

| Script | 命令 | 说明 |
|--------|------|------|
| `prisma:generate` | `prisma generate` | 根据 schema.prisma 生成 Prisma Client |
| `prisma:migrate` | `prisma migrate dev` | 开发环境：生成并应用迁移 |
| `prisma:studio` | `prisma studio` | 启动 Prisma Studio（默认端口 5555） |
| `prisma:seed` | `tsx prisma/seed.ts` | 执行种子脚本（可选） |

---

## 6. 迁移文件契约

### 6.1 文件位置

```
prisma/migrations/
└── 20260516120000_init/
    └── migration.sql
```

### 6.2 命名规范

- 目录名：`YYYYMMDDhhmmss_{description}`
- 由 `prisma migrate dev` 自动生成，禁止手动修改已应用的迁移文件。

### 6.3 迁移行为

| 场景 | 行为 |
|------|------|
| 首次执行 | 创建 `_prisma_migrations` 表，执行全部迁移 SQL。 |
| schema 变更后 | `prisma migrate dev` 对比 shadow database，生成新的迁移文件并应用。 |
| 冲突处理 | 若迁移与现有数据冲突（如添加 `NOT NULL` 列但已有数据），Prisma 提示并提供交互式修复选项。 |

---

## 7. 生命周期契约

### 7.1 应用启动

```
NestJS 初始化
  → DatabaseModule 注册
    → PrismaService 实例化
      → onModuleInit()
        → $connect()
          → 建立 PostgreSQL 连接池
```

### 7.2 应用关闭

```
SIGTERM / 进程退出
  → onModuleDestroy()
    → $disconnect()
      → 优雅关闭连接池
```

### 7.3 连接池配置

Prisma 默认连接池行为：
- 默认 `connection_limit` = `num_cpus * 2 + 1`
- 可通过 `DATABASE_URL` 查询参数覆盖：`?connection_limit=10`

---

## 8. 错误契约

### 8.1 连接错误

| 错误码 | 场景 | 处理建议 |
|--------|------|----------|
| `P1001` | 数据库不可达 | 检查 `DATABASE_URL` 和 Docker Compose 是否启动 |
| `P1002` | 数据库拒绝连接 | 检查用户名/密码/权限 |
| `P1003` | 数据库不存在 | 执行 `prisma migrate dev` 初始化 |

### 8.2 查询错误

| 错误码 | 场景 | 处理建议 |
|--------|------|----------|
| `P2002` | 唯一约束冲突 | 业务层捕获并返回 409 Conflict |
| `P2025` | 记录未找到 | 业务层捕获并返回 404 Not Found |
| `P2003` | 外键约束失败 | 业务层捕获并返回 400 Bad Request |

---

## 9. 废弃接口清理清单

以下 Drizzle ORM 相关文件在 Prisma 迁移完成后应删除：

| 文件 | 说明 |
|------|------|
| `drizzle.config.ts` | Drizzle ORM 配置 |
| `src/db/schema.ts` | Drizzle 表定义 |
| `src/db/index.ts` | Drizzle 客户端导出 |
| `src/db/client.ts` | Drizzle 连接配置 |
| `src/db/type-check.ts` | Drizzle 类型检查兼容文件 |
| `drizzle/` | Drizzle 迁移目录 |
| `package.json` 中 `db:*` scripts | Drizzle Kit 命令 |
| `package.json` 中 `drizzle-orm`、`drizzle-kit`、`pg` | Drizzle 依赖（确认 Prisma 替代后移除） |

---

*文档结束*
