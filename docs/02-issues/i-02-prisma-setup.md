状态: completed
分类: enhancement

## 要构建的内容

配置 Prisma ORM，定义数据库 schema，替换现有的 Drizzle ORM。

## 规格引用

- 功能规格: `docs/03-specs/features/prisma-setup/feature-spec.md`
- API 规格: `docs/03-specs/features/prisma-setup/api-spec.md`

## 背景

架构决策从 Drizzle ORM 迁移到 Prisma（ADR-0004 更新）。Prisma 提供更成熟的类型安全、迁移工具和生态集成。

## 验收标准

- [ ] `prisma/schema.prisma` — 完整数据模型定义
  - `User` — 用户表（id, email, name, avatar, password, createdAt, updatedAt）
  - `KnowledgeBase` — 知识库表（id, userId, name, description, isPinned, sortOrder, icon）
  - `Folder` — 虚拟文件夹表（id, kbId, parentId, name）
  - `Document` — 文档表（id, kbId, folderId, name, ext, mimeType, size, storageKey, hash, status, errorMessage）
  - `Chunk` — 文本块表（id, documentId, kbId, content, tokenCount, chunkIndex, milvusId）
  - `Session` — 会话表（id, userId, title, createdAt, updatedAt）
  - `Message` — 消息表（id, sessionId, role, content, createdAt）
  - `Setting` — 设置表（id, userId, key, value）
- [ ] `prisma/migrations/` — 初始迁移文件
- [ ] `src/processors/database/prisma.service.ts` — PrismaService（Injectable，OnModuleInit/OnModuleDestroy）
- [ ] `src/processors/database/database.module.ts` — DatabaseModule 导出 PrismaService
- [ ] `package.json` scripts：`prisma:generate`、`prisma:migrate`、`prisma:studio`
- [ ] `.env.example` 包含 `DATABASE_URL`
- [ ] `pnpm prisma:generate` 成功生成客户端
- [ ] `pnpm prisma:migrate` 成功应用到 PostgreSQL
- [ ] `pnpm type-check` 通过

## 阻塞于

- i-08-nestjs-server-setup（需要 NestJS 模块结构）

## 范围外

- 数据迁移工具（V1→V2 由 i-06 负责）
- 具体业务查询逻辑

## Agent 简报

**分类：** enhancement
**摘要：** Prisma ORM 配置和 Schema 定义，替换 Drizzle ORM

**当前行为：**
Drizzle ORM schema 已定义但需废弃。

**期望行为：**
Prisma schema 定义完成，客户端生成成功，数据库迁移完成。

**关键接口：**
- `prisma/schema.prisma` — 数据模型
- `src/processors/database/prisma.service.ts` — Prisma 服务

**验收标准：**
- [ ] 完整 schema 定义
- [ ] 初始迁移文件
- [ ] PrismaService 封装
- [ ] 生成和迁移成功
- [ ] type-check 通过

**范围外：**
- 数据迁移
- 业务查询逻辑
