# Knowledge AI 服务开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为
> [openspec/specs/knowledge-ai/spec.md](../../../../openspec/specs/knowledge-ai/spec.md)（WHAT）。

---

## Purpose

帮助在 **Nest 编排 + Python Knowledge AI** 双进程知识域中安全接线：服务令牌、分层超时、embedding 一致性、索引/删除、SSE 透传。不重复 OpenSpec 业务条文。

## Primary OpenSpec

- [openspec/specs/knowledge-ai/spec.md](../../../../openspec/specs/knowledge-ai/spec.md)

## Related OpenSpec

- [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md)
- [openspec/specs/queue/spec.md](../../../../openspec/specs/queue/spec.md)
- [openspec/specs/knowledge-base/spec.md](../../../../openspec/specs/knowledge-base/spec.md)
- [openspec/specs/rag/spec.md](../../../../openspec/specs/rag/spec.md)
- [openspec/specs/settings/spec.md](../../../../openspec/specs/settings/spec.md)

## Related Trellis Guides

- [queue-implementation.md](./queue-implementation.md) — IndexingWorker
- [rag-implementation.md](./rag-implementation.md) — 能力层指针（已非 Nest 本地管线）
- [provider-module-guide.md](./provider-module-guide.md) — Provider 解密与 SSRF 白名单

## When You Need To

- 改 Chat 知识问答 / 索引 / 删除索引
- 调 Knowledge AI HTTP 契约或 `_provider` 注入
- 排查「有文档但召回为空 / 向量空间不一致」
- 部署 compose 中的 ES + knowledge-ai

## Module Dependencies

| 组件 | 路径 |
|------|------|
| Nest Client | `packages/server/src/processors/knowledge-ai/` |
| Nest Chat | `packages/server/src/modules/chat/chat.service.ts` |
| Nest Index Worker | `packages/server/src/processors/queue/indexing.worker.ts` |
| Nest Cleanup | `packages/server/src/modules/knowledge-base/kb-cleanup.service.ts` |
| Python 服务 | `services/knowledge-ai-service/` |
| 共享 SSE 契约 | `packages/data/src/schemas/chat.schema.ts` |

## Development Entry

```
packages/server/src/processors/knowledge-ai/
  knowledge-ai.client.ts           # HTTP + SSE 解析 + 超时
  knowledge-ai.provider-resolver.ts # embedding/rerank 解析（与索引共用）
  knowledge-ai.module.ts
  knowledge-ai.types.ts

services/knowledge-ai-service/src/knowledge_ai/
  api/routes.py
  auth/service_token.py
  indexing/indexer.py
  retrieval/hybrid.py
  generation/generate.py
```

本地 Python：**uv**（`uv sync` / `uv run`），禁止依赖系统全局 Python 作为唯一环境。

---

## Scenario: Nest → Knowledge AI 跨层契约（code-spec 7 段）

### 1. Scope / Trigger

跨进程 HTTP + 密钥注入 + 索引/检索/删除；触达 env、超时、多 KB、SSE。

### 2. Signatures

**Python（服务令牌）**

| Method | Path | 说明 |
|--------|------|------|
| GET | `/health`, `/health/live` | 公开 |
| POST | `/index` | 索引 replace |
| DELETE | `/documents/{id}` | 按文档双清 |
| DELETE | `/kb/{kb_id}` | 按 KB 双清 |
| POST | `/retrieve` | 仅检索 |
| POST | `/query` | 非流式问答 |
| POST | `/stream` | SSE 问答 |

**Nest**

- `KnowledgeAiClient.stream(body, { signal, generationTimeoutMs })`
- `KnowledgeAiClient.index(body)` / `deleteDocument` / `deleteKb`
- `KnowledgeAiProviderResolver.resolveEmbeddingConfig(userId)`
- `ChatService.streamChat` → 组装 `kb_ids` + `_provider` + history

### 3. Contracts

**公共请求字段**

