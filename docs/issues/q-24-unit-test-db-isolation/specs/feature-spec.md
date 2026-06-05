---
name: q-24-feature-spec
description: 单元测试数据库隔离治理功能规格
metadata:
  type: spec
  issue: q-24
---

# 功能规格：单元测试数据库隔离治理

## 用户故事

作为项目维护者，我希望单元测试与真实数据库完全隔离，以便测试执行快速、确定、不污染开发环境。

## 边界

### 范围内
- `tests/setup/testglobals.ts` 增加数据库连接保护机制
- `tests/unit/server/prisma-pagination.spec.ts` 改造为纯 Mock 模式
- `tests/unit/server/session.service.spec.ts` 改造为纯 Mock 模式
- 开发数据库残留测试数据清理

### 范围外
- 集成测试改造（见 q-25）
- E2E 测试改造（见 q-26）
- 新增业务模块测试（见 q-27）
- 前端单元测试（已合规，无需改造）

## 涉及组件

- `tests/setup/testglobals.ts` — 单元测试全局 setup
- `tests/unit/server/prisma-pagination.spec.ts` — Prisma 分页扩展测试
- `tests/unit/server/session.service.spec.ts` — SessionService 测试
- `packages/server/src/processors/database/prisma.service.ts` — PrismaService（被测依赖）
- `packages/server/src/modules/session/session.service.ts` — SessionService（被测对象）

## 相关规范

- `docs/guide/testing/unit-testing-guide.md` — 单元测试指南（核心依据）
- `docs/guide/testing/README.md` — 测试体系总览（分层职责）

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 单元测试全面 Mock 化 | 与现有规范一致，indexing-worker.spec.ts 已验证模式 | 否（规范要求） |
| testglobals.ts 增加硬阻断 | 防止未来新增测试再次违规，比软警告更可靠 | 是（可降级为警告） |
| 不引入 vitest-mock-extended | 现有 vi.fn() 模式已足够，减少依赖 | 是 |

## 验收标准

| ID | 标准 | 验证方式 |
|----|------|----------|
| AC-01 | testglobals.ts 增加保护逻辑，单元测试尝试连接非 _test 数据库时抛出错误 | 运行 `pnpm test`，观察阻断行为 |
| AC-02 | prisma-pagination.spec.ts 使用 mockPrisma，测试通过且不连接真实数据库 | `pnpm vitest run tests/unit/server/prisma-pagination.spec.ts` |
| AC-03 | session.service.spec.ts 使用 mockPrisma，测试通过且不连接真实数据库 | `pnpm vitest run tests/unit/server/session.service.spec.ts` |
| AC-04 | 全部单元测试通过 | `pnpm test` |
| AC-05 | 开发数据库 users 表无测试残留数据（session-test@、paginate-* 等） | SQL 查询验证 |
