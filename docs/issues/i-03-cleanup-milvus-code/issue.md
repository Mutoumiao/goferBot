---
id: i-03
status: open
track: infra
priority: p2
summary: 清理 Milvus 相关代码和依赖，完成 ADR 0005 迁移
blocked_by:
  - q-23
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

删除所有 Milvus 相关代码和依赖，完成 ADR 0005 的清理阶段。

包含：
- 删除 `packages/server/src/vector/milvus.ts`
- 删除 `packages/server/src/processors/indexing/prisma-milvus.indexer.ts`
- 更新 `packages/server/package.json`：移除 `@zilliz/milvus2-sdk-node`
- 验证无 Milvus 引用残留
- 更新文档（ADR 0005、handoff）

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 验收标准

- [ ] `packages/server/src/vector/milvus.ts` 已删除
- [ ] `packages/server/src/processors/indexing/prisma-milvus.indexer.ts` 已删除
- [ ] `packages/server/package.json` 无 `@zilliz/milvus2-sdk-node`
- [ ] 代码中无 `MilvusVectorStore` 引用
- [ ] 代码中无 `PrismaMilvusIndexer` 引用
- [ ] 代码中无 `MILVUS_` 环境变量引用
- [ ] `pnpm install` 后 node_modules 无 milvus 相关包
- [ ] `pnpm type-check` 通过
- [ ] `npx vitest run tests/unit` 全部通过

## 阻塞于

- q-23：需要确认所有 Milvus 依赖已无需使用

## 范围外

- 新增功能
- 测试逻辑修改
- 数据库数据清理（当前无生产数据）

## Agent 简报

**分类：** refactor
**摘要：** 清理 Milvus 相关代码和依赖，完成架构迁移

**当前行为：**
- `packages/server/src/vector/milvus.ts` 仍存在（9.3K）
- `packages/server/src/processors/indexing/prisma-milvus.indexer.ts` 仍存在
- `packages/server/package.json` 可能包含 `@zilliz/milvus2-sdk-node`
- `.env.example` 可能包含 `MILVUS_*` 变量

**期望行为：**
- 所有 Milvus 相关代码和依赖已删除
- 项目无 Milvus 引用残留
- ADR 0005 实施完成

**关键接口：**
- `packages/server/src/vector/milvus.ts`
- `packages/server/src/processors/indexing/prisma-milvus.indexer.ts`
- `packages/server/package.json`

**验收标准：**
- [ ] milvus.ts 删除
- [ ] prisma-milvus.indexer.ts 删除
- [ ] package.json 清理
- [ ] 无引用残留
- [ ] 测试通过

**范围外：**
- 新功能
- 数据迁移
