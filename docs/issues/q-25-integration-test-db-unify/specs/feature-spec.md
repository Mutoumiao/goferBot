---
name: q-25-feature-spec
description: 集成测试数据库隔离统一化功能规格
metadata:
  type: spec
  issue: q-25
---

# 功能规格：集成测试数据库隔离统一化

## 背景

项目测试架构规范（`docs/guide/testing/integration-testing-guide.md`）定义了两种数据库生命周期模式：
- **模式 A**：每个 `it()` 独立数据库（标准模式）
- **模式 B**：`beforeAll` 共享数据库 + `beforeEach` 清理（复杂场景）

但当前部分集成测试直接连接共享测试库 `goferbot_test`，造成：
1. 测试间数据污染（无隔离）
2. 测试中断后数据残留
3. 与规范要求的 `TestDatabaseManager` 模式脱节

## 目标

1. 所有集成测试统一使用 `TestDatabaseManager` 创建独立数据库
2. 消除对 `goferbot_test` 共享库的直接依赖
3. 建立集成测试数据库隔离的标准模板

## 范围

### 包含
- `tests/integration/prisma-vector-indexer.spec.ts` → 模式 A
- `tests/integration/vector-service.spec.ts` → 模式 A/B
- `tests/integration/pgvector-store.spec.ts` → 模式 A/B
- `tests/integration/infra.spec.ts` → 模式 B
- 清理 `goferbot_test` 残留数据

### 不包含
- 单元测试改造（见 q-24）
- E2E 测试改造（见 q-26）
- 新增业务测试（见 q-27）

## 边界场景

| 场景 | 触发条件 | 预期行为 |
|------|----------|----------|
| TEST_DATABASE_ADMIN_URL 未设置 | 环境变量缺失 | `TestDatabaseManager.createDatabase()` 抛出明确错误 `'TEST_DATABASE_ADMIN_URL is not set'`，测试失败 |
| 数据库创建失败 | PostgreSQL 连接数耗尽或权限不足 | `execSync('npx prisma migrate deploy')` 抛出错误，`createDatabase` 自动调用 `dropDatabase` 清理后重新抛出，测试失败 |
| 测试进程被杀死 | Ctrl+C 或超时 | `afterAll` / `finally` 块可能未执行，残留数据库由 `TestDatabaseManager` 的随机命名机制隔离，不影响后续测试。非本 issue 范围，建议定期手动清理 `goferbot_test_*` 数据库 |
| 并发命名冲突 | 高并发下两个 it 同时创建数据库 | `TestDatabaseManager` 使用 `Date.now() + Math.random()` 生成数据库名，冲突概率极低。若冲突发生，PostgreSQL `CREATE DATABASE` 会报错，测试失败 |
| 模式 A 性能开销 | 每个 it 创建/迁移/销毁数据库 | 单个 it 增加 3-6 秒，20 个 it 预计增加 60-120 秒。可接受范围内，若未来成为瓶颈可迁移至模式 B |

## 验收标准

| ID | 标准 | 验证方式 |
|----|------|----------|
| AC-01 | prisma-vector-indexer.spec.ts 每个 it 使用独立数据库 | 运行测试，观察数据库创建/销毁日志 |
| AC-02 | vector-service.spec.ts 使用独立数据库 | 运行测试通过 |
| AC-03 | pgvector-store.spec.ts 使用独立数据库 | 运行测试通过 |
| AC-04 | infra.spec.ts 使用模式 B（共享库 + TRUNCATE） | 运行测试通过 |
| AC-05 | 全部集成测试通过 | pnpm test:integration |
| AC-06 | goferbot_test 数据库无测试残留数据 | SQL 查询验证 |
