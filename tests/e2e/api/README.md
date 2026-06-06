# HTTP API E2E 测试

此目录存放基于 Vitest 的 HTTP API E2E 测试，使用真实 NestJS 进程 + axios 验证协议行为。

## 测试范围

- Auth 核心链路（注册 → 登录 → 访问保护路由）
- KB 生命周期（创建 → 更新 → 删除 → 列表）
- 文件上传 + Chat SSE 流式响应

## 运行方式

```bash
pnpm test:e2e:api
pnpm test:e2e:api:watch
```

## 配置

- `vitest.e2e-api.config.ts` — 测试配置
- 数据库：共享 `goferbot_test`，每例 TRUNCATE 清理
- 外部依赖：PostgreSQL + MinIO + Milvus + Redis（真实实例）
- LLM/Embedding：mock（nock/msw）
