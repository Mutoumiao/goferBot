# 功能规格：pgvector 基础设施迁移

## 概述

将向量存储基础设施从 Milvus 迁移至 PostgreSQL pgvector 扩展，为后续 VectorService 和 Indexer 重写提供基础。

## 功能边界

### 范围内

- Docker Compose 配置更新
- Prisma Schema 更新
- 环境变量模板更新
- 迁移文件生成

### 范围外

- 应用代码修改（VectorService、Indexer 等）
- 数据迁移（当前无生产数据）
- 测试代码修改

## 验收标准

| ID | 标准 | 优先级 |
|----|------|--------|
| AC-01 | docker-compose.dev.yml 移除 milvus 服务，postgres 使用 pgvector/pgvector:pg16 镜像 | P0 |
| AC-02 | Prisma Schema 中 Chunk 模型添加 `embedding Unsupported("vector(1536)")?`，移除 `milvusId` | P0 |
| AC-03 | 生成新的 Prisma 迁移文件 | P0 |
| AC-04 | .env.example 移除 MILVUS_HOST, MILVUS_PORT, MILVUS_COLLECTION, MILVUS_VECTOR_DIM | P0 |
| AC-05 | docker-compose up 后，PostgreSQL 内可执行 `CREATE EXTENSION IF NOT EXISTS vector` | P0 |
| AC-06 | pnpm type-check 通过 | P0 |

## 技术约束

- 不破坏现有应用代码（即使代码仍引用 milvusId，也不在本 issue 修复）
- 保留现有数据卷（.data/postgres），但需确认 pgvector 镜像兼容现有数据
- 迁移文件需可回滚

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 pgvector/pgvector:pg16 官方镜像 | 官方维护，包含 pgvector 扩展预装 | 是 |
| 保留 .data/postgres 卷 | 避免数据丢失（虽然当前无生产数据） | 是 |
| 使用 Prisma Unsupported() 类型 | Prisma 原生不支持 vector 类型 | 否（Prisma 限制） |
