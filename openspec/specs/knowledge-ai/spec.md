# Knowledge AI Service

## Purpose（目的）

定义 GoferBot **知识域**独立服务（Python Knowledge AI Service）的业务边界、HTTP 契约、检索/索引权威路径与验收语义。

- **执行方**：`services/knowledge-ai-service/`（FastAPI）
- **调用方**：NestJS（JWT 用户 API 唯一出口）；浏览器 MUST NOT 直连本服务
- **非职责**：AI Companion / 关系记忆 / LangGraph 工作流

相关能力：`chat`（编排与 SSE 出口）、`queue`（索引 Job）、`knowledge-base`（所有权与级联删除）、`settings`（provider / retrieval_mode）、`rag`（能力层语义，运行时委托本服务）。

## Requirements（需求）

### Requirement: Knowledge Domain 服务边界

系统 SHALL 将文档知识检索与知识问答能力作为独立 **Knowledge AI Service**（Python）部署，且 MUST NOT 将 AI Companion / 关系记忆 / LangGraph 工作流纳入本服务职责。

#### Scenario: 服务职责范围

- **WHEN** 系统处理知识库文档索引、混合检索或知识问答生成
- **THEN** 计算 SHALL 由 Knowledge AI Service 执行；NestJS SHALL 负责用户鉴权、KB 所有权、会话落库与对外 SSE 出口

#### Scenario: 禁止服务 Companion 记忆

- **WHEN** 任何调用方请求将伴侣记忆写入或检索 `knowledge` 文档索引
- **THEN** 系统 MUST 拒绝该用法；伴侣记忆 MUST NOT 存储于 `knowledge.chunks`

---

### Requirement: 内网服务令牌认证

Knowledge AI Service MUST 校验共享服务令牌（`KNOWLEDGE_AI_SERVICE_TOKEN`，Bearer）；MUST NOT 将服务端口作为浏览器/公网直连的用户 API。

#### Scenario: 无令牌拒绝

- **WHEN** 请求未携带合法服务令牌
- **THEN** 服务 MUST 返回 401 且 MUST NOT 执行检索或索引

#### Scenario: 禁止用户直连

- **WHEN** 部署 Knowledge AI Service
- **THEN** 文档与 compose 配置 SHALL 将其限制在内网（例如仅绑定 `127.0.0.1`）；用户流量 MUST 经 NestJS 代理

#### Scenario: Nest 空令牌失败关闭

- **WHEN** Nest 侧 `KNOWLEDGE_AI_SERVICE_TOKEN` 未配置或为空
- **THEN** Nest MUST NOT 以空 Bearer 调用 Knowledge AI；MUST 以可观测失败语义中止（服务不可用）

---

### Requirement: 信任 Nest 已校验的 kb_ids

在通过服务令牌认证后，Knowledge AI Service SHALL 信任请求体中的 `kb_ids` 已由 Nest 完成所有权校验，MUST NOT 连接业务用户库做二次 ACL，MUST NOT 在 ES 层实现 `allowed_user_ids` 用户级 ACL 作为权威权限模型。

#### Scenario: 按 kb_ids 过滤

- **WHEN** 检索请求包含已授权的 `kb_ids`
- **THEN** 服务 MUST 仅在这些知识库范围内检索

---

### Requirement: 知识存储所有权

系统 SHALL 在与业务库相同的 PostgreSQL 实例上使用独立 schema `knowledge` 存储 chunk 与 embedding；该 schema MUST 由 Python 独占读写。Nest Prisma MUST NOT 将 `knowledge.chunks` 建模为知识索引主存。

#### Scenario: 向量写入 PG

- **WHEN** 文档索引成功
- **THEN** `knowledge` 中对应 chunk 的 embedding MUST 存在，且主向量检索 MUST 使用 pgvector 而非 ES dense_vector

#### Scenario: ES 无主向量

- **WHEN** 写入 Elasticsearch
- **THEN** 映射 MUST NOT 将 embedding/dense_vector 作为主向量库；ES MUST 用于全文/BM25

#### Scenario: ES 中文分析

- **WHEN** 创建或更新 ES 全文索引映射
- **THEN** content 字段 SHOULD 使用中文友好分析器（IK 或等价）；若环境暂无 IK 插件，MUST 在文档中说明降级分析器并保持 BM25 可检索

---

### Requirement: 索引 Replace 与删除双清

