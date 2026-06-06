---
issue_id: q-31
type: feature-spec
status: draft
summary: 建立 HTTP API E2E 测试，使用真实 NestJS 进程 + axios 验证 Auth/Chat/File/KB 四条核心链路的协议行为。
---

# 功能规格：HTTP API E2E 测试

## 背景与问题

### PRD 原始目标

`docs/prd/api-testing-prd.md` 明确定义了 HTTP E2E 测试体系：

- **技术**：`axios` + 真实 NestJS 进程
- **数据库**：真实 PG（共享测试库 `goferbot_test`，每例清理）
- **外部依赖**：全套真实；LLM/Embedding mock
- **速度**：分钟级
- **运行时机**：CI / 提交前
- **必做规则**：核心链路（Auth/Chat/File/KB）必须写

### 当前测试覆盖状态

当前 `tests/e2e/api/` 目录为空，无 HTTP API E2E 测试。

**结论**：PRD HTTP E2E 验收标准**并未完成**。

## 目标

1. 为 Auth 核心链路建立 HTTP E2E 测试
2. 为 KB 生命周期建立 HTTP E2E 测试
3. 为文件上传 + Chat SSE 建立 HTTP E2E 测试
4. 所有测试使用真实 NestJS 进程 + axios

## 边界

### 范围内
- Auth 链路：注册 → 登录 → 访问保护路由 → refresh → logout
- KB 生命周期：创建 → 更新 → 删除 → 列表
- 文件上传 + Chat SSE：multipart 上传 → SSE 流式对话
- 验证真实协议行为：multipart、SSE、JWT header、rate limit
- 数据库：共享 `goferbot_test`，每例 TRUNCATE 清理

### 范围外
- 前端 Playwright E2E（已有 `tests/e2e/specs/`）
- 性能测试
- 压力测试

## 涉及文件

### 新建测试文件
- `tests/e2e/api/auth-flow.spec.ts`
- `tests/e2e/api/kb-lifecycle.spec.ts`
- `tests/e2e/api/file-upload-chat.spec.ts`

### 现有配置（复用）
- `vitest.e2e-api.config.ts`

## 相关功能

- **上游**：q-28（第一批 Controller 集成测试）— API 行为已验证
- **上游**：`docs/prd/api-testing-prd.md` — 本 issue 的原始需求来源

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 axios（非 app.inject()） | 验证真实 HTTP 协议行为 | 否 |
| 使用真实 NestJS 进程 | 验证真实启动和路由注册 | 否 |
| 共享数据库 + 逐例清理 | E2E 标准模式，与模块级隔离区分 | 否 |
| LLM/Embedding mock | 收费、慢、不稳定 | 否 |

## 验收标准

| ID | 标准 | 验证方式 |
|----|------|----------|
| AC-01 | `auth-flow.spec.ts` 覆盖 Auth 核心链路 | `pnpm test:e2e:api` 通过 |
| AC-02 | `kb-lifecycle.spec.ts` 覆盖 KB 生命周期 | `pnpm test:e2e:api` 通过 |
| AC-03 | `file-upload-chat.spec.ts` 覆盖文件上传 + Chat SSE | `pnpm test:e2e:api` 通过 |
| AC-04 | 全部新增测试在 `pnpm test:e2e:api` 中通过 | 运行命令验证 |
| AC-05 | 测试数据库零残留 | 每例 TRUNCATE 清理 |
