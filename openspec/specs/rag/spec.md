# RAG - 检索增强生成（能力层）

## Purpose（目的）

定义 GoferBot **知识库 RAG** 业务能力（检索增强生成）的阶段语义与存储原则。

> **运行时权威实现**：Python **Knowledge AI Service**（见 [knowledge-ai/spec.md](../knowledge-ai/spec.md)）。  
> NestJS `packages/server/src/processors/rag/` **已移除**，MUST NOT 再作为混合检索 / 知识答案生成 / 向量索引权威路径。  
> Nest 职责：JWT 鉴权、KB 所有权、组装 `_provider`、透传 SSE、索引 Job 触发与删除级联。

## Requirements（需求）

### Requirement: RAG 委托 Knowledge AI

系统的知识库 RAG 检索与知识答案生成 MUST 委托 Python Knowledge AI Service。NestJS MUST NOT 继续作为 Knowledge 混合检索与知识答案生成的权威运行时。

#### Scenario: 无本地混合检索权威路径

- **WHEN** Chat 触发知识检索
- **THEN** 系统 MUST 通过 Knowledge AI HTTP API 完成检索/生成，MUST NOT 依赖已删除的 Nest 本地 hybrid 管线

---

### Requirement: 向量与全文存储分离

系统 MUST 使用 PostgreSQL pgvector 作为主向量库，Elasticsearch 作为全文/BM25 库。MUST NOT 将 ES `dense_vector` 作为主向量存储。

#### Scenario: 索引双写职责

- **WHEN** 文档索引成功
- **THEN** PG `knowledge` schema 中 MUST 有 embedding，ES 中 MUST 有可用于 BM25 的全文内容

---

### Requirement: 检索全链路管线

系统 MUST 实现完整的 RAG 检索管线，阶段顺序 MUST 为：QueryUnderstanding（Must-Merged）→ 元数据过滤（`kb_ids`）→ hybrid（vector ∥ BM25）→ RRF → **Parent Resolution** → **API Rerank**（可 R1 降级）→ Context/Citation（问答路径继续 Generation）。执行位置 MUST 为 Knowledge AI Service；Rerank MUST 为 HTTP API 型。Parent MUST 在 Rerank 之前。

#### Scenario: 默认混合检索

- **WHEN** 用户发起知识检索且未指定强制单通道
- **THEN** 系统 MUST 使用 hybrid（向量 + BM25）并 RRF 融合，默认 rrfK 可采用 60

#### Scenario: 管线顺序 Parent 先于 Rerank

- **WHEN** 执行完整 hybrid 检索
- **THEN** 系统 MUST 在 RRF 之后先 Parent Resolution，再 API Rerank（未降级时）

#### Scenario: 查询长度限制

- **WHEN** 用户查询超过实现约定上限（Chat 侧如 4000 字符 Zod 上限）
- **THEN** 系统 MUST 拒绝或截断，行为须一致且可测

---

### Requirement: RRF 融合算法

系统 MUST 在 Knowledge AI 应用层实现 RRF，融合向量检索与关键词检索结果。

#### Scenario: RRF 计算

- **WHEN** 执行 hybrid 检索
- **THEN** 系统 MUST 分别执行向量与 BM25 检索并融合排序

---

### Requirement: Parent-Child 与 Parent Resolution

系统 SHALL 支持 Parent-Child 分块语义：子块检索后还原父块内容并按父块去重。分块与 parent 字段写入由 Knowledge AI 在 `/index` 执行。

#### Scenario: Parent resolution

- **WHEN** 命中子 chunk
- **THEN** 系统 MUST 能还原其 parent 内容供上下文构建

---

### Requirement: 权限模型（Nest + kb_ids）

知识检索权限 MUST 由 Nest 在转发前校验用户对全部 `kb_ids` 的所有权，再由 Knowledge AI 按 `kb_ids` 过滤。MUST NOT 以 ES `allowed_user_ids` 作为权威 ACL。

#### Scenario: 无 KB 拒绝

- **WHEN** Chat 请求未提供任何知识库 ID
- **THEN** Nest MUST 拒绝（4xx）且 MUST NOT 调用 Knowledge AI

#### Scenario: 无权 KB

- **WHEN** `kb_ids` 中存在不属于该用户的知识库
- **THEN** Nest MUST 拒绝（404 以避免泄露存在性）

---

### Requirement: API Rerank 与降级

系统 SHALL 通过可配置的 HTTP Rerank API 做重排；失败时 MUST R1 降级（保留 RRF+Parent 排序截断）并标记 `degraded`，MUST NOT 将 rerank 失败单独作为整次问答系统失败（除非上层策略覆盖）。

#### Scenario: Rerank 失败降级

- **WHEN** Rerank HTTP 调用失败
- **THEN** 管线 MUST 继续返回 topK 候选并标记 degraded

---

### Requirement: strict 空检索业务语义

默认 `retrieval_mode=strict`：无合格召回时 MUST NOT 编造知识性断言；MUST 以业务成功结束（空 sources + `retrieval_empty`），MUST NOT 记为系统 `failed`。

#### Scenario: strict 空检索

- **WHEN** 检索无合格结果且 mode 为 strict
- **THEN** 返回/流式 MUST 业务成功并标记 `retrieval_empty: true`

---

## 已废止（原 Nest 本地实现）

以下条款在迁移后 **不再**作为系统要求：

| 废止项 | 原因 |
|--------|------|
| ES knn 主向量检索 | 主向量改为 pgvector |
| Nest 内 BGE / @xenova 本地重排 | 改为 API Rerank |
| ES 层 `allowed_user_ids` 权威 ACL | 改为 Nest 所有权 + 服务令牌 + kb_ids |
| Nest `processors/rag` 权威索引写入 | 改为 Knowledge AI `/index` |
| Redis 检索缓存作为权威路径要求 | Phase 1 未作为硬验收 |
