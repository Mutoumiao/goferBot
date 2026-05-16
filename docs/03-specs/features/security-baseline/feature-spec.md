# Security Baseline — 功能规格

> 对应 issue: `q-01-security-baseline`
> 依赖: `i-00-core-interfaces`
> 对齐认证系统: `b-01-auth-api`

---

## 1. 目标

作为系统管理员，我希望系统具备基础安全防护，防止常见 Web 攻击（CORS 滥用、暴力破解、SSRF、注入、XSS、信息泄露），确保 Sidecar API 在认证上线前即具备安全基线。

---

## 2. 范围

### 2.1 范围内（MVP）

- **Helmet 安全头**：X-Content-Type-Options、X-Frame-Options、X-XSS-Protection、Strict-Transport-Security（生产环境）
- **CORS 硬化**：从通配 `*` 改为仅允许 Tauri WebView origin，或完全移除（同机 IPC 不需要 CORS）
- **速率限制**：按 IP 限制请求频率，覆盖认证端点、聊天端点、文件上传端点、通用端点
- **输入验证**：所有请求体使用 Zod schema 验证，拒绝未知字段，限制字段长度与格式
- **SQL 注入防护**：Drizzle ORM 参数化查询（天然防护）
- **XSS 防护**：安全头 + 输入过滤 + 响应不渲染原始 HTML
- **SSRF 防护**：`streamChatCompletion` 中 `baseUrl` 白名单校验，拒绝内网地址（除 localhost 外）
- **敏感信息过滤**：错误响应不暴露堆栈、数据库结构、内部路径；日志脱敏（API Key、密码）
- **密码策略**：最小 8 位，包含字母和数字（与 `b-01-auth-api` 对齐）

### 2.2 范围外（后续扩展 / 其他 issue）

- WAF / IDS 级别防护
- DDoS 防护（网络层）
- 渗透测试与合规认证（SOC2 / ISO27001 等）
- 高级认证加固（MFA、设备绑定、异常登录检测）—— 见 `q-02-auth-hardening`（已归档作废，功能合并至后续迭代）

---

## 3. 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 安全头中间件 | `hono/helmet` 或 `helmet` | 设置 HTTP 安全响应头 |
| CORS 中间件 | `hono/cors` | 限制 Origin、Methods、Headers |
| 速率限制 | `hono-rate-limiter` | 内存存储（开发）或 Redis（生产） |
| 输入验证 | `hono/zod-validator` + Zod | 所有请求体 schema 校验，拒绝未知字段 |
| ORM 注入防护 | Drizzle ORM | 参数化查询，天然防 SQL 注入 |
| SSRF 防护 | 自定义 URL 校验工具 | 基于白名单 + 内网地址黑名单 |

---

## 4. 架构设计

### 4.1 模块结构

```
packages/server/
├── src/
│   ├── index.ts                    # Hono app：挂载 helmet、CORS、rate-limit、全局错误处理
│   ├── middleware/
│   │   ├── helmet.ts               # 安全头中间件配置（或内联在 index.ts）
│   │   ├── cors.ts                 # CORS 硬化配置
│   │   ├── rate-limit.ts           # 速率限制中间件（多实例：auth / chat / upload / general）
│   │   └── validate.ts             # Zod 校验中间件封装
│   ├── utils/
│   │   ├── ssrf-guard.ts           # baseUrl 白名单 + 内网地址校验
│   │   └── sanitize-error.ts       # 错误响应脱敏（去除堆栈、SQL、路径）
│   └── services/
│       └── llm.ts                  # streamChatCompletion 调用 ssrf-guard 校验 baseUrl
```

### 4.2 中间件执行顺序

```
[请求进入]
    ↓
Helmet 安全头
    ↓
CORS（若保留）
    ↓
速率限制（按路由匹配不同策略）
    ↓
Zod 输入验证（按路由）
    ↓
认证中间件（b-01-auth-api）
    ↓
业务 Handler
    ↓
全局错误处理（onError）→ 脱敏 → 统一错误格式
```

---

## 5. 与其他 issue 的关系

### 5.1 与 `b-01-auth-api` 的关系

- `q-01` 提供基础安全设施（速率限制框架、CORS 配置、错误脱敏），`b-01` 在其上实现认证端点的具体安全策略（密码策略、Session Cookie 属性、认证错误码）。
- `b-01` 的认证端点速率限制（5 req/min/IP）依赖 `q-01` 的 `rate-limit.ts` 中间件实例。
- `q-01` 定义的全局错误响应格式 `{ error: { code, message } }` 供 `b-01` 复用。

### 5.2 与 `q-02-auth-hardening` 的关系

- `q-02` 已归档作废，其增强功能（MFA、设备绑定、异常登录检测）不在当前 MVP 范围内。
- `q-01` 是当前唯一活跃的安全基线 issue，覆盖所有 MVP 阶段安全需求。

---

## 6. 安全要求摘要

| 类别 | 要求 | 实现方式 |
|------|------|----------|
| 安全头 | X-Content-Type-Options: nosniff, X-Frame-Options: DENY, X-XSS-Protection: 1; mode=block, HSTS（生产） | hono/helmet |
| CORS | Origin 白名单（`http://localhost:1420` 或 Tauri 实际 origin），不允许 credentials 通配 | hono/cors |
| 速率限制 | 认证 5/min，聊天 10/min，上传 30/min，通用 60/min | hono-rate-limiter |
| 输入验证 | 所有 body 走 Zod schema，strict 模式拒绝未知字段 | hono/zod-validator |
| 密码策略 | 最小 8 位，含字母和数字 | Zod schema + b-01 集成 |
| SSRF | baseUrl 白名单（OpenAI / DeepSeek / Claude / Ollama），拒绝内网地址 | 自定义 ssrf-guard.ts |
| 错误响应 | 不暴露堆栈、SQL、路径；统一格式 | sanitize-error.ts + onError |
| 日志 | 记录安全事件（登录失败、限速触发、非法输入），API Key / 密码脱敏 | 自定义 logger 中间件 |

---

## 7. 验收标准

- [ ] `packages/server/src/index.ts` 引入 helmet 安全头中间件
- [ ] CORS 配置 hardened：origin 非 `*`，methods 仅列出实际使用的 method
- [ ] `packages/server/src/middleware/rate-limit.ts` 提供多策略限速中间件（auth / chat / upload / general）
- [ ] `packages/server/src/middleware/validate.ts` 封装 Zod 校验，所有业务路由接入
- [ ] `packages/server/src/utils/ssrf-guard.ts` 实现 baseUrl 白名单 + 内网地址黑名单
- [ ] `packages/server/src/services/llm.ts` 在 `streamChatCompletion` 中调用 ssrf-guard 校验
- [ ] `packages/server/src/utils/sanitize-error.ts` 实现错误脱敏，全局 `app.onError` 使用统一格式
- [ ] 安全事件日志：登录失败、速率限制触发、非法输入、SSRF 拦截均有日志记录
- [ ] 输入校验覆盖：消息 content ≤ 4000 字符，知识库名称 1-50 字符且过滤特殊字符，上传文件 ≤ 50MB，文件名过滤路径穿越字符
