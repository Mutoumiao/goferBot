---
name: backend-rules
description: 后端编码规范导航与核心约束
globs:
  - "packages/server/**"
  - "tests/unit/server/**"
  - "tests/integration/**"
---

# 后端编码规范导航

## 首次阅读
首次编辑后端代码前，阅读 `docs/guide/backend/README.md`。

## 核心约束（已读过则以此为准）

- 框架：NestJS 10 + Fastify + Prisma 5
- 验证：Zod + nestjs-zod，禁止 class-validator / class-transformer
- 认证：JWT + bcrypt，使用 `@UseGuards(JwtAuthGuard)` + `@CurrentUser()`
- 数据库：PostgreSQL 16 + pgvector，Prisma 查询通过 `PrismaService` 注入
- 响应：直接返回原始数据，由 `ResponseInterceptor` 统一包装为 `{ data: T }`
- 异常：由全局 `ExceptionFilter` 捕获，Service 层抛出 NestJS 内置异常

## 涉及以下场景时，阅读对应文档

| 场景 | 文档 |
|------|------|
| 编写 DTO / API / Controller | `docs/guide/backend/conventions.md` |
| 代码审查 / 验收 | `docs/guide/backend/architecture-compliance.md` |
| 编写测试 | `docs/guide/testing/README.md` |
