---
id: q-31
status: closed
track: quality
priority: p1
summary: 建立 HTTP API E2E 测试，使用真实 NestJS 进程 + axios 验证 Auth/Chat/File/KB 四条核心链路的协议行为。
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/api-testing-prd.md
prd_section: HTTP E2E
---

## 要构建的内容

为 `docs/prd/api-testing-prd.md` 定义的 HTTP E2E 测试体系建立第一批测试，覆盖 Auth/Chat/File/KB 四条核心链路，验证真实协议行为。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## PRD 引用

- **来源 PRD**: `docs/prd/api-testing-prd.md`
- **对应章节**: HTTP E2E
- **核心目标**: 使用 axios + 真实 NestJS 进程验证 multipart upload、SSE 流、JWT header、rate limit 响应头等真实协议行为。
- **验收标准**:
  1. Auth/Chat/File/KB 四条核心链路有 HTTP E2E 测试
  2. 所有测试在本地 `pnpm test:all` 通过
  3. 测试数据库零残留

## 验收标准

- [x] Auth 核心链路 E2E 测试：注册 → 登录 → 访问保护路由 → refresh → logout
- [x] KB 生命周期 E2E 测试：创建 → 更新 → 删除 → 列表
- [x] 文件上传 + Chat SSE E2E 测试：multipart 上传 → SSE 流式对话
- [x] 全部新增测试在 `pnpm test:e2e:api` 中通过
- [x] 测试数据库零残留，不污染开发环境

## 阻塞于

- q-28（已关闭）— 模块级集成测试已就绪，API 行为已验证
- q-29（待实施）— 第二批 Controller 测试完成后 E2E 更稳定
- q-30（待实施）— 全局中间件测试完成后 E2E 更稳定

## 范围外

- 前端 Playwright E2E（已有 `tests/e2e/specs/`）
- 性能测试
- 压力测试

## Agent 简报

**分类：** quality
**摘要：** 建立 HTTP API E2E 测试，验证四条核心链路的真实协议行为。

**当前行为：**
- `tests/e2e/api/` 目录包含 3 个 spec 文件 + helpers
- `vitest.e2e-api.config.ts` 已配置并验证通过
- PRD HTTP E2E 验收标准已达成

**期望行为：**
- 3 个 E2E 测试文件覆盖 Auth/KB/File+Chat 链路
- 使用 axios + 真实 NestJS 进程（非 `app.inject()`）
- 验证真实协议行为：multipart、SSE、JWT header、rate limit
- 数据库：共享 `goferbot_test`，每例 TRUNCATE 清理

**关键接口：**
- `vitest.e2e-api.config.ts` — E2E 测试配置
- `tests/e2e/api/` — E2E 测试目录
- PRD 参考：`docs/prd/api-testing-prd.md` HTTP E2E 章节

**验收标准：**
- [x] Auth 核心链路 E2E 测试
- [x] KB 生命周期 E2E 测试
- [x] 文件上传 + Chat SSE E2E 测试
- [x] 全部新增测试在 `pnpm test:e2e:api` 中通过
- [x] 测试数据库零残留

**范围外：**
- 前端 Playwright E2E
- 性能/压力测试
