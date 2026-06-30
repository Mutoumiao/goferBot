# 服务端配置管理指南

> 本文档定义 GoferBot 服务端配置的**分层管理原则**：哪些配置保留在环境变量，哪些配置迁移到**配置中心（数据库** **`Setting`** **表）**，以及如何在 UI 后台中区分管理。
>
> 目标：把“运行时可选、按用户/租户可变、需要 UI 热切换”的配置全部纳入数据库配置中心；仅把“影响服务启动、基础设施连接、全局安全策略”的配置保留在环境变量。

***

## 1. 分层原则

### 1.1 环境变量层（保留）

仅存放以下四类配置：

1. **服务启动依赖**：端口、运行模式、日志级别等。
2. **基础设施连接**：数据库、Redis、MinIO、Elasticsearch 等外部服务的地址与凭证。
3. **全局安全策略**：JWT 密钥、配置加密密钥、密码哈希轮数、SSRF 白名单、CORS 来源等。
4. **部署/实例级开关**：NODE\_ENV、队列并发数、重启生效的本地模型开关等。

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

## 2. 环境变量三层架构与文件职责

项目采用**三层环境变量架构**，以"单一信息源"为核心原则：每个变量只能在唯一的模板/实例文件中声明，避免多处维护导致的配置漂移。

### 2.1 三层分类标准

| 层级 | 变量分类 | 单一信息源（模板） | 单一信息源（实例） | 示例 |
|------|----------|--------------------|--------------------|------|
| **Layer 1: Docker-Infra** | 仅被 `docker-compose.dev.yml` 使用的基础设施配置 | 根目录 `.env.example` | 根目录 `.env` | `POSTGRES_PORT`, `MINIO_ROOT_USER`, `REDIS_PORT` |
| **Layer 2: Shared** | 被 server 应用和 docker-compose 共同使用的连接参数 | 根目录 `.env.example` | 根目录 `.env` | `DATABASE_URL`, `REDIS_HOST`, `MINIO_ENDPOINT` |
| **Layer 3: Server-Only** | 仅被 server 应用使用的配置 | `packages/server/.env.example` | `packages/server/.env` | `JWT_SECRET`, `PORT`, `CORS_ORIGIN` |
| **Frontend-Only** | 仅被前端 Vite 消费的变量 | `packages/web/.env.example` / `packages/admin/.env.example` | 各自的 `.env` | `VITE_API_BASE_URL` |

> **禁止** 在 `packages/server/.env` 中重复声明 Shared 变量（如 `DATABASE_URL`、`REDIS_HOST`、`MINIO_*`、`ELASTICSEARCH_*`），这些变量的唯一来源是根目录 `.env`。

### 2.2 文件职责

| 文件 | 职责 | 包含变量层级 | 是否必需 |
|------|------|-------------|----------|
| 根目录 `.env.example` | Docker-Infra + Shared 变量模板（唯一信息源） | Layer 1, 2 | ✅ 是（docker-compose 依赖） |
| 根目录 `.env` | 本地开发基础设施配置实例化 | Layer 1, 2 | ✅ 是 |
| `packages/server/.env.example` | Server-Only 变量模板（唯一信息源） | Layer 3 | ✅ 是 |
| `packages/server/.env` | 服务端应用配置实例化 | Layer 3 | ✅ 是 |
| `packages/web/.env.example` | 前端 Vite 专属配置 | Frontend-Only | ✅ 前端开发 |
| `packages/admin/.env.example` | 管理后台 Vite 专属配置 | Frontend-Only | ✅ 管理后台开发 |

### 2.3 加载顺序

服务端 `ConfigModule` 加载配置如下：

```ts
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: [
    resolve(__dirname, '../.env'),      // packages/server/.env (Server-Only)
    resolve(__dirname, '../../../.env'),  // 根目录 .env (Docker-Infra + Shared)
  ],
  validate: () => validateEnv(),
})
```

加载顺序为：

1. `packages/server/.env` — Server-Only 变量
2. 根目录 `.env` — Docker-Infra + Shared 变量

**后加载的文件会覆盖先加载文件中的同名变量。** 设计原则：

- **docker-compose 变量**必须留在根目录，因为 `docker-compose.dev.yml` 通过 `${VAR}` 语法从根目录 `.env` 读取。
- **Server-Only 变量**（JWT、安全策略、业务开关等）仅存放在 `packages/server/.env`，实现模块隔离。
- **Shared 变量**（连接参数）仅存放在根目录 `.env`，server 应用通过 ConfigModule 自动读取。
- 如需特殊覆盖，允许在 `packages/server/.env` 中定义同名变量临时覆盖根目录的值（例如本地端口调整），但模板层只保留单一信息源。

### 2.4 变量分类速查表

> 单一信息源原则：下列变量仅在指定位置声明一次。

