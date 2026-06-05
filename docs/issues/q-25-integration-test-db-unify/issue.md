---
id: q-25
status: open
track: quality
priority: p0
summary: 集成测试数据库隔离统一化 — 消除共享库污染
blocked_by:
  - q-24
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

统一所有集成测试的数据库隔离策略，消除直接连接共享测试库 `goferbot_test` 的违规测试，确保每个测试文件独立创建/销毁数据库。

## 规格引用

- 功能规格: specs/feature-spec.md

## 补充说明

- 当前违规文件：`tests/integration/prisma-vector-indexer.spec.ts`、`tests/integration/vector-service.spec.ts`、`tests/integration/pgvector-store.spec.ts`、`tests/integration/infra.spec.ts`
- 这些测试直接使用 `new PrismaClient()` 连接 `goferbot_test`，无独立数据库隔离
- 改造后：统一使用 `TestDatabaseManager`（模式 A 或模式 B），与 `auth.spec.ts`、`admin-user-management.spec.ts` 等合规测试保持一致
- `q-24` 完成后执行，避免单元测试与集成测试改造冲突
