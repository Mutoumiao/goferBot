# Feature Spec: b-10 Server 向量与关键词存储适配

## 范围

本规格定义 `VectorService` 适配 SDK `IVectorStore` 接口、新增 `KeywordService` 实现 SDK `IKeywordStore` 接口的完整行为约束。

## 用户故事

### US-1: 向量存储接口统一
作为后端开发者，我希望 `VectorService` 实现 SDK 定义的 `IVectorStore`，使 `HybridRetriever` 能够直接注入使用，避免 server 与 SDK 之间因接口重复定义导致的类型不兼容。

### US-2: 关键词检索基础设施
作为后端开发者，我需要基于 PostgreSQL 全文检索的 `KeywordService`，使 `HybridRetriever` 在混合检索时拥有关键词分支，提升中文文档检索召回率。

### US-3: 文档删除时向量同步清理
作为用户，当我删除知识库中的文档时，系统应同步删除该文档在 Milvus 中的全部向量记录，避免产生无法访问的孤立向量。

### US-4: 中文分词降级可用
作为运维人员，当 PostgreSQL 未安装 zhparser 扩展时，关键词检索应降级为 `simple` 配置继续工作，保证功能可用性，而非直接报错。

## 边界

### 包含
- `VectorService` 接口声明改为 `implements import('@goferbot/rag-sdk').IVectorStore`
- 删除 `packages/server/src/interfaces/IVectorStore.ts`
- 新增 `KeywordService` 实现 `IKeywordStore`，基于 PostgreSQL `to_tsvector` / `plainto_tsquery`
- `KeywordService` 的 zhparser 检测与降级逻辑
- `DocumentService.remove()` 调用 `VectorService.deleteByFileId()`
- 新增 `KeywordModule` 并注册到 `AppModule`
- `packages/server/package.json` 添加 `@goferbot/rag-sdk` 依赖

### 不包含
- `HybridRetriever` 本身的实现（属于 SDK，已冻结）
- `ChatService` 的检索上下文注入（属于 issue b-09）
- 索引流水线 Worker 的实现（属于 issue b-11）
- `PrismaMilvusIndexer` 的实现（属于 issue b-11）
- 向量数据库从 Milvus 迁移到其他引擎
- 关键词检索从 PostgreSQL FTS 迁移到 Elasticsearch / Meilisearch

## 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 接口适配方式 | 直接 `implements` SDK `IVectorStore`，删除 server 自有定义 | SDK 与 server 的字段完全一致，保留两份定义导致 TypeScript 视为不同类型，无法直接注入 `HybridRetriever` |
| `deleteByFileId` / `deleteByKbId` 去留 | 保留为 `VectorService` 扩展方法 | 这两个方法是业务层高频操作（删除文档/知识库时清理向量），但不在 SDK `IVectorStore` 接口中。删除会破坏 `DocumentService.remove()` 和下游知识库删除逻辑 |
| 关键词存储引擎 | PostgreSQL `to_tsvector` + `plainto_tsquery` | 无需引入额外依赖，MVP 阶段够用；已有 Chunk 内容存储在 PostgreSQL，直接复用 |
| 中文分词方案 | zhparser（优先）+ `simple`（降级） | zhparser 是 PostgreSQL 中文全文检索的标准扩展，支持语义分词；`simple` 仅按空格分词，中文效果差但可用 |
| zhparser 检测时机 | `KeywordService` 构造函数内异步检测，结果缓存到私有字段 | 避免每次查询都执行检测 SQL；检测失败时记录 warn 日志一次 |
| `KeywordService.search` 返回的 `RetrievalCandidate.chunk` 字段填充 | 从 `chunks` 表直接返回 `id`, `documentId`, `kbId`, `content`, `chunkIndex`；`tokenCount` / `parentId` / `hierarchyPath` / `metadata` 为 `undefined` | `IKeywordStore` 仅需满足 `RetrievalCandidate` 的 `chunk` 为 `Chunk` 类型；`Chunk` 的 `tokenCount` 等字段为 optional，缺失不影响 postprocessor 运行（postprocessor 会回退到 `Math.ceil(content.length / 4)`） |
| `KeywordService` 模块范围 | `@Global()` | `VectorModule` 已是 `@Global()`，为保持存储层服务的一致性，`KeywordModule` 同样设为全局模块 |
| `@goferbot/rag-sdk` 依赖版本 | `workspace:*` |  monorepo 内 workspace 协议确保始终使用本地最新构建 |

## 验收标准

- [ ] `VectorService` 的 `implements` 子句引用 `@goferbot/rag-sdk` 的 `IVectorStore`
- [ ] `packages/server/src/interfaces/IVectorStore.ts` 文件已删除
- [ ] `pnpm type-check` 在 `packages/server` 中 0 错误
- [ ] `KeywordService.search()` 在 zhparser 可用时返回按 `ts_rank_cd` 降序排列的 `RetrievalCandidate[]`
- [ ] `KeywordService.search()` 在 zhparser 不可用时降级为 `simple` 配置，不抛出异常
- [ ] `DocumentService.remove()` 在删除 PG 记录前调用 `this.vectorService.deleteByFileId(docId)`
- [ ] `KeywordModule` 已导入 `AppModule`
- [ ] 单元测试覆盖 `KeywordService.search` 的 FTS 查询构造、kbIds 过滤、空结果、zhparser 降级路径
