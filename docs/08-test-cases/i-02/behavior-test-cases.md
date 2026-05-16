# 测试用例：i-02 Drizzle ORM Setup

> 对应 Issue: [docs/02-issues/i-02-drizzle-orm-setup.md](../../02-issues/i-02-drizzle-orm-setup.md)  
> 对应 Spec: [docs/03-specs/features/drizzle-orm-setup/feature-spec.md](../../03-specs/features/drizzle-orm-setup/feature-spec.md) / behavior-spec.md  
> 对应 Plan: [docs/04-plans/drizzle-orm-setup/2026-05-16.md](../../04-plans/drizzle-orm-setup/2026-05-16.md)

---

## TC-I02-001: 验证 `drizzle-orm`、`pg`、`drizzle-kit`、`@types/pg` 已安装

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-001 |
| **测试目标** | 确认 `@goferbot/server` 已安装 Drizzle ORM 运行时与开发依赖 |
| **前置条件** | 1. 项目已执行 `pnpm install`  
2. `packages/server/package.json` 存在 |
| **步骤** | 1. 打开 `packages/server/package.json`  
2. 检查 `dependencies` 中是否包含 `drizzle-orm`、`pg`  
3. 检查 `devDependencies` 中是否包含 `drizzle-kit`、`@types/pg` |
| **预期结果** | 1. `dependencies` 中存在 `"drizzle-orm": "^x.x.x"` 与 `"pg": "^x.x.x"`  
2. `devDependencies` 中存在 `"drizzle-kit": "^x.x.x"` 与 `"@types/pg": "^x.x.x"` |
| **优先级** | P0（阻塞后续所有测试） |

---

## TC-I02-002: 验证 `drizzle.config.ts` 配置正确

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-002 |
| **测试目标** | 确认 Drizzle Kit 配置文件指向正确的 Schema 路径、输出目录与 PostgreSQL 驱动 |
| **前置条件** | TC-I02-001 通过；`packages/server/drizzle.config.ts` 已创建 |
| **步骤** | 1. 读取 `packages/server/drizzle.config.ts`  
2. 确认 `schema` 字段值为 `'./src/db/schema.ts'`  
3. 确认 `out` 字段值为 `'./drizzle'`  
4. 确认 `dialect` 字段值为 `'postgresql'`  
5. 确认 `dbCredentials.url` 读取 `DATABASE_URL` 环境变量，并提供开发默认值 |
| **预期结果** | 配置文件中各字段与上述期望值完全一致；无语法错误 |
| **优先级** | P0 |

---

## TC-I02-003: 验证 `packages/server/src/db/client.ts` 创建 pg Pool 与 db 实例

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-003 |
| **测试目标** | 确认数据库客户端使用 `pg` Pool，参数与生命周期符合行为规格 |
| **前置条件** | TC-I02-001 通过；`packages/server/src/db/client.ts` 已创建 |
| **步骤** | 1. 读取 `packages/server/src/db/client.ts`  
2. 确认使用 `new Pool({ ... })` 创建连接池  
3. 确认 `connectionString` 读取 `DATABASE_URL` 并提供开发默认值  
4. 确认 `max` 为 `10`、`idleTimeoutMillis` 为 `20000`、`connectionTimeoutMillis` 为 `10000`  
5. 确认通过 `drizzle({ client: pool })` 导出 `db` 实例  
6. 确认存在 `process.on('beforeExit', ...)` 优雅关闭连接池 |
| **预期结果** | 所有连接池参数与导出方式与行为规格 4.1 / 4.2 / 4.3 一致 |
| **优先级** | P0 |

---

## TC-I02-004: 验证 `schema.ts` 包含全部 7 张表定义

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-004 |
| **测试目标** | 确认 `packages/server/src/db/schema.ts` 定义了 issue 要求的 7 张表 |
| **前置条件** | TC-I02-001 通过；`packages/server/src/db/schema.ts` 已创建 |
| **步骤** | 1. 读取 `packages/server/src/db/schema.ts`  
2. 全文搜索 `pgTable(` 出现次数  
3. 核对表名列表：users、knowledge_bases、folders、documents、chunks、sessions、messages |
| **预期结果** | 共 7 处 `pgTable(` 调用，且 7 个表名均存在 |
| **优先级** | P0 |

---

