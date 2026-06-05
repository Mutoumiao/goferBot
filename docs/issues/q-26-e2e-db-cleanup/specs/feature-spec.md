---
name: q-26-feature-spec
description: E2E 测试数据库清理机制功能规格
metadata:
  type: spec
  issue: q-26
---

# 功能规格：E2E 测试数据库清理机制

## 背景

项目 E2E 测试指南（`docs/guide/testing/e2e-testing-guide.md`）定义了 `globalSetup` 和 `globalTeardown` 的职责，但 `globalTeardown` 当前仅关闭后端进程，不包含数据库清理。

实际运行中：
1. `playwright.global-setup.ts` 创建 `goferbot_e2e` 数据库并执行 migrate
2. 每次 E2E 测试通过 `createTestUser()` 创建新用户（带 `Date.now()` 后缀）
3. `playwright.global-teardown.ts` 仅关闭进程，不清理数据
4. `users` 表随每次运行线性增长，影响后续测试性能和可靠性

## 目标

1. E2E 测试结束后自动清理数据库数据
2. 提供配套的测试用户删除机制
3. 验证清理机制有效（多次运行无数据累积）

## 范围

### 包含
- `tests/e2e/playwright.global-teardown.ts` 增加数据库清理
- `tests/e2e/fixtures/auth.ts` 增加 `deleteTestUser()`
- 关键 E2E 测试文件增加 `test.afterEach` 清理
- 更新 `e2e-testing-guide.md` 文档

### 不包含
- 单元测试改造（见 q-24）
- 集成测试改造（见 q-25）
- 新增业务测试（见 q-27）

## 验收标准

| ID | 标准 | 验证方式 |
|----|------|----------|
| AC-01 | globalTeardown 调用 cleanupDatabase() 清理所有业务表 | 运行 E2E 后查询 users 表 count |
| AC-02 | fixtures/auth.ts 支持 deleteTestUser(email) 和 deleteTestUser(id) | 代码审查 + 单元测试 |
| AC-03 | 关键测试文件（flows/ 下）增加 test.afterEach 清理 | 代码审查 |
| AC-04 | 全部 E2E 测试通过 | pnpm test:e2e |
| AC-05 | 连续运行两次 E2E，第二次运行时 users 表无上一轮数据 | SQL 查询验证 |
