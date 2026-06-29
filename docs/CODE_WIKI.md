# GoferBot Code Wiki

> 云端优先的 AI Workspace / Agent OS 完整代码参考文档

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈全景](#2-技术栈全景)
3. [系统架构](#3-系统架构)
4. [Monorepo 包结构](#4-monorepo-包结构)
5. [后端架构详解](#5-后端架构详解)
6. [前端架构详解](#6-前端架构详解)
7. [数据模型](#7-数据模型)
8. [核心业务流程](#8-核心业务流程)
9. [开发规范与约定](#9-开发规范与约定)
10. [测试体系](#10-测试体系)
11. [部署与运行](#11-部署与运行)
12. [关键配置文件](#12-关键配置文件)

---

## 1. 项目概述

### 1.1 项目定位

**GoferBot** 是一款云端优先的 **AI Workspace / Agent OS** Web 应用。核心能力包括：

- **智能问答**：基于多 LLM 提供商的流式对话，支持 Markdown 渲染、代码高亮
- **RAG 检索增强**：向量搜索 + 全文搜索混合排序，支持 `@知识库` 提及触发
- **知识库管理**：虚拟文件夹树、文件导入、后台索引队列
- **AI 伴侣**：基于 LangGraph 的多轮对话、记忆系统、情感关怀
- **多租户**：用户隔离、权限控制、管理后台

### 1.2 设计理念

- **Harness Engineering**：需求澄清 → 规划拆分 → 依赖检查 → 并行实现 → 代码审查 → 验收验证
- **架构决策记录 (ADR)**：所有重大决策通过 ADR 形式记录
- **Issue-Centric 开发**：一个 issue 一个目录，含 spec / plan / checklist

### 1.3 项目亮点

| 亮点 | 说明 |
|------|------|
| 混合搜索策略 | pgvector HNSW 向量索引 + 全文索引，RRF 融合排序 |
| 细粒度检索控制 | 每条消息独立选择检索范围，支持 `@知识库名称` 提及 |
| 后台索引队列 | BullMQ 异步处理，前端实时显示索引进度 |
| 多 LLM 提供商 | OpenAI / Claude / DeepSeek / Ollama，每会话独立切换 |
| AI 伴侣系统 | LangGraph 工作流、记忆提取、情感分析、关怀计划 |

---

## 2. 技术栈全景

### 2.1 总览

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **前端框架** | React + TypeScript | 19.x / 6.x | 函数式组件 + Hooks |
| **前端路由** | TanStack Router / Start | latest | 文件系统路由、SSR-ready |
| **状态管理** | Zustand | 5.x | 轻量级状态管理 |
| **UI 组件** | shadcn/ui + Radix UI | - | 无障碍、可组合基础组件 |
| **样式方案** | Tailwind CSS v4 | 4.x | 原子化样式 |
| **图标库** | lucide-react | - | 统一图标体系 |
| **HTTP 客户端** | alova | 3.x | 请求策略、缓存 |
| **后端框架** | NestJS + Fastify | 10.x / 4.x | 模块化、依赖注入 |
| **ORM** | Prisma | 5.x | 类型安全数据库访问 |
| **数据库** | PostgreSQL + pgvector | 16 | 元数据 + 向量统一存储 |
| **对象存储** | MinIO | - | 文件内容存储 |
| **缓存/队列** | Redis + BullMQ | 7.x / 5.x | 缓存、异步任务 |
| **认证** | JWT + bcrypt + Passport | - | 双令牌机制 |
| **验证** | Zod + nestjs-zod | 4.x / 5.x | Schema 验证 |
| **AI 框架** | LlamaIndex + LangChain + LangGraph | - | RAG + Agent 工作流 |
| **测试框架** | Vitest + Playwright | 4.x / 1.x | 单元/集成/E2E 测试 |
| **代码规范** | Biome | 2.5.x | Lint + Format 一体化 |
| **包管理** | pnpm workspace | - | Monorepo 管理 |

### 2.2 依赖关系图

```
packages/web (React 前端)
    └── packages/data (共享类型 + Zod Schema)

packages/admin (管理后台)
    └── packages/data

packages/server (NestJS 后端)
    ├── packages/data
    ├── PostgreSQL (Prisma + pgvector)
    ├── MinIO (对象存储)
    └── Redis (BullMQ 队列 + 缓存)
```

---

## 3. 系统架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         客户端层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web 前端    │  │  Admin 后台  │  │  第三方集成   │      │
│  │  (React 19)  │  │  (React 19)  │  │  (API Token) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼──────────────────┼──────────────┘
          │                 │                  │
          └─────────────────┼──────────────────┘
                            │ HTTP / SSE
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       API 网关层 (NestJS)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  全局中间件/拦截器/守卫/过滤器                          │   │
│  │  Helmet → CORS → RequestId → RequestContext          │   │
│  │  ThrottlerGuard → SpiderGuard → JwtAuthGuard         │   │
│  │  ZodValidationPipe → ResponseInterceptor              │   │
│  │  AllExceptionsFilter                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       业务模块层                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │   Auth   │ │  User    │ │  Chat    │ │ Session  │       │
│  │  认证模块 │ │ 用户模块 │ │ 聊天模块 │ │ 会话模块 │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Knowledge │ │  Folder  │ │ Document │ │ Settings │       │
│  │ 知识库   │ │ 文件夹   │ │  文档    │ │  设置    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │Companion │ │  Admin   │ │  Health  │                    │
│  │ AI 伴侣  │ │  管理    │ │ 健康检查 │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       处理器层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ RAG 处理器    │  │ Queue 处理器  │  │ Parser 解析器 │      │
│  │ 检索增强生成   │  │  BullMQ 队列  │  │ 文档解析分块   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼──────────────────┼──────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                       基础设施层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    MinIO     │  │    Redis     │      │
│  │  + pgvector   │  │  对象存储    │  │  缓存/队列    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 请求生命周期

```
客户端请求
    │
    ▼
Fastify HTTP Server
    │
    ▼
Helmet 安全头 → CORS 跨域 → RequestId 中间件 → RequestContext 中间件
    │
    ▼
全局守卫
  ├─ ThrottlerGuard (速率限制)
  ├─ SpiderGuard (爬虫防护)
  └─ JwtAuthGuard (JWT 认证，可选)
    │
    ▼
ZodValidationPipe (请求体验证)
    │
    ▼
Controller → Service → Repository → Prisma → PostgreSQL
    │
    ▼
ResponseInterceptor (统一响应包装 { data: T })
    │
    ▼
AllExceptionsFilter (异常统一处理)
    │
    ▼
HTTP 响应
```

---

## 4. Monorepo 包结构

### 4.1 目录总览

```
knowledge-base/
├── packages/
│   ├── data/           # 共享数据契约 (Zod schemas + TypeScript types)
│   ├── server/         # NestJS API 后端
│   ├── web/            # React 前端 (用户端)
│   └── admin/          # React 管理后台
├── e2e/                # Playwright E2E 测试
├── tests/              # 集成测试 + API E2E 测试
├── docs/               # 项目文档
├── scripts/            # 工具脚本
└── docker-compose.dev.yml  # 开发环境容器编排
```

### 4.2 各包职责

#### packages/data — 共享数据契约

**作用**：前后端共享的类型定义和 Zod Schema，确保 API 契约一致性。

**结构**：
```
src/
├── schemas/          # Zod 验证 Schema
│   ├── auth.schema.ts
│   ├── chat.schema.ts
│   ├── kb.schema.ts
│   ├── document.schema.ts
│   ├── companion.schema.ts
│   └── ...
└── types/            # TypeScript 类型定义
    ├── chat.ts
    └── index.ts
```

**导出**：
- `@goferbot/data` — 类型 + Schema 统一导出
- `@goferbot/data/schemas` — 仅 Schema

#### packages/server — NestJS 后端

**作用**：API 服务端，业务逻辑编排，数据持久化。

详见 [第 5 章：后端架构详解](#5-后端架构详解)

#### packages/web — React 前端（用户端）

**作用**：用户交互界面，知识库管理、AI 对话、AI 伴侣等功能。

详见 [第 6 章：前端架构详解](#6-前端架构详解)

#### packages/admin — React 管理后台

**作用**：管理员操作界面，用户管理、审计日志、系统配置等。

**技术栈**：
- React 19 + Ant Design 5.x + Pro Components
- TanStack Router + Zustand
- alova HTTP 客户端

**主要功能**：
- 用户管理（列表、启用/禁用、角色分配）
- 审计日志查看
- 系统配置管理
- RAG 可观测性
- 会话管理

---

## 5. 后端架构详解

### 5.1 模块组织

```
src/
├── main.ts                    # 应用入口
├── app.module.ts              # 根模块
├── bootstrap.ts               # 启动配置
├── env.ts                     # 环境变量验证 (Zod)
│
├── auth/                      # 认证模块
├── modules/                   # 业务模块
│   ├── admin/                 # 管理后台
│   ├── chat/                  # 聊天
│   ├── companion/             # AI 伴侣
│   ├── health/                # 健康检查
│   ├── knowledge-base/        # 知识库
│   ├── session/               # 会话
│   ├── settings/              # 设置
│   └── user/                  # 用户
│
├── processors/                # 处理器
│   ├── database/              # 数据库 (PrismaService)
│   ├── parser/                # 文档解析
│   ├── queue/                 # 任务队列
│   ├── rag/                   # RAG 检索增强
│   └── storage/               # 存储抽象
│
├── common/                    # 通用设施
│   ├── decorators/            # 装饰器
│   ├── filters/               # 异常过滤器
│   ├── guards/                # 守卫
│   ├── helpers/               # 辅助函数
│   ├── interceptors/          # 拦截器
│   ├── middleware/            # 中间件
│   ├── pipes/                 # 管道
│   └── utils/                 # 工具函数
│
├── shared/                    # 共享类型
│   ├── dto/
│   ├── interfaces/
│   └── repositories/          # 基础 Repository
│
├── lib/                       # 基础库
│   └── app-error.ts           # 应用异常类
│
├── interfaces/                # 接口定义
│   ├── IStorageProvider.ts
│   └── errors.ts
│
├── middleware/                # 中间件
│   └── request-id.middleware.ts
│
├── queue/                     # 队列配置
│   ├── index.ts
│   ├── queues.ts
│   ├── redis.ts
│   └── workers.ts
│
├── storage/                   # MinIO 实现
│   └── minio.ts
│
└── tools/                     # 工具脚本
    └── export-openapi.ts
```

### 5.2 核心模块说明

#### 5.2.1 Auth 模块 — 认证与授权

**文件**：`packages/server/src/auth/`

**核心类**：
- `AuthService` — 认证业务逻辑（注册、登录、刷新、登出、修改密码）
- `AuthController` — 认证 API 端点
- `AuthRedisService` — Redis 中的令牌管理
- `AuthRepository` — 认证相关数据库操作
- `JwtStrategy` — JWT 策略（Passport）
- `JwtAuthGuard` — JWT 认证守卫
- `RolesGuard` — 角色权限守卫

**关键特性**：
- Access Token + Refresh Token 双令牌机制
- 会话管理（多设备登录、会话撤销）
- 密码加密（bcrypt，可配置轮数）
- 支持 web 和 admin 两种应用类型
- 令牌旋转（Token Rotation）+ 重放检测

**关键 DTO**：
- `login.dto.ts` — 登录请求
- `register.dto.ts` — 注册请求
- `update-profile.dto.ts` — 更新资料
- `password.schema.ts` — 密码强度验证 Schema

#### 5.2.2 Chat 模块 — AI 对话

**文件**：`packages/server/src/modules/chat/`

**核心类**：
- `ChatService` — 聊天业务逻辑（流式对话）
- `ChatController` — 聊天 API 端点（SSE 流式输出）
- `ConversationService` — 会话消息管理
- `LlmProviderFactory` — LLM 提供商工厂
- `ModelRegistryService` — 模型注册表
- `LlamaIndexProviderService` — LlamaIndex LLM 实现

**关键特性**：
- 流式 SSE 输出
- 多 LLM 提供商切换（每会话独立）
- 对话历史加载与保存
- 可插拔的上下文检索接口（`ChatContextRetriever`）

**接口**：
```typescript
interface LlmProvider {
  chat(messages: LlmMessage[], options: LlmChatOptions): AsyncGenerator<string>
  supportsModel(model: string): boolean
}

interface ChatContextRetriever {
  retrieve(query: string, options: RetrieverOptions): Promise<RetrievedContext[]>
}
```

#### 5.2.3 KnowledgeBase 模块 — 知识库管理

**文件**：`packages/server/src/modules/knowledge-base/`

**核心类**：
- `KnowledgeBaseService` — 知识库 CRUD
- `KnowledgeBaseController` — 知识库 API
- `FolderService` — 文件夹管理
- `FolderController` — 文件夹 API
- `DocumentService` — 文档管理
- `DocumentController` — 文档 API
- `KbCleanupService` — 知识库清理服务

**Repository 层**：
- `KbRepository` — 知识库数据访问
- `FolderRepository` — 文件夹数据访问
- `DocumentRepository` — 文档数据访问

**关键特性**：
- 知识库 CRUD、置顶、排序
- 虚拟文件夹树（自关联 parentId）
- 文件上传（MinIO 存储）
- 文档状态追踪（uploaded → chunking → embedding → indexing → ready）
- 跨知识库文件移动/复制
- 命名冲突自动处理

#### 5.2.4 Companion 模块 — AI 伴侣

**文件**：`packages/server/src/modules/companion/`

**核心类**：
- `CompanionChatService` — 伴侣对话业务
- `CompanionChatController` — 伴侣对话 API
- `CompanionController` — 伴侣 CRUD API

**LangGraph 工作流**：
```
用户消息 → 意图识别 → 路由决策
                      ├─ 普通对话 → 生成回复 → 质量检查 → 输出
                      ├─ 情感分析 → 情感回应 → 输出
                      ├─ 记忆提取 → 更新记忆 → 输出
                      └─ 安全检测 → 安全回应 → 输出
```

**节点**（`langgraph/nodes/`）：
- `intent-node.ts` — 意图识别
- `emotion-node.ts` — 情感分析
- `generate-node.ts` — 回复生成
- `memory-extraction-node.ts` — 记忆提取
- `memory-candidate-node.ts` — 记忆候选
- `policy-node.ts` — 策略检查
- `quality-guard-node.ts` — 质量守卫
- `safety-node.ts` — 安全检测
- `summary-node.ts` — 对话摘要
- `route-node.ts` — 路由决策
- `relationship-stage-node.ts` — 关系阶段

**记忆系统**：
- `CompanionMemory` — 长期记忆（偏好、边界、重要事实等）
- 记忆类型：preference / boundary / relationship_goal / conversation_style / important_fact
- 按重要性排序注入上下文

**关怀计划**：
- `CompanionCarePlan` — 定时主动关怀
- 频率：daily / weekly / monthly / custom
- 场景化消息生成

#### 5.2.5 Settings 模块 — 系统设置

**文件**：`packages/server/src/modules/settings/`

**核心类**：
- `SettingsService` — 用户设置管理
- `SettingsController` — 设置 API
- `ModelProviderService` — 模型提供商配置
- `SystemConfigService` — 系统配置
- `ConfigCryptoService` — 配置加密（敏感字段）

**设置分类**：
- `chat` — 聊天设置（温度、最大 token 等）
- `rag` — RAG 配置（检索数量、阈值等）
- `indexing` — 索引配置（分块大小、重叠等）
- `companion` — 伴侣设置
- `appearance` — 外观设置
- `modelProviders` — 多 LLM 提供商配置

#### 5.2.6 User 模块 — 用户管理

**文件**：`packages/server/src/modules/user/`

**核心类**：
- `UserService` — 用户业务逻辑（创建、验证密码、更新资料）

#### 5.2.7 Admin 模块 — 管理后台

**文件**：`packages/server/src/modules/admin/`

**核心类**：
- `AdminService` — 管理员业务逻辑
- `AdminController` — 管理 API

**功能**：
- 用户列表（分页、筛选）
- 用户状态管理（启用/禁用）
- 角色分配

### 5.3 处理器层

#### 5.3.1 RAG 处理器

**文件**：`packages/server/src/processors/rag/`

**核心服务**：
- `LlamaIndexRagService` — RAG 主服务（LlamaIndex）
- `RouterService` — 查询路由
- `QueryUnderstandingService` — 查询理解
- `BgeRerankService` — BGE 重排序
- `EsVectorService` — Elasticsearch 向量搜索
- `EsKeywordService` — Elasticsearch 关键词搜索
- `GroundingService` — 引用源验证
- `GuardrailService` — 内容安全护栏
- `LlamaIndexEmbeddingService` — Embedding 生成

**检索流程**：
```
用户查询
  → 查询理解 (QueryUnderstandingService)
  → 向量检索 (EsVectorService)
  → 关键词检索 (EsKeywordService)
  → 混合排序 (RRF 融合)
  → 重排序 (BgeRerankService)
  → 安全过滤 (GuardrailService)
  → 返回相关片段
```

#### 5.3.2 Queue 处理器

**文件**：`packages/server/src/processors/queue/`

**核心服务**：
- `QueueService` — 队列操作服务
- `WorkerService` — Worker 管理
- `IndexingWorker` — 文档索引 Worker

**队列类型**：
- 文件解析队列
- 向量索引队列
- 文档清理队列

**流程**：
```
文件上传 → 添加索引队列 → Worker 消费
  → 文档解析 (DocumentParser)
  → 文本分块
  → Embedding 生成
  → 写入 pgvector
  → 更新文档状态为 ready
```

#### 5.3.3 Parser 解析器

**文件**：`packages/server/src/processors/parser/`

**解析器**：
- `DocumentParser` — 文档解析调度器
- `TextParser` — 纯文本解析
- `PdfParser` — PDF 解析
- `StructureExtractor` — 结构提取

#### 5.3.4 Storage 存储处理器

**文件**：`packages/server/src/processors/storage/`

**核心类**：
- `StorageService` — 存储服务
- `StorageProvider` — 提供者抽象
- `IStorageProvider` — 存储接口

**实现**：MinIO (S3 兼容)

### 5.4 通用设施

#### 5.4.1 全局拦截器

- `ResponseInterceptor` — 统一响应格式 `{ data: T }`
- `LoggingInterceptor` — 请求日志（开发环境）

#### 5.4.2 全局守卫

- `ThrottlerGuard` — 速率限制（生产环境 60 次/分钟）
- `SpiderGuard` — 爬虫防护
- `JwtAuthGuard` — JWT 认证
- `RolesGuard` — 角色授权

#### 5.4.3 全局管道

- `ZodValidationPipe` — Zod Schema 验证（替代 class-validator）

#### 5.4.4 全局过滤器

- `AllExceptionsFilter` — 统一异常处理，格式化错误响应

#### 5.4.5 中间件

- `RequestIdMiddleware` — 请求 ID 追踪
- `RequestContextMiddleware` — AsyncLocalStorage 请求上下文

### 5.5 Repository 模式

**基础类**：`src/shared/repositories/base.repository.ts`

**各模块 Repository**：
- `AuthRepository` — 认证数据访问
- `KbRepository` — 知识库数据访问
- `FolderRepository` — 文件夹数据访问
- `DocumentRepository` — 文档数据访问
- `SessionRepository` — 会话数据访问
- `MessageRepository` — 消息数据访问
- `CompanionRepository` — 伴侣数据访问
- `CompanionConversationRepository` — 伴侣会话
- `CompanionMessageRepository` — 伴侣消息
- `CompanionMemoryRepository` — 伴侣记忆
- `CompanionFeedbackRepository` — 伴侣反馈

---

## 6. 前端架构详解

### 6.1 架构原则

**Feature-First（按业务领域组织）**：
- 按业务领域拆分，不是按页面布局拆分
- 新增功能时，优先判断属于哪个 Feature
- 全局能力（auth / theme / settings / tabs）例外

### 6.2 目录结构

```
src/
├── router.tsx                 # 路由实例
├── router-register.ts         # 路由注册
├── routeTree.gen.ts           # 自动生成的路由树
├── globals.css                # 全局样式
│
├── routes/                    # 路由 (页面层，TanStack Router)
│   ├── __root.tsx             # 根路由
│   ├── _authenticated.tsx     # 认证布局
│   ├── index.tsx              # 首页
│   ├── login.tsx              # 登录页
│   └── _authenticated/
│       ├── chat/
│       │   └── $tabId.tsx     # 聊天页
│       ├── knowledgeBase.tsx  # 知识库页
│       ├── history.tsx        # 历史会话页
│       ├── companions.tsx     # 伴侣列表
│       ├── companions/
│       │   ├── $companionId.chat.tsx
│       │   └── $companionId.memories.tsx
│       ├── profile.tsx        # 个人资料
│       ├── settings.tsx       # 设置页
│       └── recycle.tsx        # 回收站
│
├── features/                  # 业务特性模块
│   ├── auth/                  # 认证
│   ├── chat/                  # 聊天
│   ├── KnowledgeBase/         # 知识库
│   ├── companion/             # AI 伴侣
│   └── settings/              # 设置
│
├── stores/                    # 全局状态 (Zustand)
│   ├── auth.ts                # 认证状态
│   ├── settings.ts            # 设置状态
│   ├── tabManager.ts          # 标签页管理
│   ├── workspace.store.ts     # 工作区状态
│   └── conversation.store.ts  # 对话状态
│
├── api/                       # HTTP API 层 (alova)
│   ├── auth.ts
│   ├── chat.ts
│   ├── KnowledgeBase.ts
│   ├── file.ts
│   ├── settings.ts
│   └── x-chat.ts
│
├── components/                # 跨 feature 复用组件
│   ├── sidebar/               # 侧边栏
│   ├── tab-bar/               # 标签栏
│   └── ui/                    # shadcn/ui 基础组件
│
├── overlays/                  # 弹窗系统
│   ├── host/                  # 弹窗宿主
│   ├── services/              # 弹窗服务
│   ├── hooks/                 # useOverlay hook
│   ├── types/                 # 类型定义
│   └── dialogs/               # 具体弹窗组件
│
├── utils/                     # 工具函数
│   ├── auth-token.ts          # Token 管理
│   ├── server.ts              # alova 实例
│   ├── sse-parser.ts          # SSE 解析
│   ├── cn.ts                  # classnames 工具
│   ├── file.ts                # 文件工具
│   ├── llm-config.ts          # LLM 配置工具
│   └── password-encryption.ts # 密码加密
│
└── lib/
    └── utils.ts               # 通用工具
```

### 6.3 Feature 模块结构

每个 Feature 内部遵循统一结构：

```
features/{featureName}/
├── store.ts              # 该领域状态
├── services.ts           # 业务动作编排
├── types.ts              # 该领域类型
├── hooks.ts              # 该领域自定义 hooks (可选)
├── constants.ts          # 常量 (可选)
└── components/           # 该领域组件
    ├── ComponentA.tsx
    └── ComponentB.tsx
```

**职责边界**：

| 层级 | 职责 | 禁止 |
|------|------|------|
| **API** | HTTP 请求 | Toast、Store 更新、跳转 |
| **Store** | 保存状态 | 业务逻辑方法 |
| **Service** | 业务编排（API → 刷新 → 更新状态 → Toast） | — |
| **Component** | 展示 UI、触发动作 | async 组合超过 3 步 |
| **Page** | 组装组件、连接状态 | 复杂业务流程 |

### 6.4 核心 Feature 模块

#### 6.4.1 Chat 模块

**文件**：`packages/web/src/features/chat/`

**核心组件**：
- `ChatPageByTab` — 按标签页的聊天页
- `ChatSessionView` — 会话视图
- `ChatMessage` — 消息气泡
- `ChatMarkdown` — Markdown 渲染
- `ChatHistoryList` — 历史会话列表
- `ChatHistoryPage` — 历史页
- `ChatTempHome` — 首页占位
- `KnowledgeBaseSelector` — 知识库选择器
- `ProviderSelector` — 模型提供商选择器
- `QuickActions` — 快捷操作
- `EditorPlaceholder` — 输入框占位

**状态管理**：
- `store.ts` — 聊天状态
- `services.ts` — 聊天业务动作
- `hooks.ts` — 自定义 hooks
- `sse-client.ts` — SSE 流式客户端

**X-Chat 集成**：
- 使用 `@ant-design/x` 组件库
- `GoferChatProvider` — 自定义 Chat Provider

#### 6.4.2 KnowledgeBase 模块

**文件**：`packages/web/src/features/KnowledgeBase/`

**核心组件**：
- `KnowledgeBasePage` — 知识库主页
- `KnowledgeBaseList` — 知识库列表
- `KnowledgeBaseToolbar` — 工具栏
- `FileBrowser` — 文件浏览器
- `FileGridItem` / `FileListItem` — 文件项
- `FileContextMenu` — 右键菜单
- `UploadDropZone` — 拖拽上传区
- `UploadProgressBar` — 上传进度条
- `MoveCopyDialog` — 移动/复制对话框

#### 6.4.3 Auth 模块

**文件**：`packages/web/src/features/auth/`

**核心组件**：
- `AuthContainer` — 认证容器
- `LoginForm` — 登录表单
- `RegisterForm` — 注册表单
- `ProfilePage` — 个人资料页
- `Avatar` — 头像组件

#### 6.4.4 Companion 模块

**文件**：`packages/web/src/features/companion/`

**核心组件**：
- `CompanionListPage` — 伴侣列表
- `CompanionCard` — 伴侣卡片
- `CompanionChatPage` — 伴侣聊天页
- `CompanionForm` — 伴侣编辑表单
- `CompanionHeader` — 聊天头部
- `CompanionMessageItem` — 消息项
- `CompanionMemoriesPage` — 记忆管理页
- `CompanionQuickPrompts` — 快捷提示
- `CompanionStatusTag` — 状态标签
- `CompanionTypingIndicator` — 输入指示器

#### 6.4.5 Settings 模块

**文件**：`packages/web/src/features/settings/`

**核心组件**：
- `SettingsSection` — 设置区块
- `SettingsRow` — 设置行
- `ProviderSelect` — 提供商选择
- `ProviderDialog` — 提供商配置弹窗
- `CustomProviderList` — 自定义提供商列表
- `AppearanceSelect` — 外观选择
- `FontSizeSlider` — 字号滑块

### 6.5 Overlay 弹窗系统

**设计**：全局统一的弹窗管理系统

**文件**：`packages/web/src/overlays/`

**核心文件**：
- `host/OverlayHost.tsx` — 弹窗宿主组件
- `host/overlay-store.ts` — 弹窗状态管理
- `services/overlay-service.ts` — 弹窗服务
- `hooks/useOverlay.ts` — useOverlay Hook
- `types/overlay.types.ts` — 类型定义

**预置弹窗**：
- `ConfirmDialog` — 确认弹窗
- `CreateKbDialog` — 新建知识库
- `EditKbDialog` — 编辑知识库
- `DeleteKbDialog` — 删除知识库
- `CreateFolderDialog` — 新建文件夹
- `RenameItemDialog` — 重命名
- `DeleteItemDialog` — 删除项
- `DeleteSessionDialog` — 删除会话
- `EditAvatarDialog` — 编辑头像
- `EditNameDialog` — 编辑名称
- `PreviewDialog` — 预览弹窗

### 6.6 状态管理 (Zustand)

**全局 Store**：

| Store | 文件 | 作用 |
|-------|------|------|
| `authStore` | `stores/auth.ts` | 认证状态、用户信息 |
| `settingsStore` | `stores/settings.ts` | 全局设置 |
| `tabManagerStore` | `stores/tabManager.ts` | 标签页管理 |
| `workspaceStore` | `stores/workspace.store.ts` | 工作区状态 |
| `conversationStore` | `stores/conversation.store.ts` | 对话状态 |

**Feature 级 Store**：
- 每个 Feature 有自己的 `store.ts`
- 仅管理该 Feature 内部状态

### 6.7 路由系统

**框架**：TanStack Router (文件系统路由)

**路由配置**：
- `router.tsx` — 路由实例
- `router-register.ts` — 路由注册
- `routeTree.gen.ts` — 自动生成（`tsr generate`）

**路由守卫**：
- `_authenticated.tsx` — 认证布局，未登录重定向到登录页
- 路由级权限控制

### 6.8 UI 组件

**基础组件库**：shadcn/ui (Radix UI + Tailwind CSS)

**位置**：`packages/web/src/components/ui/`

**常用组件**：
- Button, Input, Textarea, Select
- Dialog, AlertDialog, DropdownMenu, ContextMenu
- Card, Badge, Tabs, Breadcrumb
- Table, Pagination, Progress
- Switch, Checkbox, RadioGroup, Slider
- Tooltip, HoverCard, Popover
- Skeleton, Spinner, Empty, Sonner

---

## 7. 数据模型

### 7.1 ER 图概览

```
User (1) ──< (N) KnowledgeBase
  │             │
  │             ├─< Folder (树形，parentId 自关联)
  │             │      └─< Document
  │             │             └─< Chunk (向量块)
  │             └─< Document
  │                    └─< Chunk
  │
  ├─< Session ──< Message
  │
  ├─< Setting (key-value)
  │
  ├─< Companion ──< CompanionConversation ──< CompanionMessage
  │                    └─< CompanionMemory
  │                    └─< CompanionMessageFeedback
  │
  ├─< CompanionCarePlan ──< CompanionCareEvent
  │
  ├─< GroupChat ──< GroupChatMember
  │             └─< GroupChatMessage
  │
  ├─< AuthSession ──< RefreshToken
  │
  └─< UserRole
```

### 7.2 核心数据表

#### User — 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| email | String (unique) | 邮箱 |
| name | String? | 昵称 |
| avatar | String? | 头像 |
| password | String (60) | bcrypt 哈希 |
| role | String | 角色 (默认 USER) |
| isActive | Boolean | 是否启用 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

#### KnowledgeBase — 知识库表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| userId | String | 用户 ID (外键) |
| name | String (100) | 名称 |
| description | String? | 描述 |
| isPinned | Boolean | 是否置顶 |
| sortOrder | Int (autoincrement) | 排序 |
| icon | String? | 图标 |

#### Folder — 文件夹表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| kbId | String | 知识库 ID |
| parentId | String? | 父文件夹 ID (自关联) |
| name | String | 名称 |

#### Document — 文档表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| kbId | String | 知识库 ID |
| folderId | String? | 文件夹 ID |
| name | String | 文件名 |
| ext | String? | 扩展名 |
| mimeType | String? | MIME 类型 |
| size | BigInt? | 文件大小 |
| storageKey | String | MinIO 存储键 |
| status | DocumentStatus | 状态 (uploaded/chunking/embedding/indexing/ready/failed) |
| errorMessage | String? | 错误信息 |
| indexedAt | DateTime? | 索引完成时间 |

#### Chunk — 文档分块表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| documentId | String | 文档 ID |
| kbId | String | 知识库 ID |
| content | String | 块内容 |
| tokenCount | Int? | Token 数量 |
| chunkIndex | Int | 块索引 |
| embedding | vector(1536) | pgvector 向量列 |

> **注意**：embedding 列在 Prisma schema 中通过 raw SQL 迁移添加，pgvector 扩展必需。

#### Session — 会话表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| userId | String | 用户 ID |
| title | String | 标题 |
| provider | String? | 提供商 |
| model | String? | 模型 |

#### Message — 消息表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| sessionId | String | 会话 ID |
| role | String | 角色 (user/assistant/system) |
| content | String | 内容 |

#### Setting — 设置表 (key-value)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| userId | String | 用户 ID |
| key | String | 设置键 |
| value | String | 设置值 |

唯一约束：`(userId, key)`

#### AuthSession — 认证会话表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (CUID) | 主键 |
| userId | String | 用户 ID |
| app | String | 应用类型 (web/admin) |
| userAgent | String? | 浏览器 UA |
| ip | String? | IP 地址 |
| lastSeenAt | DateTime | 最后活跃时间 |
| revokedAt | DateTime? | 撤销时间 |
| revokedReason | String? | 撤销原因 |

#### RefreshToken — 刷新令牌表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (CUID) | 主键 |
| sessionId | String | 会话 ID |
| jtiHash | String (unique) | JTI 哈希 |
| usedAt | DateTime? | 使用时间 |
| replacedByTokenId | String? | 替换令牌 ID |
| parentTokenId | String? | 父令牌 ID |
| revokedAt | DateTime? | 撤销时间 |

### 7.3 Companion 相关表

详见 Prisma schema 中 `Companion Module` 注释部分，包含：
- Companion — 伴侣
- CompanionConversation — 伴侣会话
- CompanionMessage — 伴侣消息
- CompanionMemory — 伴侣记忆
- CompanionMessageFeedback — 消息反馈
- CompanionCarePlan — 关怀计划
- CompanionCareEvent — 关怀事件
- GroupChat — 群聊
- GroupChatMember — 群聊成员
- GroupChatMessage — 群聊消息

---

## 8. 核心业务流程

### 8.1 用户认证流程

```
用户输入邮箱密码
    │
    ▼
POST /api/auth/login
    │
    ▼
AuthController.login()
    │
    ├─ AuthService.login()
    │   ├─ UserService.validatePassword() → bcrypt 比对
    │   ├─ 检查用户是否启用 (isActive)
    │   ├─ AuthRepository.getRolesForUserByApp() → 获取角色
    │   ├─ 创建会话 (AuthRepository.createSession)
    │   ├─ 生成 Access Token + Refresh Token (JWT)
    │   └─ 保存 Refresh Token (jti 哈希)
    │
    └─ 返回 { user, accessToken, refreshToken }
```

### 8.2 文件上传与索引流程

```
用户选择文件上传
    │
    ▼
前端 POST /api/knowledge-bases/{kbId}/documents/upload
    │
    ▼
DocumentController.upload()
    │
    ├─ StorageService.upload() → 上传到 MinIO
    ├─ DocumentRepository.create() → 创建文档记录 (status=uploaded)
    └─ QueueService.addIndexingJob() → 添加索引任务
    │
    ▼
立即返回文档信息 (前端显示上传中)
    │
    ▼
BullMQ Worker 后台处理
    │
    ├─ 1. 文档解析 (DocumentParser)
    │   ├─ 根据扩展名选择解析器
    │   └─ 提取纯文本内容
    │
    ├─ 2. 文本分块
    │   └─ 按 token 数/字符数分割，带重叠
    │
    ├─ 3. Embedding 生成
    │   └─ 调用 Embedding API (LlamaIndexEmbeddingService)
    │
    ├─ 4. 向量入库
    │   └─ 写入 chunks 表 (pgvector)
    │
    └─ 5. 更新文档状态
        └─ DocumentRepository.updateStatus(ready)
```

### 8.3 AI 对话流程 (含 RAG)

```
用户发送消息
    │
    ▼
前端 → POST /api/chat/messages (SSE)
    │
    ▼
ChatController.streamChat()
    │
    ▼
ChatService.streamChat()
    │
    ├─ 1. 验证会话所有权
    ├─ 2. 解析 LLM Provider
    ├─ 3. 加载历史消息
    ├─ 4. 保存用户消息
    │
    ├─ 5. 可选：RAG 检索 (ChatContextRetriever)
    │   ├─ QueryUnderstandingService → 查询理解
    │   ├─ EsVectorService → 向量搜索
    │   ├─ EsKeywordService → 关键词搜索
    │   ├─ RRF 融合排序
    │   ├─ BgeRerankService → 重排序
    │   └─ GuardrailService → 安全过滤
    │
    ├─ 6. 构建 Prompt (历史 + 检索上下文 + 用户消息)
    │
    ├─ 7. 调用 LLM (LlmProvider.chat())
    │   └─ 流式输出 token
    │
    ├─ 8. 保存助手消息
    │
    └─ SSE 流式返回给前端
```

### 8.4 知识库检索流程

```
用户在聊天中 @知识库名
    │
    ▼
前端解析 @提及，提取 kbId 列表
    │
    ▼
发送请求时携带 kb_ids 参数
    │
    ▼
ChatService 调用 ChatContextRetriever.retrieve()
    │
    ├─ 向量检索 (pgvector HNSW)
    ├─ 全文检索 (PostgreSQL full-text)
    ├─ RRF 混合排序
    ├─ 重排序 (BGE Reranker)
    └─ 返回最相关的 N 个片段
    │
    ▼
注入到 LLM Prompt 上下文中
```

### 8.5 AI 伴侣对话流程

```
用户发送消息
    │
    ▼
CompanionChatService.sendMessage()
    │
    ▼
LangGraph 工作流执行
    │
    ├─ 1. intent-node → 意图识别
    ├─ 2. route-node → 路由决策
    │   ├─ 普通对话路径
    │   ├─ 情感对话路径
    │   ├─ 记忆提取路径
    │   └─ 安全回应路径
    ├─ 3. emotion-node → 情感分析 (如需要)
    ├─ 4. memory-extraction-node → 记忆提取 (如需要)
    ├─ 5. generate-node → 生成回复
    ├─ 6. quality-guard-node → 质量检查
    └─ 7. safety-node → 安全检查
    │
    ▼
保存消息 + 流式返回
```

---

## 9. 开发规范与约定

### 9.1 代码风格

**工具**：Biome 2.5.x (lint + format 一体化)

**配置文件**：`biome.json`

**关键规则**：
- 缩进：2 空格
- 行宽：100 字符
- 引号：单引号
- 分号：as-needed (尽量省略)
- 尾随逗号：all
- 箭头函数括号：always

### 9.2 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 变量/函数 | camelCase | `userName`, `getUserById` |
| 布尔变量 | is/has/should/can 前缀 | `isActive`, `hasPermission` |
| 类型/接口/组件 | PascalCase | `User`, `UserCard` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| 自定义 Hook | use + camelCase | `useDebounce`, `useAuth` |
| 文件名 (组件) | PascalCase.tsx | `UserCard.tsx` |
| 文件名 (工具/hook) | kebab-case.ts | `use-debounce.ts`, `date-utils.ts` |
| 测试文件 | 源文件名 + .spec.ts/.spec.tsx | `auth.service.spec.ts` |

### 9.3 后端约定

**文件**：`docs/guide/backend/conventions.md`

**关键要点**：
- 框架：NestJS 10 + Fastify + Prisma 5
- 验证：Zod + nestjs-zod，禁止 class-validator / class-transformer
- 认证：JWT + bcrypt，使用 `@UseGuards(JwtAuthGuard)` + `@CurrentUser()`
- 数据库：PostgreSQL + pgvector，通过 PrismaService 注入
- 响应：直接返回原始数据，由 ResponseInterceptor 统一包装
- 异常：Service 层抛出 NestJS 内置异常，全局过滤器处理

### 9.4 前端约定

**文件**：`docs/guide/frontend/`

**关键要点**：
- Feature-First 组织架构
- Zustand 状态管理，按 Feature 拆分
- alova 作为 HTTP 客户端
- shadcn/ui 基础组件库
- 测试：Vitest + React Testing Library

### 9.5 错误处理

**后端**：
- Service 层抛出 NestJS 内置 HttpException
- 使用 AppException 自定义错误码
- 全局 AllExceptionsFilter 统一格式化

**前端**：
- API 层错误由 alova 拦截器处理
- Service 层捕获错误后 Toast 提示
- 错误码映射：`utils/error-mapper.ts`

### 9.6 Git 约定

**提交信息格式**：
```
<type>: <中文描述>

<可选正文>
```

**类型**：feat, fix, refactor, docs, test, chore, perf, ci

**示例**：
```
feat: 添加知识库文件移动功能

- 支持跨知识库移动文件
- 处理命名冲突自动重命名
- 增加单元测试覆盖
```

---

## 10. 测试体系

### 10.1 测试金字塔

```
        /───────\
       /  E2E    \  ← Playwright (UI 端到端)
      /───────────\
     / API E2E     \  ← Vitest (HTTP API 端到端)
    /───────────────\
   /  Integration    \  ← Vitest (集成测试)
  /───────────────────\
 /     Unit Tests      \  ← Vitest (单元测试)
─────────────────────────
```

### 10.2 测试目录结构

```
# 单元测试 (与源码同目录)
packages/server/src/auth/auth.service.ts
packages/server/tests/auth/auth.service.spec.ts

packages/web/src/features/chat/store.ts
packages/web/tests/chat-store.spec.ts

# 集成测试
tests/integration/
  ├── auth.controller.spec.ts
  ├── knowledge-base.controller.spec.ts
  ├── chat.controller.spec.ts
  ├── rag-e2e.spec.ts
  └── ...

# API E2E 测试
tests/e2e/api/
  └── chat-flow.spec.ts

# UI E2E 测试 (Playwright)
e2e/
  ├── specs/
  │   └── auth-chat.spec.ts
  ├── pages/
  ├── fixtures/
  └── playwright.config.ts
```

### 10.3 测试命令

| 命令 | 说明 |
|------|------|
| `pnpm test` | 运行所有单元测试 (watch 模式) |
| `pnpm test:unit` | 运行单元测试 (单次) |
| `pnpm test:integration` | 运行集成测试 |
| `pnpm test:e2e:api` | 运行 API E2E 测试 |
| `pnpm test:e2e` | 运行 Playwright UI E2E 测试 |
| `pnpm test:all` | 运行所有测试 |
| `pnpm type-check` | TypeScript 类型检查 |

### 10.4 测试覆盖率

**目标**：最低 80% 覆盖率

**测试框架**：Vitest (内置 coverage)

---

## 11. 部署与运行

### 11.1 环境要求

| 工具 | 最低版本 | 用途 |
|------|---------|------|
| Node.js | LTS (≥20) | 运行时 |
| pnpm | ≥9 | Monorepo 包管理 |
| Docker | ≥24 | 运行基础设施容器 |

### 11.2 基础设施

**Docker Compose**：`docker-compose.dev.yml`

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| PostgreSQL | pgvector/pgvector:pg16 | 5432 | 数据库 + 向量存储 |
| MinIO | minio/minio | 9000 / 9001 | 对象存储 / 管理控制台 |
| Redis | redis:7-alpine | 6379 | 缓存 + 任务队列 |

### 11.3 端口一览

| 服务 | 端口 | 说明 |
|------|------|------|
| Web 前端 | 1420 | Vite dev server |
| Admin 后台 | 1421 | Vite dev server |
| NestJS API | 3000 | 后端 HTTP 接口 |
| Swagger 文档 | 3000/api/docs | OpenAPI UI (开发环境) |
| PostgreSQL | 5432 | 数据库 |
| MinIO API | 9000 | 对象存储 API |
| MinIO Console | 9001 | MinIO 管理面板 |
| Redis | 6379 | 缓存/队列 |

### 11.4 首次运行步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 启动 Docker 基础设施
docker compose -f docker-compose.dev.yml up -d --wait

# 3. 初始化数据库
cd packages/server && npx prisma migrate dev && cd ../..

# 4. 构建共享包
pnpm -r build

# 5. 启动开发模式
pnpm dev
```

### 11.5 日常开发命令

```bash
# 同时启动前后端
pnpm dev

# 分别启动
pnpm dev:server    # 后端 :3000
pnpm dev:web       # 前端 :1420
pnpm dev:admin     # 管理后台 :1421

# 代码检查
pnpm check              # lint + format 检查
pnpm check:fix          # 自动修复
pnpm type-check         # TypeScript 类型检查

# 数据库
pnpm --filter @goferbot/server prisma:migrate   # 迁移
pnpm --filter @goferbot/server prisma:studio    # Prisma Studio
```

### 11.6 环境变量

**根目录 `.env`** — Docker 容器配置：
```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=gofer
POSTGRES_PASSWORD=gofer_dev_pass
POSTGRES_DB=goferbot

MINIO_HOST=localhost
MINIO_PORT=9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

REDIS_HOST=localhost
REDIS_PORT=6379
```

**`packages/server/.env`** — 后端配置：
```
PORT=3000
DATABASE_URL=postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot
REDIS_HOST=localhost
REDIS_PORT=6379
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_here
CORS_ORIGIN=http://localhost:1420
```

**`packages/web/.env`** — 前端配置：
```
VITE_API_BASE_URL=http://localhost:3000
```

### 11.7 验证服务就绪

```bash
# 检查 Docker 容器健康状态
docker compose -f docker-compose.dev.yml ps

# 验证后端健康检查
curl http://localhost:3000/api/health
# → {"status":"ok"}

# 访问 Swagger 文档
# http://localhost:3000/api/docs
```

---

## 12. 关键配置文件

| 文件 | 作用 |
|------|------|
| `package.json` | 根 package，Monorepo scripts |
| `pnpm-workspace.yaml` | pnpm workspace 配置 |
| `biome.json` | Biome lint/format 配置 |
| `docker-compose.dev.yml` | 开发环境容器编排 |
| `.env.example` | 根目录环境变量模板 |
| `packages/server/package.json` | 后端依赖 |
| `packages/server/prisma/schema.prisma` | 数据库 Schema |
| `packages/server/nest-cli.json` | NestJS CLI 配置 |
| `packages/server/tsconfig.json` | 后端 TS 配置 |
| `packages/server/vitest.config.ts` | 后端 Vitest 配置 |
| `packages/server/.env.example` | 后端环境变量模板 |
| `packages/web/package.json` | 前端依赖 |
| `packages/web/vite.config.ts` | Vite 配置 |
| `packages/web/tsconfig.json` | 前端 TS 配置 |
| `packages/web/components.json` | shadcn/ui 配置 |
| `packages/web/.env.example` | 前端环境变量模板 |
| `packages/admin/package.json` | 管理后台依赖 |
| `packages/data/package.json` | 共享数据依赖 |
| `e2e/playwright.config.ts` | Playwright E2E 配置 |
| `vitest.integration.config.ts` | 集成测试配置 |
| `vitest.e2e-api.config.ts` | API E2E 测试配置 |

---

## 附录

### A. 学习资源

- [项目 README](file:///d:/projects/ai-stared-project/knowledge-base/README.md)
- [后端开发指南](file:///d:/projects/ai-stared-project/knowledge-base/docs/guide/backend/README.md)
- [前端开发指南](file:///d:/projects/ai-stared-project/knowledge-base/docs/guide/frontend/README.md)
- [测试指南](file:///d:/projects/ai-stared-project/knowledge-base/docs/guide/testing/README.md)
- [架构决策记录](file:///d:/projects/ai-stared-project/knowledge-base/docs/adrs/)

### B. 相关文档

- [产品需求文档](file:///d:/projects/ai-stared-project/knowledge-base/docs/prd/)
- [设计模式参考](file:///d:/projects/ai-stared-project/knowledge-base/docs/reference/)
- [Issue 列表](file:///d:/projects/ai-stared-project/knowledge-base/docs/issues/)

---

*本文档最后更新：2026-06-29*
