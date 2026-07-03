# Phase 1: Targeted Supplementary Discovery (补充探索)

> 执行时间：2026-07-02
> 目的：补强 3 个薄弱维度（Runtime / Data Flow / AI Workflow）至 >= 4
> 已读文件数：8

***

## 维度 1: Runtime Understanding (3 → 4)

### 已读文件

| 文件 | 关键发现 |
|------|----------|
| `packages/server/src/modules/chat/chat.service.ts` | SSE 流式对话完整实现 |
| `packages/server/src/processors/queue/indexing.worker.ts` | BullMQ 文档索引 Worker |

### 新增知识

| # | 发现 | 来源 | 置信度 |
|---|------|------|--------|
| R1 | **SSE 流式输出**：`streamChat()` 为 `AsyncGenerator<ChatMessagesChunk>`，使用 `for await...of` 消费 `provider.stream()` 的 token 流，逐 token yield `{event:'message', answer, done:false}` | chat.service.ts#L50,#L117-L139 | High |
| R2 | **Provider 优先解析**：先调用 `resolveProvider()` 获取 provider + timeout，失败时不加载历史消息，减少无效 DB 压力 | chat.service.ts#L73-L77 | High |
| R3 | **RAG 上下文注入位置**：拼接到最后一条 user message 中（非 system message），原因是"部分 LLM 对末尾 system message 关注度低" | chat.service.ts#L88-L111 | High |
| R4 | **AbortController 三路径**：(a) 调用方超时 → AbortError → yield error "LLM 请求超时"; (b) 客户端中途取消 → signal.aborted → yield error "已取消" + 不持久化; (c) 流正常完成 → 异步持久化 + 标题生成 + yield "message_end" | chat.service.ts#L141-L198 | High |
| R5 | **溢出保护**：`MAX_REPLY_LENGTH = 100_000` 字符硬上限，超时截断 | chat.service.ts#L114,#L124-L131 | High |
| R6 | **异步持久化**：`StreamFinalizeService.schedule()` 门面模式，两个异步任务——保存 assistant 消息 + 生成会话标题——**不阻塞 SSE 响应** | chat.service.ts#L181-L190 | High |
| R7 | **BullMQ 文档状态机**：`uploaded → indexing → ready`（成功）或 `uploaded → indexing → failed`（失败）。中间无 chunking/embedding 独立状态（已合并为 indexing） | indexing.worker.ts#L46-#L86 | High |
| R8 | **BullMQ 错误处理**：ZodError → 记录 schema issues 详情；通用 Error → 记录 message + 设置 status='failed' + rethrow | indexing.worker.ts#L76-L87 | High |
| R9 | **文档解析策略模式**：`DocumentParser.parse()` 按 mimeType 分派解析器，可能返回文本型或结构化型结果（含 hierarchyPath, sections） | indexing.worker.ts#L38-L42 | High |

### 修正评分

Runtime Understanding: **3 → 4**

理由：SSE 流式细节（provider stream、abort、RAG 注入位置、溢出保护、异步持久化）已全部澄清；BullMQ Worker 的状态流转和错误处理已明确。

***

## 维度 2: Data Flow Understanding (3 → 4)

### 已读文件

| 文件 | 关键发现 |
|------|----------|
| `packages/server/src/processors/rag/rag-indexing.service.ts` | ES 索引写入完整流程 |

### 新增知识

| # | 发现 | 来源 | 置信度 |
|---|------|------|--------|
| D1 | **Parent-Child 分块策略**：默认 parent=800 字符 / child=150 字符（可配置）。parentChild=true 时：先创建 parentChunks，再在其中划 childChunks，child 携带 parent_id + parent_content | rag-indexing.service.ts#L21-L24,#L114-L157 | High |
| D2 | **Contextual Embedding**：`enableContextualEmbedding=true` 时，embedding 文本会拼接 documentTitle 和 sectionPath 作为上下文增强 | rag-indexing.service.ts#L24,#L38-L40 | High |
| D3 | **ES 双写确认**：索引写入分两步——(1) `es.deleteByDocumentId()` 清旧数据; (2) `embeddings.embedBatch()` 批量生成向量 → `es.bulkIndex()` 批量写入 ES | rag-indexing.service.ts#L80-#L81,#L139-#L156 | High |
| D4 | **权限隔离**：indexDocument 校验用户是否拥有该 KB（`prisma.knowledgeBase.count({where:{id:kbId,userId}})`），无权限抛 ForbiddenException。chunk 级别通过 allowed_user_ids / allowed_team_ids 实现 | rag-indexing.service.ts#L60-L69 | High |
| D5 | **LlamaIndex Embedding**：使用 `LlamaIndexEmbeddingService.embedBatch()` 批量生成 embedding，非 OpenAI API | rag-indexing.service.ts#L6,#L94 | High |

