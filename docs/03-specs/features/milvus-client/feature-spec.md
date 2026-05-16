# Feature Spec: Milvus Client 封装

> Issue: i-04-milvus-client
> 状态: 草案
> 日期: 2026-05-16

---

## 1. 用户故事

作为系统，我需要将文本块向量化并存储到向量数据库，以便支持语义检索。

---

## 2. 范围

### 2.1 范围内

- Milvus Client 封装（基于 `@zilliz/milvus2-sdk-node`）
- Collection 管理（创建、存在性检查、结构校验）
- 向量批量插入
- ANN 近似最近邻搜索（带 kb_id 过滤）
- 向量删除（按 Milvus 主键）
- 启动时连接检查与明确错误提示
- 与 PostgreSQL chunks 表的关联映射

### 2.2 范围外

- Embedding 生成（由 RAG SDK / Embedding API 负责）
- Rerank 逻辑（Phase 5 后期）
- 混合检索（向量 + 关键词，Phase 5）
- 多 Collection 支持（MVP 仅单 Collection）
- 向量数据库本身的运维（备份、扩缩容）

---

## 3. 涉及组件

| 组件 | 路径 | 职责 |
|------|------|------|
| IVectorStore 接口 | `packages/server/src/interfaces/IVectorStore.ts` | 抽象契约，屏蔽底层实现差异 |
| MilvusClient 实现 | `packages/server/src/vector/milvus.ts` | 具体实现：连接、collection 管理、CRUD |
| VectorStoreError | `packages/server/src/interfaces/errors.ts` | 统一错误类型 |
| chunks 表 | `packages/server/src/db/schema.ts` | 存储文本块元数据，通过 `milvusId` 关联 |

---

## 4. 依赖关系

### 4.1 与 i-02-drizzle-orm-setup 的关系

- chunks 表存储文本块元数据（content、tokenCount、chunkIndex）
- Milvus 存储向量数据（embedding）
- 两者通过 `chunks.milvusId` ↔ `knowledge_chunks.id` 关联
- 插入流程：先写 PostgreSQL chunks 记录，再写 Milvus 向量，最后回写 `milvusId`

### 4.2 与 d-01-rag-sdk-contracts 的关系

- RAG SDK 的 `IIndexer` / `IRetriever` 将调用 `IVectorStore` 接口
- MilvusClient 是 `IVectorStore` 的 V2 实现（V1 为 sqlite-vec 实现）
- RAG SDK 不直接依赖 `@zilliz/milvus2-sdk-node`，只依赖接口

### 4.3 与 i-01-docker-compose-infra 的关系

- 依赖 Milvus 服务在 Docker 中运行
- 配置从环境变量读取（host、port）

---

## 5. Collection Schema

Collection 名称可配置，默认 `knowledge_chunks`。

| 字段 | Milvus 类型 | 说明 |
|------|-------------|------|
| id | VARCHAR | Milvus 主键（业务生成 UUID） |
| chunk_id | VARCHAR | 关联 PostgreSQL `chunks.id` |
| kb_id | VARCHAR | 知识库 ID，搜索过滤条件 |
| file_id | VARCHAR | 文档 ID |
| embedding | FLOAT_VECTOR(dim) | 向量，维度从配置读取 |

索引：
- `embedding` 字段创建 IVF_FLAT 或 HNSW 索引（MVP 使用 AUTOINDEX，由 Milvus 自动选择）
- `kb_id` 创建标量索引以加速过滤

---

## 6. 配置项

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `MILVUS_HOST` | `localhost` | Milvus 服务地址 |
| `MILVUS_PORT` | `19530` | Milvus gRPC 端口 |
| `MILVUS_COLLECTION` | `knowledge_chunks` | Collection 名称 |
| `MILVUS_VECTOR_DIM` | `1536` | 向量维度（对应 OpenAI text-embedding-3-small） |

---

## 7. 非功能性需求

- 启动时必须在 5 秒内完成 Milvus 连接检查
- 批量插入单次上限 1000 条（Milvus 推荐值）
- 搜索超时默认 10 秒
- 所有错误必须包装为 `VectorStoreError`，保留原始 cause
