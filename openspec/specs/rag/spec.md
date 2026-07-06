# RAG - 检索增强生成

## Purpose（目的）

定义 GoferBot RAG 检索增强生成系统规范。覆盖完整三侧架构：
- **检索侧**: QueryUnderstanding → Router → Vector/BM25/Hybrid → RRF → Rerank → Parent Resolution → Cache
- **生成侧**: 上下文构建 → LLM 调用（同步/流式）→ Guardrail → Grounding → SSE 输出
- **索引侧**: 分块（Parent-Child）→ Embedding → ES 批量写入 → 权限字段注入

## Requirements（需求）

### Requirement: 检索全链路管线
系统应实现完整的 RAG 检索管线：QueryUnderstanding → Router → 检索（vector/bm25/hybrid）→ RRF 融合 → BGE 重排 → Parent Resolution → Redis 缓存。

证据来源：
- `packages/server/src/processors/rag/rag-retrieval.service.ts#L38-L233`

#### Scenario: 默认混合检索
- **WHEN** 用户发起检索请求且未指定 mode
- **THEN** 系统使用 RouterService 决策意图，默认采用 hybrid 模式（向量权重 0.7 + BM25 权重 0.3），执行 RRF 融合排序

#### Scenario: 查询长度限制
- **WHEN** 用户查询超过 2000 字符
- **THEN** 系统截断查询并记录警告日志，继续执行检索

#### Scenario: 缓存命中
- **WHEN** 相同查询在 60 秒内再次发起（所有参数相同）
- **THEN** 系统直接返回 Redis 缓存结果，跳过检索管线

### Requirement: 检索权限模型
系统应实施三层检索权限校验：kbIds 必填校验 → Prisma 所有权验证 → ES 层 ACL 过滤。

证据来源：
- `packages/server/src/processors/rag/rag-retrieval.service.ts#L49-L66`
- `packages/server/src/processors/rag/es-filter.builder.ts#L70-L98`

#### Scenario: kbIds 必填
- **WHEN** 用户提供 userId 但未提供 kbIds
- **THEN** 系统抛出 ForbiddenException，拒绝请求

#### Scenario: 所有权验证失败
- **WHEN** 用户请求的 kbIds 中包含非自己拥有的知识库
- **THEN** Prisma 计数校验失败，系统抛出 ForbiddenException

#### Scenario: ES 层 ACL 过滤
- **WHEN** 执行 ES 查询
- **THEN** 系统添加 ACL 过滤：`allowed_user_ids` 命中 OR 字段不存在（默认公开）；`allowed_team_ids` 同理

### Requirement: ES 向量检索
系统应使用 Elasticsearch knn 查询实现向量检索，ACL 过滤在 ANN 遍历之前执行。

证据来源：
- `packages/server/src/processors/rag/es-vector.service.ts#L42-L64`
- `packages/server/src/processors/rag/elasticsearch.service.ts#L127-L132`

#### Scenario: knn 查询构建
- **WHEN** 执行向量检索
- **THEN** 系统构建 knn 查询：field='embedding', query_vector, k=topK, num_candidates=topK*5, similarity='cosine'

#### Scenario: ACL 物理隔离
- **WHEN** 向量检索包含 ACL 过滤条件
- **THEN** 过滤条件通过 `knn.filter` 传入，在 ANN 遍历之前执行，确保未授权文档不会进入候选集

### Requirement: ES 关键词检索
系统应使用 Elasticsearch BM25 match 查询实现关键词检索，根据语言自动切换分词器。

证据来源：
- `packages/server/src/processors/rag/es-keyword.service.ts#L45-L116`
- `packages/server/src/processors/rag/elasticsearch.service.ts#L111-L117`

#### Scenario: 中文分词
- **WHEN** 检测到查询语言为中文（中文字符比例 > 0.2）
- **THEN** 系统使用 `ik_smart` 搜索分词器，`ik_max_word` 索引分词器

