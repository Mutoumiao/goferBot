状态: needs-triage
分类: enhancement

## 要构建的内容

配置 Drizzle ORM，定义全部数据库 Schema，建立迁移流程，提供类型安全的数据库访问层。

## 规格引用

- 功能规格: docs/03-specs/features/drizzle-orm-setup/feature-spec.md
- 行为规格: docs/03-specs/features/drizzle-orm-setup/behavior-spec.md
- API 规格: 无（基础设施，无 API）

## 验收标准

- [ ] `packages/server/src/db/schema.ts` 包含所有表定义（users、knowledge_bases、folders、documents、chunks、sessions、messages）
- [ ] 所有表定义与 PRD 数据模型一致（字段类型、约束、默认值、外键）
- [ ] `chunks` 表的 `embedding` 维度从配置读取，不硬编码（支持 OpenAI 1536 / bge 1024 等）
- [ ] `drizzle.config.ts` 配置正确，指向 PostgreSQL
- [ ] `pnpm db:generate` 可生成迁移文件
- [ ] `pnpm db:migrate` 可执行迁移
- [ ] `pnpm db:studio` 可打开 Drizzle Studio 查看数据
- [ ] 提供 `packages/server/src/db/index.ts` 导出类型安全的 db 实例
- [ ] 所有表导出对应的 TypeScript 类型（Select/Insert）

## 阻塞于

- i-00-core-interfaces（需要实现 IRepository 接口）
- i-01-docker-compose-infra（需要 PostgreSQL 服务运行）

## 范围外

- 种子数据
- 数据库性能优化（索引策略后续迭代）
- 多租户支持

## Agent 简报

**分类：** enhancement
**摘要：** 配置 Drizzle ORM + 数据库 Schema + 迁移流程

**当前行为：**
项目无数据库层，无 ORM 配置。

**期望行为：**
类型安全的数据库访问层就绪，可通过 Drizzle Studio 查看和管理数据，迁移流程可复现。

**关键接口：**
- `packages/server/src/db/schema.ts` — 全部表定义
- `packages/server/src/db/index.ts` — db 实例导出
- `drizzle.config.ts` — ORM 配置
- `package.json` scripts — `db:generate`、`db:migrate`、`db:studio`

**验收标准：**
- [ ] `packages/server/src/db/schema.ts` 包含所有表定义
- [ ] 所有表定义与 PRD 数据模型一致
- [ ] `drizzle.config.ts` 配置正确
- [ ] `pnpm db:generate` 可生成迁移文件
- [ ] `pnpm db:migrate` 可执行迁移
- [ ] `pnpm db:studio` 可打开 Drizzle Studio
- [ ] 提供类型安全的 db 实例导出
- [ ] 所有表导出对应的 TypeScript 类型

**范围外：**
- 种子数据
- 数据库性能优化
- 多租户支持