对同一 `document_id` 再次索引时，系统 MUST 以 replace 语义更新该文档在 PG 与 ES 中的数据（MUST NOT append 残留幽灵 chunk）。删除文档时 MUST 同步清理 PG 与 ES。

安全 replace 顺序：先 chunk+embed 成功，再原子替换 PG，再写 ES 并清理该 document 下非 keep 集合的陈旧文档。

#### Scenario: 再索引无幽灵 chunk

- **WHEN** 同一 document_id 第二次成功 `POST /index`
- **THEN** 检索结果 MUST NOT 包含仅属于第一次索引、已不在新文本中的旧 chunk

#### Scenario: 按文档删除一致

- **WHEN** 调用 `DELETE /documents/{id}` 成功
- **THEN** 随后以该 document_id 为范围的检索 MUST NOT 命中其内容

#### Scenario: 按知识库级联清理

- **WHEN** Nest 删除整个知识库并请求清理索引
- **THEN** Knowledge AI MUST 清理该 `kb_id` 下全部 PG 与 ES 索引数据（`DELETE /kb/{kb_id}` 或等价）
- **AND** 随后以该 kb_id 为范围的检索 MUST NOT 命中已删 KB 内容

#### Scenario: 无 embedding 密钥拒绝索引

- **WHEN** `/index` 未提供可用的 `embedding_api_key`
- **THEN** 服务 MUST 失败且 MUST NOT 写入伪向量污染索引

---

### Requirement: HTTP API 面

Knowledge AI Service SHALL 提供至少以下端点：`POST /retrieve`、`POST /query`、`POST /stream`、`POST /index`、`DELETE /documents/{id}`、`DELETE /kb/{kb_id}`、`GET /health`（及可选 `GET /health/live`）。

#### Scenario: 健康检查依赖

- **WHEN** 调用 `GET /health`
- **THEN** 响应 MUST 反映 PostgreSQL(pgvector) 与 Elasticsearch 的可用性（ok / degraded / unavailable）

#### Scenario: 运行时注入

- **WHEN** 调用检索或问答端点
- **THEN** 请求 MUST 可携带 `_provider` 与可选 `_prompts`、`trace_id`；服务 MUST NOT 依赖直连 Admin 业务配置库读取密钥

#### Scenario: 公开路径

- **WHEN** 调用 `/health` 或 `/health/live`
- **THEN** MUST NOT 要求服务令牌；业务写读端点 MUST 要求令牌

---

### Requirement: Must-Merged 查询理解（L1）

Phase 1 查询理解（L1）MUST 采用 **Must-Merged**：对单次用户查询执行**一次** LLM 调用并得到结构化输出，代码模块 MUST 可独立单测。MUST NOT 将「多段独立 LLM 调用串联」作为 Phase 1 权威路径。

#### Scenario: 单次合并调用

- **WHEN** 执行知识检索或问答管线的 L1
- **THEN** 系统 MUST 至多发起一次理解用 LLM 请求（失败重试不计入「多段串联设计」），并将结构化结果交给后续检索阶段

#### Scenario: 可测模块边界

- **WHEN** 运行 L1 单元测试
- **THEN** 理解模块 MUST 可在 mock LLM 下验证结构化解析，而不依赖完整 HTTP 服务

---

### Requirement: 混合检索管线

系统 SHALL 对知识查询按以下顺序执行：L1 查询理解（Must-Merged）→ 元数据过滤（`kb_ids`）→ ES BM25 与 pgvector **并行** → RRF 融合 → **Parent Resolution** → **API Rerank**（可降级）→ 返回 chunks / 进入上下文构建。Parent MUST 在 Rerank 之前执行。

#### Scenario: 默认 hybrid

- **WHEN** 未指定仅 vector 或仅 bm25 的强制模式
- **THEN** 系统 MUST 执行混合检索并 RRF 融合（默认 rrfK 可采用 60）

#### Scenario: 管线顺序

- **WHEN** hybrid 检索完整执行
- **THEN** 系统 MUST 在 RRF 之后先完成 Parent Resolution，再调用 API Rerank（若未降级）

#### Scenario: Rerank 降级 R1

- **WHEN** 配置的 Rerank HTTP API 调用失败或未配置
- **THEN** 系统 MUST 跳过 rerank 或透传截断 topK 继续，并在观测中标记 `degraded`（失败时），MUST NOT 仅因 rerank 失败而使整次请求以系统错误失败

---

### Requirement: 引用 sources 载荷