| 字段 | 类型 | 约束 |
|------|------|------|
| `query` | string | 问答必填 |
| `kb_ids` | string[] | min 1；Nest 已校验所有权 |
| `top_k` | int | 默认 5 |
| `retrieval_mode` | `strict`\|`loose` | 默认 strict |
| `history` | `{role,content}[]` | 约最近 10 条 |
| `trace_id` | string? | 观测 |
| `conversation_id` / `message_id` | string? | Nest 生成，Python 不发明 |
| `_provider` | object | embedding/llm/rerank + `*_api_key` / `*_base_url` / `*_model` |
| `_prompts` | object? | 可选提示覆盖 |

**SSE 事件顺序**：`sources` → `message`* → `message_end` | `error`

**环境变量（Nest）**

| Key | 必填 | 说明 |
|-----|------|------|
| `KNOWLEDGE_AI_BASE_URL` 或 `KNOWLEDGE_AI_URL` | 建议 | 默认 `http://127.0.0.1:8090` |
| `KNOWLEDGE_AI_SERVICE_TOKEN` | **是** | 空则 fail-closed |
| `KNOWLEDGE_AI_CONNECT_TIMEOUT_MS` | 否 | 默认 15000 |
| `KNOWLEDGE_AI_GENERATION_TIMEOUT_MS` | 否 | 默认 180000 |

**环境变量（Python 容器）**

| Key | 说明 |
|-----|------|
| `KNOWLEDGE_AI_SERVICE_TOKEN` | 与 Nest 一致 |
| `DATABASE_URL` / `KNOWLEDGE_AI_DATABASE_URL` | 容器内用 `postgres` 主机名 |
| `ELASTICSEARCH_URL` / `KNOWLEDGE_AI_ELASTICSEARCH_URL` | 容器内用 `http://elasticsearch:9200`，**禁止**误注 `127.0.0.1` |

### 4. Validation & Error Matrix

| 条件 | 行为 |
|------|------|
| 无/错 Bearer | Python 401 |
| Nest token 空 | `ServiceUnavailableException`，不发请求 |
| Chat 无 `knowledge_base_ids` | 400 `KB_REQUIRED` |
| KB 非本人 | 404 `NOT_FOUND` |
| 无可用 embedding 配置 | 400 TYPE_MISMATCH / Worker Error |
| 无 `embedding_api_key` 调 embed | Python ValueError → 索引失败 |
| strict 空检索 | 业务成功 + `retrieval_empty`，助手 `completed` |
| 生成超时 / Abort | 助手 `failed`/`cancelled`，error 无栈 |
| Rerank 失败 | `degraded`，继续 |

### 5. Good / Base / Bad Cases

- **Good**：多 KB 均属用户；index ready 后 stream 有 sources；token 非空；embedding 与 index 同源
- **Base**：strict 空检索 → completed + retrieval_empty + 未找到类正文
- **Bad**：Chat 用 LLM provider 自带 embedding、Index 用 `rag.embeddingProvider` 另一模型 → 召回崩溃；容器 ES URL 指向 `127.0.0.1`

### 6. Tests Required

| 层 | 断言点 |
|----|--------|
| Python unit | token 长度不等→False；RRF/parent/strict stream；redact |
| Nest unit | Chat sources→message→end；KB 拒绝；IndexingWorker → `/index` + ready/failed |
| Web unit | GoferChatProvider 处理 sources；KB 选择器必选 |
| 边界 DoD | index→retrieve sources→stream→delete 不可召回（`scripts/dod_acceptance.py`） |

### 7. Wrong vs Correct

#### Wrong

```typescript
// Chat 只取当前 LLM provider 的 embedding → 与 Index 向量空间不一致
const emb = chatProvider.models.find((m) => m.type === 'embedding')
_provider.embedding_model = emb.name
_provider.embedding_api_key = chatProvider.apiKey
```

```python
# 无 key 仍写伪向量 → 污染 hybrid 检索
if not api_key:
    return pseudo_embeddings(texts)
```

#### Correct

```typescript
// Index 与 Chat 共用
const embCfg = await this.knowledgeAiProviderResolver.resolveEmbeddingConfig(userId)
// 与 llm 字段合并进 _provider
```

