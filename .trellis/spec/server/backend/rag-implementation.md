# RAG 能力开发指南（委托 Knowledge AI）

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为
> [openspec/specs/rag/spec.md](../../../../openspec/specs/rag/spec.md) 与
> [openspec/specs/knowledge-ai/spec.md](../../../../openspec/specs/knowledge-ai/spec.md)（WHAT）。

---

## Purpose

说明知识库 RAG **能力层**在代码中的落点。权威运行时已迁移至 Python Knowledge AI；本指南防止开发者继续在 Nest 内实现 hybrid/ES knn/BGE。

## Primary OpenSpec

- [openspec/specs/rag/spec.md](../../../../openspec/specs/rag/spec.md) — 能力语义
- [openspec/specs/knowledge-ai/spec.md](../../../../openspec/specs/knowledge-ai/spec.md) — 运行时契约

## Related Trellis Guides

- **首选实现指南**：[knowledge-ai-service.md](./knowledge-ai-service.md)
- [queue-implementation.md](./queue-implementation.md)
- [provider-module-guide.md](./provider-module-guide.md)

## Module Dependencies

- Knowledge AI HTTP（Nest Client）
- pgvector（Python schema `knowledge`）
- Elasticsearch BM25（Python）
- Provider 池（Nest 解密后注入 `_provider`）

## Development Entry

| 旧路径（已删除） | 新路径 |
|------------------|--------|
| `packages/server/src/processors/rag/*` | **勿再创建** |
| Nest LlamaIndexRagService 索引 | `IndexingWorker` + `KnowledgeAiClient.index` |
| Nest rag-retrieval 管线 | Python `retrieval/hybrid.py` + Chat `stream` |

Nest 入口：

- `processors/knowledge-ai/`
- `modules/chat/chat.service.ts`
- `processors/queue/indexing.worker.ts`

Python 入口：`services/knowledge-ai-service/src/knowledge_ai/`

## Implementation Notes

### 管线顺序（实现时核对）

L1 Must-Merged → filter kb_ids → BM25 ∥ pgvector → RRF → **Parent** → **API Rerank** → generate

Parent **必须**在 Rerank 之前（与 OpenSpec 一致）。

### 存储

- 主向量：**PG pgvector**（`knowledge.chunks`）
- 全文：**ES**（无主 dense_vector）
- Nest Prisma `Chunk` 表：遗留清理用，**非**知识索引权威

### 权限

Nest `assertKbOwnership` + 服务令牌；Python 只按 `kb_ids` 过滤。不要恢复 ES `allowed_user_ids` 权威 ACL。

## Testing Checklist

见 [knowledge-ai-service.md](./knowledge-ai-service.md) Testing Checklist。

## Review Checklist

- [ ] 变更是否只动 Client/Chat/Worker/Python，而非复活 Nest rag 模块
- [ ] OpenSpec rag 与 knowledge-ai 是否同步

## Common Pitfalls

### Don't: 在 Nest 重新实现 hybrid

任何「为了快一点」在 Nest 写向量检索的补丁都会造成双写与权限漂移。一律走 Knowledge AI。

### Common Mistake: 文档仍写 processors/rag 路径

**Symptom**：新会话按旧路径改代码找不到文件。  
**Fix**：以本指南 + knowledge-ai-service 为准；更新 discovery 时勿引用已删目录。