#### Scenario: 英文分词
- **WHEN** 检测到查询语言为英文
- **THEN** 系统使用 `standard` 分词器

#### Scenario: Score 归一化
- **WHEN** BM25 检索完成
- **THEN** 系统将分数除以 maxScore 归一化到 [0,1] 区间

### Requirement: RRF 融合算法
系统应在应用层实现 RRF（Reciprocal Rank Fusion）算法，融合向量检索和关键词检索结果。

证据来源：
- `packages/server/src/processors/rag/rag-retrieval.service.ts#L325-L355`

#### Scenario: RRF 计算
- **WHEN** 执行 hybrid 检索
- **THEN** 系统分别执行向量检索和 BM25 检索，使用公式 `score = vectorWeight/(rrfK+rank+1) + bm25Weight/(rrfK+rank+1)` 融合结果，默认 rrfK=60

### Requirement: BGE 本地重排
系统应使用 @xenova/transformers 加载 BGE Cross-Encoder 模型进行本地重排，支持懒加载、批量推理和降级策略。

证据来源：
- `packages/server/src/processors/rag/bge-rerank.service.ts#L156-L251`

#### Scenario: 模型加载
- **WHEN** 首次调用重排且模型未加载
- **THEN** 系统懒加载 AutoTokenizer 和 AutoModelForSequenceClassification，batchSize=16 批量推理

#### Scenario: 模型白名单校验
- **WHEN** 配置重排器模型
- **THEN** 系统校验模型 ID 前缀（BAAI/、Xorbits/、sentence-transformers/），不在白名单中的模型使用 fallback

#### Scenario: Fallback 降级
- **WHEN** 模型加载失败或不在白名单
- **THEN** 系统使用词法匹配 50% + 原始分数 50% 的混合策略作为降级方案

### Requirement: 查询理解预处理
系统应在检索前对查询进行三步预处理：语言检测、短查询改写、同义词扩展。

证据来源：
- `packages/server/src/processors/rag/query-understanding.service.ts#L131-L158`

#### Scenario: 语言检测
- **WHEN** 处理查询
- **THEN** 系统计算中文字符比例，> 0.2 判定为中文，否则为英文

#### Scenario: 短查询改写
- **WHEN** 查询 token ≤ 5 且配置了 RAG LLM Provider
- **THEN** 系统调用 LLM 将短查询扩写为更完整的问题描述

#### Scenario: 同义词扩展
- **WHEN** 查询命中预设 SYNONYM_MAP 中的关键词
- **THEN** 系统扩展为包含同义词的 OR 查询，最多 3 个并行查询

### Requirement: 意图路由
系统应使用规则式意图分类器（零推理成本），根据查询意图选择最优检索策略。

证据来源：
- `packages/server/src/processors/rag/router.service.ts#L95-L182`

#### Scenario: 代码搜索意图
- **WHEN** 查询匹配代码相关模式（function/class/interface/API 等）
- **THEN** 系统分类为 code_search，使用 BM25 模式（权重 0.8），不重排，不完整上下文

#### Scenario: 时间范围意图
- **WHEN** 查询匹配时间相关模式（年份、去年/今年、before/after 等）
- **THEN** 系统分类为 time_range，使用 vector 模式（权重 0.8），需要重排和完整上下文

#### Scenario: 事实问答意图
- **WHEN** 查询匹配事实问答模式（是什么、如何、为什么等）
- **THEN** 系统分类为 fact_qa，使用 hybrid 模式，需要重排和完整上下文

### Requirement: 输出安全护栏
系统应在答案返回前执行安全过滤：PII 脱敏、敏感关键词检测、领域免责声明。

证据来源：
- `packages/server/src/processors/rag/guardrail.service.ts#L76-L142`

#### Scenario: PII 脱敏
- **WHEN** 答案包含 email/phone/id_card/bank_card
- **THEN** 系统正则匹配并替换为 [XXX REDACTED]，记录 redactions 用于审计

#### Scenario: 敏感关键词检测
- **WHEN** 答案包含敏感关键词（密码/密钥/secret/password 等）
- **THEN** 系统追加警告（不阻断回答）

