---
issue_id: i-02-prisma-setup
type: feature-spec
status: approved
summary: 配置 Prisma ORM 5 替代 Drizzle，定义 8 张表数据模型，建立 Prisma Migrate 迁移流程，通过 NestJS PrismaService（OnModuleInit/OnModuleDestroy）管理连接生命周期，支持 Prisma Studio。
---
# Feature Spec: Prisma ORM Setup

## 1. 功能概述

为 GoferBot Server 配置 Prisma ORM 5，定义完整的 PostgreSQL 数据模型，建立可复现的迁移流程，并提供 NestJS 原生的类型安全数据库访问层。本任务替换原有的 Drizzle ORM 配置。

## 2. 用户故事

- **作为开发者**，我希望通过 Prisma Schema 声明式地定义数据模型，自动生成类型安全的客户端代码，减少手写 SQL 和类型定义的工作量。
- **作为开发者**，我希望使用 Prisma Migrate 管理数据库 schema 变更，确保团队内数据库结构可复现、可追踪。
- **作为开发者**，我希望在 NestJS 中通过 `@Injectable()` 的 PrismaService 管理数据库连接生命周期，支持优雅启停。
- **作为开发者**，我希望通过 Prisma Studio 在本地开发时直观地查看和编辑数据。

## 3. 范围

### 3.1 范围内

- Prisma 5 + `@prisma/client` 安装与配置。
- `prisma/schema.prisma` — 完整数据模型定义（8 张表）。
- `prisma/migrations/` — 初始迁移文件（`prisma migrate dev` 生成）。
- `src/processors/database/prisma.service.ts` — PrismaService（NestJS Injectable，实现 `OnModuleInit` / `OnModuleDestroy`）。
- `src/processors/database/database.module.ts` — DatabaseModule（导出 PrismaService，供其他模块导入）。
- `package.json` scripts：`prisma:generate`、`prisma:migrate`、`prisma:studio`、`prisma:seed`（可选）。
- `.env.example` — 包含 `DATABASE_URL` 示例。
- 废弃并清理 Drizzle ORM 相关文件（`drizzle.config.ts`、`src/db/schema.ts`、`src/db/index.ts` 等）。

### 3.2 范围外

- V1 → V2 数据迁移（由 `i-06-data-migration` 负责）。
- 具体业务查询逻辑（由各自业务模块的 Repository / Service 负责）。
- 多租户支持（MVP 单用户模式）。
- 数据库性能优化（索引策略后续迭代）。

## 4. 数据模型

### 4.1 模型清单

| 模型            | 说明             | 核心关系                                 |
|-----------------|------------------|------------------------------------------|
| `User`          | 用户表           | 1:N KnowledgeBase, Session               |
| `KnowledgeBase` | 知识库表         | N:1 User, 1:N Folder, Document           |
| `Folder`        | 虚拟文件夹表     | N:1 KnowledgeBase, 自引用 parentId       |
| `Document`      | 文档表           | N:1 KnowledgeBase, N:1 Folder, 1:N Chunk |
| `Chunk`         | 文本块表         | N:1 Document, N:1 KnowledgeBase          |
| `Session`       | 会话表           | N:1 User, 1:N Message                    |
| `Message`       | 消息表           | N:1 Session                              |
| `Setting`       | 设置表（键值对） | N:1 User                                 |

### 4.2 Prisma Schema 核心定义

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id @default(uuid())
  email         String         @unique
  name          String?
  avatar        String?
  password      String         // bcrypt hash
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  knowledgeBases KnowledgeBase[]
  sessions       Session[]
  settings       Setting[]

  @@map("users")
}

model KnowledgeBase {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  name        String
  description String?
  isPinned    Boolean   @default(false) @map("is_pinned")
  sortOrder   Int       @default(0) @map("sort_order")
  icon        String?
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  folders   Folder[]
  documents Document[]
  chunks    Chunk[]

  @@map("knowledge_bases")
}

model Folder {
  id        String   @id @default(uuid())
  kbId      String   @map("kb_id")
  parentId  String?  @map("parent_id")
  name      String
  createdAt DateTime @default(now()) @map("created_at")

  knowledgeBase KnowledgeBase @relation(fields: [kbId], references: [id], onDelete: Cascade)
  parent        Folder?       @relation("FolderTree", fields: [parentId], references: [id], onDelete: Cascade)
  children      Folder[]      @relation("FolderTree")
  documents     Document[]

  @@map("folders")
}

model Document {
  id           String   @id @default(uuid())
  kbId         String   @map("kb_id")
  folderId     String?  @map("folder_id")
  name         String
  ext          String?
  mimeType     String?  @map("mime_type")
  size         BigInt?
  storageKey   String   @map("storage_key")
  hash         String?
  status       String   @default("uploaded") // uploaded | parsing | chunking | indexing | ready | failed
  errorMessage String?  @map("error_message")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  knowledgeBase KnowledgeBase @relation(fields: [kbId], references: [id], onDelete: Cascade)
  folder        Folder?       @relation(fields: [folderId], references: [id], onDelete: Cascade)
  chunks        Chunk[]

  @@map("documents")
}

model Chunk {
  id         String   @id @default(uuid())
  documentId String   @map("document_id")
  kbId       String   @map("kb_id")
  content    String
  tokenCount Int?     @map("token_count")
  chunkIndex Int      @map("chunk_index")
  milvusId   String?  @map("milvus_id")
  createdAt  DateTime @default(now()) @map("created_at")

  document      Document      @relation(fields: [documentId], references: [id], onDelete: Cascade)
  knowledgeBase KnowledgeBase @relation(fields: [kbId], references: [id], onDelete: Cascade)

  @@map("chunks")
}

