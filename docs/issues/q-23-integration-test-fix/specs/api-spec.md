# API 规格：集成测试层修复

## 语法转换规范

### Playwright → vitest 映射

| Playwright | vitest | 说明 |
|------------|--------|------|
| `test.describe(name, fn)` | `describe(name, fn)` | 测试套件 |
| `test(name, fn)` | `it(name, fn)` | 测试用例 |
| `test.beforeAll(fn)` | `beforeAll(fn)` | 全局前置 |
| `test.afterAll(fn)` | `afterAll(fn)` | 全局后置 |
| `test.beforeEach(fn)` | `beforeEach(fn)` | 每个用例前置 |
| `test.afterEach(fn)` | `afterEach(fn)` | 每个用例后置 |
| `test.skip()` | `it.skip()` | 跳过 |
| `test.only()` | `it.only()` | 独占 |

### 导入变更

```typescript
// 旧（Playwright）
import { test, expect } from '@playwright/test'

// 新（vitest）
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
```

## 文件修复清单

### auth-flow.spec.ts

**问题**：使用 `test.describe()` 和 `test()`
**修复**：
1. 替换导入：`@playwright/test` → `vitest`
2. 替换 `test.describe` → `describe`
3. 替换 `test(` → `it(`
4. 检查是否有 Playwright 特有 API（如 `page.goto`），如有需移除或替换

### infra.spec.ts

**问题**：同上
**修复**：同上

### kb-lifecycle.spec.ts

**问题**：同上
**修复**：同上

### rag-e2e.spec.ts

**问题**：导入 `./teardown.js` 模块缺失
**修复**：
1. 检查 `teardown.js` 是否存在
2. 如存在但路径错误，修正导入路径
3. 如不存在，检查是否可移除该导入（可能是不必要的）
4. 如需要该模块，创建最小实现

## q-22 验证规范

### 运行条件

```bash
# 1. 启动基础设施
docker-compose up -d

# 2. 运行集成测试（含 q-22）
npx vitest run --config vitest.integration.config.ts

# 3. 确认 q-22 非跳过
# 预期：rag-real.spec.ts 的 3 个 it() 全部执行（非 console.log('[SKIP]')）
```

### 预期结果

| 测试文件 | 预期状态 |
|----------|----------|
| `rag-real.spec.ts` | 3 个 AC 全部 pass |
| `auth-flow.spec.ts` | 修复后 pass |
| `infra.spec.ts` | 修复后 pass |
| `kb-lifecycle.spec.ts` | 修复后 pass |
| `rag-e2e.spec.ts` | 修复后 pass |

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 语法转换验证 | `tests/integration/auth-flow.spec.ts` | AC-01: vitest describe/it 运行无报错 |
| 语法转换验证 | `tests/integration/infra.spec.ts` | AC-02: vitest describe/it 运行无报错 |
| 语法转换验证 | `tests/integration/kb-lifecycle.spec.ts` | AC-03: vitest describe/it 运行无报错 |
| 模块缺失修复 | `tests/integration/rag-e2e.spec.ts` | AC-04: 导入无模块缺失错误 |
| 真实链路验证 | `tests/integration/rag-real.spec.ts` | AC-05: Docker 环境下 3 AC 全部通过 |
| 全量通过 | 全部集成测试 | AC-06: npx vitest run --config vitest.integration.config.ts 全部通过 |
