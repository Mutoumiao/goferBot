# 服务端配置管理指南

> 本文档定义 GoferBot 服务端配置的**分层管理原则**：哪些配置保留在环境变量，哪些配置迁移到**配置中心（数据库 `Setting` 表）**，以及如何在 UI 后台中区分管理。
>
> 目标：把“运行时可选、按用户/租户可变、需要 UI 热切换”的配置全部纳入数据库配置中心；仅把“影响服务启动、基础设施连接、全局安全策略”的配置保留在环境变量。

***

## 1. 分层原则

### 1.1 环境变量层（保留）

仅存放以下四类配置：

1. **服务启动依赖**：端口、运行模式、日志级别等。
2. **基础设施连接**：数据库、Redis、MinIO、Elasticsearch 等外部服务的地址与凭证。
3. **全局安全策略**：JWT 密钥、配置加密密钥、密码哈希轮数、SSRF 白名单、CORS 来源等。
4. **部署/实例级开关**：NODE_ENV、队列并发数、重启生效的本地模型开关等。

特点：

- 修改后通常需要重启服务才能生效。
- 不适合在 UI 后台频繁变更。
- 涉及系统级安全边界，不应通过普通配置接口暴露。

### 1.2 配置中心层（数据库）

存放在 PostgreSQL 的 `Setting` 表中，通过 `SettingsService` / `SystemConfigService` 读写，支持：

- UI 后台管理。
- 按用户隔离（`userId` 维度）。
- 运行时读取，无需重启（provider 变更后可通过 `/admin/system-config/reload` 触发消费者重载）。
- 敏感字段由 `SETTINGS_ENCRYPTION_KEY` 加密存储。

适合存放：

- 大模型 Provider 的 API Key、模型名、Base URL、类型、超时等。
- Embedding / Reranker / Document Parser 模型配置。
- Chat / RAG / Companion 等模块对 provider 的选择。
- RAG 切分策略、同义词字典等业务调参。

***

## 2. 环境变量文件职责与加载顺序

项目采用**统一根目录模板 + 包级覆盖**的环境变量管理策略：

| 文件                             | 职责                                      | 是否必需     |
| ------------------------------ | --------------------------------------- | -------- |
| 根目录 `.env.example`             | 唯一的完整环境变量模板，包含基础设施、安全策略、服务端应用配置 | ✅ 是      |
| 根目录 `.env`                     | 本地开发/部署时的实际配置文件，由 `.env.example` 复制而来   | ✅ 是      |
| `packages/server/.env.example` | 服务端独立覆盖说明文件，通常无需填写                      | ❌ 否      |
| `packages/server/.env`         | 服务端独立覆盖值，根目录 `.env` 会覆盖其中同名变量           | 按需       |
| `packages/web/.env.example`    | 前端 Vite 专属配置                            | ✅ 前端开发   |
| `packages/admin/.env.example`  | 管理后台 Vite 专属配置                          | ✅ 管理后台开发 |

### 加载顺序

服务端 `ConfigModule` 配置如下：

```ts
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: ['.env', '../.env'],
})
```

加载顺序为：

1. `packages/server/.env`
2. 根目录 `.env`

**后加载的文件会覆盖先加载文件中的同名变量。** 因此：

- 通用配置统一放在**根目录** **`.env`**。
- 只有在服务端需要特殊覆盖时，才在 `packages/server/.env` 中添加同名变量。
- `packages/server/.env.example` 不再重复列出所有变量，仅保留职责说明。

***

## 3. 环境变量清单

> 以下变量统一维护在**根目录** **`.env.example`** 中，并按类别分组。每个变量右侧都附带用途说明，便于运维与开发者理解。

### 3.1 服务基础

```bash
# 服务端口号，Fastify 监听端口
PORT=3000

# 运行环境：development / production / test
# 影响：CORS 策略、安全头、错误详情返回、Swagger 文档开关
NODE_ENV=development

# 日志级别：debug / info / warn / error
# 生产环境建议设为 info 或 warn
LOG_LEVEL=debug
```

### 3.2 数据库

```bash
# PostgreSQL 连接串，Prisma 与 pgvector 共用
# 格式：postgresql://用户名:密码@主机:端口/数据库名
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/goferbot

# 测试数据库管理连接串，用于创建/删除测试数据库，需要超级用户权限
TEST_DATABASE_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

### 3.3 缓存与队列

```bash
# Redis 主机地址，用于会话、队列、缓存
REDIS_HOST=localhost

