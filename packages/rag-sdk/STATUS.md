# @goferbot/rag-sdk — 项目状态与开发路线图

> ⚠️ **本文档已过时** — 最后更新于 2026-05-27，pgvector 迁移（ADR 0005，2026-06-01）后大量内容未同步更新。
> 当前可靠信息请查阅：
> - ADR 0005: `docs/adrs/0005-pgvector-replaces-milvus.md`
> - PRD v1.1: `docs/prd/rag-server-integration.md`
> - 代码: `packages/rag-sdk/src/`

---

## 1. 当前状态总览（⚠️ 过时）

| 维度 | 状态 |
|------|------|
| 接口层 | **已冻结** — 4 个核心接口 + 类型体系 + 错误体系已定义 |
| 实现层 | **完全空白** — 无任何具体实现类 |
| 测试 | **空白** — 无单元测试、无集成测试 |
| 下游依赖（server） | **基础设施就绪，业务逻辑待填充** — Milvus 连接、队列框架、配置系统均已就位 |
| 阻塞项 | 无外部阻塞，可随时启动开发 |
| 包引用方向 | **server → rag-sdk 单向依赖** — rag-sdk 作为纯工具库，禁止反向依赖 server |

**一句话总结**：接口合约已签好，仓库里只有"图纸"，没有"零件"。

**⚠️ 项目级约束（来自 `CLAUDE.md` + 记忆系统）**
- **RAG 逻辑全部由 rag-sdk 负责**：server 仅做业务编排，不得将分块/嵌入/检索逻辑直接写在 server 中。
- **Token 预算**：单任务 ≤ 8k，会话 ≤ 30k。超 80% 暂停并压缩；超 95% 终止。
- **先思后码**：不确定就问，禁止在无 spec/plan/测试的情况下直接编码。
- **测试验证意图**：业务逻辑变更时测试应失败，测试必须体现"行为为何重要"。

---

## 2. 现有代码清单

### 2.1 已存在文件

```
packages/rag-sdk/
├── package.json          # 仅依赖 typescript，无运行时依赖
├── tsconfig.json         # 标准 ESM 配置
├── README.md             # 占位说明（当前内容见 §8）
└── src/
    ├── index.ts          # 统一导出接口、类型、错误
    ├── types.ts          # DocumentSource, Chunk, ChunkWithScore, EmbeddingConfig, HybridSearchOptions
    ├── errors.ts         # RAGError / EmbeddingError / RetrievalError / ValidationError
    └── interfaces/
        ├── index.ts      # 统一导出 4 个接口
        ├── IChunker.ts   # 分块策略抽象
        ├── IEmbedder.ts  # 文本向量化抽象
        ├── IIndexer.ts   # 向量索引写入抽象
        └── IRetriever.ts # 语义检索抽象（含混合检索参数预留）
```

### 2.2 接口速查

| 接口 | 核心方法 | 典型实现预期 |
|------|----------|--------------|
| `IChunker` | `chunk(doc) => Promise<Chunk[]>` | `RecursiveCharacterChunker`（按段落/句子/单词层级递归切分） |
| `IEmbedder` | `embed(texts) => Promise<number[][]>` | `OpenAIEmbedder`（调用 OpenAI Embedding API） |
| `IIndexer` | `index(chunks, vectors) => Promise<void>` | `MilvusIndexer`（校验后写入 Milvus） |
| `IRetriever` | `retrieve(query, kbIds, topK, options) => Promise<ChunkWithScore[]>` | `MilvusRetriever`（向量搜索 + 可选混合检索） |

---

## 3. 下游依赖就绪度（packages/server）

### 3.1 已就绪的基础设施

| 模块 | 文件 | 就绪度 | 说明 |
|------|------|--------|------|
| Milvus 向量存储 | `src/vector/milvus.ts` | **100%** | 完整的 `MilvusVectorStore` 实现，支持插入、搜索、删除、Collection 自动创建 |
| 向量存储服务 | `src/processors/vector/vector.service.ts` | **100%** | NestJS Injectable，封装 `MilvusVectorStore`，启动时自动检查健康并确保 Collection |
| 队列定义 | `src/queue/queues.ts` | **100%** | `DOCUMENT_PROCESSING_QUEUE`（parse/chunk/embed）和 `EMBEDDING_QUEUE` 已定义 |
| Worker 工厂 | `src/queue/workers.ts` | **100%** | `createDocumentWorker` / `createEmbeddingWorker` 工厂函数已就绪 |
| 配置系统 | `src/modules/settings/` | **100%** | 已支持 `embeddingProvider` 配置（provider/apiKey/model/baseUrl），默认 OpenAI `text-embedding-3-small` |
| 数据库模型 | `prisma/schema.prisma` | **100%** | `Chunk` 模型已定义（含 `milvusId` 字段），`Document.status` 枚举已定义（uploaded/parsing/chunking/indexing/ready/failed） |

