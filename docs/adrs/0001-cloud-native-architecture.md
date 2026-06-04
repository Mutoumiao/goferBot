# ADR 0001: GoferBot 云原生架构

## 状态

已接受

## 背景

项目从传统"本地桌面应用"（Tauri + SQLite + 本地文件夹）演进为"云端优先的 AI Workspace"。旧架构存在以下根本限制：

- 物理文件夹存储无法支持远程同步、分享、协作
- sqlite-vec 无法支撑大规模向量检索
- 同步索引阻塞主流程
- 文件流经过后端，带宽压力大

## 决策

按云原生架构从头重构，采用以下技术栈：

| 层级 | 技术 | 职责 |
|------|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Tailwind CSS v4 + Pinia | UI 渲染、状态管理、HTTP 调用 |
| 桌面壳 | Tauri v2 (Rust) | 窗口管理、本地能力（冻结，Phase 6 扩展） |
| Web 框架 | NestJS 10 + Fastify | API 路由、认证、业务编排、全局拦截器 |
| ORM | Prisma 5 | PostgreSQL 数据库访问层 |
| 主数据库 | PostgreSQL 16 + pgvector 扩展 | 元数据、用户、认证、向量统一存储 |
| 对象存储 | MinIO (Docker) | 文件内容存储 |
| 缓存/队列 | Redis 7 + BullMQ | 异步任务流水线 |
| 认证 | JWT + bcrypt + Passport | Access/Refresh Token 双令牌机制 |
| 验证 | Zod + nestjs-zod | 运行时校验与 DTO 类型推导 |
| 本地缓存 | SQLite | UI 状态、离线缓存、Agent Memory（预留） |

### 核心原则

1. **对象存储才是真正文件系统** — 文件内容存 MinIO，不在数据库或本地磁盘
2. **PostgreSQL 统一承载元数据与向量** — pgvector 扩展提供 ANN 能力，元数据与向量同库同表
3. **本地只是缓存层** — 云端为唯一真相来源
4. **虚拟文件夹** — 数据库树结构，支持远程同步与协作
5. **异步流水线** — 上传 → 解析 → 分块 → 向量化，不阻塞用户操作
6. **验证统一为 Zod** — 全局 `createZodValidationPipe`，禁止 class-validator
7. **响应统一包装** — 全局 `ResponseInterceptor` 包装为 `{ data: T }`，Controller 直接返回原始数据

### 架构分层

```
┌─────────────────────────────────────────┐
│  Vue 3 前端 (packages/webui/)            │
│  Pinia + Tailwind CSS v4 + shadcn-vue   │
└─────────────────┬───────────────────────┘
                  │ HTTP API
┌─────────────────▼───────────────────────┐
│  NestJS 10 API (packages/server/)       │
│  Fastify + Prisma + JWT + Zod           │
│  ─────────────────────────────────────  │
│  Controller → Service → Prisma → PG     │
│  QueueModule → BullMQ → Redis           │
│  StorageService → MinIO                 │
│  VectorService → pgvector ($queryRaw)   │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌───────┐    ┌───────┐    ┌───────┐
│PostgreSQL│   │ MinIO │    │ Redis │
│+ pgvector│   │       │    │+BullMQ│
└───────┘    └───────┘    └───────┘
```

## 关键子决策

### 1. 验证方案：Zod 统一

**决策**：后端全局使用 `createZodValidationPipe`（来自 `nestjs-zod`），所有 DTO 通过 Zod schema 推导。

**禁止**：
- `class-validator`、`class-transformer`、`@nestjs/class-validator`
- Controller 上使用 `@UsePipes(new ValidationPipe(...))`
- 手动实例化 `ValidationPipe`

**标准模式**：
```typescript
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const xxxSchema = z.object({
  name: z.string().min(1, '名称不能为空').describe('名称'),
  page: z.coerce.number().int().min(1).default(1).describe('页码'),
})
export class XxxDto extends createZodDto(xxxSchema) {}
```

### 2. 响应格式：统一拦截器

**决策**：所有 API 成功响应统一为 `{ data: T }` 格式，由全局 `ResponseInterceptor` 自动包装。

