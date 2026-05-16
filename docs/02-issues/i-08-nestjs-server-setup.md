状态: completed
分类: enhancement

## 要构建的内容

初始化 NestJS 10 + Fastify 后端服务器，建立模块化架构基础。

## 背景

架构决策从 Hono 迁移到 NestJS（ADR-0004 更新）。需要基于成熟的 nest-template（D:\projects\ai-stared-project\nest-http-prisma-zod）建立新的 server 结构。

## 验收标准

- [ ] `packages/server/` 目录重构为 NestJS 项目结构
- [ ] `package.json` 包含 NestJS 10 + Fastify + Prisma + Zod 依赖
- [ ] `src/main.ts` — NestJS 启动入口，Fastify 适配器
- [ ] `src/bootstrap.ts` — 全局配置（CORS、Helmet、日志、端口）
- [ ] `src/app.module.ts` — 根模块，导入所有业务模块
- [ ] `src/common/` — 通用组件目录
  - `interceptors/response.interceptor.ts` — 统一响应包装 `{ data }`
  - `filters/all-exception.filter.ts` — 全局异常处理
  - `pipes/zod-validation.pipe.ts` — Zod 验证管道
  - `guards/auth.guard.ts` — JWT 认证守卫（占位）
- [ ] `src/processors/` — 基础设施层
  - `database/database.module.ts` — Prisma 数据库模块
  - `cache/cache.module.ts` — Redis 缓存模块
  - `helper/helper.module.ts` — 工具服务模块
- [ ] `pnpm dev:server` 可正常启动
- [ ] `pnpm type-check` 通过

## 阻塞于

- 无（最优先任务）

## 范围外

- 具体业务模块（Auth/KnowledgeBase/Chat 等）
- Prisma schema 定义（由 i-02-prisma-setup 负责）
- 前端代码

## Agent 简报

**分类：** enhancement
**摘要：** NestJS 10 + Fastify 服务器初始化，建立模块化架构基础

**当前行为：**
Hono 服务器存在但需废弃。

**期望行为：**
NestJS 服务器正常启动，模块体系就绪，可接入业务模块。

**关键接口：**
- `packages/server/src/main.ts` — 启动入口
- `packages/server/src/bootstrap.ts` — 全局配置
- `packages/server/src/app.module.ts` — 根模块

**验收标准：**
- [ ] NestJS 项目结构建立
- [ ] Fastify 适配器配置
- [ ] 全局拦截器、过滤器、管道
- [ ] 基础设施模块（Database/Cache/Helper）
- [ ] 启动正常，type-check 通过

**范围外：**
- 业务模块
- Prisma schema
- 前端代码