#### Scenario: 领域免责声明
- **WHEN** 指定 domain 为 medical/financial/legal
- **THEN** 系统自动追加对应领域的免责声明

### Requirement: 事实校验（Grounding）
系统应对答案逐句进行 Grounding 检查，验证每句是否被检索 chunks 支撑。

证据来源：
- `packages/server/src/processors/rag/grounding.service.ts#L55-L110`

#### Scenario: 混合词汇蕴含判定
- **WHEN** 执行 Grounding 检查
- **THEN** 系统使用公式 `score = 0.4*overlapRatio + 0.6*bigramRatio` 计算置信度；长 token(≥4字符)×1.2 加权；短句子(<8字符)自动 grounded

#### Scenario: 置信度阈值
- **WHEN** 句子置信度 ≥ 0.35（MEDIUM_CONFIDENCE_THRESHOLD）
- **THEN** 系统判定为 grounded；否则判定为 ungrounded

### Requirement: ES 索引管理
系统应自动管理 Elasticsearch 索引，支持索引创建、文档批量索引、按文档/知识库删除。

证据来源：
- `packages/server/src/processors/rag/elasticsearch.service.ts#L89-L198`
- `packages/server/src/processors/rag/rag-indexing.service.ts#L43-L158`

#### Scenario: 索引创建
- **WHEN** 模块初始化且索引不存在
- **THEN** 系统创建索引，配置 ik_max_word/ik_smart 分词、dense_vector embedding（cosine）、keyword 类型权限字段

#### Scenario: Parent-Child 分块索引
- **WHEN** 索引文档且启用 parentChild 模式（默认）
- **THEN** 系统先按 800 字符切分 parent chunks，再按 150 字符切分 child chunks，记录 parent_id 和 parent_content

#### Scenario: 上下文嵌入
- **WHEN** 启用上下文嵌入（默认启用）
- **THEN** 系统拼接 `文档：{title} | 章节：{sectionPath} | 上下文窗口 chunks + 当前 chunk` 作为 embedding 输入

### Requirement: Redis 缓存策略
系统应使用 Redis 缓存检索结果，TTL=60s，key 包含所有检索参数。

证据来源：
- `packages/server/src/processors/rag/rag-retrieval.service.ts#L18-L20`

#### Scenario: 缓存 key 构建
- **WHEN** 构建缓存 key
- **THEN** 系统拼接 query + kbIds + documentIds + mode + topK + candidateK + vectorWeight + bm25Weight + rrfK + needRerank + rerankTopK + metadata + userId + userTeams + resolveParents + skipRouter

#### Scenario: 缓存 TTL
- **WHEN** 设置缓存
- **THEN** 系统使用 60 秒 TTL

### Requirement: 上下文构建
系统应将检索到的 chunks 构建为 LLM 可用的上下文：去重 → 排序 → token 预算截取 → 编号格式化。

证据来源：
- `packages/server/src/processors/rag/rag-context.service.ts#L10-L56`

#### Scenario: 去重与排序
- **WHEN** 构建上下文
- **THEN** 系统先按 documentId 去重，再按 score 降序排序

#### Scenario: Token 预算截取
- **WHEN** chunks 总 token 数超过预算（默认 3000）
- **THEN** 系统按 `Math.ceil(content.length / 2)` 估算 token，超出时按比例截断并添加 `...`

#### Scenario: 编号格式化
- **WHEN** 输出上下文
- **THEN** 系统格式化为 `[1] content\n\n[2] content` 形式

### Requirement: 同步生成编排
系统应支持同步问答模式：构建上下文 → 组装 Prompt → 调用 LLM → 后处理（Guardrail + Grounding）→ 返回结果。

证据来源：
- `packages/server/src/processors/rag/rag-generation.service.ts#L25-L46`
- `packages/server/src/processors/rag/llamaindex-rag.service.ts#L142-L160`