# Redis 端口
REDIS_PORT=6379

# Redis 密码，无密码时留空
REDIS_PASSWORD=

# BullMQ 任务并发数，控制同时执行的后台任务数量
QUEUE_CONCURRENCY=2
```

### 3.4 对象存储

```bash
# MinIO 服务端点，S3 兼容
MINIO_ENDPOINT=http://localhost:9000

# MinIO Access Key
MINIO_ACCESS_KEY=minioadmin

# MinIO Secret Key
MINIO_SECRET_KEY=minioadmin

# MinIO 默认桶名，用于存储用户上传的文档
MINIO_BUCKET=goferbot-files

# MinIO 控制台端口（Docker Compose 使用）
MINIO_CONSOLE_PORT=9001
```

### 3.5 认证与安全

```bash
# JWT 访问令牌密钥，用于签名 access token
# 生产环境必须修改，建议使用 openssl rand -base64 32 生成
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# JWT 刷新令牌密钥，用于签名 refresh token
# 必须与 JWT_SECRET 不同
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# JWT 访问令牌有效期
JWT_EXPIRES_IN=15m

# JWT 刷新令牌有效期
JWT_REFRESH_EXPIRES_IN=7d

# 配置加密密钥，用于加密数据库中存储的 API Key 等敏感配置
# 强烈建议单独设置，不要复用 JWT_SECRET
# 生成方式：openssl rand -base64 32
SETTINGS_ENCRYPTION_KEY=

# bcrypt 密码哈希轮数，数值越大越安全但越慢
# 开发环境 10-12，生产环境 12-14
BCRYPT_SALT_ROUNDS=12

# SSRF 防护允许的主机名白名单
# 限制用户可配置的 Base URL 只能指向这些主机，防止内网探测
# 多个值用逗号分隔，例如：api.openai.com,api.deepseek.com
SSRF_ALLOWED_HOSTNAMES=
```

### 3.6 CORS 与网络

```bash
# 前端应用地址，用于 CORS 白名单
# 多个来源用逗号分隔
CORS_ORIGIN=http://localhost:5173
```

### 3.7 搜索引擎基础设施

```bash
# Elasticsearch 节点地址
ELASTICSEARCH_NODE=http://localhost:9200

# Elasticsearch API Key（优先使用）
ELASTICSEARCH_API_KEY=

# Elasticsearch 用户名/密码（未使用 API Key 时生效）
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=