## TC-I02-005: 验证所有表主键为 `uuid` 且默认随机生成

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-005 |
| **测试目标** | 确认每张表的主键定义满足 `IRepository<T>` 的 `id: string` 约束 |
| **前置条件** | TC-I02-004 通过 |
| **步骤** | 1. 在 `schema.ts` 中遍历 7 张表的定义  
2. 确认每张表的主键字段为 `uuid('id').primaryKey().defaultRandom()` |
| **预期结果** | 7 张表均使用 `uuid('id').primaryKey().defaultRandom()`，无其他主键类型 |
| **优先级** | P0 |

---

## TC-I02-006: 验证 `users` 表字段、约束与默认值

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-006 |
| **测试目标** | 确认 `users` 表结构与 PRD 数据模型一致 |
| **前置条件** | TC-I02-004 通过 |
| **步骤** | 1. 检查 `users` 表字段：id、email、name、avatar、createdAt  
2. 确认 `email` 为 `.notNull().unique()`  
3. 确认 `name`、`avatar` 可为 null  
4. 确认 `createdAt` 为 `timestamp('created_at', { withTimezone: true }).defaultNow()`  
5. 确认无 `updatedAt` 字段 |
| **预期结果** | 字段、类型、约束、默认值与 feature spec 5.1 及 PRD 一致 |
| **优先级** | P1 |

---

## TC-I02-007: 验证 `knowledge_bases` 表字段、外键与级联策略

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-007 |
| **测试目标** | 确认 `knowledge_bases` 表结构、外键与级联删除策略正确 |
| **前置条件** | TC-I02-004 通过 |
| **步骤** | 1. 检查字段：id、userId、name、description、isPinned、sortOrder、icon、createdAt、updatedAt  
2. 确认 `userId` 外键指向 `users.id`，`onDelete: 'cascade'`  
3. 确认 `isPinned` 默认 `false`，`sortOrder` 默认 `0`  
4. 确认 `createdAt`、`updatedAt` 为 `withTimezone: true` 且默认当前时间 |
| **预期结果** | 外键级联策略为 `cascade`；默认值与 PRD 一致 |
| **优先级** | P1 |

---

## TC-I02-008: 验证 `folders` 表自引用树结构与级联策略

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-008 |
| **测试目标** | 确认 `folders` 表通过 `parent_id` 自引用实现虚拟文件夹树 |
| **前置条件** | TC-I02-004 通过 |
| **步骤** | 1. 检查字段：id、kbId、parentId、name、createdAt  
2. 确认 `kbId` 外键指向 `knowledge_bases.id`，`onDelete: 'cascade'`  
3. 确认 `parentId` 外键指向 `folders.id`，`onDelete: 'cascade'`，且可为 null  
4. 确认无 `updatedAt` 字段 |
| **预期结果** | `parentId` 为自引用外键，允许 null 表示根目录；级联策略正确 |
| **优先级** | P1 |

---

## TC-I02-009: 验证 `documents` 表状态机字段与存储字段

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-009 |
| **测试目标** | 确认 `documents` 表包含状态机字段 `status` 及 MinIO 存储关联字段 |
| **前置条件** | TC-I02-004 通过 |
| **步骤** | 1. 检查字段：id、kbId、folderId、name、ext、mimeType、size、storageKey、hash、status、errorMessage、createdAt、updatedAt  
2. 确认 `status` 默认值为 `'uploaded'`  
3. 确认 `size` 为 `bigint('size', { mode: 'number' })`  
4. 确认 `storageKey` 为 `.notNull()`  
5. 确认 `folderId` 可为 null |
| **预期结果** | 字段与 PRD 数据模型一致；`status` 默认 `uploaded`；`folderId` 可为 null |
| **优先级** | P1 |

---

## TC-I02-010: 验证 `chunks` 表不存储向量，仅存元数据

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-010 |
| **测试目标** | 确认 `chunks` 表无 `embedding` 字段，仅保存文本与 Milvus 关联 ID |
| **前置条件** | TC-I02-004 通过 |
| **步骤** | 1. 检查字段：id、documentId、kbId、content、tokenCount、chunkIndex、milvusId、createdAt  
2. 确认不存在任何名为 `embedding` 或类似向量类型的字段  
3. 确认 `milvusId` 字段存在，用于关联 Milvus 向量存储  
4. 确认 `documentId`、`kbId` 外键均带 `onDelete: 'cascade'` |
| **预期结果** | 无 embedding 字段；`milvusId` 存在；外键级联策略正确 |
| **优先级** | P1 |

