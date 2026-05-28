# API Spec: b-10 Server 向量与关键词存储适配

## 1. 接口签名

### 1.1 VectorService（变更）

**文件**: `packages/server/src/processors/vector/vector.service.ts`

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type {
  IVectorStore,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
} from '@goferbot/rag-sdk'
import { MilvusVectorStore } from '../../vector/milvus.js'

@Injectable()
export class VectorService implements IVectorStore, OnModuleInit {
  private readonly store: MilvusVectorStore

  constructor(private readonly config: ConfigService) {
    this.store = new MilvusVectorStore({
      host: this.config.getOrThrow<string>('MILVUS_HOST'),
      port: this.config.getOrThrow<string>('MILVUS_PORT'),
      collectionName: this.config.getOrThrow<string>('MILVUS_COLLECTION'),
      vectorDim: this.config.getOrThrow<number>('MILVUS_VECTOR_DIM'),
    })
  }

  async onModuleInit(): Promise<void> {
    await this.store.checkHealth()
    await this.store.ensureCollection()
  }

  async ensureCollection(): Promise<void> {
    return this.store.ensureCollection()
  }

  async insertVectors(vectors: VectorRecord[]): Promise<void> {
    return this.store.insertVectors(vectors)
  }

  async searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    return this.store.searchVectors(queryVector, options)
  }

  async deleteByIds(ids: string[]): Promise<void> {
    return this.store.deleteByIds(ids)
  }

  /** 扩展方法：按文档 ID 删除向量（不在 SDK IVectorStore 接口中） */
  async deleteByFileId(fileId: string): Promise<void> {
    return this.store.deleteByFileId(fileId)
  }

  /** 扩展方法：按知识库 ID 删除向量（不在 SDK IVectorStore 接口中） */
  async deleteByKbId(kbId: string): Promise<void> {
    return this.store.deleteByKbId(kbId)
  }
}
```

**关键变更点**:
- `implements` 子句从 `IVectorStore`（server 自有）改为 `IVectorStore`（from `@goferbot/rag-sdk`）
- `import type` 来源从 `../../interfaces/IVectorStore.js` 改为 `@goferbot/rag-sdk`
- `deleteByFileId` / `deleteByKbId` 保留为扩展方法，注释明确标注其不在 SDK 接口中

### 1.2 MilvusVectorStore（变更）

**文件**: `packages/server/src/vector/milvus.ts`

```typescript
import {
  MilvusClient,
  DataType,
  type CreateCollectionReq,
  type FieldType,
  type FieldSchema,
} from '@zilliz/milvus2-sdk-node'
import type {
  IVectorStore,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
} from '@goferbot/rag-sdk'
import { VectorStoreError } from '../interfaces/errors.js'

export interface MilvusVectorStoreOptions {
  host?: string
  port?: string | number
  collectionName?: string
  vectorDim?: number
  metricType?: 'COSINE' | 'IP' | 'L2'
}

export class MilvusVectorStore implements IVectorStore {
  // ... 现有实现不变 ...
}
```

**关键变更点**:
- `import type` 来源从 `../interfaces/IVectorStore.js` 改为 `@goferbot/rag-sdk`
- 删除 `../interfaces/IVectorStore.js` 文件本身

### 1.3 KeywordService（新增）

**文件**: `packages/server/src/processors/keyword/keyword.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service.js'
import type { IKeywordStore, RetrievalCandidate } from '@goferbot/rag-sdk'

