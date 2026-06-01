# 功能规格：集成测试层修复

## 概述

修复集成测试层所有无法运行的文件，使集成测试层从"1 active + 4 broken"变为"全部可用"。

## 功能边界

### 范围内

- Playwright → vitest 语法转换（3 个文件）
- 模块缺失修复（1 个文件）
- q-22 真实链路验证
- sidecar/ 遗留文件清理（可选）

### 范围外

- 新增测试用例
- E2E 测试修改
- 单元测试修改

## 验收标准

| ID | 标准 | 优先级 |
|----|------|--------|
| AC-01 | `auth-flow.spec.ts` 使用 vitest `describe()` 替代 Playwright `test.describe()` | P0 |
| AC-02 | `infra.spec.ts` 使用 vitest `describe()` 替代 Playwright `test.describe()` | P0 |
| AC-03 | `kb-lifecycle.spec.ts` 使用 vitest `describe()` 替代 Playwright `test.describe()` | P0 |
| AC-04 | `rag-e2e.spec.ts` 解决 `./teardown.js` 模块缺失问题 | P0 |
| AC-05 | `rag-real.spec.ts` 在 Docker 环境下 3 个 AC 全部通过（非跳过） | P0 |
| AC-06 | `npx vitest run --config vitest.integration.config.ts` 全部通过 | P0 |
| AC-07 | 可选：删除 `tests/integration/sidecar/` 遗留文件 | P2 |

## 技术约束

- 保持测试逻辑不变，仅修改语法/导入
- 不引入新的测试依赖
- q-22 验证需要 Docker 环境运行

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| Playwright → vitest 语法转换 | 集成测试层使用 vitest 配置，Playwright 语法不兼容 | 否 |
| 补充缺失模块而非删除导入 | 保留测试逻辑完整性 | 是 |
| sidecar/ 文件删除 | 与当前架构无关，减少噪音 | 否 |