#### Scenario: 有上下文生成
- **WHEN** 检索到 chunks 且构建了上下文
- **THEN** 系统组装 Prompt：`上下文：\n\n${context}\n\n问题：${question}\n\n请仅根据上下文内容回答。如果上下文没有相关信息，请直接说"没有相关信息"。`

#### Scenario: 无上下文生成
- **WHEN** 未检索到相关 chunks
- **THEN** 系统组装 Prompt：`问题：${question}\n\n知识库中没有检索到相关内容，请直接说"没有相关信息"。`

#### Scenario: 后处理管线
- **WHEN** LLM 返回原始答案
- **THEN** 系统执行 Guardrail（PII 脱敏+敏感词检测）→ Grounding（逐句事实校验）→ 返回 `{answer, grounding, warnings}`

### Requirement: 流式生成编排
系统应支持 SSE 流式问答模式：先输出 sources → 流式输出文本（带心跳）→ 实时 Guardrail 过滤 → 最后输出 grounding。

证据来源：
- `packages/server/src/processors/rag/rag-generation.service.ts#L61-L151`

#### Scenario: SSE 事件序列
- **WHEN** 发起流式查询
- **THEN** 系统依次输出：`sources` 事件（sourceChunks）→ `message` 事件（流式文本）→ `grounding` 事件（事实校验）→ `message_end` 事件（结束标记）

#### Scenario: SSE 心跳机制
- **WHEN** 流式输出超过 60 秒无数据
- **THEN** 系统发送心跳（空 text）保持连接活跃

#### Scenario: 实时 Guardrail 过滤
- **WHEN** 流式文本到达
- **THEN** 系统使用 `applyStream` 实时过滤敏感内容，缓冲区上限 100,000 字符

### Requirement: Embedding 服务
系统应基于 @llamaindex/openai 提供 Embedding 服务，支持配置化提供商和动态刷新。

证据来源：
- `packages/server/src/processors/rag/llamaindex-embedding.service.ts#L54-L61`

#### Scenario: 配置化提供商
- **WHEN** 初始化 Embedding 服务
- **THEN** 系统通过 `ModelProviderService.resolveProvider()` 解析 `rag.embeddingProvider` 引用（`{providerId}#{modelName}` 格式），从 `provider.models` 中查找 enabled 的 embedding 模型，使用 `ResolvedProvider` 扁平化视图（apiKey/model/baseURL/dimensions/isCompleteUrl）创建 OpenAIEmbedding 实例

#### Scenario: 动态刷新
- **WHEN** 触发 `config.changed` 事件（category 为 rag 或 providers）
- **THEN** 系统重新解析配置并刷新模型实例

### Requirement: RAG API 端点
系统应提供 6 个 API 端点：retrieve（检索）、query（同步问答）、stream（流式问答）、index（索引）、removeDocument（删除文档）、health（健康检查）。

证据来源：
- `packages/server/src/processors/rag/rag.controller.ts#L45-L232`

#### Scenario: 权限解析
- **WHEN** 用户未提供 kbIds
- **THEN** 系统调用 `resolveKbIds` 自动解析用户拥有的所有知识库 ID

#### Scenario: 空知识库短切
- **WHEN** 用户无任何知识库权限
- **THEN** 系统直接返回空结果，避免无效 ES 查询

#### Scenario: SSE 流式响应
- **WHEN** 调用 /rag/stream 端点
- **THEN** 系统使用 SseResponseHelper 初始化 SSE 连接，依次写入 sources/message/grounding/message_end 事件

### Requirement: Metadata 安全校验
系统应在 DTO 层对 metadata 参数进行安全校验：黑名单前缀过滤、白名单 keys 校验、键名格式校验。

证据来源：
- `packages/server/src/processors/rag/dto/rag.schema.ts#L9-L67`

#### Scenario: 黑名单前缀过滤
- **WHEN** metadata key 以 `__`、`$` 或 `.` 开头
- **THEN** 系统拒绝请求，防止 NoSQL 注入（如 `__proto__`、`.script`）

