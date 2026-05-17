---
issue_id: i-02-drizzle-orm-setup
type: feature-spec
status: draft
summary: 配置 Drizzle ORM 作为 PostgreSQL 类型安全数据访问层，定义 users/knowledge_bases/folders/documents/chunks/sessions/messages 7张表 Schema，建立可复现迁移流程与 Drizzle Studio。
---
# Feature Spec: Drizzle ORM Setup

## 1. 功能概述

为 GoferBot Server 配置 Drizzle ORM，定义全部 PostgreSQL 数据库 Schema，建立可复现的迁移流程，并提供类型安全的数据库访问层。

## 2. 目标

- 通过 Drizzle ORM 以类型安全的方式操作 PostgreSQL。
- 所有表结构与 PRD v2 数据模型完全一致。
- 迁移流程可复现，支持生成、执行、回滚（手动）。
- 提供 Drizzle Studio 用于本地开发时查看和管理数据。
- 导出 TypeScript 类型供 Repository 层与 Service 层消费。

## 3. 范围

### 3.1 范围内

- Drizzle ORM + `pg` 驱动安装与配置。
- `drizzle.config.ts` 配置（PostgreSQL 连接、Schema 路径、输出目录）。
- `packages/server/src/db/schema.ts` — 全部 7 张表定义：
  - `users`
  - `knowledge_bases`
  - `folders`
  - `documents`
  - `chunks`
  - `sessions`
  - `messages`
- `packages/server/src/db/index.ts` — 导出类型安全的 `db` 实例。
- `package.json` scripts：`db:generate`、`db:migrate`、`db:studio`。
- 所有表导出对应的 Drizzle `Select` / `Insert` 派生类型。

### 3.2 范围外

- 种子数据（后续由业务模块负责）。
- 数据库性能优化（索引策略后续迭代）。
- 多租户支持（MVP 单用户模式）。
- 自动回滚脚本（需手动执行 `down` SQL）。

## 4. 表清单与核心约束

| 表名 | 主键 | 核心外键 | 级联策略 | 说明 |
|------|------|----------|----------|------|
| `users` | `uuid` PK | — | — | 邮箱唯一 |
| `knowledge_bases` | `uuid` PK | `user_id → users.id` | `onDelete: 'cascade'` | 支持置顶、排序 |
| `folders` | `uuid` PK | `kb_id → knowledge_bases.id`, `parent_id → folders.id` | `onDelete: 'cascade'` | 虚拟文件夹树结构 |
| `documents` | `uuid` PK | `kb_id → knowledge_bases.id`, `folder_id → folders.id` | `onDelete: 'cascade'` | 状态机字段 `status` |
| `chunks` | `uuid` PK | `document_id → documents.id`, `kb_id → knowledge_bases.id` | `onDelete: 'cascade'` | 不存向量，只存元数据 |
| `sessions` | `uuid` PK | `user_id → users.id` | `onDelete: 'cascade'` | 消息计数缓存 |
| `messages` | `uuid` PK | `session_id → sessions.id` | `onDelete: 'cascade'` | 角色枚举 `user` / `assistant` |

## 5. 关键设计决策

### 5.1 主键类型

所有表主键使用 `uuid('id').primaryKey().defaultRandom()`，满足 `IRepository<T>` 的 `id: string` 泛型约束。

### 5.2 时间戳

统一使用 `timestamp('created_at', { withTimezone: true }).defaultNow()` 与 `timestamp('updated_at', { withTimezone: true }).defaultNow()`，确保时区安全。

### 5.3 chunks 表不存 embedding

向量数据由 Milvus 负责存储；`chunks` 表仅保存文本内容、分块索引、token 计数及 Milvus 关联 ID（`milvus_id`）。

### 5.4 documents 状态机

`status` 字段类型为 `text`，业务层约束取值集合：
`uploaded → parsing → chunking → indexing → ready`，失败时进入 `failed`。

### 5.5 虚拟文件夹树结构

`folders` 表通过 `parent_id` 自引用实现树结构，`parent_id` 为 `null` 表示根目录。业务层通过 `kb_id + parent_id` 查询子级。

## 6. 文件结构

```
packages/server/
├── drizzle.config.ts           # Drizzle ORM 配置
├── src/
│   └── db/
│       ├── index.ts            # db 实例导出 + 类型重导出
│       └── schema.ts           # 全部表定义
```

## 7. 验收标准

- [ ] `packages/server/src/db/schema.ts` 包含上述 7 张表，字段、类型、约束、默认值与 PRD 一致。
- [ ] `drizzle.config.ts` 配置正确，驱动为 `pg`，指向 PostgreSQL。
- [ ] `pnpm db:generate` 可成功生成迁移 SQL 文件到 `packages/server/drizzle/`。
- [ ] `pnpm db:migrate` 可成功执行迁移（需 PostgreSQL 服务运行）。
- [ ] `pnpm db:studio` 可启动 Drizzle Studio 并查看所有表。
- [ ] `packages/server/src/db/index.ts` 导出类型安全的 `db` 实例。
- [ ] 所有表导出 `Select` / `Insert` 类型，命名规范为 `{Table}Select` / `{Table}Insert`。
