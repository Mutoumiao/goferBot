# API 规格：文档解析与索引写入（DocumentParser + PrismaMilvusIndexer）

## 模块导出

两个组件均为 NestJS 可注入服务，通过 `processors/` 目录下的模块提供。

```typescript
import { DocumentParser } from '@goferbot/server/processors/parser/document.parser'
import { PrismaMilvusIndexer } from '@goferbot/server/processors/indexing/prisma-milvus.indexer'
```

---

## DocumentParser 契约

### 类签名

```typescript
@Injectable()
export class DocumentParser {
  constructor(private storage: StorageService) {}

  async parse(buffer: Buffer, mimeType: string): Promise<string>
}
```

#### 输入

| 参数 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `buffer` | `Buffer` | 非空 | 从 MinIO 下载的原始文件字节流 |
| `mimeType` | `string` | 非空 | 文件的 MIME 类型，由 `Document.mimeType` 提供 |

#### 输出

| 类型 | 说明 |
|------|------|
| `Promise<string>` | 文档的纯文本内容（UTF-8 编码） |

#### MIME 类型处理策略

| MIME 类型 | 行为 |
|-----------|------|
| `text/plain` | `buffer.toString('utf-8')` |
| `text/markdown` | `buffer.toString('utf-8')` |
| `text/x-markdown` | `buffer.toString('utf-8')` |
| `application/pdf` | 抛出 `Error('PDF parsing not yet implemented')` |
| 其他未知类型 | 降级为 `buffer.toString('utf-8')` |

#### 错误

| 错误类 | 触发条件 | 消息 |
|--------|----------|------|
| `Error` | `mimeType === 'application/pdf'` | `'PDF parsing not yet implemented'` |
| `Error` | `buffer` 为空（长度 0） | 由调用方决定，本组件不单独校验空 buffer |

#### 边界情况

- **空 buffer**：返回空字符串（`buffer.toString('utf-8')` 自然行为），调用方（`IndexingWorker`）需判断空文本是否继续流水线。
- **非 UTF-8 编码文本**：按 UTF-8 解码，乱码由上游负责（上传阶段已约束为文本文件）。
- **超大文本**：本组件不做截断，完整返回字符串，由 `IChunker` 处理分块。

---

## PrismaMilvusIndexer 契约

### 类签名

```typescript
export interface TokenUsage {
  promptTokens: number
  totalTokens: number
}

export class PrismaMilvusIndexer implements IIndexer {
  constructor(
    private prisma: PrismaService,
    private vectorService: VectorService,
  ) {}

  async index(
    chunks: Chunk[],
    vectors: number[][],
    usage?: TokenUsage[],
  ): Promise<void>
}
```

#### 输入

| 参数 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `chunks` | `Chunk[]` | 非空数组，长度与 `vectors` 一致 | SDK `IChunker` 产出的分块结果 |
| `vectors` | `number[][]` | 非空数组，长度与 `chunks` 一致 | SDK `IEmbedder` 产出的向量数组 |
| `usage` | `TokenUsage[]` | 可选，长度可为 `chunks.length` 或 `1` | `embedWithUsage()` 返回的逐条或总量 token 使用信息 |

#### 输出

| 类型 | 说明 |
|------|------|
| `Promise<void>` | 无返回值，副作用为写入 PG 与 Milvus |

#### 数据流

```
chunks + vectors + usage?
  │
  ▼
computeTokenCounts ──> tokenCounts[]
  │
  ▼
prisma.$transaction(
  prisma.chunk.create({ id: chunk.id, documentId, kbId, content, tokenCount, chunkIndex })
) ──> createdChunks[]
  │
  ▼
generate VectorRecord[]:
  id = chunk.id        // chunker 预生成的 UUID
  chunkId = chunk.id   // 与 PG 主键一致
  kbId = chunk.kbId
  fileId = chunk.documentId
  embedding = vectors[i]
  │
  ▼
vectorService.insertVectors(records)
  │
  ▼
// 无需回写 milvusId，因为 chunk.id === VectorRecord.id
```

#### TokenCount 计算策略

`computeTokenCounts(chunks, usage?)` 按以下优先级选择：

| 优先级 | 条件 | 计算方式 |
|--------|------|----------|
| 1 | `usage && usage.length === chunks.length` | `usage.map(u => u.promptTokens)` |
| 2 | 无 usage 或长度不匹配 | `chunks.map(c => c.tokenCount ?? Math.ceil(c.content.length / 4))` |

**注**：`usage.length === 1` 的情况在 d-20 的 `IEmbedder.embedWithUsage()` 接口契约中不会出现（返回数组长度与输入文本数组长度一致），因此不单独处理。若未来接口变更支持返回单条总量，再补充比例分配逻辑。

#### Chunk 创建字段映射

| Prisma `Chunk` 字段 | 来源 |
|---------------------|------|
| `id` | `chunk.id`（chunker 预生成的 UUID） |
| `documentId` | `chunk.documentId` |
| `kbId` | `chunk.kbId` |
| `content` | `chunk.content` |
| `tokenCount` | `computeTokenCounts` 结果 |
| `chunkIndex` | `chunk.chunkIndex` |

#### VectorRecord 字段映射

| `VectorRecord` 字段 | 来源 |
|---------------------|------|
| `id` | `chunk.id`（chunker 生成的 UUID，与 PG Chunk 表主键一致） |
| `chunkId` | `chunk.id`（同上，Milvus 主键与 chunk 主键相同） |
| `kbId` | `chunk.kbId` |
| `fileId` | `chunk.documentId` |
| `embedding` | `vectors[i]` |

