# API Spec: Milvus Client 封装

> Issue: i-04-milvus-client
> 状态: 草案
> 日期: 2026-05-16

---

## 说明

Milvus Client 为**纯内部基础设施服务**，不暴露任何 REST API 端点。所有交互通过 `IVectorStore` 接口在服务端内部进行。

本文件仅定义内部服务接口的规格，用于指导实现和测试。

---

## 1. 接口定义

实现文件: `packages/server/src/vector/milvus.ts`

实现类必须满足 `IVectorStore` 接口（`packages/server/src/interfaces/IVectorStore.ts`）。

```typescript
export class MilvusVectorStore implements IVectorStore {
  constructor(options: MilvusVectorStoreOptions)

  async ensureCollection(): Promise<void>
  async insertVectors(vectors: VectorRecord[]): Promise<void>
  async searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]>
  async deleteByIds(ids: string[]): Promise<void>
}
```

---

## 2. 构造函数选项

```typescript
interface MilvusVectorStoreOptions {
  /** Milvus 服务地址，默认 localhost */
  host?: string
  /** Milvus gRPC 端口，默认 19530 */
  port?: string | number
  /** Collection 名称，默认 'knowledge_chunks' */
  collectionName?: string
  /** 向量维度，默认 1536 */
  vectorDim?: number
  /** 相似度度量，默认 'COSINE' */
  metricType?: 'COSINE' | 'IP' | 'L2'
}
```

---

## 3. 方法详情

### 3.1 ensureCollection()

| 项 | 值 |
|---|---|
| 可见性 | public |
| 幂等性 | 是 |
| 副作用 | 可能创建 Collection、创建索引、加载 Collection |
| 错误 | `VectorStoreError`（连接失败、权限不足、维度非法） |

---

### 3.2 insertVectors(vectors)

| 项 | 值 |
|---|---|
| 可见性 | public |
| 参数 | `vectors: VectorRecord[]` |
| 返回 | `Promise<void>` |
| 校验 | 数组非空、每条 embedding 长度等于 vectorDim |
| 错误 | `VectorStoreError`（维度不匹配、插入失败） |

---

### 3.3 searchVectors(queryVector, options)

| 项 | 值 |
|---|---|
| 可见性 | public |
| 参数 | `queryVector: number[]`, `options?: VectorSearchOptions` |
| 返回 | `Promise<VectorSearchResult[]>` |
| 校验 | queryVector 长度等于 vectorDim |
| 过滤 | 支持 `kbId` 精确匹配（生成 `kb_id == "..."` 表达式） |
| 错误 | `VectorStoreError`（搜索失败、超时） |

---

### 3.4 deleteByIds(ids)

| 项 | 值 |
|---|---|
| 可见性 | public |
| 参数 | `ids: string[]` — Milvus 主键数组 |
| 返回 | `Promise<void>` |
| 校验 | 数组非空 |
| 错误 | `VectorStoreError`（删除失败） |

---

## 4. 扩展方法（实现类特有，不在 IVectorStore 中）

### 4.1 deleteByFileId(fileId: string)

| 项 | 值 |
|---|---|
| 可见性 | public |
| 参数 | `fileId: string` — 文档 ID |
| 返回 | `Promise<void>` |
| 表达式 | `file_id == "{fileId}"` |
| 用途 | 文档删除或重新索引时批量清理向量 |

### 4.2 deleteByKbId(kbId: string)

| 项 | 值 |
|---|---|
| 可见性 | public |
| 参数 | `kbId: string` — 知识库 ID |
| 返回 | `Promise<void>` |
| 表达式 | `kb_id == "{kbId}"` |
| 用途 | 删除知识库时清理全部关联向量 |

---

## 5. 类型对照表

| TypeScript 类型 | Milvus DataType |
|-----------------|-----------------|
| `string` (id, chunk_id, kb_id, file_id) | `DataType.VarChar` |
| `number[]` (embedding) | `DataType.FloatVector` |

---

## 6. 无 REST API

本服务不注册任何 Hono 路由。如需健康检查，复用全局 `GET /health`，在健康检查逻辑中调用 `MilvusClient.checkHealth()` 即可。