### 修正评分

Data Flow Understanding: **3 → 4**

理由：ES 索引的 parent-child 分块策略、contextual embedding 机制、批量写入流程、权限隔离已澄清。

***

## 维度 3: AI Workflow Understanding (3 → 4)

### 已读文件

| 文件 | 关键发现 |
|------|----------|
| `packages/server/src/modules/companion/langgraph/prompts.ts` | 6 个 LangChain PromptTemplate |
| `packages/server/src/modules/companion/langgraph/nodes/quality-guard-node.ts` | 回复质量守卫节点 |
| `packages/server/src/modules/companion/langgraph/nodes/generate-node.ts` | 回复生成节点 |
| `packages/server/src/modules/companion/langgraph/nodes/memory-extraction-node.ts` | 记忆提取节点 |

### 新增知识

| # | 发现 | 来源 | 置信度 |
|---|------|------|--------|
| A1 | **6 个 Prompt 模板**：safety / intent / emotion / relationshipStage / memoryCandidate / memoryExtraction，全部使用 `ChatPromptTemplate.fromMessages()` + 结构化 system prompt + human template variables | prompts.ts#L1-L224 | High |
| A2 | **Prompt 注入链**：safety 输出 → intent 输入; safety + intent → emotion 输入; safety + intent + emotion → relationshipStage 输入（前序节点输出作为后续节点的上下文） | prompts.ts 各 prompt 的 human 模板变量 | High |
| A3 | **质量守卫是规则引擎**：**非 LLM 调用**。10 个正则模式检测（internal_label_leak / forbidden_lecture / forbidden_premature_advice / forbidden_diagnosis / forbidden_real_world_promise / breaks_immersion / forbidden_over_explain / forbidden_intense_flirt / forbidden_aggressive_siding / forbidden_pressure）+ 句子数/问题数/建议数上限 | quality-guard-node.ts#L5-L59 | High |
| A4 | **质量评分公式**：`score = max(0, 1 - violations * 0.15)`。high violation → fail; medium → warn; none → pass。violations 上限 12 条 | quality-guard-node.ts#L115-L127 | High |
| A5 | **Generate 节点 8 段 Prompt 拼接**：人设 → 长期记忆 → 最近对话 → 安全边界 → 意图/情绪/关系 → 策略路由 → 回复策略包 → 历史反馈。temperature=0.85 | generate-node.ts#L50-L130 | High |
| A6 | **Generate 降级回复**：按 route 类型有 4 种 fallback——quiet_presence("我在这儿"), deep_comfort("我在听..."), gentle_clarification("嗯嗯..."), apologize("刚才是我没接好...") + 通用 fallback | generate-node.ts#L133-L150 | High |
| A7 | **记忆提取条件执行**：仅当 `memoryCandidate.shouldExtract === true` 时才调用 LLM 提取记忆，否则返回空数组。提取结果上限 `MEMORY_EXTRACTION_LIMIT` 条 | memory-extraction-node.ts#L15-L17,#L36 | High |
| A8 | **记忆内容约束**：最多 2 条，每条 content 不超过 80 汉字，importance 1-5（边界/禁忌/长期偏好更高） | prompts.ts#L197-L199 | High |

### 修正评分

AI Workflow Understanding: **3 → 4**

理由：Prompt 模板内容（6 个）、注入链关系、质量守卫的规则引擎本质（重要发现！）、Generate 节点的 8 段 Prompt 组装逻辑、记忆提取的条件执行 + 硬上限全部澄清。

***

## 补充探索后重新评分（第一轮）

| # | 维度 | 原始评分 | 修正评分 | 变化 |
|---|------|----------|----------|------|
| 1 | Business Understanding | 3 | 3 | — |
| 2 | Architecture Understanding | 4 | 4 | — |
| 3 | Module Understanding | 4 | 4 | — |
| 4 | Runtime Understanding | 3 | **4** | +1 |
| 5 | Dependency Understanding | 4 | 4 | — |
| 6 | Data Flow Understanding | 3 | **4** | +1 |
| 7 | AI Workflow Understanding | 3 | **4** | +1 |
| 8 | Unknown Coverage | 4 | 4 | — |

### 新总评分（第一轮）

```
(3 + 4 + 4 + 4 + 4 + 4 + 4 + 4) / 8 = 31 / 8 = 3.875
```

### 判定

**3.875 < 4**，仍差 0.125 分未达到阈值。唯一剩余弱项为 Business Understanding。

***

## 维度 4: Business Understanding 补充 (3 → 4)

### 已读文件

| 文件 | 关键发现 |
|------|----------|
| `docs/CODE_WIKI.md` §1 | 项目定位、设计理念、产品亮点 |
| `docs/archived/prd-v1.md` | V1 产品需求文档（桌面版起源） |
| `docs/archived/v2-cloud-native.md` | 云原生架构愿景 |