---

## TC-I02-011: 验证 `sessions` 与 `messages` 表结构

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-011 |
| **测试目标** | 确认会话与消息表字段、外键、角色枚举符合 PRD |
| **前置条件** | TC-I02-004 通过 |
| **步骤** | 1. 检查 `sessions` 字段：id、userId、title、provider、model、createdAt、updatedAt、messageCount  
2. 确认 `sessions.userId` 外键指向 `users.id`，`onDelete: 'cascade'`  
3. 确认 `sessions.messageCount` 默认 `0`，`title` 默认 `'新对话'`  
4. 检查 `messages` 字段：id、sessionId、role、content、knowledgeBaseIds、createdAt  
5. 确认 `messages.sessionId` 外键指向 `sessions.id`，`onDelete: 'cascade'`  
6. 确认 `messages.role` 类型约束为 `'user' \| 'assistant'` 且 `.notNull()`  
7. 确认 `messages.knowledgeBaseIds` 为 `text().array()` |
| **预期结果** | 两张表结构与 feature spec 5.4、5.5 及 PRD 一致 |
| **优先级** | P1 |

---

## TC-I02-012: 验证所有表导出 `Select` / `Insert` 类型

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-012 |
| **测试目标** | 确认每张表导出命名规范的 TypeScript 类型 |
| **前置条件** | TC-I02-004 通过 |
| **步骤** | 1. 在 `schema.ts` 中搜索 `$inferSelect` 与 `$inferInsert` 出现次数  
2. 核对类型命名：  
   - UserSelect / UserInsert  
   - KnowledgeBaseSelect / KnowledgeBaseInsert  
   - FolderSelect / FolderInsert  
   - DocumentSelect / DocumentInsert  
   - ChunkSelect / ChunkInsert  
   - SessionSelect / SessionInsert  
   - MessageSelect / MessageInsert |
| **预期结果** | 共 14 个类型导出（7 张表 x 2），命名完全符合规范 |
| **优先级** | P1 |

---

## TC-I02-013: 验证 `Select` 类型满足 `IRepository<T>` 编译时约束

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-013 |
| **测试目标** | 确认所有 `Select` 类型均包含 `id: string`，满足 `IRepository<T>` 泛型约束 |
| **前置条件** | TC-I02-012 通过；`packages/server/src/interfaces/IRepository.ts` 存在 |
| **步骤** | 1. 确认 `packages/server/src/db/type-check.ts` 存在  
2. 检查该文件是否为每个 `Select` 类型声明 `IRepository<T>` 变量  
3. 运行 `cd packages/server && pnpm type-check` |
| **预期结果** | `pnpm type-check` 零错误；若任一 `Select` 类型缺少 `id: string`，编译失败 |
| **优先级** | P1 |

---

## TC-I02-014: 验证 `packages/server/src/db/index.ts` 统一导出 db 实例与类型

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-014 |
| **测试目标** | 确认 `index.ts` 是数据库层的唯一入口，导出 db 实例、Schema 与常用工具函数 |
| **前置条件** | TC-I02-003、TC-I02-012 通过；`packages/server/src/db/index.ts` 已创建 |
| **步骤** | 1. 读取 `packages/server/src/db/index.ts`  
2. 确认 `export { db } from './client'` 存在  
3. 确认 `export * from './schema'` 存在  
4. 确认导出常用 Drizzle 工具函数（如 `eq`, `and`, `or`, `inArray`, `desc`, `asc`） |
| **预期结果** | 统一导出文件包含 db 实例、全部 Schema 类型、常用查询构建器；无循环依赖 |
| **优先级** | P1 |

---

## TC-I02-015: 验证 `package.json` 包含 db:generate / db:migrate / db:studio scripts

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-015 |
| **测试目标** | 确认 `@goferbot/server` 提供 Drizzle Kit 迁移与 Studio 命令 |
| **前置条件** | TC-I02-001 通过 |
| **步骤** | 1. 打开 `packages/server/package.json`  
2. 检查 `scripts` 字段中是否存在：  
   - `"db:generate": "drizzle-kit generate"`  
   - `"db:migrate": "drizzle-kit migrate"`  
   - `"db:studio": "drizzle-kit studio"` |
| **预期结果** | 三条 scripts 均存在且命令正确；`package.json` 为合法 JSON |
| **优先级** | P0 |