| 变量 | 分类 | 单一信息源 |
|------|------|------------|
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker-Infra | 根目录 `.env` |
| `MINIO_PORT`, `MINIO_CONSOLE_PORT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | Docker-Infra | 根目录 `.env` |
| `REDIS_PORT` | Docker-Infra | 根目录 `.env` |
| `DATABASE_URL`, `TEST_DATABASE_ADMIN_URL` | Shared | 根目录 `.env` |
| `REDIS_HOST`, `REDIS_PASSWORD` | Shared | 根目录 `.env` |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_REGION` | Shared | 根目录 `.env` |
| `ELASTICSEARCH_NODE`, `ELASTICSEARCH_*`, `ELASTICSEARCH_INDEX` | Shared | 根目录 `.env` |
| `PORT`, `NODE_ENV`, `LOG_LEVEL` | Server-Only | `packages/server/.env` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Server-Only | `packages/server/.env` |
| `BCRYPT_SALT_ROUNDS`, `SETTINGS_ENCRYPTION_KEY` | Server-Only | `packages/server/.env` |
| `CORS_ORIGIN`, `SSRF_ALLOWED_HOSTNAMES` | Server-Only | `packages/server/.env` |
| `QUEUE_CONCURRENCY`, `METADATA_ALLOWED_KEYS`, `RERANK_EAGER_LOAD` | Server-Only | `packages/server/.env` |
| `VITE_API_BASE_URL` | Frontend-Only | `packages/web/.env` 或 `packages/admin/.env` |

***

## 3. 环境变量清单

> 环境变量分为两部分维护：**根目录 `.env.example`**（Docker-Infra + Shared）和 **`packages/server/.env.example`**（Server-Only）。

### 3.1 根目录 `.env` — Docker-Infra + Shared 变量

以下变量存放在根目录 `.env`，供 `docker-compose.dev.yml` 和 server 应用共用：

#### PostgreSQL 基础设施

```bash
# PostgreSQL 服务主机地址
POSTGRES_HOST=localhost

# PostgreSQL 服务端口
POSTGRES_PORT=5432

# PostgreSQL 初始化用户名
POSTGRES_USER=gofer

# PostgreSQL 初始化密码
POSTGRES_PASSWORD=gofer_dev_pass

# PostgreSQL 初始化数据库名
POSTGRES_DB=goferbot
```

#### PostgreSQL 应用连接

```bash
# PostgreSQL 连接串，Prisma 与 pgvector 共用
# 格式：postgresql://用户名:密码@主机:端口/数据库名
# 开发环境使用 127.0.0.1，避免 Windows 上 Prisma engine 对 localhost 的 IPv6 解析问题
DATABASE_URL=postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot

# 测试数据库管理连接串，用于创建/删除测试数据库，需要超级用户权限
TEST_DATABASE_ADMIN_URL=postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/postgres
```

#### Redis 基础设施 + 应用

```bash
# Redis 服务主机地址
REDIS_HOST=localhost

# Redis 端口
REDIS_PORT=6379

# Redis 密码，无密码时留空
REDIS_PASSWORD=
```

#### MinIO 基础设施 + 应用

```bash
# MinIO 服务端点，S3 兼容
MINIO_ENDPOINT=http://localhost:9000

# MinIO Access Key
MINIO_ACCESS_KEY=minioadmin

# MinIO Secret Key
MINIO_SECRET_KEY=minioadmin

# MinIO 默认桶名，用于存储用户上传的文档
MINIO_BUCKET=goferbot-files

# MinIO 区域
MINIO_REGION=us-east-1

# MinIO 服务端口（docker-compose 使用）
MINIO_PORT=9000

# MinIO 控制台端口（docker-compose 使用）
MINIO_CONSOLE_PORT=9001

# MinIO 根账号（docker-compose 初始化）
MINIO_ROOT_USER=minioadmin

# MinIO 根密码（docker-compose 初始化）
MINIO_ROOT_PASSWORD=minioadmin
```

#### Elasticsearch 基础设施 + 应用

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

### 3.2 `packages/server/.env` — Server-Only 变量

以下变量仅被 server 应用使用，存放在 `packages/server/.env`。Shared 变量（`DATABASE_URL` / `REDIS_HOST` / `MINIO_*` / `ELASTICSEARCH_*` 等）的唯一信息源是根目录 `.env`，此处**不得**重复声明。

#### 服务基础配置

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

#### JWT 与认证安全

```bash
# JWT 访问令牌密钥，用于签名 access token
# 生产环境必须修改，建议执行：openssl rand -base64 32
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
```

#### CORS 与安全策略

```bash
# 前端应用地址，用于 CORS 白名单
# 多个来源用逗号分隔
CORS_ORIGIN=http://localhost:5173

# SSRF 防护允许的主机名白名单
# 限制用户可配置的 Base URL 只能指向这些主机，防止内网探测
# 多个值用逗号分隔，例如：api.openai.com,api.deepseek.com
SSRF_ALLOWED_HOSTNAMES=
```

#### 队列与业务开关

```bash
# BullMQ 任务并发数，控制同时执行的后台任务数量
QUEUE_CONCURRENCY=2

# RAG 元数据过滤器白名单
# 限制用户传入的 metadata 键名，防止 NoSQL 注入
# 当前允许：year, status, type, category, source, language, author, priority, department, project, tags, version
METADATA_ALLOWED_KEYS=year,status,type,category,source,language,author,priority,department,project,tags,version

# 本地 Reranker 模型是否在启动时预加载
# true 时启动会变慢，但首次请求延迟更低
RERANK_EAGER_LOAD=false
```

