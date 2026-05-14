# 知识库应用 PRD v1

## 1. 项目概述

基于 Tauri v2 + Vue 3 + Hono Sidecar 的本地知识库桌面应用。用户可导入文档进行管理，通过 LLM 进行问答，支持 RAG 检索增强。

## 2. 架构设计

### 2.1 分层架构

| 层 | 职责 | 技术 |
|---|---|---|
| Tauri Rust | 桌面壳：窗口管理、启动/监控 sidecar、提供 appData 路径 | Rust |
| Hono Sidecar | 全部业务逻辑：LLM 问答、RAG、LangChain、文件 I/O、SQLite | TS + Hono |
| 前端 Vue | UI 渲染、状态管理、HTTP 调用 sidecar | Vue 3 + Pinia |

### 2.2 数据目录

应用通过 Tauri 获取系统用户目录，创建 `knowledge-base/` 子目录：

```
knowledge-base/
  docs/                  # 知识库文档（按知识库分子目录）
  .trash/                # 回收站（被删除的知识库物理移动至此）
  config.json            # 用户配置
  sidecar.db             # SQLite（会话、消息、知识库、文档块、向量索引、全文索引）
  .sidecar-port          # sidecar 实际监听端口
```

## 3. 全局布局

### 3.1 框架尺寸

- 左侧边栏：64px 固定宽度，全局始终显示
- 顶部标签栏：38px 固定高度
- 内部区域：剩余空间

### 3.2 左侧边栏（64px）

上区（常用）：
- 消息图标 → 打开/切换到问答首页（若无问答标签则新建首页）
- 文件夹图标 → 打开/切换到知识库管理

下区（低频）：
- 时钟图标 → 打开/切换到对话历史
- 齿轮图标 → 打开/切换到设置

### 3.3 顶部标签栏（38px）

- 动态多标签，浏览器式横向滚动
- 标签类型：
  - 问答会话：可多开，默认名"首页"
  - 知识库管理：单例
  - 设置：单例
  - 对话历史：单例
- "首页"标签始终保留，无法关闭
- 最右侧 `+` 按钮新建问答会话
- 点击已打开页面的图标则切换到对应标签

## 4. 页面设计

### 4.1 问答对话页

#### 空会话态（默认首页）

- 中间区域：大输入框 + 发送按钮
- 输入框下方：3-4 个快捷提问示例胶囊按钮
- 顶部：会话标题（可编辑，默认为"首页"）、模型切换下拉

#### 对话态

- 底部：固定输入框（多行文本，支持 Enter 发送，Shift+Enter 换行，支持 `@知识库名称` 提及触发 RAG）
- 上部：可滚动消息流
  - 用户消息：靠右，浅色背景
  - AI 消息：靠左，白色背景
  - 支持 Markdown 渲染
  - 代码块：语法高亮 + 复制按钮
- 顶部：会话标题（可编辑）、模型切换下拉

### 4.2 知识库管理页

- 左侧：一级知识库列表
  - 每项：图标 + 知识库名称
  - 支持新建知识库（输入名称，创建空目录）
- 右侧：资源管理器式图标视图
  - 显示当前知识库内的文件和文件夹
  - 双击文件夹进入下一级
  - 面包屑导航显示当前路径
- 顶部工具栏：
  - 面包屑导航
  - 搜索框（按文件名搜索）
  - 排序下拉（名称/日期/类型）
  - 添加文件按钮（打开文件选择对话框）
- 空状态：提示"点击添加文件导入文档"

### 4.3 对话历史页

- Tabs：默认"问答历史"（预留扩展）
- 列表项：
  - 对话总结标题
  - 最后消息时间
  - 少许内容摘要
- 操作：点击恢复续上对话、删除、重命名

### 4.4 设置页

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

## 5. Sidecar API 设计（Hono）

### 5.1 端口与发现

- 默认端口：11451
- 若冲突则递增，写入 `knowledge-base/.sidecar-port`
- Tauri 在 `tauri.conf.json` 中允许 `http://localhost:*`

### 5.2 API 路由