---

## TC-I02-016: 验证 `pnpm db:generate` 成功生成迁移 SQL 文件

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-016 |
| **测试目标** | 确认首次迁移生成命令可正常执行，输出目录结构正确 |
| **前置条件** | TC-I02-002、TC-I02-015 通过；PostgreSQL 服务已启动（`docker compose up -d postgres`） |
| **步骤** | 1. 确保 `packages/server/drizzle/` 目录不存在或为空  
2. 在 `packages/server` 目录执行 `pnpm db:generate`  
3. 检查命令退出码  
4. 检查 `packages/server/drizzle/` 目录下是否生成 `.sql` 文件与 `meta/` 快照目录 |
| **预期结果** | 命令退出码为 0；`drizzle/` 下存在形如 `YYYYMMDDHHMMSS_*.sql` 的迁移文件；`meta/` 目录包含 `_journal.json` |
| **优先级** | P0 |

---

## TC-I02-017: 验证 `pnpm db:migrate` 成功创建 7 张表与迁移记录表

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-017 |
| **测试目标** | 确认迁移执行后数据库表结构与 `schema.ts` 完全一致 |
| **前置条件** | TC-I02-016 通过；PostgreSQL 服务已启动 |
| **步骤** | 1. 在 `packages/server` 目录执行 `pnpm db:migrate`  
2. 检查命令退出码  
3. 使用 `psql` 或 `\dt` 查询数据库表列表  
4. 检查 `__drizzle_migrations` 表是否存在 |
| **预期结果** | 命令退出码为 0；数据库中存在 `chunks`、`documents`、`folders`、`knowledge_bases`、`messages`、`sessions`、`users` 共 7 张表；存在 `__drizzle_migrations` 记录表 |
| **优先级** | P0 |

---

## TC-I02-018: 验证 `pnpm db:studio` 可启动 Drizzle Studio

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-018 |
| **测试目标** | 确认 Drizzle Studio 本地服务可启动，无报错 |
| **前置条件** | TC-I02-017 通过；PostgreSQL 服务已启动 |
| **步骤** | 1. 在 `packages/server` 目录执行 `pnpm db:studio`  
2. 观察终端输出，确认显示本地服务地址（默认 `http://localhost:4983`）  
3. 按 `Ctrl+C` 终止进程 |
| **预期结果** | 终端输出服务地址，无连接错误、无 Schema 加载异常；进程可被正常终止 |
| **优先级** | P1 |

---

## TC-I02-019: 验证外键级联删除行为（数据库层面）

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-019 |
| **测试目标** | 确认删除父表记录时，子表记录按 `onDelete: 'cascade'` 自动删除 |
| **前置条件** | TC-I02-017 通过；数据库已迁移且可写入 |
| **步骤** | 1. 向 `users` 表插入一条记录，获取 userId  
2. 向 `knowledge_bases` 表插入一条关联记录  
3. 向 `documents` 表插入一条关联到该 knowledge_base 的记录  
4. 删除 `users` 表中的父记录  
5. 查询 `knowledge_bases` 与 `documents` 表 |
| **预期结果** | `knowledge_bases` 与 `documents` 中关联记录均被级联删除；无孤儿记录 |
| **优先级** | P1 |

---

## TC-I02-020: 验证 `chunks` 表 embedding 维度可配置（边界条件）

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-020 |
| **测试目标** | 确认 `chunks` 表不硬编码 embedding 维度，向量维度由外部配置/ Milvus 决定 |
| **前置条件** | TC-I02-010 通过 |
| **步骤** | 1. 检查 `schema.ts` 中 `chunks` 表定义  
2. 确认不存在任何固定维度（如 1536、1024）的数组或向量字段  
3. 确认向量存储完全由 `milvusId` 字段关联到外部 Milvus 服务 |
| **预期结果** | `chunks` 表无 embedding 字段；维度变更无需修改 Schema 或迁移 |
| **优先级** | P1 |

---

## TC-I02-021: 验证时间戳字段时区安全（边界条件）

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-021 |
| **测试目标** | 确认所有时间戳字段使用 `withTimezone: true`，避免时区歧义 |
| **前置条件** | TC-I02-004 通过 |
| **步骤** | 1. 在 `schema.ts` 中搜索所有 `timestamp(` 调用  
2. 确认每个调用均包含 `{ withTimezone: true }` 选项  
3. 确认无裸 `timestamp('xxx')` 或 `{ withTimezone: false }` 的用法 |
| **预期结果** | 所有时间戳字段均带 `withTimezone: true` |
| **优先级** | P2 |

