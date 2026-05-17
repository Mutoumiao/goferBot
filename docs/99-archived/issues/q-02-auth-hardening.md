---
id: q-02-auth-hardening
type: issue
status: closed
track: quality
priority: p1
summary: Sidecar 共享令牌机制 — 已归档作废。原设计基于 V1 架构的 Tauri Sidecar 共享令牌，ADR-0004 后不再适用。
blocked_by: []
blocks: []
archived_reason: ADR-0004 架构重构，Sidecar 模式废除，认证改为 NestJS JWT + Passport（i-09-nestjs-auth-system）
---

状态: archived
分类: security

## 状态说明

**本 issue 已归档作废。**

原设计基于 V1 架构的 Tauri Sidecar 共享令牌机制（Tauri 启动 sidecar 时注入随机 token，API 通过 Bearer token 校验）。随着 ADR-0004 架构决策，项目已从"本地桌面应用"全面转向"云端优先的 SaaS 型 Web 应用"：

- Tauri 进入冻结状态（详见 `src-tauri/README.md`）
- Sidecar 模式废除，Server 升级为独立 Web Server
- 认证机制改为 Better Auth + Session Cookie（见 b-01-auth-api）
- Sidecar Token 机制不再有适用场景

## 原内容归档

### 曾计划构建

实现 Sidecar 共享令牌机制：Tauri 启动 sidecar 时注入随机 token，所有 API 通过 Bearer token 认证。

### 原验收标准

- Tauri 启动 sidecar 时通过环境变量 `GSTACK_SIDECAR_TOKEN` 注入随机 UUID token
- `packages/server/src/middleware/sidecar-token.ts` 实现 Bearer token 校验中间件
- 中间件编排顺序：先 sidecar-token → 再 Better Auth session
- 前端从 Tauri event 获取 token，所有 BackendTransport 请求自动携带 `Authorization: Bearer <token>`

### 替代方案

Web 应用的安全认证由以下 issue 覆盖：
- **b-01-auth-api**: Better Auth 邮箱+密码认证 + Session Cookie
- **q-01-security-baseline**: CORS 硬化、速率限制、SSRF 防护、输入校验

---
*归档日期: 2026-05-16*
*归档原因: ADR-0004 架构重构，Sidecar 模式废除*