```
GET  /health                    # 健康检查

# LLM 问答
POST /chat                      # 流式对话
  body: { message: string, sessionId: string, knowledgeBaseIds?: string[], config: LLMConfig }
  response: SSE stream

GET  /sessions                  # 获取所有会话列表
GET  /sessions/:id              # 获取单个会话详情
POST /sessions/:id/rename       # 重命名会话
DELETE /sessions/:id            # 删除会话

# 知识库
GET  /knowledge-bases           # 获取知识库列表
POST /knowledge-bases           # 创建知识库
DELETE /knowledge-bases/:id     # 删除知识库

GET  /knowledge-bases/:id/files # 获取知识库文件列表（支持 path 参数指定子目录）
POST /knowledge-bases/:id/files # 导入文件
DELETE /knowledge-bases/:id/files/:path  # 删除文件

POST /knowledge-bases/:id/index # 触发索引/重建索引
GET  /knowledge-bases/:id/index-status   # 获取索引状态

# 设置
GET  /settings                  # 获取当前配置
POST /settings                  # 保存配置
```

## 6. 数据模型

### 6.1 SQLite Schema

```sql
-- 会话表
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  provider TEXT,              -- 当前会话使用的 LLM 提供商
  model TEXT,                 -- 当前会话使用的模型
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  message_count INTEGER DEFAULT 0
);

-- 消息表
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  knowledge_base_ids TEXT,    -- JSON 数组，记录本条消息检索的知识库 ID 列表
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- 知识库表
CREATE TABLE knowledge_bases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 文档块表（原始数据）
CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,
  knowledge_base_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB,  -- 原始向量数据（备份）
  chunk_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id)
);

-- 向量索引虚拟表（sqlite-vec HNSW）
CREATE VIRTUAL TABLE vec_document_chunks USING vec0(
  chunk_id TEXT PRIMARY KEY,
  embedding FLOAT[1536]  -- 维度根据 Embedding 模型调整
);

-- 全文索引虚拟表（FTS5）
CREATE VIRTUAL TABLE fts_document_chunks USING fts5(
  content,
  file_path,
  content='document_chunks',
  content_rowid='id'
);
```

### 6.2 配置模型（config.json）

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

## 7. RAG 流程（LangChain）

### 7.1 索引流程

1. 用户导入文件到知识库目录
2. Sidecar 监听文件变化（或前端触发 `/index`）
3. LangChain `TextLoader` 读取文档
4. `RecursiveCharacterTextSplitter` 分块（chunkSize=500, overlap=50）
5. 调用 Embedding API 获取向量
6. 存入 SQLite `document_chunks` 表（BLOB）
7. 同步写入 `sqlite-vec` 的 `vec0` 虚拟表（HNSW 向量索引）
8. 同步写入 FTS5 全文索引表（`content` + `file_path`）

### 7.2 检索流程（混合搜索）

1. 用户提问，消息中 `@提及` 目标知识库
2. Sidecar 提取 `knowledgeBaseIds`，对 query 调用 Embedding API
3. **向量搜索**：通过 `sqlite-vec` 的 `vec_distance_cosine` 在指定知识库内获取语义相似 Top-K（如 5）
4. **全文搜索**：通过 FTS5 对 query 做关键词匹配，获取命中 Top-K（如 5）
5. **融合排序**：使用 RRF（Reciprocal Rank Fusion）合并两种搜索结果，去重后取最终 Top-K
6. Top-K 文档块拼入 system prompt
7. 调用 LLM 生成回答

## 8. 实现顺序

### Phase 1：基础框架
1. 创建 `packages/server/` 目录，搭建 Hono 服务
2. Tauri Rust 配置 sidecar 启动与监控
3. 前端布局：左侧边栏 + 顶部标签栏 + 内部区域
4. 标签栏：新建、切换、关闭、首页固定

### Phase 2：问答对话
1. 空会话态（中间输入框 + 快捷按钮）
2. 对话态（消息流、底部输入框）
3. Markdown 渲染 + 代码高亮
4. Pinia 状态管理（会话、消息）
5. Sidecar chat API（先直连 LLM，不做 RAG）

### Phase 3：知识库管理
1. 知识库 CRUD API
2. 知识库列表页
3. 文件资源管理器视图
4. 文件导入（选择对话框）
5. 面包屑导航

### Phase 4：RAG 与设置
1. LangChain 集成（分块、Embedding）
2. 向量存储与检索
3. 设置页面（LLM、Embedding、温度）
4. 知识库检索开关对接
5. 对话历史页面

### Phase 5：收尾
1. 本地模型（Ollama）支持
2. 错误处理与 Loading 状态
3. 空状态与引导
4. 测试覆盖
