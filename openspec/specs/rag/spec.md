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

### Requirement: 检索结果标记可供 Admin 聚合

RAG/Knowledge AI 管线产出的 `retrieval_empty` 与 `degraded` 语义 MUST 能通过 Chat 助手消息 metadata 被 Admin 聚合（写入权威路径见 `chat` capability）。`retrieval_empty` 表示 strict 空检索业务成功；`degraded` 表示管线降级（例如 rerank R1），MUST NOT 单独等同于系统 5xx。

证据来源：
- `openspec/specs/chat/spec.md`
- `packages/server/prisma/schema.prisma`（`Message.metadata`）
- `packages/server/src/modules/admin/services/dashboard-observability.service.ts`（聚合消费方）

#### Scenario: 空检索可聚合

- **WHEN** 一轮知识问答以 strict 空检索业务成功结束
- **THEN** 助手消息 metadata MUST 含 `retrieval_empty: true`
- **AND** Admin 聚合可将该消息计入空结果样本

#### Scenario: 降级可聚合

- **WHEN** 检索管线发生已定义的 degraded 降级且仍完成业务响应
- **THEN** 经 Chat 定稿后助手 metadata MUST 含 `degraded: true`
- **AND** Admin 聚合可将该消息计入降级样本
- **AND** 窗内无 completed 助手样本时，Admin Hub 降级率 KPI MUST 为 `insufficient_samples`（非虚构 0% 冒充有流量）

#### Scenario: 可选延迟

- **WHEN** 实现写入检索/生成耗时
- **THEN** metadata MAY 含 `latencyMs`
- **AND** 若未写入，Admin MUST NOT 伪造 RAG P95

### Requirement: 索引失败可被 Admin 计数

文档索引失败状态 MUST 可通过持久化文档状态在时间窗内计数，以支持 Admin Hub「索引失败数」黄金指标。

证据来源：
- `packages/server/prisma/schema.prisma`（`Document.status`、`errorMessage`、`updatedAt`）

#### Scenario: 按状态与时间窗聚合失败

- **WHEN** 文档 `status` 为 `failed` 且 `updatedAt` 落在观测时间窗内
- **THEN** 该文档 MUST 计入 Admin 索引失败数
- **AND** `status=ready` 等成功态 MUST NOT 计入失败数
- **AND** 无失败文档时计数 MUST 为 0 且 KPI 可为 `ready`（计数型，非比率样本不足）

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
