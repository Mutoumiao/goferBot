# @goferbot/server

GoferBot 后端 API 服务，基于 NestJS 10 + Fastify 构建。

## 技术栈

- **框架**: NestJS 10 + Fastify
- **数据库**: PostgreSQL 16 + Prisma 5 + pgvector
- **对象存储**: MinIO
- **缓存/队列**: Redis 7 + BullMQ
- **认证**: JWT (passport-jwt) + bcrypt
- **文档**: Swagger / OpenAPI (nestjs-zod)
- **测试**: Vitest

## 目录结构

```
src/
├── main.ts                          # 应用入口
├── app.module.ts                    # 根模块
├── bootstrap.ts                     # Fastify 插件注册（Helmet、CORS、Multipart 等）
│
├── auth/                            # 认证模块
│   ├── auth.module.ts               #   AuthModule（JWT、Passport、UserModule 聚合）
│   ├── auth.controller.ts           #   注册 / 登录 / 刷新令牌 / 登出 / 获取当前用户
│   ├── auth.service.ts              #   令牌生成与刷新逻辑
│   ├── dto/
│   │   ├── login.dto.ts             #     LoginDto（Zod）
│   │   └── register.dto.ts          #     RegisterDto（Zod）
│   ├── guards/
│   │   ├── jwt.guard.ts             #     JwtAuthGuard（基于 passport-jwt）
│   │   └── roles.guard.ts           #     RolesGuard（基于 @Roles 装饰器）
│   ├── decorators/
│   │   ├── current-user.decorator.ts#     @CurrentUser() 提取当前登录用户
│   │   └── roles.decorator.ts       #     @Roles() 标记所需角色
│   ├── strategies/
│   │   └── jwt.strategy.ts          #     JWT 验证策略（验证 access token）
│   ├── crypto/
│   │   └── password-encryption.service.ts # RSA-OAEP 密码前端解密服务
│   └── enums/
│       └── role.enum.ts             #     Role.USER / Role.ADMIN
│
├── modules/                         # 业务模块（按领域划分）
│   ├── health/                      #   健康检查
│   │   ├── health.module.ts
│   │   └── health.controller.ts     #     GET /health
│   ├── user/                        #   用户管理
│   │   ├── user.module.ts           #     导入 DatabaseModule
│   │   └── user.service.ts          #     用户 CRUD、密码校验
│   ├── knowledge-base/              #   知识库、文件夹、文档
│   │   ├── knowledge-base.module.ts #     导入 StorageModule
│   │   ├── knowledge-base.controller.ts   # 知识库 CRUD
│   │   ├── knowledge-base.service.ts      # 知识库业务逻辑
│   │   ├── folder.controller.ts           # 文件夹 CRUD
│   │   ├── document.controller.ts         # 文档上传/列表/更新/删除
│   │   ├── document.service.ts            # 文档业务逻辑（调用 Storage + Queue）
│   │   └── dto/                     #     CreateKbDto / UpdateKbDto / CreateFolderDto / UpdateFolderDto / CreateDocumentDto / UpdateDocumentDto
│   ├── session/                     #   会话管理
│   │   ├── session.module.ts
│   │   ├── session.controller.ts    #     会话 CRUD + 消息列表
│   │   ├── session.service.ts       #     会话业务逻辑（支持 paginate）
│   │   └── dto/
│   │       ├── create-session.dto.ts
│   │       └── update-session.dto.ts
│   ├── chat/                        #   LLM 对话（SSE 流式输出）
│   │   ├── chat.module.ts           #     配置 HybridRetriever + DefaultRetrievalPostprocessor
│   │   ├── chat.controller.ts       #     POST /chat（SSE 流）
│   │   ├── chat.service.ts          #     流式对话逻辑（RAG 检索 + LLM 调用）
│   │   └── dto/
│   │       └── chat.dto.ts          #     ChatDto（含 SSRF 校验的 config）
│   ├── settings/                    #   用户设置（API Key 加密存储）
│   │   ├── settings.module.ts
│   │   ├── settings.controller.ts
│   │   ├── settings.service.ts      #     AES-256-GCM 加密/解密配置
│   │   └── dto/
│   │       └── settings.dto.ts
│   └── admin/                       #   后台管理
│       ├── admin.module.ts
│       ├── admin.controller.ts      #     用户列表 / 状态更新（仅 ADMIN）
│       ├── admin.service.ts
│       └── dto/
│           ├── admin-user-list-query.dto.ts
│           └── update-user-status.dto.ts
│
├── processors/                      # 基础设施处理器（全局复用）
│   ├── database/                    #   数据库
│   │   ├── database.module.ts       #     DatabaseModule（@Global，导出 PrismaService）
│   │   └── prisma.service.ts        #     PrismaService（扩展 $extends：paginate / exists）
│   ├── vector/                      #   向量存储
│   │   ├── vector.module.ts         #     VectorModule（@Global，导出 VectorService）
│   │   └── vector.service.ts        #     VectorService（封装 PgVectorStore，实现 IVectorStore）
│   ├── keyword/                     #   全文检索
│   │   ├── keyword.module.ts        #     KeywordModule（@Global，导出 KeywordService）
│   │   └── keyword.service.ts       #     KeywordService（ts_rank_cd + zhparser 检测）
│   ├── storage/                     #   对象存储
│   │   ├── storage.module.ts        #     StorageModule（@Global，导出 StorageService）
│   │   ├── storage.service.ts       #     StorageService（代理 IStorageProvider）
│   │   └── storage.provider.ts      #     STORAGE_PROVIDER（MinIO 工厂）
│   ├── queue/                       #   任务队列
│   │   ├── queue.module.ts          #     QueueModule（DynamicModule，forRoot 配置 Worker）
│   │   ├── queue.service.ts         #     QueueService（BullMQ Queue 管理）
│   │   ├── worker.service.ts        #     WorkerService（BullMQ Worker 生命周期）
│   │   ├── indexing.worker.ts       #     文档索引 Worker（解析 → 分块 → Embedding → 写入）
│   │   ├── parser/
│   │   │   └── document.parser.ts   #       文档解析（txt/md/pdf）
│   │   └── indexing/
│   │       └── prisma-vector.indexer.ts #   Chunk + Vector 单事务写入
│   └── queue/ (顶层)                #   队列定义（与 processors/queue 区分）
│       ├── index.ts                 #     统一导出
│       ├── redis.ts                 #     Redis 连接工厂
│       ├── queues.ts                #     DocumentQueue / EmbeddingQueue 定义
│       └── workers.ts               #     DocumentWorker / EmbeddingWorker 工厂
│
├── storage/                         # 存储适配器
│   └── minio.ts                     #   MinIOStorageProvider（实现 IStorageProvider）
│
├── vector/                          # 向量存储适配器
│   └── pgvector.ts                  #   PgVectorStore（实现 IVectorStore，原始 SQL）
│
├── common/                          # 全局通用
│   ├── interceptors/
│   │   ├── response.interceptor.ts  #     统一 { data: T } 响应包装
│   │   └── logging.interceptor.ts   #     请求/响应日志（开发环境）
│   ├── filters/
│   │   └── all-exception.filter.ts  #     全局异常捕获与标准化
│   ├── pipes/
│   │   └── zod-validation.pipe.ts   #     Zod 请求参数校验管道
│   ├── guards/
│   │   └── spider.guard.ts          #     爬虫 UA 拦截
│   ├── decorators/
│   │   └── bypass-response.decorator.ts # @BypassResponse() 跳过响应包装
│   └── utils/
│       └── ssrf-guard.ts            #     baseUrl SSRF 校验
│
├── interfaces/                      # 抽象接口与错误类
│   ├── IStorageProvider.ts          #   存储提供者接口
│   └── errors.ts                    #   RepositoryError / VectorStoreError / StorageError 等
│
├── shared/                          # 共享类型与 DTO
│   ├── dto/
│   │   └── pager.dto.ts             #     PagerDto（分页参数）
│   └── interfaces/
│       └── paginator.interface.ts   #     Paginator / PaginationResult
│
├── types/
│   └── express.d.ts                 #   Express.User 类型扩展
│
└── tools/                           # 独立脚本
    └── export-openapi.ts            #   OpenAPI JSON 导出工具

prisma/
├── schema.prisma                    # Prisma 数据模型
└── seed.ts                          # 种子数据脚本
```

