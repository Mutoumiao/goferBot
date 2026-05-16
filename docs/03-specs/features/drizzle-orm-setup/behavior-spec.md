# Behavior Spec: Drizzle ORM Setup

## 1. 迁移流程行为

### 1.1 生成迁移（pnpm db:generate）

**触发条件**：开发者修改 `schema.ts` 后手动执行。

**行为**：
1. Drizzle Kit 读取 `drizzle.config.ts` 中的 `schema` 路径。
2. 连接 PostgreSQL（通过 `DATABASE_URL` 环境变量）。
3. 对比当前数据库状态与 `schema.ts` 定义。
4. 生成新的迁移 SQL 文件到 `packages/server/drizzle/` 目录，文件名格式：
   ```
   YYYYMMDDHHMMSS_<auto_description>.sql
   ```
5. 同时生成对应的 `meta/` JSON 快照。

**成功判定**：命令退出码为 0，且 `drizzle/` 目录下新增 `.sql` 文件。

**失败场景**：
- PostgreSQL 不可达 → 报错提示检查 `DATABASE_URL` 与 Docker Compose。
- Schema 语法错误 → 报错提示具体文件与行号。

### 1.2 执行迁移（pnpm db:migrate）

**触发条件**：首次初始化数据库、或生成新迁移后手动执行。

**行为**：
1. Drizzle Kit 读取 `drizzle/` 目录下所有未执行的 `.sql` 文件。
2. 按文件名时间戳顺序依次执行。
3. 在数据库中写入 `__drizzle_migrations` 表记录已执行迁移。

**成功判定**：命令退出码为 0，数据库表结构与 `schema.ts` 一致。

**失败场景**：
- 迁移 SQL 与现有数据冲突（如添加 `NOT NULL` 列但已有数据）→ 事务回滚，报错提示具体迁移文件。
- 权限不足 → 报错提示检查数据库用户权限。

### 1.3 回滚策略（手动）

MVP 阶段不配置自动 `down` 迁移。回滚行为：
1. 开发者手动编写反向 SQL。
2. 通过 `psql` 或 Drizzle Studio 的 SQL Runner 执行。
3. 从 `__drizzle_migrations` 表中删除对应记录（如需重新执行）。

## 2. Drizzle Studio 使用行为

### 2.1 启动（pnpm db:studio）

**行为**：
1. Drizzle Kit 启动本地 Web 服务（默认端口 4983）。
2. 自动打开浏览器（或终端输出 URL）。
3. 加载 `schema.ts` 中定义的所有表结构。

### 2.2 数据查看

**行为**：
- 左侧导航栏列出所有表名。
- 点击表名后右侧展示数据网格，支持分页（默认 50 条/页）。
- 字段类型、约束、外键关系可视化。

### 2.3 数据编辑

**行为**：
- 双击单元格可内联编辑。
- 新建行：点击 "+" 按钮，填写字段后保存。
- 删除行：选中行后点击删除按钮，外键约束触发级联删除（如删除 `knowledge_bases` 会自动删除关联的 `documents`）。

### 2.4 SQL Runner

**行为**：
- 提供 SQL 编辑器，支持执行任意查询。
- 用于手动回滚、数据修复、复杂查询调试。

## 3. 类型导出行为

### 3.1 类型推导时机

TypeScript 类型在编译时由 Drizzle ORM 的 `inferSelectModel` / `inferInsertModel` 自动推导，无需手动维护。

### 3.2 导出规范

每个表导出以下类型：
- `{Table}Select` — 查询返回的完整实体类型（含 `id`、`createdAt`、`updatedAt`）。
- `{Table}Insert` — 插入时允许的字段类型（不含自生成字段）。

命名示例：
- `UserSelect`, `UserInsert`
- `KnowledgeBaseSelect`, `KnowledgeBaseInsert`
- `DocumentSelect`, `DocumentInsert`

### 3.3 与 IRepository 对齐

`Select` 类型必须满足 `IRepository<T>` 的泛型约束 `T extends { id: string }`，即所有 `Select` 类型都包含 `id: string`。

## 4. 数据库连接行为

### 4.1 连接字符串

通过环境变量 `DATABASE_URL` 读取，格式：
```
postgresql://<user>:<password>@<host>:<port>/<database>
```
开发默认值（由 Docker Compose 提供）：
```
postgresql://gofer:gofer@localhost:5432/goferbot
```

### 4.2 连接池

使用 `pg` 驱动的连接池，默认配置：
- `max: 10` — 最大连接数。
- `idle_timeout: 20` — 空闲连接超时（秒）。
- `connection_timeout: 10` — 连接超时（秒）。

### 4.3 生命周期

- 应用启动时：创建连接池。
- 应用关闭时：优雅关闭连接池（Node.js `beforeExit` 事件）。

## 5. 环境行为矩阵

| 环境 | 数据库 | 迁移行为 | Studio |
|------|--------|----------|--------|
| 开发（dev） | Docker Compose PostgreSQL | 手动执行 `db:migrate` | 可用 `db:studio` |
| 测试（test） | 独立测试数据库（`goferbot_test`） | 每次测试前自动迁移 | 不使用 |
| 生产（prod） | 外部 PostgreSQL | CI/CD 或手动执行 | 不使用 |
