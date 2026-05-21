---
id: q-04-password-transport-encryption
type: issue
status: closed
track: quality
priority: p1
summary: 前端密码传输加密：客户端 RSA 公钥加密密码后再发送，杜绝明文密码出现在 HTTP 请求体中。
blocked_by: []
blocks: []
spec: docs/03-specs/q-04-password-transport-encryption/
plan: docs/04-plans/q-04-password-transport-encryption/v1.md
tests: docs/08-test-cases/q-04-password-transport-encryption/
token_estimate: 900
---

状态: needs-triage
分类: security

## 要构建的内容

为注册/登录接口添加客户端密码加密：服务端暴露 RSA 公钥端点，前端请求公钥后对密码进行 RSA 加密，服务端用私钥解密后再进行 bcrypt 处理。杜绝密码明文出现在 HTTP 请求体中。

## 背景

当前注册（`POST /api/auth/register`）和登录（`POST /api/auth/login`）接口直接传输明文密码：

```
前端表单 (raw "mypassword123")
  → POST /api/auth/register { email, password: "mypassword123" }  ← 明文
    → 服务端 bcrypt hash → 存入 DB
```

项目无 HTTPS/TLS 配置（纯 localhost 开发），密码在 HTTP 请求体中完全暴露。尽管本地开发 localhost 明文在业界常见，但作为安全基线应做到纵深防御——即使未来 TLS 终止层配置不当，密码也不会以明文出现在应用层日志、代理缓存或开发者工具中。

已有 `packages/server/src/modules/settings/settings.service.ts` 中的 AES-256-GCM 加解密实现可参考，但密码传输场景更适合 RSA 非对称加密（无需共享密钥）。

## 规格引用

- 安全基线: docs/issues/q-01-security-baseline.md
- 认证系统: docs/issues/i-09-nestjs-auth-system.md
- NestJS 安全: docs/issues/i-10-nestjs-security.md

## 验收标准

### 后端 — RSA 密钥对与解密
- [ ] 生成 RSA-4096 密钥对（或 OAEP），私钥通过环境变量 `PASSWORD_PRIVATE_KEY` 注入
- [ ] `GET /api/auth/public-key` 端点，返回 PEM 格式公钥
- [ ] 该端点不受速率限制（或单独高频限制），无认证要求
- [ ] `AuthService.register()` 和 `AuthService.login()` 接收加密密码时自动解密 → bcrypt
- [ ] 向后兼容：同时支持加密密码和明文密码（通过 `encrypted: boolean` 标记或请求头区分），过渡期后移除明文支持

### 前端 — RSA 加密
- [ ] API client 或 auth store 在注册/登录前调用 `/api/auth/public-key` 获取公钥
- [ ] 使用 Web Crypto API (`crypto.subtle.encrypt`) 进行 RSA-OAEP 加密
- [ ] 加密后的密码以 base64 字符串发送
- [ ] 公钥缓存（页面生命周期内），避免每次登录前重复请求

### 验证
- [ ] `pnpm type-check` 通过
- [ ] curl 测试：`/api/auth/public-key` 返回 PEM 公钥
- [ ] curl 测试：加密密码注册 → 登录 → 获取 me 全流程
- [ ] curl 测试：明文密码仍可正常注册/登录（向后兼容）
- [ ] E2E 测试：注册/登录页面正常可用

## 阻塞于

- 无

## 范围外

- HTTPS/TLS 配置（本地开发或生产部署的反向代理 TLS 终止，属于运维层面，不在此 issue 范围内）
- 其他敏感字段加密（API Key 已由 settings.service.ts AES-256-GCM 覆盖）
- 密码重置流程
- 邮箱验证

## Agent 简报

**分类：** security
**摘要：** 前端使用 RSA 公钥加密密码后传输，杜绝明文密码出现在 HTTP 请求中。

**当前行为：**
注册和登录接口直接传输明文密码。密码以原始字符串出现在：
- HTTP 请求体（Network 面板可直接查看）
- 服务端日志（若开启请求体日志）
- 反向代理缓存（若配置不当）

**期望行为：**
前端使用 RSA 公钥加密密码，服务端私钥解密后再 bcrypt 处理。密码在传输层和应用层均不可见。

**关键接口：**
- `GET /api/auth/public-key` — 新增，返回 RSA 公钥
- `POST /api/auth/register` — 修改，支持 `encryptedPassword` 字段
- `POST /api/auth/login` — 修改，支持 `encryptedPassword` 字段
- `packages/server/src/modules/auth/auth.service.ts` — 添加解密逻辑
- `packages/server/src/modules/auth/dto/register.dto.ts` — DTO 兼容加密字段
- `packages/server/src/modules/auth/dto/login.dto.ts` — DTO 兼容加密字段
- `packages/webui/src/stores/auth.ts` — 注册/登录前加密
- `packages/webui/src/api/client.ts` — 或新增 `encryptPassword()` 工具函数

**验收标准：**
- [ ] `/api/auth/public-key` 返回 PEM 公钥
- [ ] 注册/登录支持加密密码
- [ ] 向后兼容明文密码
- [ ] 前端 Web Crypto API 加密
- [ ] type-check + curl + E2E 通过

**范围外：**
- HTTPS/TLS 部署
- 其他字段加密
- 密码重置