# Elasticsearch 索引名，用于存储文档分片
ELASTICSEARCH_INDEX=knowledge_chunks
```

### 3.8 元数据安全策略

```bash
# RAG 元数据过滤器白名单
# 限制用户传入的 metadata 键名，防止 NoSQL 注入
# 当前允许：year, status, type, category, source, language, author, priority, department, project, tags, version
METADATA_ALLOWED_KEYS=year,status,type,category,source,language,author,priority,department,project,tags,version
```

### 3.9 实例级行为开关

```bash
# 本地 Reranker 模型是否在启动时预加载
# true 时启动会变慢，但首次请求延迟更低
RERANK_EAGER_LOAD=false
```

***

## 4. 配置中心架构

### 4.1 模型提供商池（`system_config.providers`）

模型提供商是**全局资源**，统一存储在 `key = system_config` 的 provider 池中，仅由 **ADMIN** 管理。

单个 provider 字段：

| 字段          | 类型     | 说明                                              |
| ------------- | -------- | ------------------------------------------------- |
| `id`          | string   | 唯一标识，如 `openai-gpt4o`                       |
| `name`        | string   | 展示名                                            |
| `type`        | enum     | `llm` / `embedding` / `reranker` / `document-parser` |
| `enabled`     | boolean  | 是否启用                                          |
| `model`       | string   | 模型名或 HuggingFace ID                           |
| `apiKey`      | string   | API 密钥（加密存储）                              |
| `baseUrl`     | string   | 接口地址，空字符串表示使用默认地址                |
| `timeoutMs`   | number   | 超时毫秒数                                        |
| `dimensions`  | number?  | `embedding` 专用，向量维度                        |
| `maxLength`   | number?  | `reranker` 专用，最大输入长度                     |

管理接口（ADMIN）：

- `GET /admin/providers`
- `GET /admin/providers/:id`
- `POST /admin/providers`
- `DELETE /admin/providers/:id`

只读接口（普通用户）按模块返回已勾选且已启用的 provider 列表：

- `GET /settings/chat/providers` — Chat 可用 LLM 列表
- `GET /settings/rag/providers` — RAG 可用 LLM 列表
- `GET /settings/companion/providers` — Companion 可用 LLM 列表

返回结构预留 `builtIn` 与 `custom` 数组，当前 `custom` 固定为空数组：

```json
{
  "builtIn": [
    { "id": "qwen", "name": "Qwen", "type": "llm", "model": "qwen-turbo", ... }
  ],
  "custom": []
}
```

### 4.2 模块分类配置

模块配置只保存“选择哪些 provider”以及业务调参，不保存 API Key / model / baseUrl。

| 分类        | 配置字段                                                                 | 说明                          |
| ----------- | ------------------------------------------------------------------------ | ----------------------------- |
| `chat`      | `defaultProvider`, `enabledProviders`, `temperature`                     | Chat 默认/启用 provider、温度 |
| `rag`       | `llmProvider`, `embeddingProvider`, `rerankerProvider`, `timeoutMs`      | RAG 各阶段模型选择            |
| `companion` | `provider`                                                               | AI 伴侣模型选择               |
| `indexing`  | `contextualEmbedding`, `contextualWindow`, `parentChunkSize`, `childChunkSize`, `synonymDict` | 索引切分与同义词策略 |
| `appearance`| `mode`, `fontSizeLevel`                                                  | 外观与字体                    |

用户只读端点：

- `GET /settings/:category`

用户可写端点（仅限 `appearance`）：

- `POST /settings/appearance`

`chat` / `rag` / `companion` / `indexing` 由 admin 后台统一配置，用户端只读。

ADMIN 系统默认端点：

- `GET /admin/system-config/:category`
- `POST /admin/system-config/:category`

重载端点：

- `POST /admin/system-config/reload`

### 4.3 API Key 掩码与编辑约定

所有返回配置对象的接口对 `apiKey` 统一掩码为 `MASKED:...`。ADMIN 编辑 provider 时：

- 若不需要修改 API Key，前端将收到的 `MASKED:...` 原样回传，后端会保留旧值。
- 若需要修改，直接传入新值即可。

禁止在 response 中返回完整明文 `apiKey`。

### 4.4 级联与引用校验

`SettingsService.getMergedConfig(userId)` 的合并顺序：

1. 非模型字段兜底（`indexing`、`appearance`）。
2. 系统配置 `system_config` 覆盖（含 `providers` 与系统模块配置）。
3. 用户配置 `app_config` 覆盖（忽略 `providers`，当前 `providers` 字段仅做自定义模型预留）。
4. 校验 `chat` / `rag` / `companion` 中引用的 provider 是否存在、类型匹配且已启用。

删除 provider 前，`SystemConfigService.deleteProvider` 会检查是否仍被系统或用户配置引用，若存在引用则抛出 `PROVIDER_IN_USE` 错误。

***

## 5. 迁移路线图

### 第一期：补齐环境变量与文档（已完成）

- [x] 统一 `packages/server/.env.example` 与根目录 `.env.example`：根目录为完整模板，服务端仅保留覆盖说明。
- [x] 补齐所有缺失的基础设施/安全类环境变量。
- [x] 发布本文档，明确环境变量与配置中心的边界、文件职责与加载顺序。

### 第二期：配置中心后端改造（已完成）

- [x] 重写 `settings.dto.ts`，建立 provider-pool-centric schema。
- [x] 新增 `ModelProviderService`，集中管理 provider 查找、类型过滤、引用校验。
- [x] 重写 `SettingsService` 级联合并与引用校验。
- [x] 新增 `SystemConfigService` / `SystemConfigController`，提供 ADMIN provider CRUD 与分类配置接口。
- [x] Chat / Companion / RAG / Embedding / Reranker 全部从 provider 池解析模型凭证。

### 第三期：前端适配（已完成）

- [x] 更新前端 Settings 类型与 API，支持 provider 池与分类配置。
- [x] 在 `packages/admin/` 实现模型提供商管理页与模块配置页。
- [x] `packages/web` 只读消费可用模型列表，用于 chat / rag / companion 会话页模型选择。
- [x] `packages/web` 设置页保留 `appearance` 等用户偏好与本地自定义模型入口（自定义模型持久化后续扩展）。

### 第四期：环境变量清理（已完成）

- [x] 从 `.env.example` 与 `packages/server/.env.example` 中移除已迁移的模型环境变量。
- [x] 更新本文档为 provider-pool 架构。

***

## 6. 已移除的环境变量

以下变量已迁移到数据库配置中心，不再出现在 `.env.example` 中：

| 变量                         | 迁移目标                                               |
| -------------------------- | -------------------------------------------------- |
| `DEEPSEEK_API_KEY`         | `system_config.providers.{id}.apiKey`              |
| `DEEPSEEK_BASE_URL`        | `system_config.providers.{id}.baseUrl`             |
| `LLM_API_KEY`              | `system_config.providers.{id}.apiKey`              |
| `LLM_MODEL`                | `system_config.providers.{id}.model`               |
| `LLM_BASE_URL`             | `system_config.providers.{id}.baseUrl`             |
| `LLM_TIMEOUT_MS`           | `system_config.providers.{id}.timeoutMs`           |
| `RAG_LLM_API_KEY`          | `system_config.providers.{rag.llmProvider}.apiKey` |
| `RAG_LLM_MODEL`            | `system_config.providers.{rag.llmProvider}.model`  |
| `RAG_LLM_BASE_URL`         | `system_config.providers.{rag.llmProvider}.baseUrl`|
| `RAG_LLM_TIMEOUT_MS`       | `system_config.providers.{rag.llmProvider}.timeoutMs` |
| `EMBEDDING_API_KEY`        | `system_config.providers.{rag.embeddingProvider}.apiKey` |
| `EMBEDDING_MODEL`          | `system_config.providers.{rag.embeddingProvider}.model` |
| `EMBEDDING_BASE_URL`       | `system_config.providers.{rag.embeddingProvider}.baseUrl` |
| `EMBEDDING_DIMENSIONS`     | `system_config.providers.{rag.embeddingProvider}.dimensions` |
| `RERANK_MODEL`             | `system_config.providers.{rag.rerankerProvider}.model` |
| `RERANK_MAX_LENGTH`        | `system_config.providers.{rag.rerankerProvider}.maxLength` |
| `RAG_CONTEXTUAL_EMBEDDING` | `system_config.indexing.contextualEmbedding`       |
| `RAG_CONTEXTUAL_WINDOW`    | `system_config.indexing.contextualWindow`          |
| `RAG_PARENT_CHUNK_SIZE`    | `system_config.indexing.parentChunkSize`           |
| `RAG_CHILD_CHUNK_SIZE`     | `system_config.indexing.childChunkSize`            |
| `RAG_SYNONYM_DICT`         | `system_config.indexing.synonymDict`               |
| `ENABLED_PROVIDERS`        | `system_config.chat.defaultProvider` / `system_config.chat.enabledProviders` |

***

## 7. 环境变量与配置中心对比速查

| 维度     | 环境变量           | 配置中心（数据库）                      |
| ------ | -------------- | ------------------------------ |
| 修改方式   | 修改文件 + 重启      | UI 后台 / API，热生效                |
| 按用户隔离  | 不支持            | 支持（`userId` 维度）                |
| 敏感信息加密 | 依赖部署环境         | 由 `SETTINGS_ENCRYPTION_KEY` 加密 |
| 适合场景   | 基础设施、安全策略、启动依赖 | LLM 模型、API Key、业务调参            |
| 审计与版本  | 依赖外部工具         | 可扩展审计日志与版本历史                   |

***

## 8. 相关代码入口

- 配置中心服务：`packages/server/src/modules/settings/settings.service.ts`
- 系统配置服务：`packages/server/src/modules/settings/system-config.service.ts`
- Provider 解析服务：`packages/server/src/modules/settings/model-provider.service.ts`
- 配置 DTO：`packages/server/src/modules/settings/dto/settings.dto.ts`
- 配置加密：`packages/server/src/modules/settings/config-crypto.service.ts`
- 配置表模型：`packages/server/prisma/schema.prisma` → `Setting`
- 前端设置 API：`packages/web/src/api/settings.ts`
- 前端 chat 模型列表 API：`packages/web/src/api/chat.ts`
- 前端设置 Store：`packages/web/src/stores/settings.ts`
- 前端设置页：`packages/web/src/routes/_authenticated/settings.tsx`
- 前端 chat 模型选择器：`packages/web/src/features/chat/components/ProviderSelector.tsx`
- 管理后台 API：`packages/admin/src/api/system-config.ts`
- 管理后台模型提供商页：`packages/admin/src/features/model-providers/components/ProviderList.tsx`
- 管理后台模块配置页：`packages/admin/src/features/module-settings/components/ModuleSettingsLayout.tsx`
