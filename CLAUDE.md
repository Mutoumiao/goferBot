# GoferBot

GoferBot — 云端优先的 AI Workspace / Agent OS。基于 React + NestJS 的 Web 应用，支持文档管理、LLM 问答、RAG 检索增强、AI 伴侣聊天。

## 技术栈详情

> **REFERENCE\_ONLY**: 各 package 的权威技术栈和编码约定请参见对应 `.trellis/spec/` 目录。

| Layer          | Technology                               | Version                           |
|----------------|------------------------------------------|-----------------------------------|
| **前端框架**   | React + TanStack Start                   | React 19.x, TanStack Start latest |
| **前端路由**   | TanStack Router                          | 1.132.x                           |
| **UI 构建**    | Vite + Tailwind CSS                      | Vite 6.x, Tailwind 4.x            |
| **状态管理**   | Zustand                                  | 5.x                               |
| **请求库**     | alova (CRUD) + @ant-design/x-sdk (SSE)   | alova latest, XRequest SSE        |
| **UI 组件**    | shadcn/ui + @ant-design/x (Chat)         | -                                 |
| **AI Chat UI** | @ant-design/x / @ant-design/x-markdown   | Bubble / Sender / XMarkdown       |
| **后端框架**   | NestJS + Fastify                         | NestJS 10.x, Fastify 4.x          |
| **数据库**     | PostgreSQL + pgvector                    | PG 16                             |
| **ORM**        | Prisma                                   | 5.x                               |
| **向量存储**   | pgvector                                 | -                                 |
| **缓存/队列**  | Redis + BullMQ                           | Redis 7, BullMQ 5.x               |
| **对象存储**   | MinIO (S3兼容)                           | -                                 |
| **AI SDK**     | LangChain + @ant-design/x                | LangChain 1.x                     |
| **AI 工作流**  | LangGraph StateGraph                     | -                                 |
| **Reranker**   | @xenova/transformers (BGE Cross-Encoder) | -                                 |
| **数据校验**   | Zod                                      | 3.x                               |
| **测试**       | Vitest + Playwright                      | Vitest 4.x, Playwright latest     |
| **包管理**     | pnpm                                     | -                                 |
| **格式/Lint**  | Biome                                    | 2.4                               |

## Agent 核心约束

1. **先思后码**：不确定就问，规则冲突时优先"简单至上"
2. **外科手术式修改**：只改必要处，顺手优化标 `#adjacent-fix`
3. **Token 预算**：单任务≤8k，超 80% 暂停压缩，超 95% 终止
4. **落笔先阅读**：通读导出接口、调用方、公共工具；代码探索优先用 codegraph
5. **检查点**：每关键步骤输出 `[CHECKPOINT] ✅|🔍|⏳|🚨`
6. **显式失败**：置信度<90% 输出 `[UNCERTAIN]` 并征求指令

## 项目结构

```
├── packages/
│   ├── web/           # React 前端（主前端）
│   │   ├── features/chat/         # Chat 聊天模块（@ant-design/x-sdk SSE）
│   │   ├── features/companion/    # AI Companion 模块（原生 fetch SSE + 打字机动画）
│   │   ├── features/KnowledgeBase/# 知识库管理
│   │   ├── overlays/              # Portal 弹窗系统（4层架构：类型 → Store → Service → Portal）
│   │   ├── stores/                # 全局 State（auth/settings/workspace/conversation）
│   │   └── api/                   # API 客户端（alova + XRequest SSE）
│   ├── admin/         # React 管理后台（独立前端应用）
│   │   ├── features/auth/         # 登录/RSA加密/会话恢复
│   │   ├── features/users/        # 用户管理
│   │   ├── features/roles/        # 角色权限管理（PermissionMatrix）
│   │   ├── features/audit/        # 审计日志
│   │   ├── features/dashboard/    # 仪表盘统计
│   │   └── utils/server.ts        # alova 实例 + Token 自动刷新订阅者队列
│   ├── server/        # NestJS API 服务端
│   │   ├── modules/chat/          # Chat SSE + StreamFinalize
│   │   ├── modules/companion/     # Companion LangGraph Pipeline (11节点)
│   │   ├── modules/knowledge-base/# 知识库 CRUD
│   │   ├── modules/auth/          # 认证 + Token Rotation
│   │   ├── modules/admin/         # 管理后台 API
│   │   ├── modules/storage/       # S3 存储（4层架构：Controller→Service→Adapter→MinIO）
│   │   ├── modules/settings/      # 用户设置
│   │   ├── modules/health/        # 健康检查（/health + /health/live）
│   │   ├── common/                # 安全中间件、SseResponseHelper、全局异常过滤器
│   │   └── processors/rag/        # RAG 管线（QueryUnderstanding→HybridRetrieval→RRF→Reranker→ParentResolution）
│   └── data/          # 共享数据契约（Zod schemas、chatMessagesChunkSchema）
├── e2e/               # 浏览器 E2E 测试（Playwright POM + Mock 双模式 + goferbot_e2e DB）
├── tests/             # 测试（unit/integration/e2e-api）
├── docs/              # 文档（guide/prd/adrs/design/discovery-report.md）
├── BACKLOG.md         # 待办（open / in-progress）
└── CHANGELOG.md       # 完成日志（closed）
```