**Controller 中直接返回原始数据**：
```typescript
@Get('users')
async listUsers() {
  const result = await this.adminService.listUsers()
  return result  // ResponseInterceptor → { data: result }
}
```

**唯一例外**：SSE 流式响应（`chat.controller.ts`）使用 `@BypassResponse()`。

### 3. 向量存储：PostgreSQL pgvector

**决策**：元数据与向量统一存储在 PostgreSQL，通过 pgvector 扩展提供 ANN 能力。

**Schema**：
```prisma
model Chunk {
  id         String                      @id @default(uuid())
  documentId String                      @map("document_id")
  kbId       String                      @map("kb_id")
  content    String
  tokenCount Int?                        @map("token_count")
  chunkIndex Int                         @map("chunk_index")
  embedding  Unsupported("vector(1536)")?
  createdAt  DateTime                    @default(now()) @map("created_at")

  document      Document      @relation(fields: [documentId], references: [id], onDelete: Cascade)
  knowledgeBase KnowledgeBase @relation(fields: [kbId], references: [id], onDelete: Cascade)

  @@map("chunks")
  @@index([kbId])
  @@index([documentId])
}
```

**索引写入**：`PrismaVectorIndexer` 单事务写入（元数据 + 向量），`ON CONFLICT ... DO UPDATE` 支持重试。

**向量检索**：`PgVectorStore` 通过 `$queryRaw` 使用 `<=>` 余弦距离操作符。

**级联删除**：`chunks` 表定义 `ON DELETE CASCADE` 外键，删除 document/knowledge_base 时自动清理向量。

### 4. RAG SDK 接口注入

**决策**：`@goferbot/rag-sdk` 作为纯逻辑库，定义接口契约，由 `@goferbot/server` 实现存储端。

| SDK 接口 | Server 实现 | 存储后端 |
|----------|------------|----------|
| `IVectorStore` | `PgVectorStore` | PostgreSQL pgvector |
| `IIndexer` | `PrismaVectorIndexer` | PostgreSQL（单事务写入） |
| `IKeywordStore` | `KeywordService` | PostgreSQL FTS（zhparser） |
| `IGenerator` | `ChatService` | OpenAI 兼容 LLM API |

**单向依赖**：`server → rag-sdk`，禁止反向依赖。

## 后果

### 正面

- 架构可直接扩展为 SaaS/团队协作
- 文件上传不阻塞（异步流水线）
- 元数据与向量事务一致性（单库 ACID）
- 认证系统为后续多用户、权限、分享打下基础
- 验证统一，减少认知负担与依赖体积
- Docker Compose 仅 3 个服务（PG + MinIO + Redis），启动更快

### 负面

- 开发环境依赖 Docker
- 数据全部丢弃，重新初始化（v1 → v2）
- 实现周期比局部修补长
- pgvector HNSW 在千万级向量以上性能劣于专用向量库（当前数据量数万级，不构成瓶颈）
- Prisma 原生不支持 `vector` 类型，需使用 `$queryRaw` 操作向量列

### 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 千万级+ 性能不足 | 中 | 当前数据量在数万级；如增长超预期，可迁移到 pgvector 集群或专用向量库 |
| Prisma `$queryRaw` 维护成本 | 低 | 向量操作封装在 `VectorService` 内，调用方无感知 |
| 非归一化 Embedding 模型 | 低 | 当前使用 OpenAI text-embedding-3（已归一化）；未来切换模型时需评估是否改用 `<=>` 余弦操作符 |

## 当前 MVP 范围

- 单用户（无 Workspace 概念）
- 本地跑全套 Docker 基础设施（PG + MinIO + Redis）
- 认证：JWT + bcrypt
- 后端框架：NestJS 10 + Fastify
- 文件上传先走 NestJS Controller，后续优化为 Presigned URL
- RAG SDK 接口注入，Server 实现存储端

## 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-05-16 | 初始决策：云原生架构重构（Hono → NestJS，Drizzle → Prisma，Better Auth → JWT） | 架构评估 |
| 2026-06-01 | 向量存储修正：Milvus → PostgreSQL pgvector 扩展（元数据与向量统一存储） | 架构评估 |
| 2026-06-04 | 合并 ADR 0004 与 ADR 0005 为单一决策文件，去除历史修正痕迹 | 架构评估 |
