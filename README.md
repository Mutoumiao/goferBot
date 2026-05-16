# GoferBot

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs" alt="Vue 3">
  <img src="https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs" alt="NestJS 10">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
</p>

**GoferBot** 是一款云端优先的 **AI Workspace / Agent OS** Web 应用。支持导入 Markdown、TXT 等文档进行管理，通过多 LLM 提供商进行智能问答，并基于 **RAG 检索增强**（向量搜索 + 全文搜索混合排序）提供上下文感知的精准回答。

> **从零到一完整实践 Harness Engineering 开发方法论。**

***

## 项目亮点

### 1. 完整的 RAG 检索增强系统

- **混合搜索策略**：Milvus HNSW 向量索引（语义相似度）+ **全文索引**（关键词匹配），通过 RRF 融合排序提升召回率
- **细粒度检索控制**：支持 `@知识库名称` 提及触发 RAG，每条消息独立选择检索范围，非全局开关
- **后台索引队列**：批量导入文件时自动排队处理，前端实时显示索引进度，避免卡死 UI

### 2. 分层架构与职责边界

采用 Monorepo 组织的多层架构，前后端分离，各层职责清晰：

| 层 | 职责 | 技术选型 | 路径 |
| -- | ---- | -------- | ---- |
| **Vue 3 前端** | UI 渲染、状态管理、HTTP API 调用 | Vue 3 + Pinia + Tailwind CSS v4 | `packages/webui/` |
| **NestJS API** | API 路由、认证、业务编排、全局拦截器 | NestJS 10 + Fastify | `packages/server/` |
| **PostgreSQL** | 元数据：用户、知识库、文档、会话、消息 | PG 16 + Prisma 5 | Docker |
| **MinIO** | 对象存储：文件内容 | MinIO | Docker |
| **Milvus** | 向量索引与 ANN 搜索 | Milvus 2.4+ | Docker |
| **Redis + BullMQ** | 缓存、异步任务队列 | Redis 7 | Docker |

**文件导入链路设计**：前端通过 HTTP POST 到 NestJS Controller → MinIO 存储 → PostgreSQL 创建记录 → BullMQ 添加解析任务 → Worker 异步处理（解析 → 分块 → 向量化 → Milvus）。该设计解耦了上传与处理，避免阻塞用户操作。

### 3. 多 LLM 提供商与每会话模型切换

- 支持 **OpenAI、Claude、DeepSeek、Ollama** 等多个提供商同时配置
- 每会话可独立切换模型，不影响全局默认配置
- 会话表记录 `provider` + `model` 快照，恢复历史会话时保持当时使用的模型信息

### 4. 完整的知识库文件管理

- 知识库 = 虚拟文件夹树（数据库存储），支持远程同步与协作
- 支持文件夹层级浏览、面包屑导航、文件名搜索
- 右键菜单操作：置顶、修改资料（名称/图标）、删除
- 文件操作：新建文件夹、行内重命名、跨库移动/复制、删除

***

## 功能特性

| 模块           | 功能                                            |
| ------------ | --------------------------------------------- |
| **智能问答**     | 流式 SSE 对话、Markdown 渲染、代码语法高亮 + 复制按钮、首页占位符自动升格 |
| **RAG 检索**   | `@提及` 触发知识库检索、多知识库同时检索、混合搜索（向量+全文）、检索来源引用     |
| **知识库管理**    | 新建/删除/置顶/修改资料、文件夹层级浏览、文件导入、回收站恢复              |
| **文件操作**     | 新建文件夹、行内重命名、跨库移动/复制、物理删除、命名冲突自动处理             |
| **多 LLM 支持** | OpenAI / Claude / DeepSeek / Ollama，每会话独立切换   |
| **问答历史**     | 会话列表、历史恢复、重命名、删除                              |
| **设置**       | 多提供商 API Key 配置、Embedding API 配置、温度参数滑块       |

***

## 架构决策（ADR）

本项目所有重大架构决策均通过 **ADR（Architecture Decision Records）** 形式记录，确保设计意图可追踪、可复盘。

## Harness Engineering 实践

本项目完整实践了 Harness Engineering 开发方法论：

```
需求澄清 → 规划拆分 → 依赖检查 → 并行实现 → 代码审查 → 验收验证 → 架构优化 → 分支收尾
```

<br />

**工程纪律体现：**

- **事务驱动**：所有功能以 Markdown Issue 形式跟踪，含明确的 `Acceptance criteria` 和 `Blocked by` 依赖声明
- **设计先行的文档化**：每个功能开发前通过 spec 确认领域术语和架构决策，避免返工
- **状态机管理**：Issue 遵循多状态生命周期（`needs-triage` → `ready-for-agent` → `in-progress` → `ready-for-review` → `verified` → `completed`）
- **验证即完成**：禁止在未经验证的情况下声明完成，强制运行测试与类型检查