## 架构亮点

| 系统                 | 架构要点                                                                                                              |
|----------------------|-----------------------------------------------------------------------------------------------------------------------|
| **SSE 流式**         | 双轨并行 — Chat 用 `@ant-design/x-sdk` (XMarkdown streaming)，Companion 用原生 `fetch + ReadableStream` (打字机动画)  |
| **RBAC 守卫**        | Admin 三层权限 — `beforeLoad` 路由守卫 → `useMenuConfig` 菜单过滤 → `PermissionMatrix` 组件级，19 权限码 + 3 预置角色 |
| **Overlay Portal**   | 4 层命令式架构 — `openDialog(Comp, props)` → Promise<T>，createPortal 到 body，11 个预置弹窗                          |
| **Token 刷新**       | 订阅者队列模式 — `isRefreshing` 互斥锁，并发 401 聚合为单次 refresh                                                   |
| **RAG 管线**         | 5 阶段 — QueryUnderstanding → Hybrid(BM25+Vector) → RRF → BGE Reranker → ParentResolution                             |
| **Companion 工作流** | LangGraph StateGraph — 11 节点 + 3 条件路由 + 18 状态字段                                                             |
| **测试架构**         | 4 层金字塔 — Unit(vitest) → Integration(vitest+NestJS) → E2E API(vitest+axios) → E2E Browser(Playwright)              |

## 常用命令

```bash
pnpm dev              # 同时启动前后端
pnpm dev:web          # 只启动前端
pnpm dev:server       # 只启动后端（watch）
pnpm type-check       # TypeScript 类型检查
pnpm test             # 单元测试（vitest）
pnpm test:integration # 模块级集成测试（22 specs）
pnpm test:e2e:api     # HTTP API E2E
pnpm test:e2e         # 浏览器 E2E（Playwright，Chromium serial）
pnpm test:all         # 全量回归
pnpm format           # biome 格式化（写入）
pnpm format:check     # biome 格式化检查（不写入，CI 用）
pnpm format:unsafe    # biome 格式化（含 unsafe 修复）
pnpm lint             # biome 仅 lint
pnpm check            # biome 检查（format + lint + assist）
pnpm check:fix        # biome 检查并应用安全修复
pnpm check:unsafe     # biome 检查并应用全部修复
pnpm check:staged     # biome 仅处理 git 暂存文件
pnpm check:changed    # biome 仅处理 VCS 变更文件
pnpm check:ci         # biome CI 模式（不写入，错误即非零退出）
```

## 权威知识索引

### 项目全局

| 文档                                         | 内容                                           |
|----------------------------------------------|------------------------------------------------|
| [Discovery Report](docs/discovery-report.md) | 项目全局认知基线（21 章节，全模块覆盖）        |
| `.trellis/workflow.md`                       | 开发阶段流程、任务创建时机、Skill 路由         |
| `.trellis/workspace/`                        | 开发者日志和会话追踪                           |
| `.trellis/tasks/`                            | 活跃/已归档任务（PRD、research、jsonl 上下文） |

