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
| **Admin**         | `src/modules/admin/`          | 用户管理（列表/启用禁用/角色分配）、审计日志                             | AdminAuditLog, SystemFlag, Permission, RolePermission                                                                                |
| **Health**        | `src/modules/health/`         | 健康检查端点                                                             | -                                                                                                                                    |

### 4.2 处理器层 (`packages/server/src/processors/`)

| 处理器      | 路径                  | 核心职责                                                                                                                  |
|-------------|-----------------------|---------------------------------------------------------------------------------------------------------------------------|
| **RAG**     | `processors/rag/`     | Elasticsearch 驱动：查询理解 → ES 向量检索 + ES 关键词检索 → RRF 混合排序 → BGE 本地重排(@xenova/transformers) → 安全过滤 |
| **Queue**   | `processors/queue/`   | BullMQ 队列管理、IndexingWorker（文档解析→分块→Embedding→写入pgvector）                                                   |
| **Storage** | `processors/storage/` | MinIO S3 对象存储抽象                                                                                                     |
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

- 三层角色：USER / ADMIN / SUPER\_ADMIN
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