***

## 技术栈

| 层级         | 技术                                                | 说明                                 |
| ---------- | ------------------------------------------------- | ---------------------------------- |
| 前端框架       | Vue 3 + TypeScript + Vite                         | Composition API、响应式状态管理            |
| 后端框架       | NestJS 10 + Fastify                               | 模块化架构、依赖注入、拦截器、守卫模式              |
| ORM        | Prisma 5                                          | PostgreSQL 数据库访问层                    |
| 认证         | JWT + bcrypt + Passport                           | Access/Refresh Token 双令牌机制            |
| 状态管理       | Pinia                                             | 会话、知识库、标签页、设置等模块状态                 |
| CSS 框架     | Tailwind CSS v4                                   | 原子化样式、自定义主题                        |
| 图标方案       | lucide-vue-next                                   | 统一图标体系                             |
| 测试框架       | Vitest + @vue/test-utils                          | 组件测试、Store 测试、工具函数测试               |
| 包管理器       | pnpm workspace                                    | Monorepo 依赖管理、跨包引用               |

***

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/)（建议 LTS 版本）
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/)（运行 PostgreSQL + MinIO + Milvus + Redis）

### 启动基础设施

```bash
# 启动 Docker 基础设施
cd packages/server && docker compose -f docker-compose.dev.yml up -d
```

### 安装依赖

```bash
pnpm install
```

### 构建所有包

```bash
pnpm -r build
```

### 启动开发模式

```bash
# 同时启动前后端（webui Vite + NestJS watch）
pnpm dev
```

### 检查与测试

```bash
# 运行单元测试
pnpm test

# 运行 E2E 测试
pnpm test:e2e

# TypeScript 类型检查（所有 workspace 包）
pnpm type-check
```

### 常用脚本说明

| 脚本 | 作用 |
|------|------|
| `pnpm dev` | **同时启动前后端**（NestJS + Vite dev server） |
| `pnpm dev:web` | 只启动前端（Vite dev server） |
| `pnpm dev:server` | 只启动后端 NestJS（watch 模式） |
| `pnpm build` | 构建 webui 生产版本 |
| `pnpm preview` | 预览 webui 生产构建 |
| `pnpm -r build` | 构建所有 workspace 包（server、rag-sdk、webui） |
| `pnpm test` | 运行根目录单元测试（Vitest，含组件、store、composable 测试） |
| `pnpm test:e2e` | 运行 E2E 测试（Playwright，浏览器级交互测试） |
| `pnpm type-check` | 对所有 workspace 包运行 TypeScript 类型检查 |

***

## 数据架构

### PostgreSQL 数据模型（Prisma）

```
User          → 用户（邮箱、密码哈希、名称、头像）
KnowledgeBase → 知识库（名称、描述、图标、所有者）
Folder        → 虚拟文件夹（树结构，parentId 自关联）
Document      → 文档（文件名、路径、MinIO key、状态、知识库关联）
Chunk         → 文档分块（内容、向量 ID、文档关联）
Session       → 会话（标题、模型、提供商、用户关联）
Message       → 消息（角色、内容、引用来源、会话关联）
Setting       → 用户设置（LLM 配置、Embedding 配置）
```

### 文件存储（MinIO）

```
buckets/
  documents/     # 用户上传的原始文件
```

### 向量存储（Milvus）

```
Collection: chunks
  - id (primary key)
  - vector (embedding)
  - document_id
  - content (text)
```

***

## 开发规范

- 所有 API 响应统一为 `{ data: T }` 格式（由 ResponseInterceptor 处理）
- 异常统一由全局 ExceptionFilter 捕获并标准化
- 认证使用 `@UseGuards(JwtAuthGuard)` + `@CurrentUser()` 装饰器
- Prisma 查询通过 `PrismaService` 注入，禁止直接实例化 `PrismaClient`

***

## 相关文档

| 文档                                                                     | 说明                                          |
| ---------------------------------------------------------------------- | ------------------------------------------- |
| [`CLAUDE.md`](./CLAUDE.md)                                             | 项目全局指南（编码规范、技能路由、开发流程）             |
| [`PROGRESS.md`](./PROGRESS.md)                                         | 项目进度追踪（Issue 执行状态与后续开发计划）                   |
| [`docs/01-prd/v2-cloud-native.md`](./docs/01-prd/v2-cloud-native.md)   | 产品需求文档（PRD）v2                               |
| [`docs/05-adrs/`](./docs/05-adrs/)                                     | 架构决策记录（ADR）                                 |
| [`docs/02-issues/`](./docs/02-issues/)                                 | 活跃 Issue 跟踪（含验收标准与依赖声明）                        |
| [`docs/03-specs/`](./docs/03-specs/)                                   | 功能规格、行为规格、API 规格                          |

***

## 许可证

[MIT](./LICENSE)