### 编码规范（HOW）

编码时请优先查阅对应 package 的 Trellis 规范：

| Package            | Trellis 编码规范                                                       | 新增专题指南                                                                                                                                                                                                        |
|--------------------|------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `packages/web/`    | [.trellis/spec/web/frontend/](.trellis/spec/web/frontend/index.md)     | [SSE 流式架构](.trellis/spec/web/frontend/sse-streaming-architecture.md)、[Overlay 弹窗](.trellis/spec/web/frontend/overlay-portal-system.md)、[Companion UI](.trellis/spec/web/frontend/companion-ui-rendering.md) |
| `packages/admin/`  | [.trellis/spec/admin/frontend/](.trellis/spec/admin/frontend/index.md) | [RBAC 守卫架构](.trellis/spec/admin/frontend/rbac-guard-architecture.md)                                                                                                                                            |
| `packages/server/` | [.trellis/spec/server/backend/](.trellis/spec/server/backend/index.md) | [RAG 实现](.trellis/spec/server/backend/rag-implementation.md)、[Companion Pipeline](.trellis/spec/server/backend/companion-pipeline.md)、[Queue 实现](.trellis/spec/server/backend/queue-implementation.md)        |
| `packages/data/`   | [.trellis/spec/data/frontend/](.trellis/spec/data/frontend/index.md)   | -                                                                                                                                                                                                                   |

### 功能规范（WHAT）

| Package            | OpenSpec 功能规范                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `packages/server/` | [auth](openspec/specs/auth/spec.md)、[chat](openspec/specs/chat/spec.md)、[companion](openspec/specs/companion/spec.md)、[rag](openspec/specs/rag/spec.md)、[queue](openspec/specs/queue/spec.md)、[admin](openspec/specs/admin/spec.md)、[knowledge-base](openspec/specs/knowledge-base/spec.md)、[document](openspec/specs/document/spec.md)、[session](openspec/specs/session/spec.md)、[settings](openspec/specs/settings/spec.md)、[user](openspec/specs/user/spec.md) |
| `packages/admin/`  | [admin](openspec/specs/admin/spec.md)                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### 环境变量

- 根目录 `.env.example`：项目唯一的完整环境变量模板
- 加载顺序（服务端）：`packages/server/.env` → 根目录 `.env`，后加载的覆盖先加载的同名变量
- 配置管理指南：`docs/guide/backend/configuration-guide.md`

## 数据库模型（核心）

```
User ──→ Session (Chat)
  │
  ├──→ KnowledgeBase ──→ Folder ──→ Document ──→ Chunk
  │                                                 ↓
  ├──→ Setting                                    (pgvector)
  │
  ├──→ Companion ──→ Conversation ──→ Message
  │                     ↓
  │                   Memory (preference/boundary/relationship_goal/conversation_style/important_fact)
  │
  └──→ Role ──→ Permission
         ↓
       AuditLog
```

- **User**: 用户账户（email, password, role, mustChangePassword）
- **Role**: 角色（name, permissions 数组），预置 SUPER\_ADMIN(18) / ADMIN(14) / USER(2)
- **Permission**: 权限码（19 个，如 `users:read`, `roles:create` 等）
- **AuditLog**: 管理操作审计日志（操作类型、目标资源、时间戳）
- **KnowledgeBase**: 知识库（属于用户）
- **Folder**: 文件夹（树形结构，支持嵌套）
- **Document**: 文档（存储在 MinIO，metadata 在 DB）
- **Chunk**: 文档切片（用于 RAG 检索，向量存储在 pgvector）
- **Session**: 聊天会话（关联知识库）
- **Companion**: AI 伴侣（personality, tone, boundaries, guardrailsPrompt, defaultPrompt, backgroundStory, openingMessage, avatarKey, status: draft/published/archived）
- **Conversation**: 伴侣会话（关联 Companion + User）
- **Message**: 消息（role: user/assistant, content, feedback）
- **Memory**: 伴侣记忆（5 种类型：preference/boundary/relationship\_goal/conversation\_style/important\_fact）
- **Setting**: 用户设置

