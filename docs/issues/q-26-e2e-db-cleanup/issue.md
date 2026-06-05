---
id: q-26
status: open
track: quality
priority: p0
summary: E2E 测试数据库清理机制 — 防止数据无限累积
blocked_by:
  - q-25
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

为 E2E 测试建立数据库清理机制，解决 `goferbot_e2e` 数据库随每次运行线性增长的问题。

## 规格引用

- 功能规格: specs/feature-spec.md

## 补充说明

- 当前问题：`playwright.global-teardown.ts` 仅关闭后端进程，不清理数据库
- `fixtures/auth.ts` 的 `createTestUser()` 每次生成新用户，无配套删除逻辑
- 改造后：globalTeardown 中调用 `cleanupDatabase()`，或在测试级别增加 `test.afterEach` 清理
- `q-25` 完成后执行，确保集成测试和 E2E 的清理策略不冲突
