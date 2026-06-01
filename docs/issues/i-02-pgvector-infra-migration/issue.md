---
id: i-02
status: closed
track: infra
priority: p0
summary: Docker Compose 与 Prisma Schema 更新，移除 Milvus，启用 PostgreSQL pgvector 扩展
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

将基础设施从 Milvus + PostgreSQL 分离架构迁移至 PostgreSQL pgvector 统一架构。

包含：
- `docker-compose.dev.yml` 更新：移除 milvus 服务，postgres 改用 pgvector 镜像
- Prisma Schema 更新：Chunk 模型添加 embedding 列，移除 milvusId
- 迁移文件生成
- `.env.example` 更新：移除 MILVUS_* 变量

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 验收标准

- [ ] `docker-compose up` 后 PG 容器内含 pgvector 扩展
- [ ] `prisma migrate dev` 成功生成新迁移
- [ ] `prisma db push` 或 `migrate deploy` 后表结构正确
- [ ] `pnpm type-check` 通过
- [ ] 现有单元测试不受影响

## 阻塞于

无

## 范围外

- VectorService 重写（b-12 处理）
- Indexer 重写（b-13 处理）
- 数据迁移（当前无生产数据）

## Agent 简报

**分类：** refactor
**摘要：** 将向量存储基础设施从 Milvus 迁移至 PostgreSQL pgvector

**当前行为：**
- docker-compose.dev.yml 包含 milvus 服务
- postgres 使用 postgres:16-alpine 镜像（无 pgvector）
- Prisma Schema 中 Chunk 模型有 milvusId 字段，无 embedding 字段
- .env.example 包含 MILVUS_HOST, MILVUS_PORT, MILVUS_COLLECTION, MILVUS_VECTOR_DIM

**期望行为：**
- docker-compose.dev.yml 只有 postgres/minio/redis 三个服务
- postgres 使用 pgvector/pgvector:pg16 镜像
- Chunk 模型有 embedding Unsupported("vector(1536)")? 字段，无 milvusId
- .env.example 无 MILVUS_* 变量

**关键接口：**
- `docker-compose.dev.yml`
- `packages/server/prisma/schema.prisma`
- `.env.example`

**验收标准：**
- [ ] docker-compose up 后 PG 容器内含 pgvector 扩展
- [ ] prisma migrate dev 成功
- [ ] pnpm type-check 通过

**范围外：**
- VectorService 重写
- Indexer 重写
