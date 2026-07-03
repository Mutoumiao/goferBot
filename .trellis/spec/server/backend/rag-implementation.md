# RAG 实现细节

> ES 检索内部机制、过滤器构建、BGE reranker 配置以及处理器架构。
>
> **REFERENCE_ONLY**: 此文件记录实现细节（HOW）。功能规范权威源为 [openspec/specs/rag/spec.md](../../../../openspec/specs/rag/spec.md)（WHAT）。检索管线/权限模型/分块策略/API端点应以 OpenSpec 为准。

---

## Elasticsearch 过滤器构建器

向量检索和 BM25 检索路径共享的统一过滤器构建服务。

**Source**: `packages/server/src/processors/rag/es-filter.builder.ts#L22-L98`

### 过滤器结构

```typescript
{
  bool: {
    filter: [
      { terms: { kb_id: kbIds } },              // Knowledge base isolation
      { term: { document_id: documentId } },     // Optional: specific document
      { term: { status: 'active' } }             // Only active chunks
    ],
    should: [
      { terms: { allowed_user_ids: [userId] } }, // User in allow list
      { bool: { must_not: { exists: { field: 'allowed_user_ids' } } } } // Public
    ],
    minimum_should_match: 1
  }
}
```

### ACL 逻辑

- `should` 子句配合 `minimum_should_match: 1` — 至少满足一个条件
- 条件 1：用户 ID 在 `allowed_user_ids` 中 → 显式权限
- 条件 2：`allowed_user_ids` 字段不存在 → 公开文档
- 向后兼容：没有 ACL 字段的文档对所有用户可见

---

## ES 向量搜索

**Source**: `packages/server/src/processors/rag/es-vector.service.ts#L42-L64`

```
knn:
  field: 'embedding'
  query_vector: [...]
  k: topK
  num_candidates: topK * 5
  filter: [ACL filter applied BEFORE ANN traversal]
```

关键：ACL 过滤器通过 `knn.filter` 应用，意味着未授权文档在 **近似最近邻遍历开始之前** 就被排除。这比检索后过滤更安全，因为未授权的向量永远不会被检查。

---

## ES 关键词搜索

**Source**: `packages/server/src/processors/rag/es-keyword.service.ts#L45-L116`

```
match:
  field: 'content'
  query: userQuery
  analyzer: language === 'zh' ? 'ik_smart' : 'standard'
```

- 动态分析器选择：中文使用 `ik_smart`，英文使用 `standard`
- 分数归一化：`score / maxScore`
- 默认 `size`：20
- 出错时：返回空数组（管道仅使用向量结果继续执行）

---

## BGE Reranker 配置

**Source**: `packages/server/src/processors/rag/bge-rerank.service.ts`

### 模型选择

- 模型通过管理面板设置配置：`rag.rerankerProvider`
- 通过 `ModelProviderService` 解析（非硬编码）
- 白名单验证：模型名称必须以 `BAAI/`、`Xorbits/` 或 `sentence-transformers/` 开头

### 推理

- 使用 `@xenova/transformers` 进行本地推理
- `AutoTokenizer.from_pretrained(modelId)` + `AutoModelForSequenceClassification.from_pretrained(modelId)` (cross-encoder)
- `batchSize`：16
- `max_length`：512 tokens
- 预加载由 `RERANK_EAGER_LOAD` 环境变量控制

### 热重载

```typescript
// Listens for config changes
config.changed.subscribe(() => {
  // Reload model when rag.rerankerProvider changes
})
```

### 降级策略

当模型加载失败时（例如网络错误、无效模型）：
- 降级到词法匹配（50% 权重）+ 原始检索分数（50% 权重）
- 管道不受中断继续执行

---

## 处理器架构：双层结构

**Source**: 跨边界导入分析（grep）

`processors/` 目录不是纯粹的基础设施层。它具有双层结构：

```
processors/
├── pure_infrastructure/     ← 只被依赖，从不依赖其他模块
│   ├── database/            PrismaService, DatabaseModule, TransactionManager
│   └── storage/             StorageService, StorageModule, MinIO provider
│
└── orchestration_processors/ ← 依赖 modules/ 中的领域类型
    ├── rag/                 需要 ModelProviderService, SystemConfigService, LlamaIndexProvider
    ├── queue/               需要 ChatModule, SettingsModule (BullMQ processor registration)
    └── chat/                需要 ConversationService, LlmProviderFactory
```

### 跨边界依赖统计

| 方向 | 数量 | 示例 |
|-----------|-------|----------|
| modules → processors | 32 | PrismaService 随处使用；StorageService 在 knowledge-base 中；RagModule 在 chat 中 |
| processors → modules | 30 | RAG 依赖 settings/LLM；queue 依赖 chat/settings；listeners 依赖领域事件 |

### 事件驱动的松耦合

在可能的情况下，处理器使用 NestJS `EventEmitter` 进行模块通信：

```
processors/rag/listeners/document-uploaded.listener.ts
    ↓ listens to
modules/knowledge-base/events/document-uploaded.event.ts
```

这避免了从处理器反向导入业务服务。