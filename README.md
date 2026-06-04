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

- **混合搜索策略**：pgvector HNSW 向量索引（语义相似度）+ **全文索引**（关键词匹配），通过 RRF 融合排序提升召回率
- **细粒度检索控制**：支持 `@知识库名称` 提及触发 RAG，每条消息独立选择检索范围，非全局开关
- **后台索引队列**：批量导入文件时自动排队处理，前端实时显示索引进度，避免卡死 UI

### 2. 分层架构与职责边界

采用 Monorepo 组织的多层架构，前后端分离，各层职责清晰：

| 层 | 职责 | 技术选型 | 路径 |
| -- | ---- | -------- | ---- |
| **Vue 3 前端** | UI 渲染、状态管理、HTTP API 调用 | Vue 3 + Pinia + Tailwind CSS v4 | `packages/webui/` |
| **NestJS API** | API 路由、认证、业务编排、全局拦截器 | NestJS 10 + Fastify | `packages/server/` |
| **PostgreSQL + pgvector** | 元数据与向量统一存储 | PG 16 + pgvector 扩展 | Docker |
| **MinIO** | 对象存储：文件内容 | MinIO | Docker |
| **Redis + BullMQ** | 缓存、异步任务队列 | Redis 7 | Docker |

**文件导入链路设计**：前端通过 HTTP POST 到 NestJS Controller → MinIO 存储 → PostgreSQL 创建记录 → BullMQ 添加解析任务 → Worker 异步处理（解析 → 分块 → 向量化 → pgvector）。该设计解耦了上传与处理，避免阻塞用户操作。

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
- **Issue-Centric 结构**：一个 issue 一个目录，包含 `issue.md` + `plan.md` + `checklist.json` + `specs/`，测试按金字塔分层：`tests/unit/`（单元）、`tests/integration/`（集成）、`tests/e2e/`（端到端），Issue→测试映射见 `tests/README.md`
- **状态自动同步**：`checklist.json` 由 vitest reporter 自动生成，`sync-issue-status.js` 合并后保守更新 `issue.md` 的 `status`
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

