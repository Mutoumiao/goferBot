# 知识库应用 PRD v2

> 版本：v2.0
> 日期：2026-05-15
> 架构：云原生（PostgreSQL + MinIO + Redis + BullMQ）
>
> **注意**：向量存储使用 PostgreSQL pgvector 扩展（参见 ADR 0001）。本文档中部分历史描述仍保留 Milvus 引用，实际实现以 ADR 0001 为准。

---

## 1. 项目概述

基于 Tauri v2 + Vue 3 + NestJS 的 AI Workspace 桌面应用。用户可导入文档进行管理，通过 LLM 进行问答，支持 RAG 检索增强。

**定位**：带本地能力的 AI Workspace / Agent OS
- 云端优先
- 本地缓存
- 可扩展 SaaS
- AI Native Infrastructure

---

## 2. 架构设计

### 2.1 分层架构

| 层 | 职责 | 技术 |
|---|---|---|
| Tauri Rust | 桌面壳：窗口管理、提供 appData 路径 | Rust |
| NestJS API | API 路由、认证、业务编排、全局拦截器 | TS + NestJS 10 + Fastify |
| PostgreSQL | 元数据：用户、知识库、文档、会话、消息 | PG 16 |
| MinIO | 对象存储：文件内容 | MinIO |
| PostgreSQL pgvector | 向量索引与 ANN 搜索 | pgvector 扩展 |
| Redis + BullMQ | 缓存、异步任务队列 | Redis 7 |
| 前端 Vue | UI 渲染、状态管理、HTTP 调用 | Vue 3 + Pinia |
| 本地 SQLite | 前端缓存：UI 状态、离线数据、Agent Memory | SQLite |

### 2.2 数据流

```
用户上传文件
    ↓
NestJS Controller 接收 → MinIO 存储
    ↓
PostgreSQL 创建文档记录（status = uploaded）
    ↓
BullMQ 添加 parse job
    ↓
Worker: parse → chunk → embed → Milvus
    ↓
PostgreSQL 更新 status = ready
```

### 2.3 Docker 基础设施

```yaml
# docker-compose.dev.yml
services:
  postgres:     # 主数据库（含 pgvector 向量扩展）
  minio:        # 对象存储
  redis:        # 缓存 + 队列
```

---

## 3. 认证系统

### 3.1 MVP 范围

- 邮箱 + 密码注册/登录
- JWT Token 认证（Access Token + Refresh Token）
- 无 OAuth、无邮箱验证（后续扩展）

### 3.2 用户流程

```
首次打开应用 → 登录页
              ↓
        有账号？登录 : 注册
              ↓
        进入主界面
```

### 3.3 API

```
POST /api/auth/login     # 登录（返回 JWT）
POST /api/auth/register  # 注册
POST /api/auth/refresh   # 刷新 Token
GET  /api/auth/me        # 获取当前用户信息
```

---

## 4. 全局布局

### 4.1 框架尺寸

- 左侧边栏：64px 固定宽度，全局始终显示
- 顶部标签栏：38px 固定高度
- 内部区域：剩余空间

### 4.2 左侧边栏（64px）

上区（常用）：
- 消息图标 → 打开/切换到问答首页
- 文件夹图标 → 打开/切换到知识库管理

下区（低频）：
- 时钟图标 → 打开/切换到对话历史
- 齿轮图标 → 打开/切换到设置

### 4.3 顶部标签栏（38px）

- 动态多标签，浏览器式横向滚动
- 标签类型：
  - 问答会话：可多开，默认名"首页"
  - 知识库管理：单例
  - 设置：单例
  - 对话历史：单例
- "首页"标签始终保留，无法关闭
- 最右侧 `+` 按钮新建问答会话

---

## 5. 页面设计

### 5.1 问答对话页

#### 空会话态（默认首页）

- 中间区域：大输入框 + 发送按钮
- 输入框下方：3-4 个快捷提问示例胶囊按钮
- 顶部：会话标题（可编辑，默认为"首页"）、模型切换下拉

#### 对话态

- 底部：固定输入框
  - 多行文本，Enter 发送，Shift+Enter 换行
  - 支持 `@知识库名称` 提及触发 RAG
  - 支持选择多个知识库（复选框）
- 上部：可滚动消息流
  - 用户消息：靠右，浅色背景
  - AI 消息：靠左，白色背景
  - 支持 Markdown 渲染
  - 代码块：语法高亮 + 复制按钮
- 顶部：会话标题（可编辑）、模型切换下拉

### 5.2 知识库管理页

- 左侧：一级知识库列表
  - 每项：图标 + 知识库名称 + 状态指示
  - 支持新建知识库
  - 支持置顶、排序
- 右侧：资源管理器式图标视图
  - 显示当前知识库内的文件和文件夹（虚拟文件夹）
  - 双击文件夹进入下一级
  - 面包屑导航显示当前路径
- 顶部工具栏：
  - 面包屑导航
  - 搜索框（按文件名搜索）
  - 排序下拉（名称/日期/类型）
  - 添加文件按钮
