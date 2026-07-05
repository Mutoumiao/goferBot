# GoferBot Discovery Report

> 生成日期：2026-07-02
> 分析方式：静态代码扫描（未运行任何代码）
> 原则：所有结论必须来自代码或文档，不能确认的标记为 Unknown

***

## 1. 项目目标Conversation

**数据来源**：[CODE\_WIKI.md](file:///d:/projects/ai-stared-project/knowledge-base/docs/CODE_WIKI.md)、[README.md](file:///d:/projects/ai-stared-project/knowledge-base/README.md)

GoferBot 是一款**云端优先的 AI Workspace / Agent OS** Web 应用。核心能力：

| 能力              | 说明                                                                                                |
|-------------------|-----------------------------------------------------------------------------------------------------|
| 智能问答          | 多 LLM 提供商的流式对话，Markdown 渲染 + 代码高亮                                                   |
| RAG 检索增强      | Elasticsearch 双通道检索（向量 + 关键词）+ RRF 混合排序 + BGE 本地重排；pgvector 存储原始 embedding |
| 知识库管理        | 虚拟文件夹树、文件上传导入（MinIO）、后台索引入队                                                   |
| AI 伴侣           | 基于 LangGraph 的多轮对话、记忆系统、情感关怀、定时关怀计划                                         |
| 多租户 + 管理后台 | 用户隔离、RBAC 权限控制（USER/ADMIN/SUPER\_ADMIN）                                                  |

***

## 2. 技术栈

**数据来源**：[package.json](file:///d:/projects/ai-stared-project/knowledge-base/package.json)、各包 [package.json](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/package.json)、[CODE\_WIKI.md](file:///d:/projects/ai-stared-project/knowledge-base/docs/CODE_WIKI.md)

| 层                  | 技术                                              | 版本                                           | 证据                                                |
|---------------------|---------------------------------------------------|------------------------------------------------|-----------------------------------------------------|
| **前端框架**        | React + TypeScript + TanStack Start/Router        | React 19.x, TS 6.0 (web/admin), TS 5.9 (data)  | web/package.json#L47, admin/package.json#L54        |
| **前端状态**        | Zustand                                           | 5.x                                            | web/package.json#L50                                |
| **前端 UI (web)**   | shadcn/ui + Radix UI + Tailwind CSS v4            | @ant-design/x 2.8, radix-ui 1.5, tailwindcss 4 | web/package.json#L17-L49                            |
| **前端 UI (admin)** | Ant Design 6.x + Pro Components + Tailwind CSS v4 | antd 6.5, @ant-design/pro-components 2.8       | admin/package.json#L17-L36                          |
| **HTTP 客户端**     | alova                                             | 3.x                                            | web/package.json#L31                                |
| **后端框架**        | NestJS + Fastify                                  | 10.x / 4.28.1                                  | server/package.json#L36                             |
| **ORM**             | Prisma                                            | 5.x                                            | server/package.json#L44                             |
| **数据库**          | PostgreSQL + pgvector                             | 16                                             | docker-compose.dev.yml#L12 `pgvector/pgvector:pg16` |
| **缓存/队列**       | Redis + BullMQ                                    | 7 / 5.x                                        | docker-compose.dev.yml#L54, server/package.json#L46 |
| **对象存储**        | MinIO (S3 兼容)                                   | RELEASE.2025-01-20                             | docker-compose.dev.yml#L32                          |
| **认证**            | JWT + bcrypt + Passport                           | bcrypt 5.1, passport-jwt 4.0                   | server/package.json#L45,L52                         |
| **AI 框架**         | LlamaIndex + LangChain + LangGraph                | @llamaindex/core 0.6, @langchain/core 1.2      | server/package.json#L29-L32                         |
| **数据验证**        | Zod + nestjs-zod                                  | zod 4.x (server), 3.x (data)                   | server/package.json#L57                             |
| **测试**            | Vitest + Playwright                               | vitest 4.x, @playwright/test 1.61              | 根 package.json#L56,L70                             |
| **代码规范**        | Biome                                             | 2.5.x                                          | biome.json                                          |
| **包管理**          | pnpm workspace                                    | -                                              | pnpm-workspace.yaml                                 |

***

## 3. 总体架构

**数据来源**：[CODE\_WIKI.md 第3章](file:///d:/projects/ai-stared-project/knowledge-base/docs/CODE_WIKI.md#L99-L191)、[app.module.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/app.module.ts)、[bootstrap.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/bootstrap.ts)

### 3.1 部署架构

```
                    ┌───────────────┐   ┌───────────────┐
                    │  Web (用户端)  │   │ Admin (管理端) │
                    │  port 1420    │   │  port 1421     │
                    │  React 19     │   │  React 19      │
                    │  shadcn/ui    │   │  Ant Design 6  │
                    │  TanStack Start│  │  TanStack Start│
                    └───────┬───────┘   └───────┬───────┘
                            │    HTTP/SSE      │
                            └────────┬─────────┘
                                     ▼
                    ┌─────────────────────────────┐
                    │   NestJS + Fastify (port 3000)│
                    │   Helmet → CORS → Cookie     │
                    │   RequestId → RequestContext  │
                    │   ThrottlerGuard → SpiderGuard│
                    │   JwtAuthGuard → ZodPipeline  │
                    │   ResponseInterceptor         │
                    │   AllExceptionsFilter         │
                    └─────────────┬───────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
   PostgreSQL+pgvector         MinIO (S3)           Redis + BullMQ
   (port 5432)              (port 9000/9001)       (port 6379)
```

### 3.2 Monorepo 包结构

**数据来源**：[pnpm-workspace.yaml](file:///d:/projects/ai-stared-project/knowledge-base/pnpm-workspace.yaml)

```
packages/
├── data/      @goferbot/data       共享 Zod Schema + TypeScript 类型（前后端共同依赖）
├── server/    @goferbot/server     NestJS API 后端
├── web/       @goferbot/web        React 前端（用户端）
└── admin/     @goferbot/admin      React 管理后台（独立应用，Ant Design）
```

**依赖方向**：`web → data ← server`，`admin → data ← server`（data 为共享契约层，无反向依赖）

### 3.3 请求生命周期

**bootstrap.ts + app.module.ts 确认**:

```
Fastify HTTP Server
  → Helmet 安全头
  → Cookie 解析（HttpOnly）
  → CORS 白名单
  → RequestIdMiddleware（追踪 ID）
  → RequestContextMiddleware（AsyncLocalStorage）
  → 全局守卫链：ThrottlerGuard → SpiderGuard → JwtAuthGuard(可选)
  → ZodValidationPipe（请求体验证）
  → Controller → Service → Prisma/Queue/Storage
  → ResponseInterceptor（统一包装 { data: T }）
  → AllExceptionsFilter（异常统一处理）
```

### 3.4 后端模块注册

**app.module.ts 确认注册顺序**：`ConfigModule` → `EventEmitterModule` → `ThrottlerModule` → `CommonModule` → `HealthModule` → `CacheModule` → `UserModule` → `AuthModule` → `QueueModule` → `StorageModule` → `KnowledgeBaseModule` → `SessionModule` → `ChatModule` → `CompanionModule` → `SettingsModule` → `AdminModule` → `RagModule`

***

## 4. 所有业务模块

**数据来源**：[app.module.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/app.module.ts)、[Prisma schema](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/prisma/schema.prisma)、[CODE\_WIKI.md](file:///d:/projects/ai-stared-project/knowledge-base/docs/CODE_WIKI.md)、[openspec/specs](file:///d:/projects/ai-stared-project/knowledge-base/openspec/specs/)、[CHANGELOG.md](file:///d:/projects/ai-stared-project/knowledge-base/CHANGELOG.md)

### 4.1 后端模块 (`packages/server/src/`)

| 模块              | 路径                          | 核心职责                                                                 | Prisma 模型                                                                                                                          |
|-------------------|-------------------------------|--------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| **Auth**          | `src/auth/`                   | JWT 双令牌认证、CAPTCHA 验证、RBAC 权限、会话管理、Token Rotation 防重放 | User, AuthSession, RefreshToken, UserRole, Application, ApplicationAuthMethod                                                        |
| **User**          | `src/modules/user/`           | 用户 CRUD、密码验证、超级管理员引导                                      | User                                                                                                                                 |
| **Chat**          | `src/modules/chat/`           | SSE 流式对话、LLM Provider 工厂、RAG 上下文注入、多模型切换              | Session, Message                                                                                                                     |
| **KnowledgeBase** | `src/modules/knowledge-base/` | 知识库 CRUD、虚拟文件夹树、文件上传/MinIO、文档状态追踪                  | KnowledgeBase, Folder, Document                                                                                                      |
| **Session**       | `src/modules/session/`        | 会话 CRUD、消息管理、分页                                                | Session, Message                                                                                                                     |
| **Settings**      | `src/modules/settings/`       | 用户设置 key-value 存储、模型提供商配置、加密敏感字段                    | Setting                                                                                                                              |
| **Companion**     | `src/modules/companion/`      | AI 伴侣 CRUD、LangGraph 对话工作流、记忆系统、情感分析、关怀计划         | Companion, CompanionConversation, CompanionMessage, CompanionMemory, CompanionMessageFeedback, CompanionCarePlan, CompanionCareEvent |
| **Admin**         | `src/modules/admin/`          | 管理端 API：用户分页列表（search + isActive 过滤）、用户状态切换（事件驱动）、角色权限 CRUD（动态发现 + 缓存失效） | 复用 User, UserRole, Permission, RolePermission（无独立 Admin 专用模型）                                                            |
| **Health**        | `src/modules/health/`         | 健康检查端点                                                             | -                                                                                                                                    |

### 4.2 处理器层 (`packages/server/src/processors/`)

| 处理器      | 路径                  | 核心职责                                                                                                                  |
|-------------|-----------------------|---------------------------------------------------------------------------------------------------------------------------|
| **RAG**     | `processors/rag/`     | Elasticsearch 驱动：查询理解 → ES 向量检索 + ES 关键词检索 → RRF 混合排序 → BGE 本地重排(@xenova/transformers) → 安全过滤 |
| **Queue**   | `processors/queue/`   | BullMQ 队列管理、IndexingWorker（文档解析→分块→Embedding→写入pgvector）、ChatFinalizeProcessor（SSE流后处理：消息持久化+标题生成） |
| **Chat**    | `processors/chat/`    | ChatFinalizeProcessor：BullMQ 消费 chat-finalize 队列，两步后处理（saveAssistantMessage → generateTitle）                  |
| **Storage** | `processors/storage/` | MinIO S3 对象存储：IStorageProvider 接口抽象 → FactoryProvider 注入 → StorageService 门面守卫 → MinIOStorageProvider SDK 4 层架构 |
| **Parser**  | `processors/parser/`  | 文档解析器（PDF解析器 + 文本解析器 + 结构提取器）                                                                         |

### 4.3 前端模块 (`packages/web/src/`)

| Feature           | 路径                      | 核心职责                                                                                |
|-------------------|---------------------------|-----------------------------------------------------------------------------------------|
| **Auth**          | `features/auth/`          | 登录/注册表单、认证容器、个人资料                                                       |
| **Chat**          | `features/chat/`          | 聊天页、会话视图、消息气泡、Markdown 渲染、SSE 流式接收、知识库选择器、模型提供商选择器 |
| **KnowledgeBase** | `features/KnowledgeBase/` | 知识库列表、文件浏览器、拖拽上传、上传进度、文件移动/复制                               |
| **Companion**     | `features/companion/`     | 伴侣列表、伴侣聊天、伴侣记忆管理、伴侣快捷提示                                          |
| **Settings**      | `features/settings/`      | 设置区块、提供商配置、外观/字号选择                                                     |

### 4.4 管理后台 (`packages/admin/src/`)

**技术栈**: TanStack Start + React 19 + Ant Design 6.x + Pro Components + Tailwind CSS v4

**状态管理**: Zustand（auth + settings），alova HTTP 客户端，自动 Token 刷新

| 功能              | 路径                      | 核心职责                              |
|-------------------|---------------------------|---------------------------------------|
| **Auth**          | `features/auth/`          | 管理员登录/认证，验证码               |
| **Users**         | `features/users/`         | 用户管理（列表、启用/禁用、角色分配、重置密码） |
| **Roles**         | `features/roles/`         | 角色权限管理，权限矩阵                |
| **Sessions**      | `features/sessions/`      | 活跃会话管理，消息流查看              |
| **Audit**         | `features/audit/`         | 审计日志查看                          |
| **Dashboard**     | `features/dashboard/`     | 控制台仪表盘，系统健康状态            |
| **Profile**       | `features/profile/`       | 管理员个人资料，密码修改              |
| **Model Providers** | `features/model-providers/` | 模型提供商配置管理              |
| **Module Settings** | `features/module-settings/` | 各模块配置（chat/rag/indexing/companion/appearance） |
| **RAG Observability** | `features/rag-observability/` | RAG 检索可观测性面板            |

### 4.5 共享数据契约 (`packages/data/src/schemas/`)

schemas/index.ts 确认导出：

- `admin.schema.ts` — 管理用户列表/状态更新
- `auth.schema.ts` — 登录/注册/用户/加密响应
- `chat.schema.ts` — 聊天消息/会话/提供商
- `common.schema.ts` — 分页通用
- `companion.schema.ts` — 伴侣 CRUD/消息/反馈/记忆
- `companion-pipeline.schema.ts` — LangGraph 管线（意图/情感/安全/质量）Schema
- `document.schema.ts` — 文档 CRUD/移动/复制
- `folder.schema.ts` — 文件夹 CRUD/移动/复制
- `kb.schema.ts` — 知识库 CRUD
- `rag.schema.ts` — RAG 解析/索引类型
- `session.schema.ts` — 会话 CRUD
- `settings.schema.ts` — 设置分类（chat/rag/indexing/companion/appearance）

***

## 5. 模块依赖关系

**数据来源**：[app.module.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/app.module.ts)、[Prisma schema](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/prisma/schema.prisma)、各包 package.json

### 5.1 数据库实体关系（Prisma Schema 确认）

```
User ──< KnowledgeBase ──< Folder (树形，parentId 自关联)
  │           │                  └──< Document ──< Chunk (含 pgvector embedding)
  │           └──< Document ──< Chunk
  │
  ├──< Session ──< Message
  ├──< Setting (key-value)
  │
  ├──< Companion ──< CompanionConversation ──< CompanionMessage
  │     │              └──< CompanionMemory
  │     │              └──< CompanionMessageFeedback
  │     └──< CompanionCarePlan ──< CompanionCareEvent
  │
  ├──< GroupChat ──< GroupChatMember
  │              └──< GroupChatMessage
  │
  ├──< AuthSession ──< RefreshToken (Token Rotation 链)
  └──< UserRole
```

### 5.2 包间依赖

```
packages/data (Zod schemas + TypeScript types)  : 零依赖（仅 zod）
packages/server → @goferbot/data               : workspace:*
packages/web → @goferbot/data                  : workspace:*
packages/admin → @goferbot/data                : workspace:*
```

### 5.3 后端模块启动依赖顺序

NestJS 模块注册顺序隐含依赖：

`ConfigModule`(全局) → `EventEmitterModule` → `ThrottlerModule` → `CommonModule` → `HealthModule`(独立) → `CacheModule` → `UserModule` → `AuthModule`(依赖 User) → `QueueModule`(依赖 Redis) → `StorageModule`(依赖 MinIO) → `KnowledgeBaseModule`(依赖 Storage) → `SessionModule` → `ChatModule`(依赖 Session + RAG) → `CompanionModule`(依赖 LangGraph) → `SettingsModule` → `AdminModule`(依赖 Auth + User) → `RagModule`

***

## 6. 核心模块

以下模块为系统核心，移除将导致系统不可用：

| 模块              | 判定依据                                                                                               | 复杂度 |
|-------------------|--------------------------------------------------------------------------------------------------------|--------|
| **Auth**          | 所有 API 依赖 JWT 认证，6 个 Guard（JWT/Roles/Permission/Throttler/Spider），Token Rotation + 重放检测 | 高     |
| **Chat**          | 核心业务入口，SSE 流式输出、LLM Provider Factory 多提供商切换、RAG 上下文注入                          | 高     |
| **RAG 处理器**    | 混合检索管线（向量+全文+RRF+重排+安全），是"智能问答"的差异竞争力                                      | 很高   |
| **KnowledgeBase** | 知识库是 RAG 的数据基础，含 Folder 树、Document 状态机（6 状态）、文件上传/MinIO                       | 中     |
| **Queue 处理器**  | BullMQ 异步索引（解析→分块→Embedding→pgvector），是文档从上传到检索的核心中转                          | 中     |

***

## 7. 复杂模块

以下模块非核心但实现复杂，新人上手难度较高：

### 7.1 Companion（AI 伴侣）— 最复杂的模块

**数据来源**：[CODE\_WIKI 5.2.4](file:///d:/projects/ai-stared-project/knowledge-base/docs/CODE_WIKI.md#L419-L458)、[graph.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/companion/langgraph/graph.ts)、[interfaces.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/companion/langgraph/interfaces.ts)、Round 1 Deep Exploration

#### 来源背景

从 [ai-partner-agent](file:///d:/projects/ai-stared-project/knowledge-base/.archived/ai-partner-agent) 项目迁移而来。原项目使用 Cloudflare Workers + Hono 的顺序 Pipeline 模式，GoferBot 重写为 NestJS + LangGraph StateGraph 架构。原 9-step Pipeline 映射为 11 个 LangGraph 节点。

#### LangGraph 工作流（11 节点，7 LLM + 3 规则 + 1 条件 LLM）

```
START
  │
  ▼
┌──────────┐  refuse / crisis_support
│  safety  │ ────────────────────────► END (end_safety)
└────┬─────┘                              LLM 调用
     │ continue
     ▼
┌──────────┐
│  intent  │  LLM 调用
└────┬─────┘
     │
     ▼
┌──────────┐
│ emotion  │  LLM 调用
└────┬─────┘
     │
     ▼
┌──────────────┐
│ relationship │  LLM 调用（注入 safety+intent+emotion+messageCount+summary）
└────┬─────────┘
     │
     ▼
┌──────────┐
│  route   │  ⭐ 纯规则（15 条 ROUTE_RULES，零 LLM 成本）
└────┬─────┘
     │
     ▼
┌──────────┐
│  policy  │  ⭐ 纯规则（10 个 POLICY_PACKS 查表，零 LLM 成本）
└────┬─────┘
     │
     ▼
┌──────────┐
│ generate │  LLM 调用（8 段 Prompt 组装，temperature=0.85）
└────┬─────┘
     │
     ▼
┌──────────┐  fail
│ quality  │ ────────► END (end_guard)
└────┬─────┘          ⭐ 规则引擎（10 regex patterns，零 LLM 成本）
     │ pass/warn
     ▼
┌──────────┐
│ summary  │  LLM 调用（temperature=0.3，1600 字符上限，滚动更新）
└────┬─────┘
     │
     ▼
┌──────────────────┐  !shouldExtract
│ memory_candidate │ ─────────────────► END (skip_memory)
└────┬─────────────┘                    LLM 调用 + 关键词兜底
     │ shouldExtract                    (MEMORY_KEYWORD_REGEX)
     ▼
┌──────────────────┐
│memory_extraction │  条件 LLM 调用
└────┬─────────────┘
     │
     ▼
    END
```

**每轮对话 LLM 调用上限**: 7 次（safety + intent + emotion + relationship + generate + summary + memory_candidate + 条件 memory_extraction）。3 个节点（route / policy / quality）为纯规则引擎，零 LLM 成本。

**3 个条件分支**:
1. `safety` → boundaryAction=refuse/crisis_support 时中断管线，返回安全回复
2. `quality` → status=fail 时中断管线，丢弃不合格回复
3. `memory_candidate` → !shouldExtract 时跳过记忆提取

**Prompt 注入链**（前序输出始终作为后续 LLM 可见上下文）:
```
safety → intent(注入 safety) → emotion(注入 safety+intent) → relationship(注入 safety+intent+emotion+messageCount+summary)
```

**统一 LLM 调用模式**: 所有 LLM 节点通过 `SharedNodeFactory.invokeStructured<T>(schema, config, fallback, state, ctx)` 统一调用，失败自动返回 fallback 值保证管线不中断。

- **记忆系统**：5 种记忆类型 (preference/boundary/relationship\_goal/conversation\_style/important\_fact)，按 importance 排序注入上下文。记忆提取含关键词兜底（MEMORY_KEYWORD_REGEX 匹配"记住/以后/别再/我喜欢"→ 强制 shouldExtract=true）
- **关怀计划**：定时主动关怀（daily/weekly/monthly/custom），场景化消息生成
- **Prisma 模型**：10 个表（Companion / Conversation / Message / Memory / Feedback / CarePlan / CareEvent / GroupChat / GroupChatMember / GroupChatMessage）
- **共享 Schema**：companion-pipeline.schema.ts 定义了 LangGraph 管线的 intent/emotion/safety/quality/memory/summary 等 Zod 校验

### 7.2 RAG 检索管线

**数据来源**：[rag-retrieval.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/rag/rag-retrieval.service.ts)、Round 2 Deep Exploration

#### 检索全链路

```
Query 输入
  │
  ├─ QueryUnderstandingService: 改写 + 扩写(最多 3 query 并行) + 语言检测(zh/en → 分词器选择)
  │
  ├─ RouterService: 意图决策 → mode(vector/bm25/hybrid) + needRerank + topK + candidateK
  │     ↓ (skipRouter=true 时跳过, 默认 hybrid)
  │
  ├─ [分支] vector: embedding → knn('embedding') ──┐
  │         bm25: match('content', ik_smart/standard)─┤
  │         hybrid: 并行 vector + bm25 → 应用层 RRF ──┤
  │                                                  │
  ├─ ◄── hits (candidateK 条) ──────────────────────┘
  │
  ├─ [条件] needRerank → BgeRerankService 二次精排(cross-encoder, batchSize=16)
  │
  ├─ Parent Resolution: child chunk → ES 查 parent content → 去重(parent 维度)
  │
  └─ Redis Cache: key=query+所有参数 hash, TTL=60s
```

**关键参数**:
- vector=0.7, bm25=0.3, rrfK=60
- candidateK: max(30, topK * 6)
- topK 默认 5 (RouterService 决策)
- numCandidates: topK * 5 (ES ANN)
- 缓存 TTL: 60s (Redis)
- Query 长度上限: 2000 字符

**权限模型**:
- 必须显式传入 kbIds(否则 ForbiddenException)
- Prisma 验证 userId 拥有所有 kbIds
- ES 层 ACL: allowed_user_ids / allowed_team_ids (命中 OR 字段不存在=公开) — 在 ANN 遍历前执行

**BGE 重排** (详见 §8 #7):
- 配置化模型选择(admin panel `rag.rerankerProvider`)
- 白名单: BAAI/ / Xorbits/ / sentence-transformers/ 前缀
- @xenova/transformers 本地推理(AutoTokenizer + AutoModelForSequenceClassification)
- 降级策略: 词法匹配 50% + 原始分数 50%
- 热更新: config.changed 事件 → refreshConfig()

**已知问题**：[BACKLOG.md](file:///d:/projects/ai-stared-project/knowledge-base/BACKLOG.md#L15-L18) 标记：向量检索结果缺少 chunk content，语义检索被静默降级

### 7.3 前端 Overlay 弹窗系统

**数据来源**：[CODE\_WIKI 6.5](file:///d:/projects/ai-stared-project/knowledge-base/docs/CODE_WIKI.md#L812-L836)

- React Portal 命令式 API，全局统一弹窗管理
- 包含 11 个预置弹窗组件（CreateKbDialog / EditKbDialog / DeleteKbDialog 等）

### 7.4 RBAC 权限系统

**数据来源**：[permission.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/auth/services/permission.service.ts)、[roles.guard.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/auth/guards/roles.guard.ts)、[permission.guard.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/auth/guards/permission.guard.ts)

#### 三层 Guard 链

```
JwtAuthGuard (认证 + 黑名单检测)
  → RolesGuard (@Roles 装饰器 → 角色匹配)
    → PermissionGuard (@Permission 装饰器 → 细粒度权限)
```

- **JwtAuthGuard**: 从 Cookie `goferbot_access_token` 提取 token → 检查 Redis 黑名单 → Passport JwtStrategy.validate()
- **RolesGuard**: 读取 `@Roles(ADMIN)` 装饰器 → 检查 `user.roles.includes(role)`
- **PermissionGuard**: 读取 `@Permission('users.read')` 装饰器 → 调用 `PermissionService.hasAnyPermission()`

#### PermissionService — 权限缓存与 SUPER_ADMIN 判定

- **Redis 缓存优先**: `getUserPermissions(userId, app)` 先查 `auth:permission:{userId}` 缓存（TTL=300s），miss 时查 RolePermission 表
- **SUPER_ADMIN 判定**: `permissions.includes('*')` 或 `permissions.length >= 20`
- **缓存失效**: `invalidateUserPermissions(userId, app)` 单用户或 `invalidateAllPermissions()` 全量
- **权限验证**: `hasAnyPermission()` / `hasAllPermissions()` — SUPER_ADMIN 直接返回 true

#### RBAC 三层角色模型

- USER / ADMIN / SUPER\_ADMIN
- 细粒度 Permission 模型（`permissions` + `role_permissions` 表）
- admin 包使用独立的 PermissionGuard 进行菜单/按钮级控制

### 7.5 processors/ 基础设施层 — Database + Storage

**数据来源**：[prisma.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/database/prisma.service.ts) / [database.module.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/database/database.module.ts) / [storage.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/storage/storage.service.ts) / [storage.provider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/storage/storage.provider.ts) / [storage.module.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/storage/storage.module.ts)

#### DatabaseModule（@Global, 全应用自动注入）

- 提供 `PrismaService` + `TransactionManager`
- `PrismaService` 并非简单 re-export：通过 `client.$extends({ model: { $allModels } })` 注入 2 个自定义方法
  - `paginate(page, size)` → `PaginationResult<total, size, totalPage, currentPage, hasNextPage, hasPrevPage>`
  - `exists(where)` → boolean（count > 0）
- 通过 23 个 getter 代理全部 Prisma 模型：user / session / message / knowledgeBase / folder / document / chunk / setting / companion*6 / groupChat*3 / authSession / refreshToken / userRole / application / applicationAuthMethod / permission / rolePermission
- 实现 `OnModuleInit` / `OnModuleDestroy` 生命周期

#### StorageModule（@Global, 工厂降级 + 委托模式）

```
ConfigService → storageProvider(Factory) → MinIOStorageProvider | null → StorageService(Delegate)
```

- **工厂降级**：`storageProvider.useFactory` 读取 MINIO_ENDPOINT / MINIO_ACCESS_KEY / MINIO_SECRET_KEY / MINIO_BUCKET。未配置时返回 `null`（不抛异常）→ 运行时不中断启动
- **委托守卫**：`StorageService.ensureProvider()` 在 provider 为 null 时抛出 `STORAGE_NOT_CONFIGURED(503)`，阻止未配置环境下的误操作
- **6 个存储操作**：uploadFile / downloadFile / deleteFile / getUrl / extractKeyFromUrl / getPresignedUploadUrl，全部实现 `IStorageProvider` 接口

#### 跨层依赖架构（重要修正）

原先认为 `modules/` 与 `processors/` 是清晰的单向分层，实际代码揭示了**双向依赖**的 pragmatic 模式：

| 方向                 | 引用数 | 典型示例                                                                                                                                                                                                            |
|----------------------|--------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| modules → processors | 32 处  | 全部模块注入 PrismaService；knowledge-base 注入 StorageService / QueueService / RagModule                                                                                                                           |
| processors → modules | 30 处  | processors/rag/ 依赖 modules/settings/（SystemConfigService + ModelProviderService + DTO 类型）；processors/queue/ 依赖 ChatModule + SettingsModule；processors/chat/ 依赖 ConversationService + LlmProviderFactory |

**结论**：`processors/` 并非纯基础设施层，而是**二层结构**——

- **纯基础设施**：`database/`、`storage/` — 仅被依赖，不依赖 modules
- **编排处理器**：`rag/`、`queue/`、`chat/` — 需要 LLM 配置和领域类型，合法地依赖 modules；部分通过 NestJS EventEmitter（listeners → domain events）实现松耦合

这并非架构违规，而是 NestJS monorepo 中常见的 pragmatic 分层模式。

### 7.9 Auth 安全架构详解

**数据来源**：[auth.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/auth/auth.service.ts)、[auth-redis.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/auth/auth-redis.service.ts)、[auth.repository.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/auth/repositories/auth.repository.ts)、[captcha.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/auth/captcha.service.ts)、[cookie.helper.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/auth/cookie.helper.ts)、[errors.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/auth/errors.ts)

#### JWT 双密钥架构

Access Token 和 Refresh Token 使用**独立密钥**签发，防止跨类型签名攻击：

| Token | 密钥环境变量 | 默认有效期 | Cookie 名称 | Cookie maxAge |
|-------|------------|-----------|------------|---------------|
| Access | `JWT_SECRET` | 2h (`JWT_EXPIRES_IN`) | `goferbot_access_token` | 15min |
| Refresh | `JWT_REFRESH_SECRET` | 7d (`JWT_REFRESH_EXPIRES_IN`) | `goferbot_refresh_token` | 7d |

#### Token Rotation 与并发安全

```
登录: createSessionWithTokenPair (事务: AuthSession + RefreshToken)
         → sign AccessToken + RefreshToken → Cookie 设置

刷新: verify RefreshToken → findRefreshTokenByJtiHash
         → 三重检查: usedAt? / revokedAt? / session.revokedAt?
         → 生成新 jti → insertRefreshToken(新) 
         → markRefreshTokenUsed(旧) → sign 新 AccessToken + RefreshToken
```

**并发保护** — 原子 SQL 防止 Token 竞态重放：
```sql
UPDATE "RefreshToken"
SET "usedAt" = now(), "replacedByTokenId" = ?
WHERE "jtiHash" = ? AND "usedAt" IS NULL AND "revokedAt" IS NULL
RETURNING "id"
```
只有一个并发请求能成功（RETURNING 返回行），其余触发 `TOKEN_REPLAY` → 整个 Session 被撤销。

#### jti Hash 安全机制

每次 RefreshToken 生成 UUID jti → SHA256 hash → 存入 `RefreshToken.jtiHash`。JWT payload 含明文 jti，数据库存 hash。即使数据库泄露也无法从 jtiHash 反推 JWT payload 中的 jti，不可能构造有效的 RefreshToken。

#### Token 链式追踪（审计/溯源）

RefreshToken 表两个外键形成完整旋转链：

| 字段 | 含义 |
|------|------|
| `parentTokenId` | 上一个 Token 的 ID |
| `replacedByTokenId` | 替代者 Token 的 ID |

用于安全审计追踪 Token 流转历史和攻击溯源。

#### Auth Redis — 独立连接 + Fail-Closed

AuthRedisService 使用**独立 Redis 连接**，不共用 Queue 或 Cache 的 Redis：

| 功能 | Redis Key 前缀 | TTL | 说明 |
|------|---------------|-----|------|
| Token 黑名单 | `token:blacklist:` | 与 token 剩余有效期一致 | 登出/撤销时写入 |
| 用户缓存 | `auth:user:` | 300s | 避免每次请求查 Prisma |
| 权限缓存 | `auth:permission:` | 300s | 避免每次查 RolePermission 表 |
| lastSeen 节流 | `auth:lastSeen:throttle:` | 60s (SETNX) | 防止高频更新 seelastSeen |

**Fail-Closed 策略**: 生产环境 Redis 不可用时，`isTokenBlacklisted()` 返回 `true`（拒绝所有请求）。开发环境降级允许通过。

#### Cookie 安全策略

| 属性 | 生产环境 | 开发环境 |
|------|---------|---------|
| httpOnly | true | true |
| secure | true | false |
| sameSite | strict | lax |
| path | / | / |

#### CAPTCHA 完整实现

- **生成**: 4位随机字符（排除 0/O/1/I 混淆字符）→ SVG（4条贝塞尔干扰线 + 20个噪点）→ sharp → PNG buffer
- **存储**: Redis `captcha:{id}` + `captcha:img:{id}`，TTL=120s
- **验证**: 一次性消费 — 无论正确与否立即删除，防止暴力探测
- **集成**: 登录接口强制要求验证码

#### 认证错误码体系

11 个 AppException 工厂函数（`auth/errors.ts`）：

| 错误码 | HTTP | 含义 |
|--------|------|------|
| `AUTH_INVALID_CREDENTIALS` | 401 | 邮箱或密码错误 |
| `ACCOUNT_DISABLED` | 403 | 账号已被禁用 |
| `NO_ADMIN_ROLE` | 403 | 无权访问管理后台 |
| `INVALID_TOKEN_TYPE` | 401 | 令牌类型错误 |
| `TOKEN_NOT_FOUND` | 401 | 刷新令牌无效 |
| `TOKEN_REPLAY` | 401 | 检测到重放攻击，会话已撤销 |
| `TOKEN_REVOKED` | 401 | 刷新令牌已撤销 |
| `SESSION_REVOKED` | 401 | 会话已撤销 |
| `USER_NOT_FOUND` | 401 | 用户不存在 |
| `INVALID_REFRESH_TOKEN` | 401 | 刷新令牌无效或已过期 |
| `CAPTCHA_REQUIRED` / `CAPTCHA_INVALID` | 400 | 验证码相关 |

### 7.10 Companion LangChain 层 — LLM 适配基础设施

**数据来源**：[langchain-llm.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/companion/langchain/langchain-llm.service.ts)、[structured-output.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/companion/langchain/structured-output.service.ts)、[llm-config.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/companion/config/llm-config.service.ts)、[shared.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/companion/langgraph/nodes/_shared.ts)

#### LangChain vs LlamaIndex 明确分工

| 模块 | LLM 适配层 | 原因 |
|------|-----------|------|
| **Companion** | LangChain (ChatOpenAI) | 需要 `withStructuredOutput()` 多方法降级链 |
| **Chat** | LlamaIndex (LlamaIndexProvider) | OpenAI-compatible 简单适配，仅需 streaming |
| **RAG** | LlamaIndex (OpenAIEmbedding 适配器) | Embedding 生成 |

#### StructuredOutput — 三方法降级链

`StructuredOutputService.invokeWithFallback<T>()` 实现 3 种结构化输出方法的自动降级：

| API 类型 | 方法优先级 | 说明 |
|----------|-----------|------|
| `chat_completions` | functionCalling → jsonSchema → jsonMode | OpenAI 标准 API |
| `responses` | jsonSchema → functionCalling → jsonMode | OpenAI Responses API |

- 每个方法: `model.withStructuredOutput(schema, {name, method})` → `invoke(prompt)`
- 结果经 `schema.parse()` **二次 Zod 校验**
- **temperature=0**（结构化输出必须确定性）
- 全失败抛 `InternalServerErrorException`

#### LlmConfigService — 热更新配置链

```
SystemConfigService.getDecryptedSystemConfig()
  → settings.companion.provider (provider ID)
  → ModelProviderService.resolveProvider("companion.provider", "llm")
  → { apiKey, model, baseURL, timeoutMs }
  → new ChatOpenAI({ apiKey, model, baseURL, timeout, ...overrides })
```

- 监听 `@OnEvent('config.changed')` 事件热更新
- 仅监听 `companion` 和 `providers` 分类变更
- 未配置时抛 `MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED`

#### 完整 LLM 调用层级

```
LangGraph Node (e.g. intent-node)
  → SharedNodeFactory.invokeStructured<T>(schema, config, fallback, state, ctx)
    → buildVariables(state, ctx) → prompt.invoke(variables)
    → StructuredOutputService.invokeWithFallback({schema, name}, prompt, signal)
      → LlmConfigService.createLangChainChatModel({temperature: 0})
        → SystemConfigService + ModelProviderService
      → model.withStructuredOutput(schema, {name, method}).invoke(prompt)
      → schema.parse(result)  // Zod 二次验证
  → 成功: 返回 T
  → 失败: 返回 fallback (保证 LangGraph 管线不中断)
```

### 7.11 Common 安全与可观测性中间件

**数据来源**：[request-id.middleware.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/middleware/request-id.middleware.ts)、[request-context.middleware.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/middleware/request-context.middleware.ts)、[request-context-storage.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/request-context-storage.ts)、[response.interceptor.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/interceptors/response.interceptor.ts)、[logging.interceptor.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/interceptors/logging.interceptor.ts)、[spider.guard.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/guards/spider.guard.ts)、[ssrf-guard.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/utils/ssrf-guard.ts)

#### 请求生命周期完整链路

```
HTTP Request
  → Helmet 安全头 → Cookie 解析 → CORS
  → RequestIdMiddleware: 透传/生成 X-Request-Id → 写入 req + res header
  → RequestContextMiddleware: extractRequestContext(req) → AsyncLocalStorage.run()
  → 全局 Guard 链: ThrottlerGuard → SpiderGuard → JwtAuthGuard(可选) → RolesGuard → PermissionGuard
  → ZodValidationPipe → Controller → Service
  → ResponseInterceptor: 统一包装 { success, data, meta }
  → AllExceptionsFilter: 异常兜底
```

#### AsyncLocalStorage 上下文传播

基于 Node.js `AsyncLocalStorage` 实现全链路上下文传递：
- `RequestContextStorage.get()` — 获取 traceId/requestId/userId/email/ip/userAgent
- `RequestContextStorage.run(context, fn)` — 执行上下文绑定
- StreamFinalizeService 入队前捕获上下文，Worker 执行时恢复

#### 统一响应格式

**成功响应**（ResponseInterceptor）:
```json
{ "success": true, "data": {}, "meta": { "requestId": "...", "timestamp": "..." } }
```
- `@BypassResponse()` 装饰器可跳过（SSE、文件下载等场景）
- **bigint 自动序列化**: 递归 `serializeBigInt()` 将 Prisma BigInt 字段（如 Document.size）转字符串

**错误响应**（AllExceptionsFilter）:
```json
{ "success": false, "error": { "code": "TOKEN_REPLAY", "message": "..." }, "meta": { "requestId": "...", "timestamp": "..." } }
```
- AppException: 透传 code + message
- HttpException: status → code 映射 (400→VALIDATION_ERROR, 429→RATE_LIMIT_EXCEEDED 等)
- 生产环境隐藏异常细节，开发环境透传

#### LoggingInterceptor — 生产级日志策略

| 场景 | 生产环境 | 开发环境 |
|------|---------|---------|
| 错误 (status >= 400) | ERROR 全量 | DEBUG 全量 |
| 慢请求 (> 2s) | LOG 全量 | DEBUG 全量 |
| 正常请求 | DEBUG 采样 (默认 10%) | DEBUG 全量 |
| 异常抛出 | ERROR 全量 | ERROR 全量 |

- 可配置: `LOG_REQUEST_SLOW_THRESHOLD_MS`（默认 2000ms）、`LOG_REQUEST_SAMPLE_RATE`（默认 0.1）
- **敏感参数自动脱敏**: URL query 中 token/password/secret/apiKey → `***`

#### SpiderGuard — 反爬虫

- **UA 黑名单** regex: `/scrapy|httpclient|axios|python-requests|bot|spider|crawler|curl|wget|java/i`
- **搜索引擎白名单**: `/google|baidu|bing/i`
- 仅生产环境启用，开发环境直接放行

#### SSRF Guard — 防止服务端请求伪造

`validateBaseUrl(url, options)` 防护层级：
1. **HTTPS 协议检查**（生产环境强制）
2. **localhost 特殊处理**（允许 Ollama 本地部署，需 `allowLocalhost=true`）
3. **本地/内网 IP 拒绝**: `127.0.0.1`, `0.0.0.0`, `[::1]`
4. **内网 IP 前缀拒绝**: `10.`, `172.`, `192.168.`, `169.254.`, `127.`, `0.`, `fc`, `fd`, `fe80:`
5. **白名单域名校验**: 默认 `api.openai.com`, `api.deepseek.com`, `api.anthropic.com`，可通过 `SSRF_ALLOWED_HOSTNAMES` 扩展

被 ModelProviderService 调用校验用户配置的 LLM baseURL。

### 7.12 StreamFinalize + ChatFinalize + 三 Redis 连接

**数据来源**：[stream-finalize.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/services/stream-finalize.service.ts)、[chat-finalize.processor.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/chat/chat-finalize.processor.ts)、[queues.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/queue/queues.ts)、[workers.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/queue/workers.ts)

#### StreamFinalize — SSE 流后处理双模式

```
SSE 流结束
  → StreamFinalizeService.schedule(context, steps)
    → tryEnqueue: 尝试入队 chat-finalize
      → 成功: 异步队列消费
      → 失败/队列不可用: 降级为 queueMicrotask
        → RequestContextStorage.run() 恢复上下文
        → 逐个执行 steps (fire-and-forget, 错误不传播)
```

- **双模式互斥**: 入队和微任务是互斥的，不会重复执行
- **上下文恢复**: 入队前捕获 RequestContext，执行时恢复
- **Fire-and-forget**: 每个 step 的异常被 catch 并 log，不传播到主流程

#### ChatFinalizeProcessor — 两步后处理

```
ChatFinalizeProcessor.process(job):
  RequestContextStorage.run(context, async () => {
    Step 1: saveAssistantMessage(sessionId, messageId, fullReply)
      → 失败抛出异常，BullMQ 重试 (attempts=5)
    Step 2: generateTitle(sessionId, input, fullReply, provider)
      → 失败仅 log，不阻塞（标题缺失可接受）
  })
```

**标题生成 Provider 优先级**: config.chat.defaultProvider（如在 enabledProviders 中）→ enabledProviders 降级链 → 无可用 provider 时跳过。

#### BullMQ 3 队列完整拓扑

| 队列 | attempts | backoff | concurrency | removeOnComplete | removeOnFail | Job Data |
|------|----------|---------|-------------|------------------|-------------|----------|
| `document-processing` | 3 | 指数 5s | 2 | 100 | 50 | { documentId, type:'index' } |
| `embedding` | 3 | 指数 5s | 2 | 100 | 50 | { chunkIds[] } |
| `chat-finalize` | 5 | 指数 5s | 1 | 200 | 50 | { sessionId, messageId, userId, fullReply, input, traceId, requestId } |

关键差异:
- chat-finalize 重试次数最高（5次），消息持久化是关键操作
- chat-finalize concurrency=1，避免并发标题生成导致 LLM 调用雪崩
- chat-finalize Job Data 携带 traceId/requestId 用于分布式追踪

#### 三 Redis 独立连接架构（重要修正）

| 连接 | 使用者 | 用途 | 环境变量配置 |
|------|-------|------|------------|
| Queue Redis | BullMQ (queues + workers) | 任务队列 | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| Cache Redis | CacheService | 通用缓存 (TTL=300s) | `CACHE_REDIS_HOST`, `CACHE_REDIS_PORT`, `CACHE_REDIS_PASSWORD` |
| Auth Redis | AuthRedisService | Token 黑名单/用户缓存/权限缓存 | 复用 Queue Redis 配置 |

**设计目的**: 防止队列拥塞影响认证（Auth 独立），防止缓存击穿影响队列（Cache 独立）。

### 7.13 Admin 后端 API — Auth RBAC 管理端消费者

**数据来源**：[admin.controller.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/admin/admin.controller.ts)、[role.controller.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/admin/role.controller.ts)、[admin.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/admin/admin.service.ts)、[role.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/admin/role.service.ts)、[role.repository.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/admin/role.repository.ts)

Admin 后端不是独立业务模块，而是 Auth RBAC 基础设施的**管理端消费者**。它直接依赖 AuthModule 和 AuthRepositoryModule，复用 JwtAuthGuard + PermissionGuard 进行鉴权。

**两个 Controller**：

| Controller | 路由前缀 | 守卫 | 权限码 |
|-----------|---------|------|--------|
| AdminController | `admin/` | JwtAuthGuard + PermissionGuard | `users:read`, `users:update` |
| RoleController | `admin/roles/` | JwtAuthGuard + PermissionGuard | `roles:read`, `roles:update` |

**AdminService 核心功能**：

- `listUsers(query)` — 分页用户列表，支持 email 模糊搜索 + isActive 过滤。分页使用 PrismaService 的 `$extends` 扩展方法 `user.paginate({where, select, orderBy}, {page, size})`，并行执行 count + findMany
- `updateUserStatus(userId, dto)` — 启用/禁用用户，通过 EventEmitter2 发射 `UserStatusChangedEvent`（事件驱动通知）

**RoleService 核心功能**：

- `listRoles()` → RoleRepository.findAll() — 通过 `UserRole.groupBy('role')` 动态发现所有已使用的角色，从 Permission 表 `rolePermissions` 关联读取权限列表。内置角色（SUPER_ADMIN/ADMIN/USER）+ 已分配的角色 = 完整列表
- `listPermissions()` — 按 group 分组返回权限列表（dashboard/users/roles/rag/sessions/audit/profile/modelProviders/moduleSettings/other），分组名映射为中文
- `updateRole(roleCode, {permissions})` → RoleRepository.updateRolePermissions — 采用"先 deleteMany 清空 → 再 create 重建"模式更新，更新后调用 `permissionService.invalidateAllPermissions()` 清除全部权限缓存

**关键依赖链**: `AdminModule → AuthModule + AuthRepositoryModule → JwtAuthGuard + PermissionGuard + AuthRepository + PermissionService`

### 7.14 Storage 存储层 — MinIO 4 层抽象架构

**数据来源**：[IStorageProvider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/interfaces/IStorageProvider.ts)、[storage.provider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/storage/storage.provider.ts)、[storage.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/storage/storage.service.ts)、[minio.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/storage/minio.ts)

```
IStorageProvider (接口：upload/download/delete/getUrl/extractKey/getPresignedUrl)
    ↑
StorageService (门面：ensureProvider() 延迟守卫)
    ↑ 注入 STORAGE_PROVIDER
FactoryProvider (环境变量读取 → MinIO 初始化 → bucket 自动创建)
    ↑
MinIOStorageProvider (minio SDK 封装)
```

**优雅降级设计**：
- FactoryProvider 在环境变量缺失时返回 `null`（不阻塞应用启动）
- StorageService 所有公开方法调用前经 `ensureProvider()` 守卫：未配置时抛 `STORAGE_NOT_CONFIGURED` (503)
- 方案选择原因：`null` 注入 + 运行时守卫 而非 `@Optional()` + try-catch，保证错误信息精确且延迟到实际使用时才报错

**MinIO 特性**：
- 自动创建 bucket（initialize 时 `bucketExists → makeBucket`）
- HTTP/HTTPS 双协议支持
- URL 格式：`{protocol}//{endpoint}:{port}/{bucket}/{key}`
- 下载使用流式读取（`getObject → stream → Buffer.concat`），避免大文件内存溢出
- 预签名上传 URL（`presignedPutObject`），默认 3600s 过期

### 7.15 Health 健康检查 — Liveness/Readiness 双端点

**数据来源**：[health.controller.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/health/health.controller.ts)、[health.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/health/health.service.ts)

| 端点 | 类型 | 行为 |
|------|------|------|
| `GET /health` | Liveness（存活） | 立即返回 `{status:"ok", timestamp, version}`，无外部依赖 |
| `GET /health/ready` | Readiness（就绪） | 并行探针 Postgres + Redis + MinIO，每探针 2500ms 超时 |

**探针状态分类**：

| 结果 | 状态 | 判定 |
|------|------|------|
| 成功 | `ok` | 正常 |
| 超时（timeout after 2500ms） | `degraded` | 降级（服务仍可用但性能下降） |
| 非超时错误（连接拒绝/认证失败） | `down` | 不可用 |

**整体状态聚合**：任一 `down` → `down`；无 `down` 但任一 `degraded` → `degraded`；全 `ok` → `ok`

**实现细节**：使用 `Promise.race(fn(), timeout)` 实现超时控制；错误详情从响应的 `components` 中剥离（仅记录日志），防止泄露内部信息。

### 7.16 Database 数据库层 — Prisma Extended Client

**数据来源**：[prisma.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/database/prisma.service.ts)、[database.module.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/database/database.module.ts)

PrismaService 通过 `$extends({model: {$allModels: {paginate, exists}}})` 为所有 24+ Prisma 模型统一注入两个通用方法：

**paginate() 分页方法**：
- 输入：`{where, select/omit, orderBy}, {page, size}`
- 内部并行执行 `count(where)` + `findMany({...where, take:size, skip})`
- 返回：`{data: T[], pagination: {total, size, totalPage, currentPage, hasNextPage, hasPrevPage}}`

**exists() 存在性检查**：
- 输入：`{where}`，执行 `count(where) > 0`
- 返回 boolean

**模型代理**：通过 getter 暴露所有 Prisma 模型（user/session/message/knowledgeBase/folder/document/chunk/setting/companion*/groupChat*/auth*/permission/rolePermission/application*），每个 getter 返回扩展后的模型（含 paginate + exists）

**生命周期管理**：`OnModuleInit → $connect()` / `OnModuleDestroy → $disconnect()`（disconnect 错误被吞，不阻塞关闭流程）

**DatabaseModule**：`@Global()`，导出 `PrismaService + TransactionManager`

### 7.17 Web SSE 流式客户端 — Chat + Companion 双轨 SSE 架构

**数据来源**：[x-chat.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/api/x-chat.ts)、[GoferChatProvider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/providers/GoferChatProvider.ts)、[ChatPageByTab.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/components/ChatPageByTab.tsx)、[ChatSessionView.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/components/ChatSessionView.tsx)、[sse-client.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/companion/sse-client.ts)、[CompanionChatPage.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/companion/components/CompanionChatPage.tsx)、[sse-response.helper.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/helpers/sse-response.helper.ts)、[chat.schema.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/data/src/schemas/chat.schema.ts#L62-L69)

Chat 和 Companion 采用**两种完全不同的 SSE 客户端方案**，形成有趣的"高抽象 vs 低控制"对比。

#### Chat SSE 管线（高层抽象，@ant-design/x-sdk）

```
后端 SseResponseHelper
  → write({ data: { event, conversation_id, message_id, answer, done?, error? } })
  → HTTP Response: text/event-stream
  ──────────────────────── 网络 ────────────────────────
前端 XRequest (manual: true, authedFetch 自动注入 Authorization)
  → AbstractChatProvider 消费 SSE chunks
    → transformMessage: originMessage.content += chunk.answer (增量累积)
      → useXChat hook: 管理消息列表、loading/success/error/local/updating/abort 6 态
        → Bubble.List + XMarkdown streaming.hasNextChunk (光标动画)
```

**关键组件**：

- **XRequest** (`[x-chat.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/api/x-chat.ts)`): `@ant-design/x-sdk` 的 SSE 请求方法，`manual: true` 表示由 `useXChat` 手动触发。通过 `authedFetch` 工厂注入 `Authorization` header
- **GoferChatProvider** (`[GoferChatProvider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/providers/GoferChatProvider.ts)`): 继承 `AbstractChatProvider`，实现三个核心方法：
  - `transformParams`: 映射 GoferInput → API 请求体（response_mode: 'streaming'）
  - `transformLocalMessage`: 从 query 创建本地 user 消息
  - `transformMessage`: 增量累积 `{ content: originMessage.content + chunk.answer }`，JSON 解析失败静默忽略
- **useXChat** (`[ChatPageByTab.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/components/ChatPageByTab.tsx#L56-L80)`): 管理完整 SSE 生命周期 — requestPlaceholder("正在思考中...") → transformMessage 累积 → requestFallback 错误处理
- **XMarkdown streaming** (`[ChatSessionView.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/components/ChatSessionView.tsx#L75-L83)`): `streaming.hasNextChunk={status === 'loading' || status === 'updating'}` 驱动光标动画
- **Pending Message 模式**: 临时会话 → createChatSession → sessionStorage.setItem(pendingKey) → 导航 → ChatPageByTab 检测 → queueMicrotask 自动发送

**错误处理** (`[ChatPageByTab.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/components/ChatPageByTab.tsx#L68-L79)`):
- `AbortError` → "已取消回复"（保留已有内容）
- 其他 → "网络异常，请稍后重试"

**状态管理双层架构**:
- `useChatStore` (Zustand): UI 状态 + providers + sessionCache（本地）
- `useConversationStore` (Zustand): 按 conversationId 隔离消息，生命周期跨 tab
- 通过 `useEffect` 同步 `useXChat` 消息到 conversationStore

#### Companion SSE 管线（底层实现，原生 fetch）

```
后端 SseResponseHelper
  → write({ event: 'token', data: "chunk text" })
  → write({ event: 'done', data: { messageId, content, createdAt } })
  ──────────────────────── 网络 ────────────────────────
前端 CompanionSseClient (fetch + ReadableStream)
  → reader.read() → TextDecoder → buffer 累积
    → split('\n') → regex 解析 event:xxx\ndata:...
      → onEvent({ event: 'token', data }) → appendStreamingChunk (Zustand)
      → onEvent({ event: 'done', data }) → updateMessage(id, { content, streaming: false })
```

**关键差异**：Companion 的 SSE `data` 字段为**纯文本 token**（非 JSON），done 事件才传 JSON `{ messageId, content, createdAt }`。Chat 的每个 chunk 的 data 字段都为 JSON。

#### 两种方案对比

| 维度 | Chat (@ant-design/x-sdk) | Companion (原生 fetch) |
|------|-------------------------|----------------------|
| SSE 传输 | `XRequest` 方法调用 | `fetch` + `ReadableStream.getReader()` |
| 消息累积 | `AbstractChatProvider.transformMessage` 自动增量 | 手动 `appendStreamingChunk` + Zustand |
| Markdown 渲染 | `XMarkdown streaming.hasNextChunk` 光标动画 | 纯文本渲染（无 Markdown streaming） |
| 状态管理 | `useXChat` hook 全托管 | `useCompanionStore` (Zustand) 手动管理 |
| 中断控制 | `useXChat.abort()` 内置 | 手动 `AbortController` |
| 错误恢复 | `requestFallback` 自动回退 | `doneReceived` 标记 + toast |
| 消息生命周期 | 6 态 (loading/success/error/local/updating/abort) | 3 态 (streaming: true/false) |

#### 后端 SSE 基础设施

**SseResponseHelper** (`[sse-response.helper.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/helpers/sse-response.helper.ts)`) 为 Common 模块的 `@Injectable({ scope: Scope.REQUEST })` 服务，核心机制：

- **SSE 帧格式**: `event: {name}\ndata: {JSON.stringify(data)}\n\n`
- **客户端断开检测**: Fastify `reply.raw.on('close')` → AbortController.abort() → 上游 LLM 调用取消
- **CORS 透传**: 手动将 Fastify reply 的 `access-control-*` + `vary` 头拷贝到 raw response，防止直接写 raw 时丢失跨域头
- **错误帧**: `writeError(error, context)` → `event: error\ndata: { conversation_id, message_id, error }\n\n` → `end()`

#### 共享契约

Chat SSE 消息格式由 `packages/data` 的 `chatMessagesChunkSchema` ([chat.schema.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/data/src/schemas/chat.schema.ts#L62-L69)) 定义：

```ts
{ event: 'message' | 'message_end' | 'error', conversation_id: UUID, message_id: UUID, answer: string, done?: boolean, error?: string }
```

Companion SSE 不走此契约，使用自己的 `token | done | error` 事件格式。

#### 重要修正

**Chat 实际不使用 alova 进行 SSE**：alova 仅用于 Chat 模块的普通 CRUD API（getSessions/getMessages/getChatProviders 等，使用 `.send()` 模式）。SSE 流式通信通过 `@ant-design/x-sdk` 的 `XRequest` + `authedFetch` 实现，这是一个专用的 SSE 传输层。

***

### 7.18 Admin RBAC 前端守卫 — 三层权限控制 + Token 自动刷新

**数据来源**：[auth-guard.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/utils/auth-guard.ts)、[_authenticated.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/routes/_authenticated.tsx)、[server.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/utils/server.ts)、[auth.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/stores/auth.ts)、[router-register.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/router-register.ts)、[permissions.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/constants/permissions.ts)、[MenuConfig.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/components/layout/MenuConfig.tsx)

Admin 前端 RBAC 实现**三层权限控制**，与后端 §7.4 RBAC 权限系统形成前后端联动的完整安全边界。

#### 第一层：路由守卫（TanStack Router beforeLoad）

`_authenticated.tsx` 的 `beforeLoad` 在每次导航前执行：

```
waitForAuthInit()（50ms 轮询，3s 超时）
  → getAuthSnapshot()：读取 isAuthenticated + role + permissions
    → 未登录 → redirect /login（携带 ?redirect=原URL）
    → 已登录 但 mustChangePassword → redirect /change-password
    → 已登录 但 无路由 requiredPermission → redirect /forbidden
    → 通过 → 正常渲染
```

`waitForAuthInit()` ([auth-guard.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/utils/auth-guard.ts#L3-L21)): 等待 Zustand persist 的 hydration 完成（`_hydrated && isInitialized`），超时 3000ms 后强制初始化防止永久白屏。

`hasAnyPermission(snapshot, permissions)` ([auth-guard.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/utils/auth-guard.ts#L48-L52)): SUPER_ADMIN 直接返回 true，否则检查 `permissions.some(p => snapshot.permissions.includes(p))`。

`buildLoginRedirectSearch()` ([auth-guard.spec.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/utils/auth-guard.spec.ts#L119-L129)): 防御 `null` 原型 search 对象崩溃（`Object.create(null)` 无 `toString`），使用 `location.href` 而非 `location.search` 拼接参数。

#### 第二层：菜单动态过滤

`useMenuConfig()` ([MenuConfig.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/components/layout/MenuConfig.tsx#L16-L50)): 从 `ROUTES_REGISTER`（14 条路由元数据）中筛选：

- `!r.nav` → 排除非导航路由（login/changePassword 等）
- `r.requiredPermission && !permissions.includes(r.requiredPermission)` → 排除无权限路由
- `mustChangePassword` 模式 → 仅显示 profile

权限变更后菜单**实时响应**（useMemo 依赖 `user`），无需刷新页面。

#### 第三层：组件级权限（PermissionMatrix）

`PermissionMatrix` ([PermissionMatrix.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/roles/components/PermissionMatrix.tsx)): 按 `group` 分组的 Checkbox 权限矩阵，支持：

- 双向绑定：`fetchRole` → `setSelected(permissions)` → 用户勾选 → `setSelected`
- Dirty 检测：`selected.join(',') !== role.permissions.join(',')` → 显示"保存修改"
- 保存：调用 `updateRoleService(id, { permissions: selected })`

#### 路由-权限映射表

`ROUTES_REGISTER` ([router-register.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/router-register.ts#L43-L154)) 集中管理 14 条路由的元数据：

| 路由 | requiredPermission | nav |
|------|-------------------|-----|
| /dashboard | dashboard | true |
| /users | users | true |
| /users/$id | users | false |
| /roles | roles | true |
| /roles/$id | roles | false |
| /rag-observability | rag | true |
| /sessions | sessions | true |
| /sessions/$id | sessions | false |
| /audit | audit | true |
| /profile | profile | false |
| /change-password | - | false |
| /model-providers | modelProviders | true |
| /module-settings | moduleSettings | true |
| /login | - | false |

#### Token 自动刷新 — 订阅者队列模式

alova `responded` 拦截器 ([server.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/utils/server.ts#L71-L117)):

```
HTTP 401/403（非登录页）
  → isRefreshing? 
      否 → doRefreshAndRetry(method):
            isRefreshing=true → fetch /admin/auth/refresh (credentials:include)
              → ok? onRefreshed() → refreshSubscribers.forEach(cb => cb())
              → fail? clearAuth() → window.location.replace('/login')
      是 → addSubscriber(cb) → 等待 onRefreshed() 后重发
```

- **互斥锁** `isRefreshing`: 确保只有一个请求执行 refresh
- **订阅者队列** `refreshSubscribers[]`: 等待中的请求不会重复刷新，而是订阅刷新完成事件后批量重发
- **HttpOnly Cookie 认证**: `refresh({ refreshToken: '' })` — 空字符串，后端从 Cookie 读取；所有请求通过 `credentials: 'include'`

**错误解析** ([server.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/utils/server.ts#L79-L104)): 兼容两种后端错误格式 `{ error: { code, message } }` 和 `{ code, message }`，提取 code/message 注入 Error 对象。正常响应自动解包 `response.json().data ?? response.json()`。

#### Auth 状态持久化

Zustand `persist` middleware ([auth.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/stores/auth.ts#L32-L81)):

- **存储位置**: `localStorage('goferbot-admin-auth')`
- **partialize**: 仅持久化 `{user, isAuthenticated}`，Token 由 HttpOnly Cookie 承载
- **onRehydrateStorage**: hydration 完成后自动 `setInitialized(true)` 如果已有认证状态
- **clearAuth**: 同时清除 `localStorage` 和 Zustand state

#### 登录与会话恢复

**登录流程** ([auth/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/auth/services.ts#L26-L71)):

```
输入邮箱+密码
  → RSA 公钥加密密码（encryptPassword）
  → POST /admin/auth/login (email, encryptedPassword, captcha?)
    → 成功: setUser({...user, mustChangePassword?})
    → DECRYPT_FAILED: 清除公钥缓存 → 重试一次
    → 其他失败: toast 错误消息
```

**会话恢复** ([auth/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/auth/services.ts#L84-L96)): `fetchCurrentUser()` → GET `/auth/me` → 成功则 `setUser()`，401/403 则 `clearAuth()`。

#### 前端权限常量

`PERMISSIONS` ([permissions.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/constants/permissions.ts#L1-L116)): 19 个权限码（dashboard/profile/users:crud/roles:crud/rag/sessions/audit/modelProviders/moduleSettings）。

`ROLE_PERMISSIONS`: 3 角色预设权限集（前端硬编码，作为初始参考）:

| 角色 | 权限数 | 详情 |
|------|--------|------|
| SUPER_ADMIN | 18 | 全部权限 |
| ADMIN | 14 | 无 users:delete/roles:create/update/delete |
| USER | 2 | dashboard + profile |

> 实际权限以后端 `/admin/permissions` 返回为准，`ROLE_PERMISSIONS` 仅为前端预设常量。

#### 与后端 RBAC 的联动

```
前端 (_authenticated beforeLoad)           后端 (JwtAuthGuard → PermissionGuard)
  ┌─────────────────────────┐              ┌──────────────────────────────┐
  │ waitForAuthInit()       │              │ JWT Cookie 验证              │
  │ getAuthSnapshot()       │              │ JwtStrategy.validate()       │
  │ hasAnyPermission(...)   │   HTTP 200   │ PermissionGuard              │
  │  └─ route 可访问        │ ◄─────────── │  └─ 403 不可访问             │
  │  └─ menu 可见           │              │                              │
  └─────────────────────────┘              └──────────────────────────────┘
```

前后端权限码一致（如 `users:read`, `roles:update`），共享 `packages/data` 的 Zod Schema 类型约束。

***

### 7.19 Overlay 弹窗系统 — 命令式 Portal 架构

**数据来源**：[overlay.types.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/overlays/types/overlay.types.ts)、[overlay-store.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/overlays/host/overlay-store.ts)、[overlay-service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/overlays/services/overlay-service.ts)、[OverlayHost.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/overlays/host/OverlayHost.tsx)、[useOverlay.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/overlays/hooks/useOverlay.ts)

Overlay 弹窗系统是实现命令式弹窗调用的**4 层架构**，支持 dialog 和 context-menu 两种类型，通过 React Portal 渲染到 body 层。

#### 架构分层

```
┌─────────────────────────────────────────────────┐
│  React 组件层 (11 个预置 Dialog)                    │
│  DeleteSessionDialog / CreateKbDialog / ...       │
├─────────────────────────────────────────────────┤
│  命令式 API 层                                     │
│  openDialog<T>() → Promise<T>                     │
│  openContextMenu<T>() → Promise<T>                │
│  closeDialog / closeContextMenu / closeAll        │
├─────────────────────────────────────────────────┤
│  Zustand Store (状态管理)                          │
│  entries[] / nextZIndex / push / remove / closeAll│
├─────────────────────────────────────────────────┤
│  React Portal 渲染层                               │
│  OverlayHost → createPortal(..., document.body)   │
├─────────────────────────────────────────────────┤
│  类型定义                                          │
│  OverlayEntry / OverlayState / OverlayKind        │
└─────────────────────────────────────────────────┘
```

#### 完整生命周期

```
调用方                    Store               OverlayHost            Dialog 组件
  │                        │                      │                      │
  │──openDialog(Comp,props)────→ push(entry)       │                      │
  │    返回 Promise ◄────────── resolve/reject 注入 │                      │
  │                        │                      │                      │
  │                        │   entries[] 更新 ◄────│ 订阅 store           │
  │                        │                      │──createPortal──►     │
  │                        │                      │  <Comp {...props}   │
  │                        │                      │   onClose={fn} />   │
  │                        │                      │                      │
  │                        │                      │        用户交互 ────→│
  │                        │          onClose(result) ◄──────────────────│
  │                        │                      │                      │
  │                        │──remove(id, result)──→│                      │
  │                        │  resolve(result)      │                      │
  │   Promise resolve ◄────│                      │                      │
```

**核心机制**：
1. `openDialog` 创建 Promise，将 `resolve/reject` 注入 `OverlayEntry`
2. Store.push 生成唯一 id，zIndex 自增（起始 1000）
3. OverlayHost 订阅 entries 变化，通过 `createPortal` 渲染到 `document.body`
4. OverlayHost 为每个组件注入 `onClose(result)` prop
5. Dialog 组件调用 `onClose(result)` → `store.remove(id, result)` → Promise resolve
6. `closeAll()` 批量 resolve(undefined) 所有 pending Promise，清空 entries

#### OverlayEntry 数据模型

```ts
interface OverlayEntry {
  id: string                    // 全局唯一 ID
  kind: 'dialog' | 'context-menu'
  component: ComponentType      // React 组件
  props: Record<string, unknown>
  zIndex: number                // 自增层级
  position?: { x: number; y: number }  // context-menu 屏幕坐标
  resolve?: (value: unknown) => void   // Promise resolver
  reject?: (reason: unknown) => void   // Promise rejecter
}
```

#### 弹窗组件约定

所有弹窗组件接受统一的 `onClose` prop：

```ts
interface DialogProps {
  onClose?: (result?: unknown) => void
  // ... 其他业务 props
}
```

**两种返回值变体**：
- **Alert 风格**（DeleteSessionDialog/ConfirmDialog/DeleteKbDialog/DeleteItemDialog）：`onClose('confirm')` / `onClose('cancel')` — 调用方 `openDialog<'confirm' | undefined>(Comp, props)`
- **Form 风格**（CreateKbDialog/EditKbDialog/RenameItemDialog/EditNameDialog）：`onClose(true)` / `onClose(false)` — 调用方 `openDialog<boolean>(Comp, props)`

#### 两种弹窗类型

| 特性 | dialog | context-menu |
|------|--------|-------------|
| 渲染方式 | 居中 Dialog/AlertDialog | 绝对定位 div |
| 坐标 | 无 | `position: {x, y}` 屏幕像素 |
| 使用场景 | 创建/编辑/删除确认 | 右键菜单 |
| API | `openDialog(Comp, props)` | `openContextMenu(Comp, position, props)` |

#### Hook 封装

`useOverlay()` ([useOverlay.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/overlays/hooks/useOverlay.ts)) 是对服务的薄封装：

```ts
const overlay = useOverlay()
overlay.dialog(ConfirmDialog, { title: '确认？' })     // → Promise<'confirm' | 'cancel'>
overlay.contextMenu(FileMenu, { x: 100, y: 200 })       // → Promise<TResult>
overlay.closeAll()                                       // → 关闭全部
```

#### 挂载位置

OverlayHost 挂载在 `routes/__root.tsx` ([__root.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/routes/__root.tsx#L78)) body 中，与 App 主体平级：

```tsx
<body>
  <App />         {/* 主应用 */}
  <OverlayHost /> {/* Portal 弹窗层 — createPortal 到 document.body */}
</body>
```

这确保 Portal 始终在 DOM 最顶层，不受父组件 `overflow: hidden` 或 `z-index` 堆叠上下文限制。

#### 11 个预置弹窗

| 弹窗 | 类型 | 说明 |
|------|------|------|
| ConfirmDialog | Alert | 通用确认弹窗（可配置 title/description/onConfirm） |
| CreateKbDialog | Form | 创建/编辑知识库（react-hook-form + Zod 校验） |
| CreateFolderDialog | Form | 创建文件夹 |
| DeleteKbDialog | Alert | 删除知识库确认（404→refresh/403→权限不足） |
| DeleteItemDialog | Alert | 删除（文件/文件夹）确认 |
| DeleteSessionDialog | Alert | 删除会话确认 |
| EditKbDialog | Form | 编辑知识库名称/描述 |
| EditNameDialog | Form | 编辑名称（通用） |
| EditAvatarDialog | Form | 编辑头像 |
| RenameItemDialog | Form | 重命名（文件/文件夹） |
| PreviewDialog | Form | 文件预览 |

***

### 7.20 测试架构 — 4 层测试金字塔

**数据来源**：[package.json 测试脚本](file:///d:/projects/ai-stared-project/knowledge-base/package.json#L14-L25)、[playwright.config.ts](file:///d:/projects/ai-stared-project/knowledge-base/e2e/playwright.config.ts)、[vitest*.config.ts](file:///d:/projects/ai-stared-project/knowledge-base)

项目采用**4 层测试金字塔**，从底层到顶层覆盖不同粒度的验证：

```
┌─────────────────────────────────────────────────────┐
│  E2E Browser (Playwright + Chromium)                 │  1 spec, 8 cases (3 fixme)
│  auth-chat.spec.ts                                  │  real browser, mock or real backend
├─────────────────────────────────────────────────────┤
│  E2E API (vitest + axios + full NestJS app)          │  1 spec: chat-flow.spec.ts
│  TestAppFactory → NestFastifyApplication.listen()   │
├─────────────────────────────────────────────────────┤
│  Integration (vitest + NestJS TestApp)               │  22 specs
│  all controllers + infrastructure + RAG pipelines   │
├─────────────────────────────────────────────────────┤
│  Unit (vitest)                                       │  1 spec + per-package tests
│  TestDatabaseManager + pure logic                   │
└─────────────────────────────────────────────────────┘
```

#### 测试命令

| 命令 | 层级 | 运行器 |
|------|------|--------|
| `test` / `test:unit` | Unit | vitest |
| `test:integration` | Integration | vitest (vitest.integration.config.ts) |
| `test:e2e:api` | E2E API | vitest (vitest.e2e-api.config.ts) |
| `test:e2e` | E2E Browser | Playwright (e2e/playwright.config.ts) |
| `test:all` | 全量 | 顺序执行 all 4 层 |

#### E2E Browser 架构

**Page Object Model**:

- `AuthPage` ([AuthPage.ts](file:///d:/projects/ai-stared-project/knowledge-base/e2e/pages/AuthPage.ts)): `nameInput`/`emailInput`/`passwordInput`/`submitButton` locator + `gotoLogin()`/`register()`/`login()` business methods
- `ChatPage` ([ChatPage.ts](file:///d:/projects/ai-stared-project/knowledge-base/e2e/pages/ChatPage.ts)): `homeTextarea`/`bubbleList`/`assistantBubbles` locator + `submitFromHome()`/`waitForAssistantReply()`/`getAssistantMessageCount()` methods

**Mock 双模式** (`[mocks.ts](file:///d:/projects/ai-stared-project/knowledge-base/e2e/fixtures/mocks.ts)`):

- `installAuthMocks`: 内存 users Map + RSA 2048 OAEP 密钥对 → 模拟 register/login/me/refresh 完整认证流程（解密密码 + 校验 + 返回 mock token）
- `installChatMocks`: 模拟 providers/sessions/chat-messages（SSE data:`event: message\n...` 格式），支持 mock AI 回复
- 当前 `auth-chat.spec.ts` 使用**真实后端模式**（无 mock 安装），需配置 LLM provider

**独立数据库**: `goferbot_e2e` 专用数据库，避免污染开发数据：
- globalSetup ([playwright.global-setup.ts](file:///d:/projects/ai-stared-project/knowledge-base/e2e/playwright.global-setup.ts)): 验证 PostgreSQL 连接
- globalTeardown ([playwright.global-teardown.ts](file:///d:/projects/ai-stared-project/knowledge-base/e2e/playwright.global-teardown.ts)): TRUNCATE CASCADE 8 张表（messages/sessions/chunks/documents/folders/knowledge_bases/settings/users），遵循外键依赖顺序

**Playwright 配置**:
- `fullyParallel: false`（serial 模式，注册→登录依赖顺序）
- `workers: 1`，CI 环境 `retries: 1`
- `reuseExistingServer: true`（复用 `pnpm --filter @goferbot/web dev`）
- 仅 Chromium 浏览器

#### E2E API 架构

`chat-flow.spec.ts` ([chat-flow.spec.ts](file:///d:/projects/ai-stared-project/knowledge-base/tests/e2e/api/chat-flow.spec.ts)): 唯一 API E2E 用例

```
TestAppFactory.create(dbUrl) → NestFastifyApplication.listen(0)
  → registerUser(RSA加密→POST /api/auth/register)
  → login(RSA加密→POST /api/auth/login)
  → createSession(POST /api/sessions)
  → Mock ChatService.streamChat (vi.spyOn)
  → axios.post('/api/chat-messages', { response_mode: 'streaming' })
  → 验证 SSE content-type + 内容
```

#### Integration 测试覆盖矩阵（22 specs）

| 模块 | Spec | 覆盖内容 |
|------|------|----------|
| Auth | auth.controller.spec.ts | 注册/登录/刷新/登出 |
| Auth | admin-user-management.spec.ts | 用户管理 CRUD |
| Chat | chat.controller.spec.ts | 会话/消息 |
| Session | session.controller.spec.ts | 会话 CRUD |
| KB | knowledge-base.controller.spec.ts | 知识库 CRUD |
| KB | document.controller.spec.ts | 文档 CRUD |
| KB | folder.controller.spec.ts | 文件夹 CRUD |
| KB | folder-cross-kb.spec.ts | 跨KB文件夹操作 |
| KB | kb-cleanup.spec.ts | KB/文件夹/文档清理 |
| Settings | settings.controller.spec.ts | 用户+系统配置 |
| Health | health.controller.spec.ts | Liveness/Readiness |
| RAG | rag-real.spec.ts | 真实 RAG 检索 |
| RAG | rag-e2e.spec.ts | RAG 端到端 |
| RAG | pgvector-store.spec.ts | pgvector 存储 |
| RAG | prisma-vector-indexer.spec.ts | 向量索引 |
| RAG | vector-service.spec.ts | 向量服务 |
| Infra | infra.spec.ts | 基础设施健康 |
| Infra | exceptions-filter.spec.ts | 异常处理 |
| Infra | response-interceptor.spec.ts | 响应拦截器 |
| Infra | throttler-guard.spec.ts | 限流守卫 |
| Infra | zod-validation-pipe.spec.ts | Zod 校验管道 |

#### Browser E2E 覆盖缺口

`auth-chat.spec.ts` 当前 8 个用例中有 **3 个 fixme**：

| 用例 | 状态 | 原因 |
|------|------|------|
| 已登录用户访问 /login 重定向首页 | fixme | blocked by f-02-route-guard（前端未实现） |
| 首页输入后切换到会话页并显示对话 | fixme | blocked by no-llm-provider（无 LLM API Key） |
| 会话页可以看到用户和 AI 双向对话 | fixme | blocked by no-llm-provider（无 LLM API Key） |

正常运行的 5 个用例覆盖：注册页面 UI、登录页面 UI、注册新用户跳转首页、已注册用户登录、错误密码登录失败。

#### 测试覆盖率总结

| 测试层 | Spec 数 | 覆盖率 | 评价 |
|--------|---------|--------|------|
| Unit | 1 | 低 | 仅 TestDatabaseManager，业务逻辑单元测试缺失 |
| Integration | 22 | 高 | 全覆盖所有 Controller + 基础设施 + RAG |
| E2E API | 1 | 低 | 仅 chat-flow，无 auth/kb/admin 场景 |
| E2E Browser | 1 (5 有效) | 中 | 仅 auth + chat 基础流程，3 fixme，无 admin/RAG/Companion |

整体评价：**Integration 层最强**（22 specs 全覆盖），**E2E 层有提升空间**（API 层面可补充更多业务场景，Browser 层面需解决 LLM provider 依赖后可恢复 3 个 fixme）。

***

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

## 9. Knowledge Gap Roadmap

### 分类汇总

| Unknown # | 问题                         | 分类                           |
|-----------|------------------------------|--------------------------------|
| 1         | Elasticsearch 状态           | [RESOLVED] (Round 2)           |
| 2         | CI/CD 流水线                 | D — Business（已确认：未实施） |
| 3         | 生产部署配置                 | E — True Unknown               |
| 4         | LangGraph 工作流全貌         | [RESOLVED] (Round 1)           |
| 5         | GroupChat 实现状态           | D — Business                   |
| 6         | modules/ vs processors/ 边界 | [RESOLVED] (Round 3)           |
| 7         | @xenova/transformers 用途    | [RESOLVED] (Round 2)           |

### 补全路线图（按优先级排序）

| 优先级 | 目标                                        | 耗时     | 状态                      |
|--------|---------------------------------------------|----------|---------------------------|
| **P0** | 理解 RAG 检索全链路（ES ↔ pgvector 双存储） | 60 min   | DONE (Round 2)            |
| **P0** | 理解 Companion LangGraph 工作流             | 45 min   | DONE (Round 1)            |
| **P1** | 理解 modules/ vs processors/ 分工           | 20 min   | DONE (Round 3)            |
| **P1** | 理解 BGE 重排实现                           | 15 min   | DONE (Round 2)            |
| **P2** | 评估 CI/CD 实施时机                         | 10 min   | Business — 待 PM 决策     |
| **P3** | 确认 GroupChat 产品计划                     | 需 PM    | Business — 待 PM 决策     |
| **P3** | 确认生产部署方案                            | 需 Infra | True Unknown — 无仓库信息 |

### Explorer 速查索引

以下文件列表覆盖所有 A 类 Unknown 的阅读需求，可直接依次阅读：

```
packages/server/src/processors/rag/
├── rag.module.ts                  ← ES 服务注册
├── rag-retrieval.service.ts       ← 检索入口（ES 驱动）
├── elasticsearch.service.ts       ← ES 客户端
├── es-vector.service.ts           ← 向量检索
├── es-keyword.service.ts          ← 关键词检索
├── es-filter.builder.ts           ← 过滤器
├── bge-rerank.service.ts          ← 本地 BGE 重排（@xenova/transformers）

packages/server/src/modules/companion/langgraph/
├── graph.ts                       ← StateGraph 定义 + 条件路由
├── interfaces.ts                  ← CompanionState 类型
├── nodes/*.ts                     ← 11 个节点

packages/server/src/modules/companion/
├── companion-chat-pipeline.service.ts ← Pipeline 编排

docs/prd/
├── ci-pipeline.md                 ← CI 设计文档
```

---

### 7.21 Web Companion 前端 UI 渲染

> **解决**: c9-4 Web Companion 前端 UI 渲染

Companion 前端采用 **10 个组件** 组成完整的 CRUD + 对话 UI，与 Chat 模块使用完全不同的流式渲染策略。

#### 组件树和交互流

```
CompanionListPage                     ← 列表页（/companions）
├── Tabs（全部/草稿/已发布/已归档）      ← 四态筛选
├── Grid（1-4列响应式）                 ← 卡片布局
│   └── CompanionCard                 ← 每张卡片
│       ├── 头像（图片/首字母）         ← CSS backgroundImage + fallback
│       ├── CompanionStatusTag        ← 状态徽章
│       └── DropdownMenu（编辑/删除）   ← 更多操作
├── CompanionForm（Dialog）            ← 创建/编辑表单
└── AlertDialog（删除确认）             ← 二次确认

CompanionChatPage                     ← 聊天页（/companions/$id/chat）
├── CompanionHeader                   ← 固定顶部
│   ├── 返回 + 头像 + 名称 + StatusTag
│   └── "记忆库" 按钮 → /companions/$id/memories
├── 消息滚动区（overflow-y-auto）
│   ├── [空状态] Empty + CompanionQuickPrompts
│   └── [有消息] CompanionMessageItem[]
│       ├── 用户消息: plain text（placement=end, variant=filled）
│       └── AI 消息: XMarkdown（静态）+ 点赞/踩反馈
│           └── [流式中] CompanionTypingIndicator 覆写 content
└── Sender（固定底部）                  ← enter 发送, autoSize 3-6行
```

#### 打字机动画 vs XMarkdown 流式渲染

Companion 和 Chat 使用了两种完全不同的流式渲染策略：

| 维度 | Companion | Chat |
|------|-----------|------|
| 渲染引擎 | `CompanionTypingIndicator` | `XMarkdown streaming.hasNextChunk` |
| 技术方案 | `setInterval(18ms)` + `useState(displayedCount)` | `@ant-design/x-markdown` 内置 SSE 流式 |
| 动画效果 | 逐字显示 + 尾部闪烁光标 `animate-pulse` | Markdown 增量渲染 + 光标动画 |
| 完成回调 | `onComplete()` | XMarkdown 自动管理 |
| 适用场景 | 纯文本逐字输出（模拟真人打字） | Markdown 增量渲染（代码块、表格等） |

```typescript
// CompanionTypingIndicator — 逐字打字机（18ms/字）
// packages/web/src/features/companion/components/CompanionTypingIndicator.tsx
useEffect(() => {
  const timer = setInterval(() => {
    setDisplayedCount((prev) => {
      const next = prev + 1
      if (next >= content.length) { clearInterval(timer) }
      return next
    })
  }, intervalMs)  // 默认 18ms
}, [content, displayedCount])

// 渲染: 已显示文字 + 闪烁光标
{content.slice(0, displayedCount)}
{displayedCount < content.length && (
  <span className="animate-pulse w-0.5 h-4 bg-current" />
)}
```

#### 消息气泡组件

[CompanionMessageItem.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/companion/components/CompanionMessageItem.tsx) 根据消息状态决定渲染方式：

| 消息角色 | 渲染内容 | Bubble 配置 | 反馈按钮 |
|---------|---------|------------|---------|
| 用户消息 | 纯文本 `message.content` | `placement=end, variant=filled` | 无 |
| AI 消息（流式中） | `<CompanionTypingIndicator content={message.content} />` | `placement=start, variant=borderless` | 无 |
| AI 消息（完成） | `<XMarkdown content={message.content} streaming={{ hasNextChunk: false }} />` | `placement=start, variant=borderless` | 点赞/踩（group-hover 显示） |

**反馈机制**: `group-hover:opacity-100 transition-opacity` 悬停显示点赞/踩按钮，已投票按钮高亮 `variant='secondary'`，调用 `submitFeedback(messageId, {rating: 1|-1})` 提交。

#### 数据模型

```typescript
// packages/web/src/features/companion/types.ts

// Companion 实体（完整角色属性）
interface Companion {
  id, name, headline?, description?, personality?, tone?,
  boundaries?, guardrailsPrompt?, defaultPrompt?, avatarKey?,
  backgroundStory?, openingMessage?, visibility?,
  status: 'draft' | 'published' | 'archived'
  lastAssistantMessage?, createdAt, updatedAt
}

// 前端消息（比后端 Message 多了 streaming + feedback）
interface CompanionMessage {
  id, conversationId, content, createdAt
  role: 'user' | 'assistant' | 'system'
  streaming?: boolean                          // 标记流式中
  feedback?: { rating: 'up'|'down', comment? } // 用户反馈
}

// 5 种记忆类型（中文标签）
type MemoryType = 'preference' | 'boundary' | 'relationship_goal'
  | 'conversation_style' | 'important_fact'
```

#### CompanionForm 11 字段

| 字段 | 组件 | 说明 |
|------|------|------|
| `name` | Input | 唯一必填 |
| `headline` | Input | 卡片副标题 |
| `description` | Textarea(3行) | 详细描述 |
| `personality` | Input | 性格设定 |
| `tone` | Input | 语气风格 |
| `boundaries` | Textarea(2行) | 行为边界 |
| `guardrailsPrompt` | Textarea(2行) | 安全约束提示词 |
| `defaultPrompt` | Textarea(2行) | 默认系统提示词 |
| `backgroundStory` | Textarea(3行) | 背景故事 |
| `openingMessage` | Textarea(2行) | 开场白 |
| `avatarKey` | Input | 头像文件 key |
| `visibility` | Input | 可见性 |

所有字段 `trim()` 处理，空字符串转 `undefined`。create/edit 双模式通过 `mode` prop 切换。

#### 头像渲染

两个位置共用相同的头像逻辑（Card + Header）：

```typescript
// CSS backgroundImage 模式 — 有图片时用图片，无图片时首字母 fallback
<div style={{
  backgroundImage: companion.avatarKey
    ? `url(/api/files/${companion.avatarKey})`
    : undefined,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
}}>
  {!companion.avatarKey && companion.name.charAt(0)}
</div>
```

#### CompanionStatusTag 三态映射

| 状态 | Badge variant | 中文标签 |
|------|-------------|---------|
| `draft` | `default` | 草稿 |
| `published` | `secondary` | 已发布 |
| `archived` | `destructive` | 已归档 |

---

## Changelog

### v2 (2026-07-02) — Round 1 Discovery Consolidation

**修正**:
- Round 1: 修正 §7.1 — Companion 11 节点中仅 7 个调用 LLM，RouteNode / PolicyNode / QualityGuardNode 为纯规则引擎（非 LLM）。策略路由在原 ai-partner-agent 中为 LLM 生成，GoferBot 重写为 15 条硬编码 ROUTE_RULES + 10 个 POLICY_PACKS 查表

**新增**:
- Round 1: 新增 §7.1 — LangGraph 完整图结构（11 节点执行顺序 + 3 条件分支）、Prompt 注入链、SharedNodeFactory 统一 LLM 调用模式、记忆关键词兜底机制、来源背景（ai-partner-agent 迁移）

**已解决**:
- Round 1: [RESOLVED] #4 LangGraph 工作流全貌 — 全部 5 个子问题已回答（StateGraph 条件路由、执行顺序、节点实现、类型定义、stream 机制）

### v3 (2026-07-02) — Round 2 Discovery Consolidation

**修正**:
- Round 2: 修正 §7.2 — BGE 重排非硬编码单模型，而是配置化 cross-encoder 推理(admin panel 配置 + 白名单校验 + @xenova/transformers 本地推理 + 降级策略)
- Round 2: 修正 §7.2 — RRF 为应用层实现(非 ES 原生)，公式 Σ(weight_i / (k + rank_i + 1))

**新增**:
- Round 2: 新增 §7.2 — RAG 检索全链路(QueryUnderstanding → Router → Vector/BM25/Hybrid → RRF → Rerank → Parent Resolution → Cache) + 权限模型 + 关键参数
- Round 2: 新增 §7.1 Companion pipeline service — prepareContext / execute / assertFinalState / persist 外部编排层

**已解决**:
- Round 2: [RESOLVED] #1 Elasticsearch 检索侧实现 — 全部 5 个子问题已回答
- Round 2: [RESOLVED] #7 @xenova/transformers 用途 — 全部子问题已回答

### v5 (2026-07-02) — Cycle 2 Discovery Consolidation

**修正**:
- Cycle 2: 修正 §4.2 Queue — 从"BullMQ 队列管理、IndexingWorker"扩展为完整的 3 队列架构（document-processing / embedding / chat-finalize）+ Redis 降级 + 动态模块
- Cycle 2: 修正 §4.2 Parser — 从"PDF解析器+文本解析器"扩展为策略模式调度中心 + PDF 三引擎后备链 + StructureExtractor
- Cycle 2: 修正 §4.1 Session — Repository 模式为导出给其他模块使用（SessionService 本身直接使用 PrismaService）
- Cycle 2: 修正 §4.1 User — 密码变更事务（撤销所有 Session+RefreshToken）+ 超管引导分布式锁

**新增**:
- Cycle 2: 新增 §7.6 Queue 处理器详解 — 3 队列架构、IndexingWorker 管线、重试策略、Redis 生命周期
- Cycle 2: 新增 §7.7 Parser 详解 — 策略模式、PDF 三引擎链、StructureExtractor 算法、Zod 校验
- Cycle 2: 新增 §7.8 User 详解 — 密码安全事务、SuperAdminBootstrap 分布式引导锁、事件驱动通知

**已解决**:
- Cycle 2: [RESOLVED] c2-1 Queue 处理器 — 全部 4 个子问题已回答
- Cycle 2: [RESOLVED] c2-2 Session 模块 — 全部 3 个子问题已回答
- Cycle 2: [RESOLVED] c2-3 Parser — 全部 3 个子问题已回答
- Cycle 2: [RESOLVED] c2-4 User+Bootstrap — 全部 3 个子问题已回答

### v4 (2026-07-02) — Round 3 Discovery Consolidation

**修正**:
- Round 3: 修正 #6 — modules/ vs processors/ 并非单向分层，而是双向依赖的 pragmatic 二层架构（纯基础设施 + 编排处理器）

**新增**:
- Round 3: 新增 §7.5 — processors/ 基础设施层详解（DatabaseModule Prisma 扩展 + StorageModule 工厂降级 + 跨层依赖量化分析 32:30）

**已解决**:
- Round 3: [RESOLVED] #6 modules/ vs processors/ 边界 — 全部 3 个子问题已回答

### v6 (2026-07-02) — Cycle 4 Discovery Consolidation

**修正**:
- Cycle 4: 修正 §7.2 RRF 算法 — 补充精确公式 `score = weight / (rrfK + rank + 1)`，默认 rrfK=60，应用层实现而非 ES 原生
- Cycle 4: 修正 §7.2 BGE 重排 — 补充模型白名单（BAAI/Xorbits/sentence-transformers）、batchSize=16、fallback 降级策略（词法匹配 50% + 原始分数 50%）
- Cycle 4: 修正 §7.2 路由服务 — 补充 6 种意图（code_search/fact_qa/time_range/relation_qa/chitchat/general）的完整分类规则和 Pipeline 映射表

**新增**:
- Cycle 4: 新增 §7.2 RAG 检索全链路细节 — QueryUnderstanding 三步管线（语言检测→短查询改写→同义词扩展）、ES knn 查询 ACL 物理隔离、Grounding 混合词汇蕴含判定算法、Guardrail 输出安全护栏（PII 脱敏+敏感关键词+领域免责）、Redis 缓存策略（TTL=60s）
- Cycle 4: 新增 §7.2 ES 索引 mapping 详解 — ik_max_word/ik_smart 分词配置、dense_vector cosine 相似度、allowed_user_ids/allowed_team_ids 权限字段设计
- Cycle 4: 新增 §7.2 检索权限模型 — kbIds 必填 + Prisma 所有权验证 + ES 层 ACL（命中 OR 字段不存在=公开）三层校验

**已解决**:
- Cycle 4: [RESOLVED] #1 ES 检索侧实现 — 全部子问题已回答（RRF 融合、ES 查询 DSL、护栏介入、查询理解、Grounding）
- Cycle 4: [RESOLVED] #7 @xenova/transformers 用途 — 全部子问题已回答（BGE 模型加载方式、@xenova/transformers 本地推理）

### v7 (2026-07-02) — Cycle 4 Round 2 Discovery Consolidation

**修正**:
- Cycle 4 Round 2: 修正 §7.2 RAG 模块描述 — 从"仅检索管线"扩展为完整的"检索→生成→索引"三侧架构

**新增**:
- Cycle 4 Round 2: 新增 §7.2 RAG 生成侧管线 — 上下文构建（去重→排序→token预算3000截取→编号格式化）、同步生成（generateAnswer）+ 流式生成（streamQuery）、后处理（Guardrail→Grounding）、SSE心跳60s机制
- Cycle 4 Round 2: 新增 §7.2 RAG API 端点 — 6个端点定义（retrieve/query/stream/index/removeDocument/health）、权限解析（resolveKbIds自动解析用户知识库）、SSE事件格式（sources/grounding/message/message_end）
- Cycle 4 Round 2: 新增 §7.2 RAG Embedding 服务 — 基于 @llamaindex/openai 的 OpenAIEmbedding 适配器、配置化 provider（apiKey/model/baseURL/dimensions）、config.changed 事件动态刷新
- Cycle 4 Round 2: 新增 §7.2 RAG 索引侧 — Parent-Child 分块架构（parent=800/overlap=100，child=150/overlap=20）、上下文嵌入（contextualWindow=1）、ES 双写（chunk + parent_content）、权限验证（Prisma 所有权 + ES ACL）

**已解决**:
- Cycle 4 Round 2: [RESOLVED] RAG 生成侧实现 — 全部子问题已回答（上下文构建、生成编排、流式SSE、后处理管线、API端点）
- Cycle 4 Round 2: [RESOLVED] RAG 索引侧实现 — 全部子问题已回答（分块策略、Embedding构建、ES写入、权限验证）
- Cycle 4 Round 2: [RESOLVED] RAG Metadata 安全校验 — 黑名单前缀防止 NoSQL 注入、白名单 keys 环境变量扩展、键名格式校验
- Cycle 4 Round 2: [RESOLVED] RAG 事件驱动索引 — DocumentUploadedListener 监听上传事件、队列健康检查后自动入队

### v8 (2026-07-02) — Cycle 5 P1 Trellis Web Frontend 指南填充

**新增**:
- Cycle 5 P1: 新增 Trellis Web Frontend 6个指南文档 — directory-structure.md（FSA目录组织）、component-guidelines.md（shadcn/ui组件模式）、hook-guidelines.md（alova数据获取+自定义Hook）、state-management.md（Zustand分层状态管理）、quality-guidelines.md（Biome代码规范+禁止模式）、type-safety.md（TypeScript类型安全+Zod校验）
- Cycle 5 P1: 新增 Web 前端架构发现 — Feature-Sliced Architecture 模块组织、Zustand 全局/模块状态分层、alova HTTP客户端封装、Portal命令式弹窗系统、TanStack Router 路由配置

**已解决**:
- Cycle 5 P1: [RESOLVED] Trellis Web Frontend 指南 — 6个模板全部填充完成

### v9 (2026-07-02) — Cycle 5 P1 Trellis Admin Frontend 指南填充

**修正**:
- Cycle 5 P1: 修正 §4.4 Admin 模块列表 — 从 7 个扩展为 10 个功能模块（新增 Model Providers、Module Settings、RAG Observability）

**新增**:
- Cycle 5 P1: 新增 §4.4 Admin 技术栈描述 — Ant Design 6.x + Pro Components + Tailwind CSS v4 + Zustand + alova
- Cycle 5 P1: 新增 Trellis Admin Frontend 6个指南文档 — directory-structure.md（FSA目录组织）、component-guidelines.md（Ant Design组件模式）、hook-guidelines.md（alova数据获取+useQueryWithRetry）、state-management.md（Zustand全局状态）、quality-guidelines.md（Biome代码规范）、type-safety.md（TypeScript类型安全）
- Cycle 5 P1: 新增 Admin 前端架构发现 — RBAC权限守卫（auth-guard.ts）、自动Token刷新（alova responded）、ProLayout动态菜单、services.ts业务逻辑封装

**已解决**:
- Cycle 5 P1: [RESOLVED] c5-2 Trellis Admin Frontend 指南 — 6个模板全部填充完成

### v10 (2026-07-02) — Cycle 5 P2 Trellis Data Schema 指南填充

**新增**:
- Cycle 5 P2: 新增 Trellis Data Schema 6个指南文档 — directory-structure.md（纯TypeScript Schema包目录组织）、component-guidelines.md（Zod Schema定义模式和最佳实践）、hook-guidelines.md（工具函数和组合模式）、state-management.md（配置状态/业务流程状态/文档生命周期状态设计模式）、quality-guidelines.md（代码标准和禁止模式）、type-safety.md（Zod验证和TypeScript类型安全）
- Cycle 5 P2: 新增 Data Schema 包架构发现 — 16个Schema文件分类（auth/chat/kb/companion/admin/rag/settings等）、共享契约层设计（server/web/admin三方依赖）、`z.infer<>`类型派生模式、分页响应工厂函数、fallback值安全回退机制

**已解决**:
- Cycle 5 P2: [RESOLVED] c5-3 Trellis Data Schema 指南 — 6个模板全部填充完成

### v11 (2026-07-02) — Cycle 5 P2 Settings OpenSpec 补充

**新增**:
- Cycle 5 P2: 补充 Settings OpenSpec — 从74行扩展到327行，新增 Architecture（配置分层架构/模块职责/配置分类）、API Endpoints（用户配置/系统配置/Provider池端点）、Data Models（完整字段定义）、Error Codes（10个错误码）、Events（配置变更事件）、Security（API Key保护/权限控制/SSRF防护）、Migration（遗留格式自动迁移）章节
- Cycle 5 P2: 新增配置分层架构发现 — DEFAULT_CONFIG → SYSTEM_CONFIG → APP_CONFIG 三层合并策略，Provider池优先级规则，深层合并逻辑
- Cycle 5 P2: 新增模块职责划分 — SettingsService（用户配置/合并/迁移）、SystemConfigService（系统配置/Provider池/事件通知）、ModelProviderService（引用验证/类型校验）、ConfigCryptoService（加密/解密/掩码）

**已解决**:
- Cycle 5 P2: [RESOLVED] c5-4 Settings OpenSpec 补充 — 从偏薄的基础版扩展为完整的配置管理规范

### v14 (2026-07-03) — Cycle 7 Discovery Consolidation（第二遍审查）

**修正**:
- Cycle 7: 修正 Redis 架构认知 — 从"单一 Redis 连接"修正为 **3 个独立连接**：Queue Redis（BullMQ）+ Cache Redis（CacheService）+ Auth Redis（AuthRedisService），各有独立的环境变量配置
- Cycle 7: 修正 Companion LLM 调用层认知 — 从"LangGraph 直接调 LLM"修正为完整的适配层：LangChain ChatOpenAI + StructuredOutputService 三方法降级链 + LlmConfigService 热更新
- Cycle 7: 修正模块注册依赖认知 — JwtStrategy 直接注入 PrismaService + AuthRepository 做用户查询，不通过 UserModule
- Cycle 7: 修正处理器层列表 — 新增 ChatFinalizeProcessor（SSE 流后处理）

**新增**:
- Cycle 7: 新增 §7.4 RBAC 权限系统详解 — 三层 Guard 链（JWT → Roles → Permission）、PermissionService 权限缓存与 SUPER_ADMIN 判定逻辑、Redis 缓存策略
- Cycle 7: 新增 §7.9 Auth 安全架构 — JWT 双密钥架构、Token Rotation 并发安全（原子 SQL `UPDATE...WHERE usedAt IS NULL RETURNING id`）、jti Hash 反推防护、Token 链式审计追踪、Auth Redis Fail-Closed 策略、Cookie 安全策略、CAPTCHA 完整实现（SVG→sharp→PNG + 一次性消费）、11 错误码体系
- Cycle 7: 新增 §7.10 Companion LangChain 层 — LangChain vs LlamaIndex 分工（Companion/Chat/RAG 三方适配层差异）、StructuredOutput 三方法降级链（functionCalling→jsonSchema→jsonMode）、LlmConfigService 热更新配置链、完整 LLM 调用层级（Node→SharedNodeFactory→StructuredOutputService→ChatOpenAI）
- Cycle 7: 新增 §7.11 Common 安全中间件 — 请求生命周期完整链路（7 步中间件链）、AsyncLocalStorage 上下文传播、统一响应格式（success+bigint 序列化）、LoggingInterceptor 生产级日志策略（分层采样+敏感脱敏）、SpiderGuard UA 反爬虫、SSRF Guard 五层防护（HTTPS→localhost→本地IP→内网前缀→白名单）
- Cycle 7: 新增 §7.12 StreamFinalize + ChatFinalize — SSE 流后处理双模式（BullMQ → queueMicrotask 降级）、ChatFinalizeProcessor 两步后处理（持久化+标题生成）、BullMQ 3 队列完整拓扑对比表、三 Redis 独立连接架构

**已解决**:
- Cycle 7: [RESOLVED] c7-1 Auth Token Rotation 与安全机制 — 全部 6 个子问题已回答
- Cycle 7: [RESOLVED] c7-3 Companion LangChain 层 — 全部 4 个子问题已回答
- Cycle 7: [RESOLVED] c7-4 Common 安全与可观测性中间件 — 全部 7 个文件已读
- Cycle 7: [RESOLVED] c7-5 StreamFinalize + BullMQ 完整拓扑 — chat-finalize 队列完整分析

**Deferred（按需执行）**:
- Cycle 7: c7-2 Chat LLM Provider 工厂 — [RESOLVED] 采用预留扩展的工厂模式（当前仅 LlamaIndex/OpenAI 兼容一种实现），包含流式防御性守卫（`isAsyncIterable` 运行时检查）、多模态内容提取前向兼容、条件参数透传等模式
- Cycle 7: c7-6 KnowledgeBase Document 生命周期 — [RESOLVED] 探索发现非平凡架构（多存储分离事务边界、跨KB移动物理重上传、递归CTE防环、文件夹复制回滚、事件驱动异步索引），已纳入 `openspec/specs/knowledge-base/document-lifecycle.md`
- Cycle 7: c7-7 Prisma 迁移历史 — Deferred（5 个命名清晰的迁移，无架构含义）
- Cycle 7: c7-8 项目架构演进文档 — Deferred（1 份 ADR 覆盖初期决策，`docs/superpowers/` 不存在）
- Cycle 7: c5-5 Companion LangGraph 工作流 — 已在 Cycle 6 完成

**统计**:
- Cycle 7 共 2 轮（Round 12-13）、探索 18 个文件、产出 26 项新知识
- 全旅程（Cycle 1-7）：13 轮探索、~120 文件、~175 知识项（含 v15 新增 document-lifecycle）
- 18 模块认知深度矩阵已完成

### v15 (2026-07-03) — Cycle 7 Deferred Items Resolution

**修正**:
- v15: 修正 c7-2 状态 — 从 "单一实现，trivial" 修正为 RESOLVED。LLM Provider 虽只有一个实现，但含预留扩展的工厂模式、`isAsyncIterable` 流式防御守卫、多模态内容提取前向兼容等模式
- v15: 修正 c7-6 状态 — 从 "CRUD 模式" 修正为 RESOLVED。探索发现非平凡的多存储协调事务边界、跨KB移动物理重上传、递归CTE防环、文件夹复制回滚等 6+ 非明显模式

**新增**:
- v15: 新增 `openspec/specs/knowledge-base/document-lifecycle.md` — 文档生命周期完整规范，涵盖上传流程、跨KB移动/复制物理约束、多存储分离事务边界、文件夹树递归CTE操作、文件夹复制回滚、文档状态机

**已解决**:
- Cycle 7: [RESOLVED] c7-2 Chat LLM Provider 工厂 — 预留扩展模式已记录
- Cycle 7: [RESOLVED] c7-6 KnowledgeBase Document 生命周期 — 非平凡架构已纳入独立 OpenSpec

**Deferred（最终确认）**:
- Cycle 7: c7-7 Prisma 迁移历史 — 5 个命名清晰的迁移，无架构含义
- Cycle 7: c7-8 项目架构演进文档 — 1 份 ADR 覆盖初期决策

### v16 (2026-07-03) — Cycle 8 末覆盖模块补全

**修正**:
- v16: 修正 §4.1 Admin 模块描述 — 从"用户管理、审计日志"修正为"管理端 API：用户分页+状态切换+角色权限 CRUD"，Prisma 模型从 AdminAuditLog/SystemFlag 修正为复用 User/UserRole/Permission/RolePermission
- v16: 修正 Admin 模块定位 — 非独立业务模块，而是 Auth RBAC 基础设施的管理端消费者

**新增**:
- v16: 新增 §7.13 Admin 后端 API — 两个 Controller 权限矩阵、AdminService 事件驱动状态切换、RoleService 动态角色发现+deleteMany/create 权限更新
- v16: 新增 §7.14 Storage 存储层 — IStorageProvider → StorageService 门面 → FactoryProvider → MinIOStorageProvider 的 4 层抽象架构及优雅降级设计
- v16: 新增 §7.15 Health 健康检查 — Liveness/Readiness 双端点、三组件并行探针（2500ms 超时）、ok/degraded/down 状态分类
- v16: 新增 §7.16 Database 数据库层 — PrismaService `$extends` 通用分页+存在性扩展、24 模型 getter 代理、NestJS 生命周期钩子

**已解决**:
- Cycle 8: [RESOLVED] c8-1 Admin 后端模块 — 全部 2 个 Controller + 2 个 Service + 1 个 Repository 已读
- Cycle 8: [RESOLVED] c8-2 Storage 存储层 — IStorageProvider 接口 + MinIO + 门面 + Factory 完整链路
- Cycle 8: [RESOLVED] c8-3 Health 检查模块 — liveness/readiness + 并行探针
- Cycle 8: [RESOLVED] c8-4 Database PrismaService — $extends + paginate + exists + 24 模型代理

**统计**:
- Cycle 8 共 1 轮（Round 14）、探索 16 个文件、产出 16 项新知识
- 全旅程（Cycle 1-8）：14 轮探索、~136 文件、~191 知识项
- 22 模块认知深度矩阵已完成（全后端模块已覆盖）

### v17 (2026-07-03) — Cycle 9 Round 15 Web SSE 流式客户端探索

**修正**:
- v17: 修正 Chat 数据获取认知 — Chat 的 SSE 流式通信**不使用 alova**，实际通过 `@ant-design/x-sdk` `XRequest` + `AbstractChatProvider` 实现。alova 仅用于普通 CRUD API（getSessions/getMessages 等 `.send()` 模式）

**新增**:
- v17: 新增 §7.17 Web SSE 流式客户端 — Chat 与 Companion **双轨 SSE 架构**完整对比：Chat 使用 `@ant-design/x-sdk` 高层抽象（XRequest → GoferChatProvider → useXChat → XMarkdown streaming），Companion 使用原生 `fetch + ReadableStream` 底层实现（CompanionSseClient → Zustand store）
- v17: 新增后端 SseResponseHelper 基础设施分析 — 统一 SSE 帧格式 `event:name\ndata:JSON`、客户端断开 AbortController、Fastify CORS 透传机制
- v17: 新增 Chat 状态管理双层架构 — `useChatStore`（本地 UI 状态/缓存）+ `useConversationStore`（全局消息隔离、生命周期跨 tab）
- v17: 新增 Pending Message 模式 — 临时会话 → sessionStorage → queueMicrotask 自动发送链路
- v17: 新增 `useXChat` 6 态消息生命周期 — loading/success/error/local/updating/abort + requestFallback 错误分类（AbortError vs 网络异常）

**已解决**:
- Cycle 9: [RESOLVED] c9-1 Web SSE 流式客户端 — Chat + Companion 完整端到端 SSE 链路，10 文件已读

**统计**:
- Cycle 9 Round 15 共 1 轮、10 文件、12 项新知识
- 全旅程（Cycle 1-9）：15 轮探索、~146 文件、~203 知识项

### v18 (2026-07-03) — Cycle 9 Round 16 Admin RBAC 前端守卫探索

**新增**:
- v18: 新增 §7.18 Admin RBAC 前端守卫 — 三层权限控制架构完整透视：TanStack Router `beforeLoad` 路由守卫 → `useMenuConfig()` 菜单动态过滤 → `PermissionMatrix` 组件级权限分配
- v18: 新增 Token 自动刷新订阅者队列模式分析 — `isRefreshing` 互斥锁 + `refreshSubscribers[]` 队列 + HttpOnly Cookie 认证
- v18: 新增 Auth 状态持久化机制 — Zustand `persist` partialize 仅存 `{user, isAuthenticated}`，Token 完全由 HttpOnly Cookie 管理
- v18: 新增登录/RSA加密/会话恢复/登出完整流程
- v18: 新增 `ROUTES_REGISTER` 路由-权限映射表（14 条路由全量分析）
- v18: 新增前后端 RBAC 联动图 — 前端 `beforeLoad` guard → 后端 `JwtAuthGuard → PermissionGuard` 双层验证

**已解决**:
- Cycle 9: [RESOLVED] c9-2 Admin RBAC 前端守卫 — 三层权限架构 + Token 刷新 + 登录流程，10 文件已读

**统计**:
- Cycle 9 Round 16 共 1 轮、10 文件、12 项新知识
- 全旅程（Cycle 1-9）：16 轮探索、~156 文件、~215 知识项

### v19 (2026-07-03) — Cycle 9 Round 17 Overlay 弹窗系统探索

**新增**:
- v19: 新增 §7.19 Overlay 弹窗系统 — 4 层架构完整透视：类型定义 → Zustand Store → 命令式 Service → React Portal 渲染层
- v19: 新增完整生命周期时序图 — `openDialog → push(entry) + Promise注入 → OverlayHost.createPortal → onClose → remove(id, result) → resolve`
- v19: 新增 OverlayEntry 数据模型分析 + 两种弹窗类型（dialog/context-menu）对比
- v19: 新增弹窗组件 onClose 约定（Alert 风格 'confirm'/'cancel' vs Form 风格 true/false）
- v19: 新增 11 个预置弹窗清单及变体分类

**已解决**:
- Cycle 9: [RESOLVED] c9-3 Overlay 弹窗系统 — 4 层架构 + 命令式 API + 生命周期，8 文件已读

**统计**:
- Cycle 9 Round 17 共 1 轮、8 文件、11 项新知识
- 全旅程（Cycle 1-9）：17 轮探索、~164 文件、~226 知识项

### v21 (2026-07-03) — Cycle 9 Round 19 Web Companion 前端 UI 渲染探索

**新增**:
- v21: 新增 §7.21 Web Companion 前端 UI 渲染 — 10 组件树完整梳理：CompanionListPage → CompanionCard → CompanionChatPage → CompanionMessageItem
- v21: 新增 Companion 打字机动画 vs Chat XMarkdown 流式渲染对比 — setInterval 18ms 逐字 + animate-pulse 光标 vs streaming.hasNextChunk
- v21: 新增 CompanionMessageItem 三态渲染 — 用户纯文本 / AI 流式中 TypingIndicator / AI 完成 XMarkdown 静态
- v21: 新增 CompanionForm 11 字段详情 + CompanionStatusTag 三态映射
- v21: 新增头像渲染模式 — CSS backgroundImage + 首字母 fallback、5 种 MemoryType 中文标签

**已解决**:
- Cycle 9: [RESOLVED] c9-4 Web Companion 前端 UI 渲染 — 打字机动画、消息气泡、列表/卡片、表单、头像、反馈、状态标签全部覆盖，10 文件已读

---

### v20 (2026-07-03) — Cycle 9 Round 18 E2E 测试架构探索

**新增**:
- v20: 新增 §7.20 测试架构 — 4 层测试金字塔完整分析：Unit → Integration → E2E API → E2E Browser
- v20: 新增 E2E Browser 架构分析 — Page Object Model（AuthPage/ChatPage）、Mock 双模式（RSA 密钥对 + 内存 users Map）、独立 `goferbot_e2e` 数据库 + globalSetup/Teardown
- v20: 新增 Integration 测试覆盖矩阵 — 22 specs 全覆盖所有 Controller + RAG + 基础设施
- v20: 新增 E2E Browser 覆盖缺口分析 — 8 cases 中 3 fixme（route-guard / no-llm-provider）
- v20: 新增 4 层测试覆盖率总结 — Integration 最强、E2E 有提升空间

**已解决**:
- Cycle 9: [RESOLVED] c9-5 E2E 测试覆盖 — 4 层架构 + 覆盖矩阵 + CI 配置，8 文件已读

**统计**:
- Cycle 9 Round 18 共 1 轮、8 文件、9 项新知识
- 全旅程（Cycle 1-9）：18 轮探索、~172 文件、~235 知识项