| 工具 | 最低版本 | 用途 |
|------|---------|------|
| [Node.js](https://nodejs.org/) | LTS（≥20） | 运行时 |
| [pnpm](https://pnpm.io/) | ≥9 | Monorepo 包管理 |
| [Docker](https://www.docker.com/) | ≥24 | 运行 PostgreSQL + MinIO + Redis |

### 首次运行（从头搭建）

按顺序执行以下步骤：

```bash
# 1. 安装依赖（Monorepo 全部包）
pnpm install

# 2. 启动 Docker 基础设施（PostgreSQL + MinIO + Redis）
docker compose -f docker-compose.dev.yml up -d

# 3. 等待所有容器健康检查通过（约 30~60 秒）
docker compose -f docker-compose.dev.yml ps

# 4. 初始化数据库表结构（Prisma 迁移）
cd packages/server && npx prisma migrate dev && cd ../..

# 5. 构建 workspace 依赖包（rag-sdk 等）
pnpm -r build

# 6. 启动开发模式（后端 NestJS :3000 + 前端 Vite :1420）
pnpm dev
```

### 日常开发（基础设施已运行）

```bash
# 启动前后端
pnpm dev

# 或分别启动
pnpm dev:server   # 后端 → http://localhost:3000
pnpm dev:web      # 前端 → http://localhost:1420
```

### 端口与服务一览

| 服务 | 端口 | 说明 |
|------|------|------|
| **WebUI** | `1420` | Vite dev server（前端 SPA） |
| **NestJS API** | `3000` | 后端 HTTP 接口 |
| **PostgreSQL** | `5432` | 元数据数据库 |
| **MinIO** | `9000` | 对象存储 API |
| **MinIO Console** | `9001` | MinIO Web 管理面板 |
| **Redis** | `6379` | 缓存与任务队列 |

**验证基础设施是否就绪：**

```bash
# 检查所有容器健康状态
docker compose -f docker-compose.dev.yml ps
# STATUS 列应全部显示 "healthy"

# 验证后端接口
curl http://localhost:3000/api/health
# → {"status":"ok"}
```

### 项目结构（运行时视角）

```
goferbot/
├── .env                          # Docker 基础设施变量（PG/MinIO/Milvus/Redis）
├── docker-compose.dev.yml        # 开发环境容器编排（根目录）
├── .data/                        # Docker 数据卷（Git 忽略）
│   ├── postgres/
│   ├── minio/
│   ├── milvus/
│   └── redis/
├── packages/
│   ├── server/
│   │   ├── .env                  # 后端变量（DB URL、JWT、CORS 等）
│   │   ├── prisma/               # 数据库 schema 与迁移
│   │   └── src/main.ts           # NestJS 入口
│   └── webui/
│       ├── .env                  # 前端变量（VITE_API_BASE_URL）
│       └── src/                  # Vue 3 源码
```

### 配置文件说明

**根目录 `.env`** — Docker 容器所需的连接参数，`docker compose` 启动时自动读取：

```bash
POSTGRES_HOST=localhost      # PostgreSQL 地址
POSTGRES_PORT=5432
POSTGRES_USER=gofer
POSTGRES_PASSWORD=gofer_dev_pass
POSTGRES_DB=goferbot

MINIO_HOST=localhost         # MinIO 对象存储
MINIO_PORT=9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

MILVUS_HOST=localhost        # Milvus 向量引擎
MILVUS_PORT=19530

REDIS_HOST=localhost         # Redis 缓存
REDIS_PORT=6379
```

**`packages/server/.env`** — 后端运行时读取，需与 Docker 容器信息保持一致：

```bash
PORT=3000                    # API 监听端口
DATABASE_URL=postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot
REDIS_HOST=localhost
REDIS_PORT=6379
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MILVUS_HOST=localhost
MILVUS_PORT=19530
JWT_SECRET=...               # 生产环境务必更换
CORS_ORIGIN=http://localhost:5173
```

**`packages/webui/.env`** — 前端构建时注入，指定后端地址：

```bash
VITE_API_BASE_URL=http://localhost:3000
```

### 常见问题

**Docker 容器未全部 healthy？**
```bash
# 查看具体容器日志
docker compose -f docker-compose.dev.yml logs postgres
docker compose -f docker-compose.dev.yml logs redis

# 重启某个服务
docker compose -f docker-compose.dev.yml restart minio
```

**Prisma 迁移报错？**
```bash
# 确认 PostgreSQL 容器已 healthy，然后重新迁移
cd packages/server
npx prisma migrate dev --name init
```

**端口冲突？**
```bash
# 检查端口占用（Linux/macOS）
lsof -i :1420
lsof -i :3000
# Windows
netstat -ano | findstr 1420
```

**前端请求报 CORS 错误？**
确认 `packages/server/.env` 中 `CORS_ORIGIN` 包含你的前端实际访问地址（通常是 `http://localhost:1420`）。

### 检查与测试

```bash
pnpm test          # 单元测试（Vitest）
pnpm test:e2e      # E2E 测试（Playwright）
pnpm type-check    # TypeScript 类型检查（所有包）
```

### 常用脚本

| 脚本 | 作用 |
|------|------|
| `pnpm dev` | **同时启动前后端**（concurrently 并行） |
| `pnpm dev:web` | 只启动前端 Vite（`localhost:1420`） |
| `pnpm dev:server` | 只启动后端 NestJS（watch 模式，`localhost:3000`） |
| `pnpm -r build` | 构建所有 workspace 包 |
| `pnpm test` | 运行单元测试 |
| `pnpm test:e2e` | 运行 E2E 测试 |
| `pnpm type-check` | 所有包 TypeScript 类型检查 |

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

### 向量存储（PostgreSQL pgvector）

```
Table: chunks
  - id (primary key)
  - content (text)
  - embedding (vector(1536)) — pgvector 扩展
  - document_id
  - kb_id
  - chunk_index
  - token_count
```

***

## 许可证

[MIT](./LICENSE)
