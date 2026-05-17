---
issue_id: i-08-nestjs-server-setup
type: feature-spec
status: approved
summary: 初始化 NestJS 10 + Fastify 项目结构，配置 Helmet/CORS/全局前缀/日志，提供统一响应拦截器、全局异常过滤器、Zod 验证管道及 Database/Cache/Helper 基础设施模块占位与健康检查端点。
---
# 功能规格：NestJS 服务器初始化

## 用户故事

- 作为后端开发者，我希望项目使用 NestJS 10 + Fastify 作为 Web 框架，以便利用模块化架构、依赖注入和成熟的中间件生态。
- 作为后端开发者，我希望在启动时自动配置 Helmet、CORS 和全局前缀，以便统一安全策略和路由规范。
- 作为后端开发者，我希望拥有统一的响应包装和全局异常处理，以便前端消费接口时行为一致。
- 作为后端开发者，我希望基础设施模块（Database、Cache、Helper）预先就位，以便后续业务模块直接依赖。
- 作为运维/开发者，我希望通过 `GET /health` 确认服务状态，以便在部署和监控时快速验证可用性。

## 边界

- 范围内：
  - `packages/server/` 目录重构为 NestJS 标准项目结构
  - NestJS 10 + Fastify 适配器配置
  - 全局启动配置（Helmet、CORS、日志、端口、全局前缀 `/api`）
  - 根模块 `AppModule`（导入 ConfigModule、LoggerModule 及基础设施模块）
  - 通用组件：统一响应拦截器、全局异常过滤器、Zod 验证管道、JWT 认证守卫（占位）
  - 基础设施模块：DatabaseModule（Prisma）、CacheModule（Redis）、HelperModule（工具服务）
  - 健康检查端点 `GET /health`
  - 环境变量模板 `.env.example`
  - `package.json` 依赖、`tsconfig.json`、`nest-cli.json` 配置
  - `pnpm dev:server` 启动脚本、`pnpm type-check` 类型检查通过

- 范围外：
  - 具体业务模块（Auth、KnowledgeBase、Chat、Settings 等）
  - Prisma schema 定义与数据库迁移（由 i-02-prisma-setup 负责）
  - Redis、MinIO、Milvus 的客户端详细封装（仅建立模块占位）
  - 前端代码
  - Docker Compose 配置（由 i-01-docker-compose-infra 负责）
  - 速率限制详细配置（后续由 security-baseline 完善）

## 涉及模块/文件

| 文件路径 | 说明 |
|---------|------|
| `packages/server/package.json` | NestJS 10、Fastify、Prisma、Zod 等依赖 |
| `packages/server/tsconfig.json` | TypeScript 严格模式配置 |
| `packages/server/nest-cli.json` | NestJS CLI 配置 |
| `packages/server/.env.example` | 环境变量模板 |
| `packages/server/src/main.ts` | NestJS 应用入口，使用 FastifyAdapter |
| `packages/server/src/bootstrap.ts` | 启动配置：Helmet、CORS、全局前缀、日志、端口 |
| `packages/server/src/app.module.ts` | 根模块，聚合 ConfigModule、LoggerModule、基础设施模块 |
| `packages/server/src/common/interceptors/response.interceptor.ts` | 统一响应包装 `{ data }` |
| `packages/server/src/common/filters/all-exception.filter.ts` | 全局异常处理，统一错误格式 |
| `packages/server/src/common/pipes/zod-validation.pipe.ts` | Zod 验证管道，基于 `nestjs-zod` |
| `packages/server/src/common/guards/auth.guard.ts` | JWT 认证守卫占位（后续接入业务逻辑） |
| `packages/server/src/processors/database/database.module.ts` | Prisma 数据库模块（占位） |
| `packages/server/src/processors/cache/cache.module.ts` | Redis 缓存模块（占位） |
| `packages/server/src/processors/helper/helper.module.ts` | 工具服务模块（占位） |

## 相关功能

- 上游：i-01-docker-compose-infra — 提供 PostgreSQL、Redis、MinIO、Milvus 容器环境
- 下游：
  - i-02-prisma-setup — 在 DatabaseModule 基础上定义 Prisma schema 与迁移
  - b-01-auth-api — 依赖 AuthGuard 与 JWT 配置
  - b-04-chat-sse-api — 依赖 NestJS 全局拦截器和异常过滤器
  - b-05-settings-api — 依赖 ConfigModule 读取配置

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| Web 框架使用 NestJS 10 + Fastify | 团队对 NestJS 生态更熟悉；模块化、DI、拦截器、守卫模式适合大型项目；有成熟 nest-template 可参考 | 否（架构级决策） |
| ORM 使用 Prisma 5（替换 Drizzle ORM） | nest-template 已验证；Prisma 的迁移、类型生成、NestJS 集成更成熟 | 否（架构级决策） |
| 认证使用 JWT + bcrypt（替换 Better Auth） | Better Auth 与 Drizzle 集成遇到 schema 适配问题；JWT 模式在 NestJS 中更标准 | 否（架构级决策） |
| 验证使用 Zod + nestjs-zod | 保持 Zod 作为验证库；nestjs-zod 提供开箱即用的验证管道 | 否 |
| 响应格式统一为 `{ data }` 包装 | 前后端契约一致性；NestJS 拦截器天然支持 | 是（可调整包装结构） |
| 全局前缀为 `/api` | 与前端 API Client 约定一致；健康检查 `/health` 除外 | 是 |
| 基础设施模块置于 `src/processors/` | 与 nest-template 目录结构保持一致，processors 表示基础设施/处理层 | 是（可重命名） |
| `pnpm dev:server` 作为服务端启动命令 | 与现有 `pnpm dev:tauri` 等命令风格一致 | 是 |
