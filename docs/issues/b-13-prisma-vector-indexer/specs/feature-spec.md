# 功能规格：PrismaVectorIndexer

## 概述

重写索引器为 `PrismaVectorIndexer`，实现元数据与向量在同一 PostgreSQL 事务中写入，彻底消除双写不一致。

## 功能边界

### 范围内

- `PrismaVectorIndexer` 类实现（单事务写入）
- `computeTokenCounts` 逻辑（精确 usage > 总量分配 > 估算）
- `ON CONFLICT` 重试支持
- 单元测试

### 范围外

- `PrismaMilvusIndexer` 删除（i-03 处理）
- 调用方修改（IndexingWorker、DocumentService）
- 性能优化（批量插入等）

## 验收标准

| ID | 标准 | 优先级 |
|----|------|--------|
| AC-01 | `PrismaVectorIndexer` 实现 SDK `IIndexer` 接口 | P0 |
| AC-02 | `index()` 使用 `$transaction` 单事务写入所有 chunks + vectors | P0 |
| AC-03 | 优先使用 embedder 提供的精确 `tokenCount` | P0 |
| AC-04 | 无 usage 时回退到 chunker 估算值 | P0 |
| AC-05 | `ON CONFLICT (id) DO UPDATE` 支持 Worker 重试 | P0 |
| AC-06 | 不依赖 `VectorService`，直接操作 Prisma | P0 |
| AC-07 | 空 chunks 数组时直接返回，不报错 | P1 |
| AC-08 | 单元测试覆盖正常索引、重试、空 chunks | P0 |
| AC-09 | `pnpm type-check` 通过 | P0 |

## 技术约束

- 使用 Prisma `$transaction` + `$executeRaw` 实现单事务
- 向量使用 `::vector` 类型转换插入
- `ON CONFLICT` 处理重试时避免唯一键冲突

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 单事务写入 | ADR 0005 核心目标：消除双写不一致 | 否 |
| 不依赖 VectorService | 直接操作 Prisma 更简单，减少依赖层级 | 是 |
| ON CONFLICT 而非先删后插 | Worker 重试场景更安全，避免数据丢失窗口 | 是 |