@Injectable()
export class KeywordService implements IKeywordStore {
  private readonly logger = new Logger(KeywordService.name)
  private useChineseConfig = false
  private configChecked = false

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.detectZhparser()
  }

  private async detectZhparser(): Promise<void> {
    try {
      const result = await this.prisma.$queryRaw<Array<{ extname: string }>>`
        SELECT extname FROM pg_extension WHERE extname = 'zhparser'
      `
      this.useChineseConfig = result.length > 0
      if (this.useChineseConfig) {
        this.logger.log('zhparser 扩展已检测到，关键词检索使用 chinese 配置')
      } else {
        this.logger.warn('zhparser 扩展未安装，关键词检索降级为 simple 配置（中文分词效果受限）')
      }
    } catch (err) {
      this.logger.warn(`zhparser 检测失败: ${err instanceof Error ? err.message : String(err)}，降级为 simple 配置`)
      this.useChineseConfig = false
    } finally {
      this.configChecked = true
    }
  }

  async search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]> {
    if (!query || query.trim() === '') {
      return []
    }
    if (!kbIds || kbIds.length === 0) {
      return []
    }

    const config = this.useChineseConfig ? 'chinese' : 'simple'
    // 安全约束：config 只能是 'chinese' 或 'simple'，由 onModuleInit 检测结果决定，不可来自用户输入
    const limit = topK ?? 10
    const trimmedQuery = query.trim()

    const results = await this.prisma.$queryRaw<Array<{
      id: string
      document_id: string
      kb_id: string
      content: string
      chunk_index: number
      rank: number
    }>>`
      SELECT id, document_id, kb_id, content, chunk_index,
        ts_rank_cd(to_tsvector(${config}, content), plainto_tsquery(${config}, ${trimmedQuery})) as rank
      FROM chunks
      WHERE kb_id = ANY(${kbIds}::uuid[])
        AND to_tsvector(${config}, content) @@ plainto_tsquery(${config}, ${trimmedQuery})
      ORDER BY rank DESC
      LIMIT ${limit}
    `

    return results.map(r => ({
      chunk: {
        id: r.id,
        documentId: r.document_id,
        kbId: r.kb_id,
        content: r.content,
        chunkIndex: r.chunk_index,
      },
      score: Math.min(1, Number(r.rank)),
      source: 'keyword' as const,
    }))
  }
}
```

### 1.4 KeywordModule（新增）

**文件**: `packages/server/src/processors/keyword/keyword.module.ts`

```typescript
import { Global, Module } from '@nestjs/common'
import { KeywordService } from './keyword.service.js'

@Global()
@Module({
  providers: [KeywordService],
  exports: [KeywordService],
})
export class KeywordModule {}
```

### 1.5 DocumentService.remove()（变更）

**文件**: `packages/server/src/modules/knowledge-base/document.service.ts`

```typescript
@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly vectorService: VectorService,
  ) {}

  async remove(userId: string, kbId: string, docId: string) {
    await this.ensureOwnership(userId, kbId)
    const doc = await this.prisma.document.findUnique({ where: { id: docId } })
    if (!doc || doc.kbId !== kbId) throw new NotFoundException('文档不存在')

    // 同步删除向量记录
    await this.vectorService.deleteByFileId(docId)

    await this.prisma.document.delete({ where: { id: docId } })
    return { id: docId, deleted: true }
  }
}
```

### 1.6 AppModule（变更）

**文件**: `packages/server/src/app.module.ts`

在 `imports` 数组中新增 `KeywordModule`:

```typescript
import { KeywordModule } from './processors/keyword/keyword.module.js'

@Module({
  imports: [
    // ... 现有模块 ...
    VectorModule,
    KeywordModule, // 新增
    QueueModule.forRoot(),
    // ...
  ],
})
export class AppModule {}
```

### 1.7 package.json（变更）

**文件**: `packages/server/package.json`

在 `dependencies` 中新增:

```json
{
  "dependencies": {
    "@goferbot/rag-sdk": "workspace:*"
  }
}
```

## 2. SQL 策略

### 2.1 关键词检索查询

**zhparser 可用时**:

```sql
SELECT id, document_id, kb_id, content, chunk_index,
  ts_rank_cd(to_tsvector('chinese', content), plainto_tsquery('chinese', $1)) as rank
FROM chunks
WHERE kb_id = ANY($2::uuid[])
  AND to_tsvector('chinese', content) @@ plainto_tsquery('chinese', $1)
ORDER BY rank DESC
LIMIT $3
```

**zhparser 未安装时（降级）**:

```sql
SELECT id, document_id, kb_id, content, chunk_index,
  ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', $1)) as rank
FROM chunks
WHERE kb_id = ANY($2::uuid[])
  AND to_tsvector('simple', content) @@ plainto_tsquery('simple', $1)
ORDER BY rank DESC
LIMIT $3
```

### 2.2 zhparser 检测查询

```sql
SELECT extname FROM pg_extension WHERE extname = 'zhparser'
```

### 2.3 索引建议

为提升 `KeywordService.search` 性能，需在 `chunks` 表创建 GIN 索引。该索引由独立的数据库迁移管理，不在本 issue 代码变更范围内，但需在部署文档中说明：

```sql
-- 若使用 zhparser
CREATE INDEX idx_chunks_fts_chinese ON chunks USING GIN (to_tsvector('chinese', content));