#### Scenario: 白名单 keys 校验
- **WHEN** metadata key 不在白名单中
- **THEN** 系统拒绝请求；白名单可通过 `METADATA_ALLOWED_KEYS` 环境变量扩展，默认包含 year/status/type/category/source/language/author/priority/department/project/tags/version

#### Scenario: 键名格式校验
- **WHEN** metadata key 不符合 `/^[a-z][a-z0-9_]{0,63}$/i` 格式
- **THEN** 系统拒绝请求，限制键名长度不超过 64 字符

### Requirement: 事件驱动索引
系统应通过事件监听自动触发文档索引：监听 DocumentUploadedEvent → 检查队列健康状态 → 入队索引任务。

证据来源：
- `packages/server/src/processors/rag/listeners/document-uploaded.listener.ts#L12-L25`

#### Scenario: 上传后自动索引
- **WHEN** 文档上传完成触发 `DocumentUploadedEvent`
- **THEN** DocumentUploadedListener 检查 QueueService 健康状态，健康则自动入队索引任务

#### Scenario: 队列异常处理
- **WHEN** 队列服务不健康或入队失败
- **THEN** 系统记录错误日志，不阻断上传流程

### Requirement: 检索过滤业务约束
系统 SHALL 在所有检索路径（向量检索、BM25 检索、混合检索）中统一应用业务过滤条件，MUST 确保检索结果满足知识库权限、文档状态与访问控制约束。

证据来源：
- `packages/server/src/processors/rag/es-filter.builder.ts`
- `packages/server/src/processors/rag/`

#### Scenario: 知识库隔离
- **WHEN** 执行检索时
- **THEN** 系统 MUST 限定检索范围仅在请求指定的知识库（kbIds）内，MUST NOT 返回其他知识库的 chunks

#### Scenario: 活跃文档约束
- **WHEN** 执行检索时
- **THEN** 系统 MUST 仅返回状态为活跃的文档 chunk，MUST NOT 返回已删除、待处理或处理失败的文档内容

#### Scenario: 单文档限定
- **WHEN** 检索请求指定了特定文档 ID 时
- **THEN** 系统 MUST 将检索范围限定在该文档内

### Requirement: ACL 向后兼容语义
系统 SHALL 通过 OR 逻辑实现 ACL 访问控制，MUST 支持向后兼容：没有 ACL 字段的旧文档对所有用户可见。

证据来源：
- `packages/server/src/processors/rag/es-filter.builder.ts`

#### Scenario: ACL 条件判定逻辑
- **WHEN** 执行 ACL 过滤判定时
- **THEN** 系统 MUST 满足以下任一条件：条件 1 用户 ID 在 `allowed_user_ids` 中（显式权限授予）；条件 2 文档无 ACL 限制（公开文档）

#### Scenario: 向后兼容旧数据
- **WHEN** 索引中存在没有 ACL 字段的旧文档
- **THEN** 系统 MUST 将此类文档视为公开文档，使其对所有用户可见，确保旧数据不需要迁移即可被检索

### Requirement: Reranker 配置热重载
系统 SHALL 支持 Reranker 模型配置的动态变更，MUST 无需重启服务即可切换重排模型，SHOULD 限制单条文本的最大序列长度以控制推理成本。

证据来源：
- `packages/server/src/processors/rag/bge-rerank.service.ts`

#### Scenario: 模型配置解析
- **WHEN** 初始化或切换 Reranker 模型时
- **THEN** 系统 MUST 从配置中心解析模型标识，MUST NOT 硬编码模型路径

#### Scenario: 序列长度限制
- **WHEN** 执行重排推理时
- **THEN** 系统 SHOULD 限制输入序列最大长度，超长文本截断后参与重排，避免推理超时或显存溢出

#### Scenario: 配置热重载
- **WHEN** Reranker 相关配置发生变更时
- **THEN** 系统 MUST 重新加载模型实例，无需重启服务即可切换 Reranker 模型