### 3.2 待填充的业务逻辑

| 接入点 | 文件 | 当前状态 | 需要做什么 |
|--------|------|----------|------------|
| **Chat RAG 检索** | `src/modules/chat/chat.service.ts:57` | `TODO(phase-5)` | 在 `streamChat()` 中调用 `IRetriever.retrieve()`，将检索结果注入 system prompt |
| **Document Worker Handler** | `src/app.module.ts:48` | `QueueModule.forRoot()` 未传入 handler | 实现 `parse → chunk → embed → index` 的完整流水线，注入 handler |
| **文档上传触发** | `src/modules/knowledge-base/document.service.ts:31` | `upload()` 仅完成 MinIO 存储 + PG 记录创建，**未触发队列** | 上传完成后调用 `QueueService.addDocumentJob()` 触发异步处理 |

### 3.3 关键数据结构映射（Milvus ↔ PostgreSQL）

`IVectorStore` 定义的 `VectorRecord` 与 Milvus Collection `knowledge_chunks` 字段映射：

| VectorRecord 字段 | Milvus 字段名 | Milvus 类型 | 说明 |
|-------------------|---------------|-------------|------|
| `id` | `id` | VARCHAR | Milvus 主键 |
| `chunkId` | `chunk_id` | VARCHAR | 关联 PostgreSQL `chunks.id` |
| `kbId` | `kb_id` | VARCHAR | 知识库 ID，用于过滤 |
| `fileId` | `file_id` | VARCHAR | 文档 ID |
| `embedding` | `embedding` | FLOAT_VECTOR(dim) | 向量，默认维度 1536 |

Collection 参数：度量类型 **COSINE**，索引 **AUTOINDEX**。

### 3.3 关键接口契约（server 与 rag-sdk 的边界）

server 中已定义 `IVectorStore` 接口（`src/interfaces/IVectorStore.ts`），与 rag-sdk 的 `IIndexer` / `IRetriever` 形成互补：

- **`IVectorStore`**（server 层）：底层 Milvus 操作（插入、搜索、删除）
- **`IIndexer`**（rag-sdk）：业务层索引逻辑（校验 chunks/vectors 一致性，映射为 VectorRecord）
- **`IRetriever`**（rag-sdk）：业务层检索逻辑（调用 Embedder 生成 query 向量，调用 IVectorStore 搜索，组装结果）

**注意**：rag-sdk 的实现类需要引用 server 的 `IVectorStore` 接口，但 rag-sdk 作为独立包**禁止直接依赖 server**。当前解耦方案：
- `IIndexer` / `IRetriever` 的实现通过**构造函数注入**接收 `IVectorStore` 实例
- rag-sdk 中不导入 server 的任何模块，仅依赖自身接口和类型
- server 在装配时传入 `VectorService`（已实现 `IVectorStore`）

---

## 4. 开发路线图（建议顺序）

### Phase A：填充 rag-sdk 核心实现（当前最高优先级）

目标：让 rag-sdk 从"接口包"变为"可运行的工具库"。

**前置检查**：
- [ ] 确认 `pnpm-workspace.yaml` 已包含 `packages/*`（已确认 ✅）
- [ ] 确认 server `package.json` 尚未添加 `@goferbot/rag-sdk` 依赖（当前未添加，Phase B 时需手动添加 workspace 链接）

**实施步骤**：

1. **添加运行时依赖**
   - 在 `packages/rag-sdk/package.json` 中添加 `openai`（OpenAI Embedding API 客户端）
   - 可选：`tiktoken`（token 计数）
   - 执行 `pnpm install` 同步 workspace lockfile

2. **实现 `OpenAIEmbedder`**（`src/embedders/openai.ts`）
   - 实现 `IEmbedder` 接口
   - 支持批量嵌入（OpenAI 单次上限需处理）
   - 校验返回维度与 `config.dimension` 一致
   - 错误处理：网络失败抛 `EmbeddingError`，空输入抛 `ValidationError`