-- 若降级为 simple（或作为备用索引）
CREATE INDEX idx_chunks_fts_simple ON chunks USING GIN (to_tsvector('simple', content));
```

> 决策理由：GIN 索引是 PostgreSQL 全文检索的标准索引类型，可显著加速 `@@` 匹配操作。由于 `to_tsvector` 是函数调用，必须使用表达式索引（functional index）。`chinese` 与 `simple` 的 tsvector 输出不同，因此需要分别建索引。

## 3. 错误处理

### 3.1 错误码映射

| 场景 | 抛出异常 | 错误码 | HTTP 状态 | 处理方 |
|------|----------|--------|-----------|--------|
| `query` 为空字符串 | 返回空数组 `[]` | — | — | `KeywordService.search` 内部处理 |
| `kbIds` 为空数组 | 返回空数组 `[]` | — | — | `KeywordService.search` 内部处理 |
| zhparser 检测 SQL 失败 | 降级为 `simple`，记录 warn 日志 | — | — | `KeywordService.detectZhparser` |
| Prisma `$queryRaw` 执行失败 | 抛出原生 `Prisma.PrismaClientKnownRequestError` | `INTERNAL_ERROR` | 500 | `AllExceptionsFilter` |
| SQL 注入（config 被篡改） | `config` 非 `'chinese'`/`'simple'` 时 `to_tsvector` 行为异常 | — | — | 由 `onModuleInit` 锁定 config，不可来自用户输入 |
| Milvus 连接失败 | 抛出 `VectorStoreError` | `INTERNAL_ERROR` | 500 | `AllExceptionsFilter` |
| 向量维度不匹配 | 抛出 `VectorStoreError` | `INTERNAL_ERROR` | 500 | `AllExceptionsFilter` |
| `deleteByFileId` 时 Milvus 断开 | 抛出 `VectorStoreError` | `INTERNAL_ERROR` | 500 | `AllExceptionsFilter` |

### 3.2 降级行为

| 场景 | 行为 | 用户感知 |
|------|------|----------|
| zhparser 未安装 | `KeywordService` 自动降级为 `simple` 配置，后续所有查询使用 `to_tsvector('simple', content)` | 关键词检索质量下降（中文无法分词），但功能可用 |
| `KeywordService.search` 被 `HybridRetriever` 调用时抛出异常 | `HybridRetriever` 内部 catch，若向量结果可用则返回纯向量结果，否则抛出 `RetrievalError` | 对话继续（若向量可用）或 SSE 报错（若两者皆失败） |
| `DocumentService.remove()` 中 `deleteByFileId` 失败 | 当前行为：异常向上传播，Document 记录不删除 | 用户收到 500 错误，文档保留；需人工排查 Milvus 状态后重试 |

> 决策理由：`deleteByFileId` 失败时不静默跳过，避免产生孤立向量。若未来需要“尽力删除”语义，可改为 catch 后记录 error 日志再删除 PG 记录，但当前 MVP 选择显式失败。

## 4. 类型兼容性说明

### 4.1 SDK `IVectorStore` 与 server 原 `IVectorStore` 对比

| 字段/方法 | SDK `IVectorStore` | server 原 `IVectorStore` | 差异 |
|-----------|--------------------|--------------------------|------|
| `insertVectors(vectors: VectorRecord[])` | 有 | 有 | 无 |
| `searchVectors(queryVector, options?)` | 有 | 有 | 无 |
| `deleteByIds(ids: string[])` | 有 | 有 | 无 |
| `ensureCollection()` | 有 | 有 | 无 |
| `VectorRecord.id` | `string` | `string` | 无 |
| `VectorRecord.chunkId` | `string` | `string` | 无 |
| `VectorRecord.kbId` | `string` | `string` | 无 |
| `VectorRecord.fileId` | `string` | `string` | 无 |
| `VectorRecord.embedding` | `number[]` | `number[]` | 无 |
| `VectorSearchOptions.topK` | `number?` | `number?` | 无 |
| `VectorSearchOptions.filter.kbId` | `string?` | `string?` | 无 |
| `VectorSearchResult.id` | `string` | `string` | 无 |
| `VectorSearchResult.chunkId` | `string` | `string` | 无 |
| `VectorSearchResult.score` | `number` | `number` | 无 |

**结论**：字段与签名完全一致，直接替换接口引用即可，无需修改 `MilvusVectorStore` 的任何方法实现。

### 4.2 `RetrievalCandidate.chunk` 字段填充

`KeywordService.search` 返回的 `RetrievalCandidate` 中，`chunk` 字段的填充策略如下：

| `Chunk` 字段 | 来源 | 说明 |
|-------------|------|------|
| `id` | `chunks.id` | 主键 |
| `documentId` | `chunks.document_id` | 关联文档 |
| `kbId` | `chunks.kb_id` | 关联知识库 |
| `content` | `chunks.content` | 文本内容 |
| `chunkIndex` | `chunks.chunk_index` | 分块序号 |
| `tokenCount` | `undefined` | 当前 chunks 表有 `token_count` 字段，但 `KeywordService` 不反查该字段（减少 SQL 字段数）。`DefaultRetrievalPostprocessor` 会回退到 `Math.ceil(content.length / 4)` |
| `parentId` | `undefined` | 当前 schema 无此字段，不影响 postprocessor |
| `hierarchyPath` | `undefined` | 当前 schema 无此字段，不影响 postprocessor |
| `metadata` | `undefined` | 当前 schema 无此字段，不影响 postprocessor |

> 决策理由：`KeywordService` 的职责是关键词检索，不应承担 chunk 元数据补全职责。`HybridRetriever` 在融合结果后，若下游需要完整 chunk 信息，应由 `Postprocessor` 或业务层通过 `chunkId` 反查补充。当前 `DefaultRetrievalPostprocessor` 仅需 `content` 和 `tokenCount`，缺失字段有安全回退。

## 5. 测试映射

### 5.1 单元测试

| 测试文件路径 | 用例名 | 覆盖点 |
|-------------|--------|--------|
| `tests/issues/b-10-server-vector-keyword-adapters/vector-service.spec.ts` | `AC-01: VectorService implements SDK IVectorStore interface` | 类型编译通过、方法存在性 |
| `tests/issues/b-10-server-vector-keyword-adapters/vector-service.spec.ts` | `AC-02: deleteByFileId and deleteByKbId remain as extension methods` | 扩展方法可调用、不在 SDK 接口中 |
| `tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts` | `AC-03: search returns RetrievalCandidate[] ordered by rank desc` | FTS 查询构造、结果排序、字段映射 |
| `tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts` | `AC-04: search filters by kbIds` | `kb_id = ANY(...)` 过滤生效 |
| `tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts` | `AC-05: search returns empty array for empty query` | 空 query 边界 |
| `tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts` | `AC-06: search returns empty array for empty kbIds` | 空 kbIds 边界 |
| `tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts` | `AC-07: falls back to simple config when zhparser is not installed` | 降级路径、不抛异常 |
| `tests/issues/b-10-server-vector-keyword-adapters/document-service.spec.ts` | `AC-08: remove calls deleteByFileId before deleting document record` | 调用顺序、异常传播 |

### 5.2 集成测试

| 测试文件路径 | 用例名 | 覆盖点 |
|-------------|--------|--------|
| `tests/integration/vector-keyword-adapters.spec.ts` | `AC-09: KeywordService.search works against real PostgreSQL` | 端到端 FTS 查询、GIN 索引生效 |
| `tests/integration/vector-keyword-adapters.spec.ts` | `AC-10: VectorService.searchVectors returns results after insertVectors` | Milvus 插入+搜索端到端 |

### 5.3 类型检查

| 命令 | 预期结果 |
|------|----------|
| `pnpm type-check` | 0 错误，0 警告 |

## 6. 依赖与调用关系

### 6.1 导入关系图

```
packages/server/src/processors/vector/vector.service.ts
  -> @goferbot/rag-sdk (IVectorStore, VectorRecord, VectorSearchOptions, VectorSearchResult)
  -> ../../vector/milvus.js (MilvusVectorStore)