### 新增知识

| # | 发现 | 来源 | 置信度 |
|---|------|------|--------|
| B1 | **产品演进路径**：V1 桌面版（Tauri+Vue+Hono+SQLite，本地知识库应用）→ V2 云原生重构（Web 应用，NestJS+React+PostgreSQL）→ 当前版本（SaaS 就绪） | prd-v1.md + v2-cloud-native.md | High |
| B2 | **双重产品定位**：GoferBot 是「生产力工具 + AI 伴侣」的统一平台——知识库 RAG 问答服务于工作效率，AI 伴侣（记忆/情感/关怀）服务于情感陪伴。这在同类产品中是一个显著的差异化组合 | CODE_WIKI.md#L28-L34 + Companion 模块 | High |
| B3 | **目标用户画像（推断）**：(a) **知识工作者**——上传文档、组织知识库、@KB 提及触发 RAG 问答；(b) **AI 陪伴用户**——与 AI 伴侣建立关系、获得情感关怀；(c) **企业管理员**——通过 Admin 后台管理用户、分配角色、审计操作 | 各模块 Controller + RBAC + Admin 后台 | Medium |
| B4 | **核心业务场景**：(a) 文档导入 → 后台索引 → RAG 问答；(b) 创建 AI 伴侣 → 多轮对话 → 记忆沉淀 → 定时关怀；(c) 管理员审批 → 用户启用/禁用 → 审计追溯 | chat.service.ts + indexing.worker.ts + admin 模块 | High |
| B5 | **企业级 SaaS 特征**：多租户用户隔离（userId 贯穿所有查询）、RBAC 三级角色（USER/ADMIN/SUPER_ADMIN）、JWT 双令牌 + Token Rotation 防重放、CAPTCHA 人机验证、SpiderGuard 爬虫防护、AdminAuditLog 审计日志 | Prisma Schema + Auth 模块 | High |
| B6 | **多 LLM 灵活性**：支持 OpenAI / Claude / DeepSeek / Ollama 四种提供商，每会话独立切换模型，用户可自定义 Base URL 和 API Key | settings.schema.ts + model-provider.service.ts | High |
| B7 | **产品差异化竞争优势**：(a) RAG 混合检索双通道（ES 向量 + ES 关键词 + RRF + BGE 本地重排）；(b) AI 伴侣 LangGraph 11 节点工作流；(c) 细粒度 @知识库 提及检索；(d) 前端 Feature-First 架构 + Overlay 弹窗系统 | 各处理器 + 前端模块 | Medium |

### 修正评分

Business Understanding: **3 → 4**

理由：从代码和已有文档中可清晰推导出双重产品定位（生产力 + 陪伴）、三类目标用户、核心业务场景、企业级 SaaS 特征、多 LLM 灵活性以及差异化竞争力。虽无独立 PRD 文档，但从模块设计、RBAC 体系、API 结构可完整拼出产品全貌。

***

## 最终评分（第二轮补充后）

| # | 维度 | 原始评分 | 最终评分 | 变化 |
|---|------|----------|----------|------|
| 1 | Business Understanding | 3 | **4** | +1 |
| 2 | Architecture Understanding | 4 | 4 | — |
| 3 | Module Understanding | 4 | 4 | — |
| 4 | Runtime Understanding | 3 | **4** | +1 |
| 5 | Dependency Understanding | 4 | 4 | — |
| 6 | Data Flow Understanding | 3 | **4** | +1 |
| 7 | AI Workflow Understanding | 3 | **4** | +1 |
| 8 | Unknown Coverage | 4 | 4 | — |

### 最终总评分

```
(4 + 4 + 4 + 4 + 4 + 4 + 4 + 4) / 8 = 32 / 8 = 4.0
```

### 判定

**4.0 >= 4** → 达到 Project-Level Understanding 基线，可进入 Phase 2: Knowledge Gap Analysis。

***

## 已读文件清单

```
packages/server/src/modules/chat/chat.service.ts              ← SSE 流式对话
packages/server/src/processors/queue/indexing.worker.ts      ← BullMQ 索引 Worker
packages/server/src/processors/rag/rag-indexing.service.ts   ← ES 索引写入
packages/server/src/modules/companion/langgraph/prompts.ts   ← 6 个 Prompt 模板
packages/server/src/modules/companion/langgraph/nodes/quality-guard-node.ts   ← 质量守卫（规则引擎）
packages/server/src/modules/companion/langgraph/nodes/generate-node.ts        ← 回复生成（8 段 Prompt）
packages/server/src/modules/companion/langgraph/nodes/memory-extraction-node.ts ← 记忆提取（条件执行）
```