3. **实现 `RecursiveCharacterChunker`**（`src/chunkers/recursive-character.ts`）
   - 实现 `IChunker` 接口
   - 按分隔符层级递归切分：`[\n\n, \n, 空格, ""]`
   - 支持 `chunkSize`、`chunkOverlap` 配置
   - 空内容返回 `[]`

4. **实现 `MilvusIndexer`**（`src/indexers/milvus.ts`）
   - 实现 `IIndexer` 接口
   - 校验 `chunks.length === vectors.length`
   - 校验每个向量维度
   - 将数据映射为 `VectorRecord[]`，调用注入的 `IVectorStore.insertVectors()`

5. **实现 `MilvusRetriever`**（`src/retrievers/milvus.ts`）
   - 实现 `IRetriever` 接口
   - 调用 `IEmbedder.embed([query])` 生成查询向量
   - 调用 `IVectorStore.searchVectors()` 执行 ANN 搜索（带 `kbId` 过滤）
   - 按 `score` 降序返回 `ChunkWithScore[]`
   - 预留 `HybridSearchOptions` 接口（当前版本可先忽略，返回时保留字段）

6. **统一导出更新**
   - `src/index.ts` 增加实现类的具名导出

7. **补充单元测试**
   - `tests/issues/` 或 `packages/rag-sdk/tests/` 下为每个实现类编写测试
   - 重点测试边界行为：空输入、维度不匹配、网络失败

### Phase B：后端 Worker 流水线接入

目标：让文档上传后能自动完成解析/分块/向量化/索引。

**前置依赖**：
- [ ] 在 `packages/server/package.json` 中添加 `"@goferbot/rag-sdk": "workspace:*"`
- [ ] 执行 `pnpm install` 建立 workspace 链接

**实施步骤**：

1. **在 server 中实现 DocumentJobHandler**
   - 从 MinIO 读取文件内容（通过 `StorageService`）
   - 调用 Parser（纯文本直接读取，PDF 等后续扩展）
   - 调用 `IChunker.chunk()` 分块
   - 将 chunks 写入 PostgreSQL（`prisma.chunk.createMany()`）
   - 调用 `IEmbedder.embed()` 生成向量
   - 调用 `IIndexer.index()` 写入 Milvus
   - 更新 `Document.status` 状态机（`uploaded → parsing → chunking → indexing → ready`）

   **⚠️ 关于 `DocumentJobData.type` 的设计说明**：
   当前 `queues.ts` 中 `DocumentJobData.type` 定义为 `'parse' | 'chunk' | 'embed'`，但这三个阶段在实际流水线中是**顺序执行**的，不应拆分为独立 job。建议的修正方向：
   - 方案 A：移除 `type` 字段，一个 job 走完完整流水线，Worker 内部按状态机推进
   - 方案 B：保留 `type`，但仅用于重试/补偿场景（如某阶段失败后重新投递）
   - **当前推荐方案 A**（简单至上，一个 job 一个文档）

2. **在 server 中实现 EmbeddingJobHandler**
   - 处理增量 embedding 场景（如重新索引、知识库迁移）
   - 输入 `chunkIds`，查询 PostgreSQL 获取 content，调用 `IEmbedder.embed()` + `IIndexer.index()`

3. **注入 Handler 到 QueueModule**
   - 修改 `AppModule` 中 `QueueModule.forRoot()` 的调用，传入实现的 handler

4. **上传流程触发队列**
   - 在 `DocumentService.upload()` 第 48 行（创建 PG 记录后）调用 `QueueService.addDocumentJob(doc.id)`
   - 注意：`addDocumentJob` 当前签名要求 `type` 参数，若按方案 A 移除 `type`，需同步修改签名

### Phase C：Chat RAG 检索接入

目标：让对话能基于知识库内容回答。

1. **修改 `ChatService.streamChat()`**
   - 若 `dto.knowledgeBaseIds` 存在且非空，调用 `IRetriever.retrieve()`
   - 将检索到的 chunks 拼接为 context，注入 system prompt
   - 格式示例：
     ```
     基于以下参考资料回答问题：
     ---
     [1] {chunk.content}
     [2] {chunk.content}
     ---
     ```

2. **前端多知识库选择**
   - 已预留 `@知识库名称` 提及和复选框 UI，需确保 `ChatDto.knowledgeBaseIds` 正确传递