**决策**：`VectorRecord.id` 使用 `chunk.id` 而非随机 UUID，与 SDK `MilvusIndexer` 保持一致。这样无需第二次事务回写 `milvusId`，因为 `chunk.id === milvusId`。

#### 事务边界

- **事务 A**：`prisma.$transaction(chunks.map(...create))` — 批量创建 `Chunk` 记录，全部成功或全部回滚。`Chunk.id` 使用 chunker 预生成的 UUID（`chunk.id`）。
- **非事务点**：`vectorService.insertVectors(records)` 位于事务 A 之后。若 Milvus 写入失败，PG 中已有 chunks 记录，但 `chunk.id` 即为 Milvus 主键，无需回写。orphan chunks 由调用方（`IndexingWorker`）捕获异常后通过 `DocumentService.remove()` 清理（调用 `deleteByFileId`）。

**为什么不需要事务 B**：
- `chunk.id` 在 chunker 阶段已生成（`crypto.randomUUID()`）。
- `VectorRecord.id = chunk.id`，`VectorRecord.chunkId = chunk.id`。
- PG 创建 chunk 时直接使用 `chunk.id` 作为主键。
- Milvus 插入时使用同一 `id`，无需回写 `milvusId` 字段。
- 这消除了 b-11 原设计中"事务 B 回写 milvusId"的复杂性和 orphan 风险。

#### 错误

| 错误类 | 触发条件 | 传播方式 |
|--------|----------|----------|
| `ValidationError`（SDK） | `chunks.length !== vectors.length` | 由 `runIndexing` 捕获后标记 stage failed |
| `Prisma.PrismaClientKnownRequestError` | 唯一约束冲突、外键不存在 | 抛出，由调用方处理 |
| `Error`（VectorService 抛出） | Milvus 连接中断、维度不匹配 | 抛出，此时 PG 中已有 orphan chunks，由 `deleteByFileId` 清理 |

---

## 接口兼容性说明

### 与 SDK `IIndexer` 的关系

SDK `IIndexer` 定义为：

```typescript
export interface IIndexer {
  index(chunks: Chunk[], vectors: number[][]): Promise<void>
}
```

`PrismaMilvusIndexer.index` 扩展了第三个可选参数 `usage?: TokenUsage[]`，这在 TypeScript 结构类型系统中兼容：实现类可以拥有比接口更多的参数，调用方（`runIndexing`）传入 2 个参数时正常匹配，传入 3 个参数时利用扩展参数。

### 与 SDK `runIndexing` 的协作

`runIndexing`（`d-12` 实现）在 embed stage 调用 `embedder.embed()`，返回 `vectors`。若 `d-20` 已完成 `embedWithUsage()` 扩展，则 `runIndexing` 需调整为：

```typescript
const embedResult = await embedder.embedWithUsage(chunks.map(c => c.content))
vectors = embedResult.vectors
// Stage 3: index — 传入 usage
await indexer.index(chunks, vectors, embedResult.usage)
```

若 `embedder` 未实现 `embedWithUsage`，则降级为：

```typescript
vectors = await embedder.embed(chunks.map(c => c.content))
await indexer.index(chunks, vectors)
```

两种调用方式 `PrismaMilvusIndexer` 均兼容（`usage` 为可选）。

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| text/plain 解析 | `tests/issues/b-11-document-parser-indexer/document-parser.spec.ts` | `AC-01: parses text/plain buffer to utf-8 string` |
| text/markdown 解析 | `tests/issues/b-11-document-parser-indexer/document-parser.spec.ts` | `AC-02: parses text/markdown buffer to utf-8 string` |
| PDF 占位抛错 | `tests/issues/b-11-document-parser-indexer/document-parser.spec.ts` | `AC-03: throws error for application/pdf mimeType` |
| 未知类型降级 | `tests/issues/b-11-document-parser-indexer/document-parser.spec.ts` | `AC-04: falls back to utf-8 for unknown mimeType` |
| 空 buffer 返回空字符串 | `tests/issues/b-11-document-parser-indexer/document-parser.spec.ts` | `AC-05: returns empty string for empty buffer` |
| PrismaMilvusIndexer 正常写入 | `tests/issues/b-11-document-parser-indexer/prisma-milvus-indexer.spec.ts` | `AC-06: creates chunks and inserts vectors with chunk.id as milvus id` |
| chunks 与 vectors 长度不一致 | `tests/issues/b-11-document-parser-indexer/prisma-milvus-indexer.spec.ts` | `AC-07: throws ValidationError when lengths mismatch` |
| 优先使用逐条 TokenUsage | `tests/issues/b-11-document-parser-indexer/prisma-milvus-indexer.spec.ts` | `AC-08: uses per-chunk TokenUsage when available` |
| 无 TokenUsage 回退到估算 | `tests/issues/b-11-document-parser-indexer/prisma-milvus-indexer.spec.ts` | `AC-09: falls back to chunk.tokenCount or length/4 estimate` |
| Milvus 写入失败后的 orphan chunks | `tests/issues/b-11-document-parser-indexer/prisma-milvus-indexer.spec.ts` | `AC-10: leaves orphan chunks when vector insert fails, cleaned by deleteByFileId` |
| 事务回滚：chunk 创建失败不插入向量 | `tests/issues/b-11-document-parser-indexer/prisma-milvus-indexer.spec.ts` | `AC-11: does not insert vectors if chunk creation fails` |
