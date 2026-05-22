# 功能规格：API 测试共享基础设施

## 用户故事

作为后端开发者，我希望拥有一套统一的 API 测试基础设施，以便每次开发完一个 API 都能快速编写和运行真实环境模拟测试，避免接口在真实环境中出错。

## 边界

- **范围内**：
  - 五个共享测试辅助工具（TestDatabaseManager、TestAppFactory、AuthFixtures、ExternalServiceMocker、StorageCleaner）
  - vitest 测试配置（integration + e2e-api）
  - `.env.test` 环境变量文件
  - package.json 测试脚本更新
  - 一个可运行的示例测试文件（验证基础设施可用）
- **范围外**：
  - 具体 controller 的测试实现（由 b-02 ~ b-07 负责）
  - 前端单元测试/E2E 的修改
  - 旧 SQLite 路由测试的迁移（渐进式，随各 controller 测试 issue 逐步完成）
  - CI/CD 流水线配置

## 涉及组件

- `tests/integration/helpers/` — 共享辅助工具目录
- `tests/e2e/api/` — HTTP API E2E 目录（新建）
- `vitest.integration.config.ts` — 模块级集成测试配置
- `vitest.e2e-api.config.ts` — HTTP E2E 测试配置（新建）
- `.env.test` — 测试环境变量（新建）

## 相关功能

- `packages/server/src/processors/database/prisma.service.ts` — PrismaService 需可被 override
- `packages/server/src/main.ts` — Fastify 适配器配置决定 `app.inject()` 行为
- `packages/server/src/app.module.ts` — AppModule 是 TestAppFactory 的组装目标

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 模块级测试每文件独立 CREATE/DROP 数据库 | 完全隔离，支持并行，避免交叉污染 | 是（可改为共享库+TRUNCATE） |
| E2E 使用真实 NestJS 进程 + axios | 验证完整 HTTP 协议栈（header、端口、CORS） | 是（可改为 Fastify inject） |
| 测试配置统一放根目录 | 根目录 vitest v4 与项目一致，server 包 v1 后续升级 | 是（可移至 server 包） |
| 使用 nock 拦截 LLM/Embedding HTTP 请求 | 轻量、与 Node.js http 模块集成好，清理方便 | 是（可改为 msw） |
| Fastify `app.inject()` 代替 supertest | 项目使用 Fastify 适配器，`inject()` 更原生 | 是 |