## 核心运行逻辑

### 1. 启动流程 (`main.ts` → `bootstrap.ts`)

1. `NestFactory.create(AppModule, FastifyAdapter)` 创建应用
2. `bootstrap(app)` 注册全局中间件：
   - `@fastify/helmet` 安全头
   - `@fastify/multipart` 文件上传（50MB 限制）
   - CORS（开发环境允许 localhost:1420/3000/5173）
   - 全局前缀 `/api`（排除 `/health`）
   - 开发环境日志拦截器
   - 爬虫防护守卫
3. 注册 Swagger/OpenAPI 文档（非生产环境）
4. `app.listen(port, '0.0.0.0')`

### 2. 模块依赖关系

```
AppModule
├── ConfigModule (global)
├── ThrottlerModule (global 速率限制)
├── HealthModule
├── UserModule ──→ DatabaseModule (global)
├── AuthModule ──→ UserModule + JwtModule + PassportModule
├── VectorModule ──→ DatabaseModule (global)
├── KeywordModule ──→ DatabaseModule (global)
├── QueueModule.forRoot() ──→ ConfigModule
│   ├── QueueService ──→ WorkerService (forwardRef)
│   └── WorkerService ──→ IndexingWorker + DocumentParser + PrismaVectorIndexer
├── StorageModule ──→ ConfigModule
├── KnowledgeBaseModule ──→ StorageModule
├── SessionModule
├── ChatModule ──→ VectorService + KeywordService + ConfigService
├── SettingsModule
└── AdminModule
```

