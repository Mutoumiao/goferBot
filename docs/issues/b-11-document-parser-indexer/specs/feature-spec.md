# 功能规格：文档解析与索引写入（DocumentParser + PrismaMilvusIndexer）

## 用户故事

作为 GoferBot 后端开发者，我希望在索引流水线中获得两个无状态转换组件：
1. `DocumentParser` 从 MinIO 下载原始文件并解析为纯文本，使后续分块器可以消费标准 `DocumentSource`。
2. `PrismaMilvusIndexer` 实现 SDK `IIndexer`，将 chunk 元数据写入 PostgreSQL、向量写入 Milvus，并回写 `milvusId`，使检索阶段可以定位到具体文本块。

## 边界

- **范围内**：
  - `DocumentParser.parse(buffer, mimeType)` 的实现：支持 `text/plain`、`text/markdown`（含 `text/x-markdown`），PDF 占位明确抛错，未知类型降级为 UTF-8 文本尝试。
  - `PrismaMilvusIndexer.index(chunks, vectors, usage?)` 的实现：批量创建 `Chunk` 记录、批量插入 `VectorRecord`、批量回写 `milvusId`。
  - `computeTokenCounts` 内部策略：优先使用 `TokenUsage[]` 精确值，无 usage 时回退到 chunker 估算值（`chunk.tokenCount ?? Math.ceil(content.length / 4)`）。
  - 事务保证：chunk 创建与 milvusId 回写各自包裹在 `prisma.$transaction` 中。
- **范围外**：
  - 实际 PDF 解析库接入（本 issue 仅占位抛错，具体库选择由后续 issue 决定）。
  - 索引流水线的异步编排（BullMQ Worker、状态流转、重试策略由 `b-08` 负责）。
  - 文档上传 HTTP 端点及 MinIO 上传逻辑（由 `DocumentService.upload` 负责，本 issue 仅消费 `storage.downloadFile`）。
  - 向量数据库连接管理与 collection 创建（由 `VectorService` 负责，本 issue 仅调用 `insertVectors`）。
  - Embedder 的 `embedWithUsage` 实现（由 `d-20` 负责，本 issue 仅消费 usage 参数）。
  - 前端 UI 行为（本 issue 为纯后端组件，无 behavior-spec）。

## 涉及模块

- `packages/server/src/processors/parser/document.parser.ts`
- `packages/server/src/processors/indexing/prisma-milvus.indexer.ts`

## 相关功能

- **上游**：
  - `d-20-rag-sdk-embedder-token-usage` — 提供 `TokenUsage` 类型及 `embedWithUsage()` 实现，使 `PrismaMilvusIndexer` 可获得精确 `tokenCount`。
  - `b-10-server-vector-keyword-adapters` — 提供 `VectorService`（实现 SDK `IVectorStore`），使 `PrismaMilvusIndexer` 可调用 `insertVectors`。
  - `DocumentService` / `StorageService` — 提供 MinIO 文件下载能力，为 `DocumentParser` 提供 `Buffer` 输入。
- **下游**：
  - `b-08-indexing-worker-integration` — 消费 `DocumentParser` + `PrismaMilvusIndexer`，在 `IndexingWorker` 中组装进 `runIndexing` 流水线。
  - `b-09-chat-rag-retrieval` — 消费 `PrismaMilvusIndexer` 写入的向量与 chunk 数据，执行混合检索。

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| `DocumentParser` 为 NestJS `@Injectable()` 服务 | 需要注入 `StorageService` 及后续可能的配置（如 PDF 解析库） | 是（可改为纯函数，但需重新传递 storage 实例） |
| PDF 解析占位抛错而非静默降级 | 避免用户误以为 PDF 已索引，明确告知未支持 | 是（接入具体库后移除抛错） |
| 未知 MIME 类型降级为 `buffer.toString('utf-8')` | 兼容无明确 MIME 的文本文件，减少阻塞 | 是（可改为抛错拒绝） |
| `PrismaMilvusIndexer` 通过构造函数注入 `PrismaService` + `VectorService` | 保持 NestJS DI 风格，便于测试 mock | 否（接口已固定） |
| chunk 创建与 milvusId 回写分两次 `$transaction` | `VectorRecord.id` 需在 `insertVectors` 前生成，无法与 chunk 创建合并为单次事务 | 否（Milvus 与 PG 为异构存储，无分布式事务） |
| `TokenUsage` 按文本长度比例分配总量 | OpenAI Embedding API 仅返回整批 usage，需按比例拆分到各 chunk | 是（若未来 API 支持逐条 usage，可直接使用） |
| 无 usage 时回退到 `chunk.tokenCount ?? Math.ceil(content.length / 4)` | 与 SDK `RecursiveCharacterChunker` 估算策略保持一致 | 是（可替换为其他估算公式） |
