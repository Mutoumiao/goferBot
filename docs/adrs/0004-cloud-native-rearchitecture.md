# ADR 0004: 云原生架构重构

## 状态

已接受

## 背景

项目从传统"本地桌面应用"（Tauri + SQLite + 本地文件夹）演进为"云端优先的 AI Workspace"。旧架构在以下方面存在根本限制：

- 物理文件夹存储无法支持远程同步、分享、协作
- sqlite-vec 无法支撑大规模向量检索
- 同步索引阻塞主流程
- 文件流经过后端，带宽压力大

## 决策

按云原生架构从头重构：

| 层级 | 技术 | 职责 |
|-----|------|------|
| 对象存储 | MinIO (Docker) | 文件内容存储 |
| 主数据库 | PostgreSQL (Docker) + Prisma | 元数据、用户、认证 |
| 向量数据库 | Milvus (Docker) | 向量索引与 ANN 搜索 |
| 缓存/队列 | Redis (Docker) + BullMQ | 异步任务流水线 |
| 认证 | JWT + bcrypt | 身份认证与授权 |
| 本地缓存 | SQLite | UI 状态、离线缓存、Agent Memory |

核心原则：

1. 对象存储才是真正文件系统
2. PostgreSQL 管 metadata
3. Milvus 只负责向量检索
4. 本地只是缓存层
5. 虚拟文件夹（数据库树结构）
6. 异步流水线（上传 → 解析 → 分块 → 向量化）

## 后果

### 正面

- 架构可直接扩展为 SaaS/团队协作
- 文件上传不阻塞（异步流水线）
- 向量检索性能可支撑百万级文档
- 认证系统为后续多用户、权限、分享打下基础

### 负面

- 开发环境依赖 Docker（PG + MinIO + Milvus + Redis）
- 数据全部丢弃，重新初始化
- 实现周期比局部修补长

## 当前 MVP 范围

- 单用户（无 Workspace 概念）
- 本地跑全套 Docker 基础设施
- 认证：JWT + bcrypt（基于 nest-template 的 AuthGuard 模式）
- 后端框架：NestJS 10 + Fastify（替换 Hono，利用成熟的模块生态）
- 文件上传先走 NestJS Controller，后续优化为 Presigned URL
- RAG SDK 预留接口，先保证应用功能完整

## 架构变更记录

### 2026-05-16: Hono → NestJS 迁移

**原因：**
- 开发者对 NestJS 生态更熟悉，有成熟的 nest-template 可参考
- Better Auth 与 Drizzle ORM 的集成遇到 schema 适配问题
- NestJS 的模块化、依赖注入、拦截器、守卫模式更适合大型项目
- Prisma + Zod + JWT 的认证流程在 nest-template 中已验证

**变更内容：**
| 组件 | 旧方案 | 新方案 |
|------|--------|--------|
| Web 框架 | Hono | NestJS 10 + Fastify |
| ORM | Drizzle ORM | Prisma 5 |
| 认证 | Better Auth (Session Cookie) | JWT + bcrypt (Access/Refresh Token) |
| 验证 | Zod (手动) | Zod + nestjs-zod (管道) |
| 响应格式 | 手动 | 统一拦截器 `{ data }` |
| 异常处理 | 手动 | 全局异常过滤器 |
| 速率限制 | hono-rate-limiter | @nestjs/throttler |

**保留内容：**
- Docker Compose 基础设施（PG + MinIO + Milvus + Redis）
- 前端 Vue 3 + Pinia + API Client
- MinIO / Milvus / Redis 客户端封装
- BullMQ 队列框架
- RAG SDK 接口合约