检索或问答返回的 `sources` 列表中，每一条引用 MUST 至少包含 `kb_id` 与 `document_id`；SHOULD 包含 chunk 摘要、score、稳定 id。多 KB 检索时，调用方 MUST 能依据 `kb_id` 区分来源知识库。

#### Scenario: 多 KB 引用可区分

- **WHEN** 请求 `kb_ids` 含多个知识库且存在召回
- **THEN** 每条 source MUST 带有所属 `kb_id` 与 `document_id`

#### Scenario: 空 sources 形状

- **WHEN** 无合格召回
- **THEN** `sources` MUST 为空数组，MUST NOT 省略为非法结构

---

### Requirement: 流式知识问答契约

`POST /stream` SHALL 以 SSE 输出知识问答，事件顺序 MUST 支持：`sources`（可为空列表）→ 一个或多个 `message` → `message_end`；错误时 MUST 可发送 `error`。会话主键 `conversation_id` / `message_id` MUST 由调用方（Nest）传入，服务 MUST NOT 自行发明业务会话主键。

#### Scenario: 正常流式顺序

- **WHEN** 知识问答成功且有召回
- **THEN** 客户端 MUST 能先收到 sources，再收到增量 message，最后 message_end

#### Scenario: 空检索 strict（stream）

- **WHEN** `retrieval_mode` 为 strict（默认）且无合格召回
- **THEN** 服务 MUST NOT 生成无依据的知识性断言；MUST 以业务成功方式结束流（sources 为空，简短未找到类正文，message_end），并标记 `retrieval_empty: true`，MUST NOT 将其作为 5xx 系统故障

#### Scenario: error 无内部栈

- **WHEN** 流式路径发生不可恢复系统/上游错误并发送 `error`
- **THEN** 对外载荷 MUST 为用户可理解信息，MUST NOT 包含 Python 内部 stack trace 或原始密钥

---

### Requirement: 非流式问答与空检索语义一致

`POST /query` MUST 返回 answer 与 sources，且在 `retrieval_mode=strict` 且无合格召回时 MUST 与 `/stream` 采用相同业务成功语义。

#### Scenario: 空检索 strict（query）

- **WHEN** 调用 `/query` 且 strict 下无合格召回
- **THEN** 响应 MUST 为业务成功形态（含空 sources 与未找到类说明），MUST NOT 仅因此返回 5xx

---

### Requirement: 可观测性与密钥脱敏

系统 SHALL 支持 `trace_id` 贯穿请求，记录关键阶段 span。若配置 Langfuse 相关环境变量，SHALL 上报 traces；未配置时 MUST 仍可正常启动与处理请求。任何持久化或上报的载荷 MUST 剥离 `_provider` 中的 `*_api_key`。

#### Scenario: 无 Langfuse 可运行

- **WHEN** 未设置 Langfuse 凭证
- **THEN** 服务 MUST 正常处理 `/health` 与业务请求

#### Scenario: 日志脱敏

- **WHEN** 记录 index/stream 请求摘要
- **THEN** 日志 MUST NOT 明文输出 `embedding_api_key` / `llm_api_key` / `rerank_api_key`

---

### Requirement: 删除一致性（fail-closed）

Nest 删除文档/知识库/文件夹时 MUST **优先**调用 Knowledge AI 清理索引，再删除业务元数据（避免元数据已删但向量仍可召回的窗口）。

**Fail-closed**：Knowledge AI 删除失败时，Nest MUST NOT 删除业务元数据，MUST 返回可感知失败（如 503 `KNOWLEDGE_AI_PURGE_FAILED`），以便客户端/用户重试。对象存储删除在业务元数据删除成功后执行，存储失败 MAY 仅记日志（可运维补偿）。

#### Scenario: 文档删除优先清索引

- **WHEN** 用户删除文档
- **THEN** 系统 MUST 先请求 Knowledge AI `DELETE /documents/{id}`，成功后再删除业务库记录与对象存储

#### Scenario: 索引清理失败阻断

- **WHEN** Knowledge AI 删除文档或 KB 索引失败
- **THEN** Nest MUST 保留业务元数据不变，并返回失败语义，MUST NOT 静默跳过索引清理

#### Scenario: 文件夹删除优先清索引

- **WHEN** 用户删除文件夹及其下文档
- **THEN** 系统 MUST 对文档先请求 Knowledge AI 清理（全部成功），再删除业务侧文件夹与文档记录