packages/server/src/vector/milvus.ts
  -> @goferbot/rag-sdk (IVectorStore, VectorRecord, VectorSearchOptions, VectorSearchResult)
  -> ../interfaces/errors.js (VectorStoreError)

packages/server/src/processors/keyword/keyword.service.ts
  -> @goferbot/rag-sdk (IKeywordStore, RetrievalCandidate)
  -> ../database/prisma.service.js (PrismaService)

packages/server/src/modules/knowledge-base/document.service.ts
  -> ../../processors/vector/vector.service.js (VectorService)
```

### 6.2 删除的文件

| 文件路径 | 删除理由 |
|----------|----------|
| `packages/server/src/interfaces/IVectorStore.ts` | 与 SDK `IVectorStore` 完全重复，server 侧不再维护自有定义 |

### 6.3 新增的文件

| 文件路径 | 说明 |
|----------|------|
| `packages/server/src/processors/keyword/keyword.service.ts` | `KeywordService` 实现 |
| `packages/server/src/processors/keyword/keyword.module.ts` | `KeywordModule` 定义 |

## 7. 环境变量

本 issue 不引入新的环境变量。现有环境变量继续生效：

| 变量 | 用途 | 所在服务 |
|------|------|----------|
| `MILVUS_HOST` | Milvus 服务地址 | `VectorService` |
| `MILVUS_PORT` | Milvus gRPC 端口 | `VectorService` |
| `MILVUS_COLLECTION` | Milvus collection 名称 | `VectorService` |
| `MILVUS_VECTOR_DIM` | 向量维度 | `VectorService` |
| `DATABASE_URL` | PostgreSQL 连接字符串 | `KeywordService`（通过 `PrismaService`） |