- 文件项显示状态标签：
  - `uploaded`（灰色）
  - `parsing`（蓝色）
  - `chunking`（蓝色）
  - `indexing`（蓝色）
  - `ready`（绿色）
  - `failed`（红色）
- 空状态：提示"点击添加文件导入文档"

### 5.3 对话历史页

- Tabs：默认"问答历史"
- 列表项：
  - 对话总结标题
  - 最后消息时间
  - 少许内容摘要
- 操作：点击恢复续上对话、删除、重命名

### 5.4 设置页

分三个卡片区域：

**LLM 提供商配置**
- 多提供商保存：OpenAI / Claude / DeepSeek / 自定义 / Ollama
- 每个提供商独立配置：API Key（密码框）、模型、Base URL
- Ollama 额外有启用开关和服务地址
- 默认对话提供商选择

**Embedding API**
- 提供商选择：OpenAI / 硅基流动 / 自定义
- API Key 输入
- 模型选择/输入
- Base URL

**通用**
- 温度参数滑块（0-2，默认 0.7）

---

## 6. NestJS API 设计

### 6.1 认证

```
POST /api/auth/login       # 登录，返回 JWT
POST /api/auth/register    # 注册
POST /api/auth/refresh     # 刷新 Token
GET  /api/auth/me          # 获取当前用户信息
```

### 6.2 健康检查

```
GET /health
```

### 6.3 LLM 问答

```
POST /chat
  body: {
    message: string,
    sessionId: string,
    knowledgeBaseIds?: string[],   // 支持多个知识库
    config: LLMConfig
  }
  response: SSE stream
```

### 6.4 会话

```
GET    /sessions              # 获取所有会话列表
GET    /sessions/:id          # 获取单个会话详情
POST   /sessions/:id/rename   # 重命名会话
DELETE /sessions/:id          # 删除会话
```

### 6.5 知识库

```
GET    /knowledge-bases              # 获取知识库列表
POST   /knowledge-bases              # 创建知识库
PATCH  /knowledge-bases/:id          # 更新知识库（重命名、置顶等）
DELETE /knowledge-bases/:id          # 删除知识库
```

### 6.6 文件夹（虚拟）

```
GET    /knowledge-bases/:id/folders              # 获取文件夹列表
POST   /knowledge-bases/:id/folders              # 创建文件夹
PATCH  /knowledge-bases/:id/folders/:folderId   # 重命名文件夹
DELETE /knowledge-bases/:id/folders/:folderId   # 删除文件夹
```

### 6.7 文档

```
GET    /knowledge-bases/:id/documents                    # 获取文档列表（支持 folderId 参数）
POST   /knowledge-bases/:id/documents                    # 上传文件 → MinIO
GET    /knowledge-bases/:id/documents/:docId             # 获取文档详情
GET    /knowledge-bases/:id/documents/:docId/download    # 下载文件
GET    /knowledge-bases/:id/documents/:docId/preview     # 预览文件
DELETE /knowledge-bases/:id/documents/:docId             # 删除文档
PATCH  /knowledge-bases/:id/documents/:docId             # 移动文档（修改 folderId）
```

### 6.8 索引（预留）

```
POST /knowledge-bases/:id/documents/:docId/reindex   # 重新索引
GET  /knowledge-bases/:id/index-status               # 获取索引状态
```

### 6.9 设置

```
GET  /settings     # 获取当前配置
POST /settings     # 保存配置
```

---

## 7. 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Tailwind CSS v4 + Pinia |
| 桌面 | Tauri v2 (Rust) |
| 后端 | NestJS 10 + Fastify |
| ORM | Prisma 5 |
| 数据库 | PostgreSQL 16 |
| 对象存储 | MinIO |
| 向量数据库 | PostgreSQL pgvector 扩展 |
| 缓存/队列 | Redis 7 + BullMQ |
| 认证 | JWT + bcrypt |
| 验证 | Zod + nestjs-zod |
| 测试 | Vitest + Playwright |
| 包管理 | pnpm |

---

## 8. 数据模型

### 8.1 PostgreSQL Schema（Prisma）

