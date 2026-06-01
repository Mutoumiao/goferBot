---
id: i-02
issue: issue.md
version: 1
---

# pgvector 基础设施迁移计划

> **目标：** 将 Docker 基础设施和数据库 Schema 从 Milvus 迁移至 PostgreSQL pgvector
> **架构：** Docker Compose 三服务（PG+MinIO+Redis），Prisma Schema 统一存储元数据与向量
> **技术栈：** Docker Compose + Prisma + PostgreSQL pgvector

**Issue 引用：** `issue.md`
**Spec 引用：** `specs/`

---

## 文件结构

### 基础设施（修改）

- `docker-compose.dev.yml` — 移除 milvus，更新 postgres 镜像
- `.env.example` — 移除 MILVUS_* 变量
- `packages/server/prisma/schema.prisma` — 更新 Chunk 模型
- `packages/server/prisma/migrations/` — 新增迁移文件

---

## 任务列表

### 任务 1: 更新 Docker Compose

**文件：**
- 修改：`docker-compose.dev.yml`

**规格引用：**
- feature-spec.md AC-01
- api-spec.md "Docker Compose 服务变更"

- [ ] **步骤 1: 备份原文件**
  ```bash
  cp docker-compose.dev.yml docker-compose.dev.yml.bak
  ```

- [ ] **步骤 2: 移除 milvus 服务**
  - 删除整个 `milvus:` 服务块
  - 删除 `milvus` 的 volumes 声明
  - 删除 `milvus` 的 networks 引用

- [ ] **步骤 3: 更新 postgres 镜像**
  - 将 `image: postgres:16-alpine` 改为 `image: pgvector/pgvector:pg16`

- [ ] **步骤 4: 验证 docker-compose 语法**
  ```bash
  docker-compose -f docker-compose.dev.yml config
  ```

- [ ] **步骤 5: 启动并验证 pgvector 扩展**
  ```bash
  docker-compose up -d postgres
  docker exec goferbot-postgres psql -U gofer -d goferbot -c "CREATE EXTENSION IF NOT EXISTS vector;"
  docker exec goferbot-postgres psql -U gofer -d goferbot -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
  ```

---

### 任务 2: 更新 Prisma Schema

**文件：**
- 修改：`packages/server/prisma/schema.prisma`

**规格引用：**
- feature-spec.md AC-02
- api-spec.md "Chunk 模型（Prisma）"

- [ ] **步骤 1: 移除 milvusId 字段**
  - 删除 `milvusId String? @map("milvus_id")` 行

- [ ] **步骤 2: 添加 embedding 字段**
  - 在 `chunkIndex` 后添加：`embedding Unsupported("vector(1536)")?`

- [ ] **步骤 3: 验证 Schema 语法**
  ```bash
  cd packages/server && npx prisma validate
  ```

---

### 任务 3: 生成迁移文件

**文件：**
- 新增：`packages/server/prisma/migrations/20250601_add_pgvector_embedding/migration.sql`

**规格引用：**
- feature-spec.md AC-03

- [ ] **步骤 1: 创建迁移**
  ```bash
  cd packages/server && npx prisma migrate dev --name add_pgvector_embedding
  ```

- [ ] **步骤 2: 确认迁移内容**
  - 检查迁移文件包含：`ALTER TABLE "chunks" ADD COLUMN "embedding" vector(1536)`
  - 检查迁移文件包含：`ALTER TABLE "chunks" DROP COLUMN "milvus_id"`
  - 检查迁移文件包含：`CREATE EXTENSION IF NOT EXISTS vector`
  - 检查迁移文件包含：`CREATE INDEX "chunks_embedding_hnsw"`

- [ ] **步骤 3: 应用迁移到开发数据库**
  ```bash
  cd packages/server && npx prisma migrate deploy
  ```

---

### 任务 4: 更新环境变量模板

**文件：**
- 修改：`.env.example`

**规格引用：**
- feature-spec.md AC-04

- [ ] **步骤 1: 移除 MILVUS_* 变量**
  - 删除 `MILVUS_HOST`
  - 删除 `MILVUS_PORT`
  - 删除 `MILVUS_COLLECTION`
  - 删除 `MILVUS_VECTOR_DIM`

- [ ] **步骤 2: 添加 EMBEDDING_* 变量（如不存在）**
  - 确认 `EMBEDDING_API_KEY` 存在
  - 确认 `EMBEDDING_BASE_URL` 存在
  - 确认 `EMBEDDING_MODEL` 存在

---

### 任务 5: 验证

**规格引用：**
- feature-spec.md AC-05, AC-06

- [ ] **步骤 1: 类型检查**
  ```bash
  pnpm type-check
  ```

- [ ] **步骤 2: 单元测试**
  ```bash
  npx vitest run tests/unit
  ```

- [ ] **步骤 3: 确认无 Milvus 引用残留**
  ```bash
  grep -r "MILVUS" packages/server/src/ --include="*.ts" || echo "No MILVUS references found"
  ```

---

## 规格覆盖检查

- [ ] 功能规格：AC-01~AC-06 全部覆盖
- [ ] API 规格：Schema 变更、环境变量变更、Docker 服务变更全部覆盖
- [ ] 无占位符（"TODO" / "稍后实现" / "TBD"）

---

## 阻塞与依赖

- 阻塞于：无
- 阻塞下游：b-12（PgVectorStore 需要本迁移完成后的数据库）
