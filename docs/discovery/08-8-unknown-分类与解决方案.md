# GoferBot Discovery Report

## 8. Unknown 分类与解决方案

对 Discovery Report 中的 7 个 Unknown 项逐一深挖后，按可解决方式分类如下：

| 类型  | 标识           | 含义                 |
|-------|----------------|----------------------|
| **A** | Explorable     | 继续阅读代码即可确认 |
| **B** | Runtime        | 需要运行项目才能确认 |
| **C** | Infrastructure | 需要查看外部系统配置 |
| **D** | Business       | 需要产品文档/决策    |
| **E** | True Unknown   | 当前仓库无法回答     |

***

### #1 Elasticsearch 状态 → **[RESOLVED]** (Round 2)

**深度分析**：阅读代码后发现，ES **正在被使用**，并非残留配置。

- `rag.module.ts` 将 `ElasticsearchService`、`EsKeywordService`、`EsVectorService`、`EsFilterBuilder` 全部注册为 providers 并导出。
- `rag-retrieval.service.ts` 通过 DI 注入了 `EsKeywordService` + `EsVectorService` + `ElasticsearchService`，检索管线为 ES 驱动。
- pgvector 的作用是 **embedding 存储层**（Chunk 表有 embedding 列），但 RAG 的**检索层**（keyword search + vector search + RRF）走 ES。
- `bge-rerank.service.ts` 使用 `@xenova/transformers` 做本地 BGE 重排。

**结论**：系统采用双存储架构 — pgvector 存原始 embedding，ES 做检索索引。两者均在使用中，并非迁移未完成。

**如要补全理解，应阅读**：

| 目录/文件                                                     | 说明                                  |
|---------------------------------------------------------------|---------------------------------------|
| `packages/server/src/processors/rag/elasticsearch.service.ts` | ES 客户端 + ChunkDocument 索引定义    |
| `packages/server/src/processors/rag/es-vector.service.ts`     | ES 向量检索实现                       |
| `packages/server/src/processors/rag/es-keyword.service.ts`    | ES 关键词检索实现                     |
| `packages/server/src/processors/rag/es-filter.builder.ts`     | ES 过滤器构建（kb\_id 隔离等）        |
| `packages/server/src/processors/rag/rag-indexing.service.ts`  | 索引写入逻辑，确认 ES + pgvector 双写 |

***

### #2 CI/CD 流水线 → **D (Business)**

**深度分析**：CI/CD **尚未实施**。

- 仓库中无 `.github/workflows/`、`.gitlab-ci.yml` 等任何 CI 配置文件。
- 根 package.json 的 `check:ci` 仅调用 `biome ci`（本地代码规范检查）。
- `docs/prd/ci-pipeline.md`（2026-06-03，状态：**待实施**）详细设计了 3-stage CI：Quality Gate → Integration Gate → E2E Gate，目标平台 GitHub Actions。
- CD（持续部署）被标记为范围外。

**结论**：CI/CD 仅停留在设计文档阶段，代码库中不存在任何实现。

**如要补全理解，应阅读**：

| 文件                      | 说明                                                                 |
|---------------------------|----------------------------------------------------------------------|
| `docs/prd/ci-pipeline.md` | 完整的 CI 设计文档，含 3 阶段 workfow 架构、Job 依赖图、环境变量设计 |

***

### #3 生产部署配置 → **E (True Unknown)**

**深度分析**：

- 仓库中无 `Dockerfile`（应用容器镜像）、无 k8s/Helm/Terraform 文件。
- `docker-compose.dev.yml` 仅编排基础设施（PostgreSQL、MinIO、Redis），不包含应用容器（server、web、admin）。
- `docs/prd/v2-cloud-native.md` 描述了云原生架构愿景，但无对应的部署清单。
- `docs/guide/backend/configuration-guide.md` 描述了环境变量，但未涉及部署方式。

**结论**：生产部署方案在当前仓库中完全不存在。

***

### #4 LangGraph 工作流全貌 → **[RESOLVED]** (Round 1)

**深度分析**：Companion 的 LangGraph 实现代码**完整存在**。

- `graph.ts` 使用 `@langchain/langgraph` 的 `StateGraph` + `Annotation.Root` 定义完整状态图。
- 状态包含 16 个字段（safety/intent/emotion/relationship/route/policy/quality/memoryCandidate/extractedMemories/summary/assistantReply/partialTokens/existingMemories/recentMessages/feedbacks/lastFallback）。
- 11 个节点文件全部存在。
- 分支逻辑（`continue` / `end_safety` / `end_guard` / `skip_memory`）在 graph.ts 中定义。

**结论**：全部代码可读，之前的"部分 Unknown"是因为未深入该目录。

**如要补全理解，应阅读**：

| 文件                                                                       | 说明                                  |
|----------------------------------------------------------------------------|---------------------------------------|
| `packages/server/src/modules/companion/langgraph/graph.ts`                 | StateGraph 定义 + 节点连接 + 条件路由 |
| `packages/server/src/modules/companion/langgraph/interfaces.ts`            | CompanionState 类型定义               |
| `packages/server/src/modules/companion/langgraph/nodes/*.ts`               | 11 个节点实现                         |
| `packages/server/src/modules/companion/langgraph/prompts.ts`               | 各节点的 Prompt 模板                  |
| `packages/server/src/modules/companion/langgraph/index.ts`                 | 模块导出                              |
| `packages/server/src/modules/companion/companion-chat-pipeline.service.ts` | Pipeline 编排服务                     |

***

### #5 Companion 模块的 GroupChat 是否已实现 → **D (Business)**

**深度分析**：

- `GroupChat`/`GroupChatMember`/`GroupChatMessage` 仅出现在 Prisma Schema 定义和 `prisma.service.ts` 的自动生成 getter 中。
- 搜索整个 `packages/server/src/`，无 GroupChat 相关的 service、controller、module。
- CHANGELOG 和 BACKLOG 均无 GroupChat 相关 issue 或记录。

**结论**：数据模型已定义，业务逻辑**未实现**。这是一个 Schema-First 的预留设计。

**需要产品文档**：确认 GroupChat（AI 伴侣群聊）是否在 Roadmap 上、优先级、预期上线时间。

***

### #6 modules/ 与 processors/ 职责边界 → **[RESOLVED]** (Round 3)

**决议**：并非简单的单向分层，而是**双向依赖的 pragmatic 架构**。详见 §7.5 — 核心发现：

- `processors/` 分二层：纯基础设施（database/storage）← 编排处理器（rag/queue/chat）
- modules → processors：32 处引用（预期方向，业务依赖基础设施）
- processors → modules：30 处引用（编排处理器合法依赖领域类型/配置/事件）
- NestJS EventEmitter 提供跨层松耦合通道（listeners → domain events）

***

### #7 @xenova/transformers 实际用途 → **[RESOLVED]** (Round 2)

**深度分析**：

- 仅被 `bge-rerank.service.ts` 引用（第 138 行附近）。
- 用于加载 BGE-Reranker 模型（cross-encoder），在 RAG 检索管线中进行**本地重排序**。
- 不走远程 API，直接在 Node.js 进程中运行 HuggingFace Transformers 推理（CPU 或 GPU）。

**结论**：是 RAG 检索管线的一部分 — 本地 BGE 重排序器。

**如要补全理解，应阅读**：

| 文件                                                       | 说明                   |
|------------------------------------------------------------|------------------------|
| `packages/server/src/processors/rag/bge-rerank.service.ts` | BGE 重排序服务完整实现 |

***