---

## 5. 关键设计决策（已冻结，开发时需遵守）

1. **维度不从接口层硬编码**：`EmbeddingConfig.dimension` 由消费方传入，默认 1536（OpenAI `text-embedding-3-small`）
2. **错误链式追溯**：所有错误支持 `cause` 参数，便于调试底层故障（如 OpenAI API 返回的原始错误）
3. **空输入显式失败**：空字符串/空数组必须抛 `ValidationError`，不允许静默返回空结果
4. **混合检索预留**：`HybridSearchOptions` 已定义字段，但具体融合算法由实现层决定，当前 MVP 可仅做向量检索
5. **状态机驱动**：`Document.status` 必须按 `uploaded → parsing → chunking → indexing → ready` 推进，失败时置为 `failed` 并记录 `errorMessage`
6. **包边界单向性**：rag-sdk 是纯工具库，禁止依赖 server 的任何模块。server 通过构造函数注入向 rag-sdk 提供 `IVectorStore` 实现
7. **构建验证**：rag-sdk 修改后必须执行 `pnpm -r build` 确保 server 能正确引用编译产物

---

## 6. 快速启动检查清单

如果你是接手的 Agent，请按以下顺序确认：

- [ ] 已阅读 `packages/rag-sdk/src/interfaces/` 下的 4 个接口定义
- [ ] 已阅读 `packages/rag-sdk/src/types.ts` 的数据结构
- [ ] 已阅读 `packages/server/src/interfaces/IVectorStore.ts` 的向量存储契约
- [ ] 已阅读 `packages/server/src/vector/milvus.ts` 的 Milvus 实现细节（字段名、维度、度量类型）
- [ ] 已确认 `prisma/schema.prisma` 中 `Chunk` 和 `Document` 模型与接口兼容
- [ ] 已确认 `packages/server/src/queue/queues.ts` 的 JobData 结构能满足流水线需求
- [ ] 已确认 `packages/server/package.json` 是否已添加 `@goferbot/rag-sdk` workspace 依赖
- [ ] 已阅读本文档第 4 节"开发路线图"，明确当前应处于 Phase A / B / C 的哪一阶段
- [ ] 已阅读本文档第 5 节"关键设计决策"，确认包边界单向性和构建验证要求

---

## 7. 相关文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| PRD v2（RAG 章节） | `docs/prd/v2-cloud-native.md` §8 | 产品需求与数据流定义 |
| 云原生架构 ADR | `docs/adrs/0004-cloud-native-rearchitecture.md` | 架构决策与边界划分 |
| 后端开发指南 | `docs/guide/backend/` | API 测试、编码规范 |
| 项目 workflow | `docs/guide/workflow.md` | Issue 领取与开发流程 |

---

## 8. 附录

### 8.1 README.md 当前内容

`packages/rag-sdk/README.md` 当前为占位说明：

> RAG（检索增强生成）工具库。当前为占位骨架，未来将包含：文本分块策略、Embedding 客户端、向量存储适配器、混合检索（向量 + 全文）。

**注意**：rag-sdk 实现填充后，应同步更新 README.md，添加使用示例和 API 文档。

### 8.2 Chat DTO 中的 RAG 字段

`ChatDto` 已预留 `knowledgeBaseIds?: string[]` 字段（`packages/server/src/modules/chat/dto/chat.dto.ts:11`），前端和后端 API 契约已就绪。Phase C 接入时直接使用，无需修改 DTO。

### 8.3 DocumentService.upload() 当前代码

`packages/server/src/modules/knowledge-base/document.service.ts:31-50`：

```typescript
async upload(userId: string, kbId: string, payload: UploadFilePayload) {
  // ... 权限检查、MinIO 上传 ...
  const doc = await this.prisma.document.create({
    data: { kbId, folderId: payload.folderId, name: payload.filename,
      ext: payload.ext, mimeType: payload.mimeType,
      size: BigInt(payload.size), storageKey, status: 'uploaded' },
  })
  return { ...doc, size: doc.size !== null ? Number(doc.size) : null }
  // TODO: 此处应调用 QueueService.addDocumentJob(doc.id) 触发异步处理
}
```

---

*本文档由 Agent 于 2026-05-27 生成，后续开发进展请及时更新本文件中的"当前状态总览"和"开发路线图"章节。*