model Session {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  title     String   @default("新对话")
  provider  String?
  model     String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages Message[]

  @@map("sessions")
}

model Message {
  id        String   @id @default(uuid())
  sessionId String   @map("session_id")
  role      String   // user | assistant | system
  content   String
  createdAt DateTime @default(now()) @map("created_at")

  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@map("messages")
}

model Setting {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  key       String
  value     String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, key])
  @@map("settings")
}
```

### 4.3 关键约束说明

| 约束                           | 说明                                                                                                                                       |
|--------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| `@id @default(uuid())`         | 所有表主键使用 UUID v4，满足 `IRepository<T>` 的 `id: string` 约束。                                                                       |
| `@unique`                      | `users.email`、`settings.[userId, key]` 唯一。                                                                                             |
| `@relation(onDelete: Cascade)` | 删除 User 级联删除其 KnowledgeBase、Session、Setting；删除 KnowledgeBase 级联删除 Folder、Document、Chunk；删除 Session 级联删除 Message。 |
| `@updatedAt`                   | `updatedAt` 字段由 Prisma 自动更新。                                                                                                       |
| `@map`                         | 数据库列名使用 snake_case，Prisma 模型使用 camelCase。                                                                                     |

## 5. 关键设计决策

### 5.1 为什么从 Drizzle 迁移到 Prisma

| 维度          | Drizzle                        | Prisma                                                 |
|---------------|--------------------------------|--------------------------------------------------------|
| 类型推导      | 运行时推导，需手动维护类型别名 | 编译时生成 `@prisma/client`，类型即代码                |
| 迁移工具      | Drizzle Kit 较新，生态文档较少 | Prisma Migrate 成熟，支持 shadow database 校验         |
| NestJS 集成   | 无官方模块，需自行封装连接池   | `@nestjs/prisma` 社区方案成熟，或自行封装 Service 即可 |
| Schema 可视化 | Drizzle Studio 功能基础        | Prisma Studio 功能完善，支持关系跳转                   |
| 团队熟悉度    | 项目初期尝试                   | 团队有 nest-template 的 Prisma 使用经验                |
| 变更原因      | —                              | ADR-0004 决定采用 NestJS，Prisma 与 NestJS 生态更契合  |

### 5.2 主键与 UUID

延续 Drizzle 时期的决策：所有表主键使用 `uuid`（字符串），而非自增整数。原因：
1. 满足 `IRepository<T>` 的 `id: string` 泛型约束。
2. 便于后续分布式部署和 ID 生成去中心化。

### 5.3 时间戳统一

- `createdAt`：`@default(now())`，记录创建时间。
- `updatedAt`：`@updatedAt`，Prisma 自动在更新时刷新。
- 数据库底层类型为 `timestamp(3)`（Prisma 默认精度）。

### 5.4 向量数据不在 PostgreSQL 存储

`Chunk` 表仅保存文本内容、分块索引、token 计数及 Milvus 关联 ID（`milvusId`）。向量数据由 Milvus 负责存储和检索，避免在 PostgreSQL 中存储大维度浮点数组。

### 5.5 虚拟文件夹树结构

`Folder` 模型通过自引用 `parentId` 实现树结构，`parentId` 为 `null` 表示根目录。业务层通过 `kbId + parentId` 查询子级，不引入闭包表（MVP 层级浅，性能可接受）。

### 5.6 Setting 键值对设计

`Setting` 表采用 `key-value` 字符串对存储用户配置（JSON 序列化后存入 `value`），而非为每个配置项建列。原因：配置项频繁迭代，键值对更灵活。

## 6. 文件结构

```
packages/server/
├── prisma/
│   ├── schema.prisma           # Prisma 数据模型
│   └── migrations/
│       └── 20260516xxxxxx_init/
│           └── migration.sql   # 初始迁移 SQL
├── src/
│   └── processors/
│       └── database/
│           ├── prisma.service.ts   # PrismaService（Injectable）
│           └── database.module.ts  # DatabaseModule
├── .env.example
└── package.json
```

## 7. 验收标准

- [ ] `prisma/schema.prisma` 包含上述 8 个模型，字段、类型、约束、默认值与 PRD 一致。
- [ ] `prisma/migrations/` 目录下存在初始迁移文件，SQL 与 schema 定义一致。
- [ ] `src/processors/database/prisma.service.ts` 实现 `OnModuleInit`（`$connect`）和 `OnModuleDestroy`（`$disconnect`）。
- [ ] `src/processors/database/database.module.ts` 正确导出 `PrismaService`。
- [ ] `package.json` 包含 `prisma:generate`、`prisma:migrate`、`prisma:studio` scripts。
- [ ] `.env.example` 包含 `DATABASE_URL`。
- [ ] `pnpm prisma:generate` 成功生成 `@prisma/client`。
- [ ] `pnpm prisma:migrate` 成功应用到 PostgreSQL（需 Docker Compose 基础设施运行）。
- [ ] `pnpm type-check` 通过。
- [ ] 废弃的 Drizzle 文件已清理（`drizzle.config.ts`、`src/db/schema.ts`、`src/db/index.ts` 等）。

## 8. 阻塞与依赖

- **阻塞于**：`i-08-nestjs-server-setup`（需要 NestJS 模块结构和 `src/processors/` 目录）。
- **前置条件**：`i-01-docker-compose-infra`（需要 PostgreSQL 服务运行以执行迁移）。

## 9. 参考文档

- PRD: `docs/prd/v2-cloud-native.md`
- ADR: `docs/adrs/0004-cloud-native-rearchitecture.md`
- 旧 Drizzle Spec: `docs/03-specs/i-02-drizzle-orm-setup/`