#### 待清理变量

```bash
# RSA 密钥对（当前未启用，预留未来扩展）
RSA_PRIVATE_KEY=
RSA_PUBLIC_KEY=
```

### 3.3 前端 Vite 专属变量

以下变量用于前端应用，分别存放在各前端包的 `.env` 文件中：

```bash
# packages/web/.env
VITE_API_BASE_URL=http://localhost:3000/api

# packages/admin/.env
VITE_API_BASE_URL=http://localhost:3000/api
```

***

## 4. 配置中心架构

### 4.1 模型提供商池（`system_config.providers`）

模型提供商是**全局资源**，统一存储在 `key = system_config` 的 provider 池中，仅由 **ADMIN** 管理。

单个 provider 字段：

| 字段           | 类型      | 说明                                                   |
| ------------ | ------- | ---------------------------------------------------- |
| `id`         | string  | 唯一标识，如 `openai-gpt4o`                                |
| `name`       | string  | 展示名                                                  |
| `type`       | enum    | `llm` / `embedding` / `reranker` / `document-parser` |
| `enabled`    | boolean | 是否启用                                                 |
| `model`      | string  | 模型名或 HuggingFace ID                                  |
| `apiKey`     | string  | API 密钥（加密存储）                                         |
| `baseUrl`    | string  | 接口地址，空字符串表示使用默认地址                                    |
| `timeoutMs`  | number  | 超时毫秒数                                                |
| `dimensions` | number? | `embedding` 专用，向量维度                                  |
| `maxLength`  | number? | `reranker` 专用，最大输入长度                                 |

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

| 分类           | 配置字段                                                                                          | 说明                     |
| ------------ | --------------------------------------------------------------------------------------------- | ---------------------- |
| `chat`       | `defaultProvider`, `enabledProviders`, `temperature`                                          | Chat 默认/启用 provider、温度 |
| `rag`        | `llmProvider`, `embeddingProvider`, `rerankerProvider`, `timeoutMs`                           | RAG 各阶段模型选择            |
| `companion`  | `provider`                                                                                    | AI 伴侣模型选择              |
| `indexing`   | `contextualEmbedding`, `contextualWindow`, `parentChunkSize`, `childChunkSize`, `synonymDict` | 索引切分与同义词策略             |
| `appearance` | `mode`, `fontSizeLevel`                                                                       | 外观与字体                  |

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

| 变量                         | 迁移目标                                                                         |
| -------------------------- | ---------------------------------------------------------------------------- |
| `DEEPSEEK_API_KEY`         | `system_config.providers.{id}.apiKey`                                        |
| `DEEPSEEK_BASE_URL`        | `system_config.providers.{id}.baseUrl`                                       |
| `LLM_API_KEY`              | `system_config.providers.{id}.apiKey`                                        |
| `LLM_MODEL`                | `system_config.providers.{id}.model`                                         |
| `LLM_BASE_URL`             | `system_config.providers.{id}.baseUrl`                                       |
| `LLM_TIMEOUT_MS`           | `system_config.providers.{id}.timeoutMs`                                     |
| `RAG_LLM_API_KEY`          | `system_config.providers.{rag.llmProvider}.apiKey`                           |
| `RAG_LLM_MODEL`            | `system_config.providers.{rag.llmProvider}.model`                            |
| `RAG_LLM_BASE_URL`         | `system_config.providers.{rag.llmProvider}.baseUrl`                          |
| `RAG_LLM_TIMEOUT_MS`       | `system_config.providers.{rag.llmProvider}.timeoutMs`                        |
| `EMBEDDING_API_KEY`        | `system_config.providers.{rag.embeddingProvider}.apiKey`                     |
| `EMBEDDING_MODEL`          | `system_config.providers.{rag.embeddingProvider}.model`                      |
| `EMBEDDING_BASE_URL`       | `system_config.providers.{rag.embeddingProvider}.baseUrl`                    |
| `EMBEDDING_DIMENSIONS`     | `system_config.providers.{rag.embeddingProvider}.dimensions`                 |
| `RERANK_MODEL`             | `system_config.providers.{rag.rerankerProvider}.model`                       |
| `RERANK_MAX_LENGTH`        | `system_config.providers.{rag.rerankerProvider}.maxLength`                   |
| `RAG_CONTEXTUAL_EMBEDDING` | `system_config.indexing.contextualEmbedding`                                 |
| `RAG_CONTEXTUAL_WINDOW`    | `system_config.indexing.contextualWindow`                                    |
| `RAG_PARENT_CHUNK_SIZE`    | `system_config.indexing.parentChunkSize`                                     |
| `RAG_CHILD_CHUNK_SIZE`     | `system_config.indexing.childChunkSize`                                      |
| `RAG_SYNONYM_DICT`         | `system_config.indexing.synonymDict`                                         |
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