### Requirement: BM25 检索容错降级
系统 SHALL 为关键词检索提供容错机制，MUST 在检索服务不可用时返回空结果以保证管线降级执行，SHOULD 提供可配置的默认检索数量。

证据来源：
- `packages/server/src/processors/rag/es-keyword.service.ts`

#### Scenario: 检索失败降级
- **WHEN** 关键词检索抛出异常（如检索引擎连接错误、查询语法错误）
- **THEN** 系统 MUST 返回空结果，不向上抛出异常，管道仅使用可用的检索路径继续执行

## Architecture（架构）

### 检索管线流程图
```
Query 输入
  │
  ├─ QueryUnderstandingService: 语言检测 → 短查询改写 → 同义词扩展
  │
  ├─ RouterService: 意图分类 → Pipeline 决策（mode/权重/topK/重排）
  │
  ├─ [分支] vector: LlamaIndexEmbedding → ES knn 查询
  │         bm25: ES match 查询（ik_smart/standard）
  │         hybrid: 并行 vector + bm25 → RRF 融合
  │
  ├─ BgeRerankService: Cross-Encoder 重排（条件执行）
  │
  ├─ Parent Resolution: child chunk → ES 查 parent content → 去重
  │
  ├─ GuardrailService: PII 脱敏 + 敏感关键词检测 + 领域免责声明
  │
  ├─ GroundingService: 逐句事实校验
  │
  └─ Redis Cache: key=query+所有参数 hash, TTL=60s
```

### 生成侧管线流程图
```
检索 chunks 输出
  │
  ├─ RagContextService: 按 documentId 去重 → 按 score 排序 → 按 token 预算(3000)截取 → 编号格式化
  │
  ├─ [分支] 同步模式: RagGenerationService.generateAnswer()
  │         └─ 组装 Prompt → 调用 LlamaIndexProvider.invoke() → 返回原始答案
  │
  ├─ [分支] 流式模式: RagGenerationService.streamQuery()
  │         └─ 先 yield sourceChunks → 调用 LlamaIndexProvider.stream() → SSE 流式输出(带心跳60s) → 实时 Guardrail 过滤
  │
  ├─ RagGenerationService.finalizeAnswer(): Guardrail 应用 → Grounding 校验
  │
  └─ 返回 {answer, grounding, warnings}
```

### API 端点定义
| 端点 | 方法 | 功能 | 认证 |
|------|------|------|------|
| /rag/retrieve | POST | 检索 chunks（仅检索，不生成） | JwtAuthGuard |
| /rag/query | POST | 同步问答（检索+生成+后处理） | JwtAuthGuard |
| /rag/stream | POST | 流式问答（SSE，检索+流式生成） | JwtAuthGuard |
| /rag/index | POST | 索引文档（分块+Embedding+ES写入） | JwtAuthGuard |
| /rag/documents/:documentId | DELETE | 删除文档索引 | JwtAuthGuard |
| /rag/health | GET | 健康检查（ES 连接状态） | 无需认证 |

### SSE 事件格式
| 事件类型 | 数据格式 | 说明 |
|----------|----------|------|
| sources | `{ chunks: Array, total: number }` | 检索到的源 chunks |
| message | `{ answer: string, done: false }` | 流式文本输出 |
| grounding | `{ grounding: Array }` | 事实校验结果 |
| message_end | `{ answer: '', done: true }` | 流式结束标记 |

### 权限模型
```
三层校验：
1. Controller 层: kbIds 必填校验
2. Service 层: Prisma 验证 userId 拥有所有 kbIds
3. ES 层: allowed_user_ids/allowed_team_ids ACL 过滤（命中 OR 字段不存在=公开）
```