```python
if not self.provider.embedding_api_key:
    raise ValueError("embedding_api_key is required ...")
```

---

## Implementation Notes

### 设计决策：双进程信任边界

- **Nest**：JWT + KB 所有权 + baseUrl SSRF 白名单 + 解密 API Key
- **Python**：服务令牌 + 信任 `kb_ids` + 出站模型 HTTP
- 令牌泄露 ≈ 任意 index/delete + 出站 SSRF；生产强随机 token + 仅内网

### 约定：Embedding 单一解析器

`KnowledgeAiProviderResolver` 是 **IndexingWorker 与 ChatService 共用** 的唯一入口：

1. 优先 `settings.rag.embeddingProvider`
2. 否则扫描 providers 池中已启用 embedding 模型
3. Rerank：同 provider 或 `settings.rag.rerankerProvider`

### 约定：Safe replace 索引

Python `Indexer`：先 embed 成功 → PG 事务 delete+insert → ES bulk + 删 stale。禁止 delete-before-embed 导致空窗。

### 约定：删除顺序（fail-closed）

文档 / 文件夹 / KB：先 Knowledge AI，再业务 DB（及对象存储）。**KA 删除失败 → 抛 `ServiceUnavailableException`（`KNOWLEDGE_AI_PURGE_FAILED`），不删业务元数据**。对象存储失败仍可仅记日志。

### Gotcha：Docker 网络

容器内 `ELASTICSEARCH_URL=http://127.0.0.1:9200` 会 health degraded。compose 使用 `KNOWLEDGE_AI_ELASTICSEARCH_URL` 默认 `http://elasticsearch:9200`，避免根 `.env` 的 host 导向 URL 注入容器。

### Gotcha：服务令牌 compare_digest

长度不等时必须先返回 False，禁止让 `compare_digest` 抛错变成 500。

### 密钥脱敏

`redact_provider_secrets` 剥离 `*_api_key`；对外 `_public_error` 截断且过滤 authorization/api_key 字样。

---

## Testing Checklist

- [ ] 无 token / 错 token → 401
- [ ] 空 Nest token → 不发起 fetch
- [ ] Chat 无 KB / 无权 KB → 4xx/404
- [ ] Index ready 后 retrieve 含 kb_id+document_id
- [ ] strict 空检索 → completed + retrieval_empty
- [ ] Rerank 失败仍有回答 + degraded
- [ ] 删除文档/KB 后不可召回
- [ ] Chat 与 Index embedding 配置同源（单测 mock resolver）

## Review Checklist

- [ ] 未恢复 Nest `processors/rag` 权威路径
- [ ] 未在 Python 写业务用户 ACL 二次查询
- [ ] 未在生产打开公网 docs + 默认弱 token
- [ ] 日志无明文 API Key
- [ ] Companion 未误接 Knowledge AI

## Common Pitfalls

### Common Mistake: Chat/Index embedding 分叉

**Symptom**：文档已 ready 但问答 sources 恒空或乱序命中。  
**Cause**：两边解析不同 provider/model。  
**Fix**：只走 `KnowledgeAiProviderResolver`。

### Common Mistake: 伪向量入库

**Symptom**：检索分数「有结果」但语义全错。  
**Cause**：无 embedding key 仍写确定性伪向量。  
**Fix**：fail-closed，禁止伪向量。

### Common Mistake: 文件夹先删 DB 再清 KA

**Symptom**：短暂窗口内仍可召回已删文档。  
**Fix**：与 document 一致，先 KA 再 DB。

### Don't: 双跑旧 Nest RAG

```typescript
// 禁止：重新引入 processors/rag 与 Python 并行写索引
```

---

## Reusable Patterns

```typescript
// 合并 AbortSignal + 分层超时见 KnowledgeAiClient.stream
// 鉴权头：空 token 抛 ServiceUnavailableException
```

```python
# 中间件：PUBLIC_PATHS = /health, /health/live
# 业务路由：require Bearer service token
```
