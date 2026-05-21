---
id: i-10-nestjs-security
type: issue
status: closed
track: infra
priority: p0
summary: NestJS 安全基线：全局安全中间件、异常处理、响应格式化。统一响应拦截器、异常过滤器、Helmet、CORS、速率限制就绪。
blocked_by: [i-08-nestjs-server-setup]
blocks: []
spec: docs/03-specs/i-10-nestjs-security/
plan: docs/04-plans/i-10-nestjs-security/v1.md
tests: docs/08-test-cases/i-10-nestjs-security/
token_estimate: 1000
---

状态: completed
分类: security

## 要构建的内容

NestJS 安全基线：全局安全中间件、异常处理、响应格式化。

## 背景

架构决策从 Hono 中间件迁移到 NestJS 生态（ADR-0004 更新）。基于 nest-template 的安全模式实现。

## 验收标准

- [ ] `src/common/interceptors/response.interceptor.ts` — 统一响应拦截器
  - 包装为 `{ data }` 格式
  - 支持数组自动包装
  - 支持 `@BypassResponse()` 装饰器跳过
- [ ] `src/common/filters/all-exception.filter.ts` — 全局异常过滤器
  - 统一错误格式 `{ error: { code, message } }`
  - 生产环境隐藏堆栈
  - 记录错误日志
- [ ] `src/common/interceptors/logging.interceptor.ts` — 请求日志拦截器（开发环境）
- [ ] `src/bootstrap.ts` 安全配置：
  - Helmet 安全头
  - CORS 配置（白名单 origin）
  - @nestjs/throttler 速率限制（全局 60/min，认证 5/min）
- [ ] `src/common/pipes/zod-validation.pipe.ts` — Zod 验证管道
  - 基于 nestjs-zod
  - 422 错误格式统一
- [ ] `src/common/guards/spider.guard.ts` — 爬虫防护（可选）
- [ ] `pnpm type-check` 通过
- [ ] curl 测试：安全头存在、CORS 正确、速率限制生效

## 阻塞于

- i-08-nestjs-server-setup（需要 NestJS 模块结构）

## 范围外

- 具体业务验证（由业务模块负责）
- WAF、DDoS 防护

## Agent 简报

**分类：** security
**摘要：** NestJS 安全基线（响应拦截器、异常过滤器、Helmet、CORS、Throttler）

**当前行为：**
Hono 安全中间件存在但需废弃。

**期望行为：**
NestJS 全局安全组件就绪，所有 API 响应格式统一，异常处理规范。

**关键接口：**
- `ResponseInterceptor` — 响应包装
- `AllExceptionsFilter` — 异常处理
- `ZodValidationPipe` — 输入验证
- `Throttler` — 速率限制

**验收标准：**
- [ ] 响应拦截器
- [ ] 异常过滤器
- [ ] Helmet + CORS
- [ ] 速率限制
- [ ] Zod 验证管道
- [ ] type-check 通过
- [ ] curl 测试通过

**范围外：**
- 业务验证
- WAF/DDoS
