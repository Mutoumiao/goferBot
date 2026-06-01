# 功能规格：Milvus 代码清理

## 概述

删除所有 Milvus 相关代码和依赖，完成 ADR 0005（pgvector 替代 Milvus）的清理阶段。

## 功能边界

### 范围内

- `milvus.ts` 删除
- `prisma-milvus.indexer.ts` 删除
- `package.json` 依赖清理
- 环境变量模板清理
- 引用残留检查

### 范围外

- 新功能开发
- 测试逻辑修改
- 数据库数据清理

## 验收标准

| ID | 标准 | 优先级 |
|----|------|--------|
| AC-01 | `packages/server/src/vector/milvus.ts` 已删除 | P2 |
| AC-02 | `packages/server/src/processors/indexing/prisma-milvus.indexer.ts` 已删除 | P2 |
| AC-03 | `packages/server/package.json` 无 `@zilliz/milvus2-sdk-node` | P2 |
| AC-04 | 代码中无 `MilvusVectorStore` 引用 | P2 |
| AC-05 | 代码中无 `PrismaMilvusIndexer` 引用 | P2 |
| AC-06 | 代码中无 `MILVUS_` 环境变量引用 | P2 |
| AC-07 | `pnpm install` 后 node_modules 无 milvus 相关包 | P2 |
| AC-08 | `pnpm type-check` 通过 | P2 |
| AC-09 | `npx vitest run tests/unit` 全部通过 | P2 |

## 技术约束

- 确保所有引用方已切换到 pgvector 实现
- 删除前确认无运行时依赖

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 保留 Milvus 文件直到 q-23 完成 | 降低回滚风险 | 是 |
| 删除而非归档 | 代码在 git 历史中存在，无需额外归档 | 否 |
