---
issue_id: i-04-milvus-client
type: behavior-spec
status: approved
summary: 定义启动时连接检查（checkHealth）、幂等 Collection 创建（hasCollection+createCollection+结构校验）、insertVectors/searchVectors/deleteVectors 的核心流程与异常边界。
---
# Behavior Spec: Milvus Client 封装

> Issue: i-04-milvus-client
> 状态: 草案
> 日期: 2026-05-16

---

## 1. 初始化行为

### 1.1 服务启动检查

**触发时机**: Hono 服务启动时（`src/index.ts` 或专门的 `initVectorStore()`）。

**流程**:
1. 读取环境变量 `MILVUS_HOST`、`MILVUS_PORT`。
2. 使用 `@zilliz/milvus2-sdk-node` 创建 `MilvusClient` 实例。
3. 调用 `client.checkHealth()` 验证连接。
4. 若连接失败，抛出 `VectorStoreError('Milvus 连接失败: {原始错误信息}')`，服务启动中断。
5. 调用 `ensureCollection()` 检查/创建 Collection。

**成功标准**: 连接健康且 Collection 存在、结构正确。

### 1.2 ensureCollection()

**幂等性**: 多次调用结果一致，不会重复创建或报错。

**流程**:
1. 调用 `client.hasCollection({ collection_name })`。
2. 若不存在：
   - 创建 Collection，字段严格匹配 PRD 定义（id、chunk_id、kb_id、file_id、embedding）。
   - `embedding` 维度从 `MILVUS_VECTOR_DIM` 读取，默认 1536。
   - 创建索引（HNSW 或 AUTOINDEX）。
   - 调用 `loadCollection` 加载 Collection 到内存。
3. 若已存在：
   - 调用 `describeCollection` 校验字段类型与维度。
   - 若维度不匹配，抛出 `VectorStoreError('Collection 维度不匹配: 期望 {dim}, 实际 {actual}')`。
   - 确保 Collection 已加载（`loadCollection`）。

---

## 2. 插入流程

### 2.1 insertVectors(vectors: VectorRecord[])

**前置条件**: `ensureCollection()` 已成功执行。

**流程**:
1. 校验输入数组非空。
2. 校验每条记录的 `embedding` 长度等于配置维度，否则抛出 `VectorStoreError('维度不匹配')`。
3. 将数据转换为 Milvus `insert` 所需的字段数组格式：
   ```
   {
     fields_data: [
       { field_name: 'id', type: DataType.VarChar, data: [...] },
       { field_name: 'chunk_id', type: DataType.VarChar, data: [...] },
       { field_name: 'kb_id', type: DataType.VarChar, data: [...] },
       { field_name: 'file_id', type: DataType.VarChar, data: [...] },
       { field_name: 'embedding', type: DataType.FloatVector, data: [...] },
     ]
   }
   ```
4. 调用 `client.insert({ collection_name, fields_data })`。
5. 若 Milvus 返回失败，抛出 `VectorStoreError('向量插入失败: {原因}')`。

**批量限制**: 单次插入不超过 1000 条，超出时内部自动分批（或调用方保证）。

---

## 3. 搜索流程

### 3.1 searchVectors(queryVector, options)

**前置条件**: Collection 已加载。

**流程**:
1. 校验 `queryVector` 长度等于配置维度。
2. 构造搜索参数：
   - `collection_name`
   - `vector`: `queryVector`
   - `filter`: 若 `options.filter.kbId` 存在，生成表达式 `kb_id == "{kbId}"`
   - `limit`: `options.topK ?? 5`
   - `output_fields`: `['chunk_id']`
3. 调用 `client.search(...)`。
4. 将结果映射为 `VectorSearchResult[]`：
   - `id`: result.id
   - `chunkId`: result.chunk_id
   - `score`: result.score（Milvus 返回的距离/相似度，IP 内积或 COSINE）
5. 按 `score` 降序返回。

**相似度度量**: MVP 使用 COSINE（余弦相似度），与 OpenAI Embedding 兼容。

---

## 4. 删除流程

### 4.1 deleteByIds(ids: string[])

**流程**:
1. 校验输入数组非空。
2. 构造删除表达式：`id in ["id1", "id2", ...]`。
3. 调用 `client.delete({ collection_name, expr })`。
4. 若失败，抛出 `VectorStoreError('向量删除失败: {原因}')`。

### 4.2 按 document_id 删除（扩展）

**说明**: Issue 验收标准中未明确要求，但 RAG 流水线需要。建议内部提供 `deleteByFileId(fileId: string)` 方法（不在 `IVectorStore` 接口中，作为实现类扩展）。

**流程**:
1. 构造表达式：`file_id == "{fileId}"`。
2. 调用 `client.delete(...)`。

---

## 5. 错误场景

| 场景 | 触发条件 | 行为 | 错误类型 |
|------|----------|------|----------|
| 连接失败 | Milvus 未启动、网络不通、地址错误 | 启动中断，抛出明确错误 | `VectorStoreError` |
| Collection 不存在 | `ensureCollection` 被跳过或失败 | 插入/搜索/删除抛出错误 | `VectorStoreError` |
| 维度不匹配 | 插入/搜索时向量长度 ≠ Collection 维度 | 立即抛出，拒绝操作 | `VectorStoreError` |
| 搜索超时 | Milvus 负载高或网络延迟 | 抛出超时错误 | `VectorStoreError` |
| 删除 ID 不存在 | `deleteByIds` 传入不存在的 ID | Milvus 静默忽略，不报错 | 正常返回 |
| 批量插入过大 | 单次 > 1000 条 | 内部自动分批或抛出错误 | `VectorStoreError`（若拒绝） |

---

## 6. 生命周期

```
服务启动
  └─ checkHealth() ──❌─→ VectorStoreError，进程退出
       └─✅
  └─ ensureCollection() ──❌─→ VectorStoreError，进程退出
       └─✅
运行时
  ├─ insertVectors() ← RAG Worker（indexing 阶段）
  ├─ searchVectors() ← Chat API（RAG 检索阶段）
  └─ deleteByIds()   ← 文档删除 / 重新索引
```

---

## 7. 与 chunks 表的协作时序

```
RAG Worker
  ├─ INSERT INTO chunks (document_id, kb_id, content, chunk_index)
  │    → 返回 chunk_id (UUID)
  ├─ generate embedding (1536 dim)
  ├─ MilvusClient.insertVectors([{ id, chunkId: chunk_id, kbId, fileId, embedding }])
  │    → 返回 milvus_id（即传入的 id）
  └─ UPDATE chunks SET milvus_id = ? WHERE id = chunk_id
```

---

## 8. 日志与可观测性

- 连接成功：`[Milvus] Connected to {host}:{port}`
- Collection 创建：`[Milvus] Collection '{name}' created (dim={dim})`
- Collection 已存在：`[Milvus] Collection '{name}' already exists, verified`
- 插入：`[Milvus] Inserted {n} vectors into '{name}'`
- 搜索：`[Milvus] Searched '{name}', topK={k}, filter={filter}, results={n}`
- 删除：`[Milvus] Deleted vectors from '{name}', expr={expr}`
