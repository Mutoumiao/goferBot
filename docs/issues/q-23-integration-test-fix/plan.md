---
id: q-23
issue: issue.md
version: 1
---

# 集成测试层修复计划

> **目标：** 修复集成测试层所有 broken 文件，使全部可用
> **架构：** vitest 集成测试，Playwright → vitest 语法转换
> **技术栈：** vitest + Playwright（仅 E2E 层）

**Issue 引用：** `issue.md`
**Spec 引用：** `specs/`
**测试引用：** `tests/integration/`

---

## 文件结构

### 测试（修改）

- `tests/integration/infra.spec.ts` — 修改：Playwright → vitest 语法
- `tests/integration/kb-lifecycle.spec.ts` — 修改：Playwright → vitest 语法
- `tests/integration/rag-e2e.spec.ts` — 修改：运行时错误诊断与修复
- `tests/integration/rag-real.spec.ts` — 验证：Docker 环境下通过

### 排除（E2E 测试，不在集成层修复）

- `tests/integration/auth-flow.spec.ts` — 使用 AuthPage POM，属于 E2E 层

### 可选（删除）

- `tests/integration/sidecar/*.spec.ts` — 5 个遗留文件

---

## 任务列表

### 任务 1: 修复 infra.spec.ts

**文件：**
- 修改：`tests/integration/infra.spec.ts`

**规格引用：**
- api-spec.md "语法转换规范"

- [ ] **步骤 1: 替换导入**
  ```typescript
  // 旧
  import { test, expect } from '@playwright/test'
  
  // 新
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  ```

- [ ] **步骤 2: 替换语法**
  - `test.describe(` → `describe(`
  - `test(` → `it(`
  - `test.beforeAll(` → `beforeAll(`
  - `test.afterAll(` → `afterAll(`

- [ ] **步骤 3: 检查并移除 Playwright 特有 API**
  - 如使用 `page.goto()`、`page.click()` 等，需移除（集成测试层不使用浏览器）
  - 如测试逻辑依赖浏览器，考虑移至 E2E 层或重写为 API 测试

- [ ] **步骤 4: 运行验证**
  ```bash
  npx vitest run tests/integration/infra.spec.ts
  ```

---

### 任务 2: 修复 kb-lifecycle.spec.ts

**文件：**
- 修改：`tests/integration/kb-lifecycle.spec.ts`

**规格引用：**
- api-spec.md "语法转换规范"

- [ ] **步骤 1~4:** 同任务 1

---

### 任务 3: 修复 rag-e2e.spec.ts

**文件：**
- 修改：`tests/integration/rag-e2e.spec.ts`

**规格引用：**
- api-spec.md "运行时错误诊断"

**注意**：`./teardown.js` 文件实际存在，错误非"模块缺失"。需先运行查看真正错误。

- [ ] **步骤 1: 运行并查看实际错误**
  ```bash
  npx vitest run tests/integration/rag-e2e.spec.ts 2>&1 | head -50
  ```

- [ ] **步骤 2: 根据实际错误修复**
  - 可能是 pgvector 相关断言需要更新
  - 可能是 Milvus 相关检测需要移除
  - 可能是其他运行时错误

- [ ] **步骤 3: 运行验证**
  ```bash
  npx vitest run tests/integration/rag-e2e.spec.ts
  ```

---

### 任务 4: 验证 q-22 真实链路

**文件：**
- 验证：`tests/integration/rag-real.spec.ts`

**规格引用：**
- api-spec.md "q-22 验证规范"

- [ ] **步骤 1: 启动 Docker 基础设施**
  ```bash
  docker-compose up -d
  ```

- [ ] **步骤 2: 运行 q-22 测试**
  ```bash
  npx vitest run tests/integration/rag-real.spec.ts --reporter=verbose
  ```

- [ ] **步骤 3: 确认非跳过**
  - 检查输出：不应有 `[SKIP] 基础设施不可用`
  - 检查输出：应有 `✓ AC-03`、`✓ AC-04`、`✓ AC-05`

- [ ] **步骤 4: 如跳过，排查基础设施**
  ```bash
  # 检查各服务端口
  docker ps
  # 检查 PG
  docker exec goferbot-postgres pg_isready
  # 检查 Redis
  redis-cli ping
  # 检查 MinIO
  curl http://localhost:9000/minio/health/live
  ```

---

### 任务 5: 全量集成测试验证

- [ ] **步骤 1: 运行全部集成测试**
  ```bash
  npx vitest run --config vitest.integration.config.ts
  ```

- [ ] **步骤 2: 确认全部通过**
  - 预期：所有测试文件 pass，无 fail，无 skip（q-22 除外，如基础设施不可用则 skip 是预期行为）

---

### 任务 6: 清理 sidecar/ 遗留文件（可选）

- [ ] **步骤 1: 检查 sidecar/ 文件**
  ```bash
  ls tests/integration/sidecar/
  ```

- [ ] **步骤 2: 确认与当前架构无关后删除**
  ```bash
  rm -rf tests/integration/sidecar/
  ```

- [ ] **步骤 3: 验证无引用残留**
  ```bash
  grep -r "sidecar" tests/ --include="*.ts" || echo "No sidecar references"
  ```

---

## 规格覆盖检查

- [ ] 功能规格：AC-01~AC-07 全部覆盖
- [ ] API 规格：语法转换规范、模块缺失修复、q-22 验证规范全部覆盖
- [ ] 无占位符（"TODO" / "稍后实现" / "TBD"）

---

## 阻塞与依赖

- 阻塞于：b-13（需要 Indexer 正确工作，q-22 才能验证索引链路）
- 阻塞下游：q-17-rev（需要集成测试基础设施完整）