### ES 索引 Mapping
| 字段 | 类型 | 说明 |
|------|------|------|
| id | keyword | 文档唯一标识 |
| document_id | keyword | 所属文档 ID |
| kb_id | keyword | 所属知识库 ID |
| content | text | 正文，ik_max_word/ik_smart 分词 |
| parent_id | keyword | 父 chunk ID（parent-child 模式） |
| parent_content | text | 父 chunk 内容 |
| chunk_index | integer | chunk 索引 |
| token_count | integer | token 数量估算 |
| embedding | dense_vector | 1536 维，cosine 相似度 |
| allowed_user_ids | keyword | 用户权限列表 |
| allowed_team_ids | keyword | 团队权限列表 |
| document_title | text | 文档标题 |
| section_path | keyword | 章节路径 |

### 意图 → Pipeline 映射
| 意图 | Mode | Vector Weight | BM25 Weight | Rerank | Full Context | TopK |
|------|------|---------------|-------------|--------|--------------|------|
| code_search | bm25 | 0.2 | 0.8 | false | false | 5 |
| time_range | vector | 0.8 | 0.2 | true | true | 5 |
| relation_qa | hybrid | 0.5 | 0.5 | true | true | 8 |
| fact_qa | hybrid | 0.7 | 0.3 | true | true | 5 |
| chitchat | vector | 0.5 | 0.5 | false | false | 3 |
| general | hybrid | 0.7 | 0.3 | true | true | 5 |

## Configuration（配置）

### 环境变量
| 变量 | 默认值 | 说明 |
|------|--------|------|
| ELASTICSEARCH_NODE | http://localhost:9200 | ES 节点地址 |
| ELASTICSEARCH_INDEX | knowledge_chunks | 索引名称 |
| ELASTICSEARCH_API_KEY | - | API Key（可选） |
| ELASTICSEARCH_USERNAME | - | 用户名（可选） |
| ELASTICSEARCH_PASSWORD | - | 密码（可选） |
| RERANK_EAGER_LOAD | - | 是否启动时预加载重排器模型 |

### 系统配置（Settings）
| 配置路径 | 说明 |
|----------|------|
| rag.llmProvider | RAG LLM 提供商 ID（用于短查询改写和生成） |
| rag.rerankerProvider | BGE 重排器模型提供商 ID |
| rag.rerankerAllowedModelPrefixes | 重排器模型白名单前缀 |
| rag.timeoutMs | RAG 超时时间 |
| rag.embeddingProvider | Embedding 提供商 ID |
| indexing.synonymDict | 同义词字典（zh/en） |
| indexing.parentChunkSize | 父 chunk 大小（默认 800） |
| indexing.childChunkSize | 子 chunk 大小（默认 150） |
| indexing.contextualWindow | 上下文窗口大小（默认 1） |
| indexing.contextualEmbedding | 是否启用上下文嵌入（默认 true） |

### 生成侧默认参数
| 参数 | 默认值 | 说明 |
|------|--------|------|
| tokenBudget | 3000 | 上下文 token 预算 |
| sseHeartbeatMs | 60000 | SSE 心跳间隔（毫秒） |
| streamBufferMaxLength | 100000 | 流式缓冲区上限（字符） |
| parentOverlap | 100 | 父 chunk 重叠大小 |
| childOverlap | 20 | 子 chunk 重叠大小 |

## Constraints（约束）

- **查询长度上限**: 2000 字符，超出自动截断
- **缓存 TTL**: 60 秒，key 包含所有检索参数
- **BGE 模型白名单**: 仅允许 BAAI/、Xorbits/、sentence-transformers/ 前缀
- **Grounding 阈值**: 0.35（MEDIUM_CONFIDENCE_THRESHOLD）
- **短句子自动 grounded**: < 8 字符的句子不做 Grounding 检查
- **并发查询上限**: 最多 3 个并行查询（同义词扩展）
- **上下文 token 预算**: 默认 3000，超出按比例截断
- **SSE 心跳间隔**: 60 秒，无数据时发送心跳保持连接
- **流式缓冲区上限**: 100,000 字符，超出丢弃新数据
- **分块策略**: Parent-Child 架构，parent=800/overlap=100，child=150/overlap=20
- **Embedding 文本构建**: 启用上下文嵌入时拼接前后窗口 chunks