```typescript
// users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// knowledge_bases
export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  isPinned: boolean('is_pinned').default(false),
  sortOrder: integer('sort_order').default(0),
  icon: text('icon'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// folders（虚拟文件夹）
export const folders = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  kbId: uuid('kb_id').references(() => knowledgeBases.id),
  parentId: uuid('parent_id'), // 自引用，null = 根目录
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// documents
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  kbId: uuid('kb_id').references(() => knowledgeBases.id),
  folderId: uuid('folder_id').references(() => folders.id),
  name: text('name').notNull(),
  ext: text('ext'),
  mimeType: text('mime_type'),
  size: bigint('size', { mode: 'number' }),
  storageKey: text('storage_key').notNull(), // MinIO key
  hash: text('hash'),
  status: text('status').default('uploaded'), // uploaded | parsing | chunking | indexing | ready | failed
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// chunks
export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id),
  kbId: uuid('kb_id').references(() => knowledgeBases.id),
  content: text('content').notNull(),
  tokenCount: integer('token_count'),
  chunkIndex: integer('chunk_index').notNull(),
  milvusId: text('milvus_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// sessions
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  title: text('title').default('新对话'),
  provider: text('provider'),
  model: text('model'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  messageCount: integer('message_count').default(0),
});

// messages
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id),
  role: text('role').$type<'user' | 'assistant'>().notNull(),
  content: text('content').notNull(),
  knowledgeBaseIds: text('knowledge_base_ids').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

### 7.2 MinIO Storage Key 设计

```
users/<user-id>/kb/<kb-id>/<doc-id>_<filename>
```

示例：
```
users/550e8400-e29b-41d4-a716-446655440000/kb/7c9e6679-7425-40de-944b-e07fc1f90ae7/doc-123_报告.pdf
```

### 7.3 Milvus Collection 设计

**Collection**: `knowledge_chunks`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR | Milvus 主键 |
| chunk_id | VARCHAR | 关联 PostgreSQL chunks.id |
| kb_id | VARCHAR | 知识库 ID |
| file_id | VARCHAR | 文件 ID |
| embedding | FLOAT_VECTOR(1536) | 向量 |

### 7.4 配置模型

```json
{
  "providers": {
    "openai": { "apiKey": "", "model": "gpt-4o", "baseUrl": "" },
    "claude": { "apiKey": "", "model": "claude-3-5-sonnet-20241022", "baseUrl": "" },
    "deepseek": { "apiKey": "", "model": "deepseek-chat", "baseUrl": "" },
    "custom": { "apiKey": "", "model": "", "baseUrl": "" },
    "ollama": { "enabled": false, "url": "http://localhost:11434", "model": "" }
  },
  "embeddingProvider": { "provider": "openai", "apiKey": "", "model": "text-embedding-3-small", "baseUrl": "" },
  "temperature": 0.7,
  "defaultChatProvider": "openai"
}
```

---

## 8. RAG 流程（预留）

### 8.1 索引流程（异步流水线）

```
用户上传文件
    ↓
MinIO 存储
    ↓
PostgreSQL 创建记录（status = uploaded）
    ↓
BullMQ: parse job
    ↓
Worker: LangChain TextLoader 解析（status = parsing）
    ↓
Worker: RecursiveCharacterTextSplitter 分块（status = chunking）
    ↓
Worker: Embedding API 生成向量（status = indexing）
    ↓
Worker: Milvus 插入向量（status = ready）
```

失败时：status = `failed`，errorMessage 记录原因。

### 8.2 检索流程（混合搜索）

```
用户提问
    ↓
提取 knowledgeBaseIds（支持多个）
    ↓
Embedding API 生成 query 向量
    ↓
Milvus ANN Search（with kb_id filter）
    ↓
返回 chunk_ids
    ↓
PostgreSQL 查询 chunk 内容
    ↓
RRF 融合排序
    ↓
拼入 system prompt
    ↓
LLM 生成回答
```

---

## 9. 实现顺序

### Phase 1：基础设施（P0）

- [ ] Docker Compose 配置（PG + MinIO + Milvus + Redis）
- [ ] Drizzle ORM 配置 + 数据库迁移
- [ ] MinIO Client 封装
- [ ] Milvus Client 封装
- [ ] Redis + BullMQ 配置

### Phase 2：认证系统（P0）

- [ ] Better Auth 集成
- [ ] 登录/注册 API
- [ ] 前端登录/注册页面
- [ ] 路由守卫（未登录跳转）

### Phase 3：知识库与文件（P0）

- [ ] 知识库 CRUD（PostgreSQL）
- [ ] 虚拟文件夹 CRUD
- [ ] 文件上传 → MinIO
- [ ] 文件列表/删除/移动
- [ ] 文档状态机（status 字段）
- [ ] 异步流水线框架（BullMQ + Worker 占位）

### Phase 4：聊天功能（P0）

- [ ] 会话 CRUD（PostgreSQL）
- [ ] 消息存储
- [ ] SSE 流式对话
- [ ] 多知识库选择 UI
- [ ] RAG 预留接口（先返回空）

### Phase 5：RAG 集成（P1）

- [ ] SDK 实现：解析 → 分块 → 向量化
- [ ] Milvus 写入与检索
- [ ] 混合检索（向量 + 关键词）
- [ ] Rerank

### Phase 6：优化（P2）

- [ ] Presigned URL 上传
- [ ] 文件预览（PDF/图片/Markdown）
- [ ] 本地 SQLite 缓存层
- [ ] 离线模式支持

---

## 10. 本地 SQLite 缓存层（预留）

用途：
- 最近打开文件列表
- UI 状态（侧边栏展开、主题等）
- 离线时的草稿消息
- 本地 Agent Memory（后续）

---

*文档结束*