### 3. 请求处理流水线

```
HTTP Request
  → SpiderGuard (UA 检查)
  → ThrottlerGuard (速率限制)
  → JwtAuthGuard (认证，排除公开路由)
  → ZodValidationPipe (参数校验)
  → Controller Method
  → Service Business Logic
  → PrismaService / StorageService / QueueService
  → ResponseInterceptor ({ data: T } 包装)
  → HTTP Response
```

### 4. 认证流程

1. **注册**: `POST /api/auth/register`
   - 前端 RSA 加密密码 → 后端解密 → bcrypt 哈希 → 写入 user 表 → 返回 tokens
2. **登录**: `POST /api/auth/login`
   - bcrypt 校验密码 → 生成 accessToken + refreshToken
3. **访问受保护资源**: `Authorization: Bearer <accessToken>`
   - JwtStrategy 验证令牌 → `request.user` 注入 → RolesGuard 校验权限
4. **刷新**: `POST /api/auth/refresh`
   - 验证 refreshToken → 生成新 token 对

### 5. RAG 文档处理流程

1. **上传**: `POST /api/knowledge-bases/:kbId/documents/upload`
   - 文件校验 → StorageService 上传 MinIO → Document 记录创建 → QueueService 添加索引任务
2. **索引 Worker** (`IndexingWorker.handleIndexJob`):
   - 从 MinIO 下载文件 → DocumentParser 解析文本 → RecursiveCharacterChunker 分块
   - OpenAIEmbedder 生成向量 → PrismaVectorIndexer 单事务写入 chunks 表（content + vector）
3. **对话检索** (`ChatService.streamChat`):
   - HybridRetriever 同时执行向量检索（PgVectorStore）+ 关键词检索（ts_rank_cd）
   - DefaultRetrievalPostprocessor 重排序与过滤 → 注入 system message → 流式调用 LLM

### 6. 数据流

- **元数据**: PrismaService → PostgreSQL（users, sessions, messages, knowledgeBases, folders, documents, settings）
- **向量**: PrismaService.$queryRaw → pgvector（chunks.embedding）
- **文件**: StorageService → MinIO（document 原始文件）
- **队列**: QueueService → BullMQ → Redis（异步索引任务）

## 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | ✅ |
| `JWT_SECRET` | JWT 签名密钥 | ✅ |
| `JWT_REFRESH_SECRET` | Refresh Token 签名密钥 | ✅ |
| `MINIO_ENDPOINT` | MinIO 服务端点 | ✅ |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | ✅ |
| `MINIO_SECRET_KEY` | MinIO 秘密密钥 | ✅ |
| `MINIO_BUCKET` | MinIO 存储桶 | ❌（默认 goferbot-files） |
| `REDIS_HOST` | Redis 主机 | ❌（默认 localhost） |
| `REDIS_PORT` | Redis 端口 | ❌（默认 6379） |
| `REDIS_PASSWORD` | Redis 密码 | ❌ |
| `EMBEDDING_API_KEY` | Embedding 服务 API Key | ✅ |
| `EMBEDDING_BASE_URL` | Embedding 服务基础 URL | ❌ |
| `EMBEDDING_MODEL` | Embedding 模型 | ❌（默认 text-embedding-3-small） |
| `EMBEDDING_DIMENSIONS` | 向量维度 | ❌（默认 1536） |
| `SETTINGS_ENCRYPTION_KEY` | 设置加密密钥（Base64） | ✅ |
| `LLM_TIMEOUT_MS` | LLM 请求超时 | ❌（默认 300000） |
| `QUEUE_CONCURRENCY` | 队列并发数 | ❌（默认 2） |
| `CORS_ORIGIN` | 额外允许的 CORS Origin | ❌ |
| `PORT` | 服务端口 | ❌（默认 3000） |

## 常用命令

```bash
# 开发模式（热重载）
pnpm dev:server

# 构建
pnpm build

# 类型检查
pnpm type-check

# 测试
pnpm test

# Prisma 操作
pnpm prisma:generate    # 生成客户端
pnpm prisma:migrate     # 执行迁移
pnpm prisma:studio      # 打开 Studio
pnpm prisma:seed        # 执行种子脚本

# 工具脚本
pnpm export:openapi     # 导出 openapi.json
```

## 全局 Provider 注册（AppModule）

| Provider | 类型 | 作用 |
|----------|------|------|
| ResponseInterceptor | APP_INTERCEPTOR | 统一 `{ data: T }` 响应格式 |
| LoggingInterceptor | APP_INTERCEPTOR | 请求/响应日志 |
| AllExceptionsFilter | APP_FILTER | 全局异常标准化 |
| ZodValidationPipe | APP_PIPE | Zod DTO 校验 |
| ThrottlerGuard | APP_GUARD | 速率限制 |
| SpiderGuard | APP_GUARD | 爬虫拦截 |
