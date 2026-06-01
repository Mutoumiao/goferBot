---
id: i-03
issue: issue.md
version: 1
---

# Milvus 代码清理计划

> **目标：** 删除所有 Milvus 相关代码和依赖，完成 ADR 0005 迁移
> **架构：** 纯 pgvector，无 Milvus 依赖
> **技术栈：** NestJS + Prisma + pgvector

**Issue 引用：** `issue.md`
**Spec 引用：** `specs/`

---

## 文件结构

### 删除

- `packages/server/src/vector/milvus.ts`
- `packages/server/src/processors/indexing/prisma-milvus.indexer.ts`

### 修改

- `packages/server/package.json` — 移除 `@zilliz/milvus2-sdk-node`
- `.env.example` — 移除 `MILVUS_*` 变量（如 i-02 未处理）

---

## 任务列表

### 任务 1: 删除 Milvus 代码文件

**文件：**
- 删除：`packages/server/src/vector/milvus.ts`
- 删除：`packages/server/src/processors/indexing/prisma-milvus.indexer.ts`

**规格引用：**
- api-spec.md "删除文件清单"

- [ ] **步骤 1: 确认无运行时依赖**
  ```bash
  grep -r "MilvusVectorStore" packages/server/src/ --include="*.ts"
  grep -r "PrismaMilvusIndexer" packages/server/src/ --include="*.ts"
  ```
  预期：无输出（b-12/b-13 已切换）

- [ ] **步骤 2: 删除文件**
  ```bash
  rm packages/server/src/vector/milvus.ts
  rm packages/server/src/processors/indexing/prisma-milvus.indexer.ts
  ```

- [ ] **步骤 3: 验证删除**
  ```bash
  ls packages/server/src/vector/milvus.ts 2>/dev/null || echo "Deleted"
  ls packages/server/src/processors/indexing/prisma-milvus.indexer.ts 2>/dev/null || echo "Deleted"
  ```

---

### 任务 2: 清理 package.json

**文件：**
- 修改：`packages/server/package.json`

**规格引用：**
- api-spec.md "依赖清理"

- [ ] **步骤 1: 移除依赖**
  ```bash
  # 手动编辑 package.json，移除 @zilliz/milvus2-sdk-node
  ```

- [ ] **步骤 2: 重新安装**
  ```bash
  pnpm install
  ```

- [ ] **步骤 3: 验证**
  ```bash
  ls node_modules/@zilliz 2>/dev/null || echo "No @zilliz packages"
  ```

---

### 任务 3: 检查引用残留

- [ ] **步骤 1: 全局搜索 Milvus 引用**
  ```bash
  grep -r "Milvus" packages/server/src/ --include="*.ts" || echo "No Milvus references"
  grep -r "MILVUS" packages/server/src/ --include="*.ts" || echo "No MILVUS references"
  grep -r "milvus" packages/server/src/ --include="*.ts" || echo "No milvus references"
  ```

- [ ] **步骤 2: 检查 .env 文件**
  ```bash
  grep -r "MILVUS" .env* || echo "No MILVUS in env files"
  ```

- [ ] **步骤 3: 检查配置**
  ```bash
  grep -r "MILVUS" packages/server/src/config/ --include="*.ts" || echo "No MILVUS in config"
  ```

---

### 任务 4: 全局验证

- [ ] **步骤 1: 类型检查**
  ```bash
  pnpm type-check
  ```

- [ ] **步骤 2: 单元测试**
  ```bash
  npx vitest run tests/unit
  ```

- [ ] **步骤 3: 集成测试**
  ```bash
  npx vitest run --config vitest.integration.config.ts
  ```

---

## 规格覆盖检查

- [ ] 功能规格：AC-01~AC-09 全部覆盖
- [ ] API 规格：删除文件清单、依赖清理、引用检查全部覆盖
- [ ] 无占位符（"TODO" / "稍后实现" / "TBD"）

---

## 阻塞与依赖

- 阻塞于：q-23（需要确认所有 Milvus 依赖已无需使用）
- 阻塞下游：无（本 issue 是重建计划最后一步）