---

## TC-I02-022: 验证 `messages.role` 仅允许 user / assistant（边界条件）

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-022 |
| **测试目标** | 确认 `messages.role` 在类型层面限制为 `'user' \| 'assistant'` |
| **前置条件** | TC-I02-011 通过 |
| **步骤** | 1. 检查 `schema.ts` 中 `messages.role` 定义  
2. 确认使用 `.$type<'user' \| 'assistant'>()` 或等效类型收窄  
3. 运行 `cd packages/server && pnpm type-check` |
| **预期结果** | 类型检查通过；`MessageInsert` 的 `role` 字段在 IDE 中提示仅允许 `'user' \| 'assistant'` |
| **优先级** | P2 |

---

## TC-I02-023: 验证迁移失败时事务回滚（异常场景）

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-023 |
| **测试目标** | 确认冲突迁移不会破坏已有数据库状态 |
| **前置条件** | TC-I02-017 通过；数据库已有数据 |
| **步骤** | 1. 手动构造一个冲突迁移 SQL（如向已有数据的表添加 `NOT NULL` 列且无默认值）  
2. 将该 SQL 放入 `drizzle/` 目录并伪造一条未执行的 `meta` 记录  
3. 执行 `pnpm db:migrate`  
4. 观察报错后检查数据库表结构是否变化 |
| **预期结果** | 命令以非零退出码失败；数据库表结构保持原状；无部分执行残留 |
| **优先级** | P2 |

---

## TC-I02-024: 验证 `db.ts` 旧占位文件已清理或重定向

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-024 |
| **测试目标** | 确认旧 `packages/server/src/db.ts` 不会与新的 `db/index.ts` 冲突 |
| **前置条件** | TC-I02-014 通过 |
| **步骤** | 1. 读取 `packages/server/src/db.ts`  
2. 确认文件内容为重定向到 `./db/index.js`，或已被删除  
3. 确认项目中无其他代码仍直接 `import { db } from './db'` 指向旧文件（IDE 全局搜索） |
| **预期结果** | 旧文件已清理或安全重定向；无循环导入、无重复 db 实例 |
| **优先级** | P1 |

---

## TC-I02-025: 验证开发环境连接字符串默认值

| 项目 | 内容 |
|------|------|
| **TC-ID** | TC-I02-025 |
| **测试目标** | 确认未设置 `DATABASE_URL` 时，开发环境可自动连接到 Docker Compose PostgreSQL |
| **前置条件** | TC-I02-002、TC-I02-003 通过；Docker Compose PostgreSQL 已启动 |
| **步骤** | 1. 临时取消设置 `DATABASE_URL` 环境变量  
2. 执行 `pnpm db:migrate` 或启动应用  
3. 观察是否能成功连接 `postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot` |
| **预期结果** | 在无 `DATABASE_URL` 环境下，默认连接字符串生效，命令成功执行 |
| **优先级** | P2 |

---

## 测试覆盖矩阵

| 验收标准 / 规格条目 | 覆盖 TC-ID |
|---------------------|------------|
| `schema.ts` 包含 7 张表定义 | TC-I02-004 |
| 所有表与 PRD 数据模型一致 | TC-I02-006 ~ TC-I02-011 |
| `chunks` 不存 embedding，维度可配置 | TC-I02-010, TC-I02-020 |
| `drizzle.config.ts` 配置正确 | TC-I02-002 |
| `pnpm db:generate` 可生成迁移 | TC-I02-016 |
| `pnpm db:migrate` 可执行迁移 | TC-I02-017 |
| `pnpm db:studio` 可打开 Studio | TC-I02-018 |
| 提供类型安全的 db 实例导出 | TC-I02-003, TC-I02-014 |
| 所有表导出 Select / Insert 类型 | TC-I02-012 |
| Select 类型满足 IRepository 约束 | TC-I02-013 |
| 外键级联策略 | TC-I02-019 |
| 时间戳时区安全 | TC-I02-021 |
| messages.role 枚举约束 | TC-I02-022 |
| 迁移失败事务回滚 | TC-I02-023 |
| 旧 db.ts 清理 | TC-I02-024 |
| 开发环境默认连接字符串 | TC-I02-025 |
