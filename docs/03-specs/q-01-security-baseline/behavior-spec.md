---
issue_id: q-01-security-baseline
type: behavior-spec
status: draft
summary: 定义安全头（Helmet X-Content-Type-Options/X-Frame-Options/X-XSS-Protection/HSTS）的响应行为、CORS Origin 白名单判定逻辑、速率限制分层策略及日志脱敏规则。
---
# Security Baseline — 行为规格

> 对应 issue: `q-01-security-baseline`
> 关联: `b-01-auth-api`

---

## 1. 安全头行为

### 1.1 响应头列表

所有 HTTP 响应必须包含以下安全头（由 helmet 中间件自动设置）：

| 响应头 | 值 | 说明 |
|--------|-----|------|
| `X-Content-Type-Options` | `nosniff` | 禁止浏览器 MIME 嗅探 |
| `X-Frame-Options` | `DENY` | 禁止页面被嵌入 iframe |
| `X-XSS-Protection` | `1; mode=block` | 启用浏览器 XSS 过滤器（兜底） |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains`（生产环境） | 强制 HTTPS，仅当 `NODE_ENV=production` 时启用 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 控制 Referrer 泄露 |

### 1.2 生产环境判定

```
process.env.NODE_ENV === 'production'
    ├─ 是 → 启用 HSTS、Secure Cookie、Redis 限速
    └─ 否 → 禁用 HSTS，内存限速，允许 localhost origin
```

---

## 2. CORS 硬化行为

### 2.1 当前问题

现有配置：
```typescript
app.use('*', cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  credentials: true,
}))
```

### 2.2 目标行为

**方案 A（推荐）**：完全移除 CORS 中间件。Tauri WebView 与 Sidecar 同机通信，通过 `localhost` 直接访问，不需要跨域头。

**方案 B（若必须保留）**：
- `origin` 严格限定为 Tauri WebView 实际 origin：`http://localhost:1420`（开发）或 `tauri://localhost`（生产 Tauri）
- `allowMethods` 仅保留实际使用的：`GET`, `POST`, `PATCH`, `DELETE`
- `allowHeaders` 增加 `Cookie`（若前端携带 Cookie）
- `credentials: true` 时 `origin` 绝不允许为 `*`

### 2.3 决策逻辑

```
[请求到达]
    ↓
若采用方案 A（移除 CORS）
    → 无 Access-Control-Allow-* 头，浏览器同源策略默认允许同域
若采用方案 B（保留 CORS）
    → origin 不在白名单？
        ├─ 是 → 不返回 CORS 头，浏览器拦截
        └─ 否 → 返回对应 CORS 头
```

---

## 3. 速率限制行为

### 3.1 限速策略矩阵

| 端点分组 | 路径匹配 | 限制 | 窗口 | 存储 |
|----------|----------|------|------|------|
| 认证端点 | `/api/auth/**` | 5 次 | 1 分钟 / IP | 内存（开发）/ Redis（生产） |
| 聊天端点 | `/chat` | 10 次 | 1 分钟 / IP | 内存（开发）/ Redis（生产） |
| 文件上传 | `/knowledge-bases/*/documents` POST | 30 次 | 1 分钟 / IP | 内存（开发）/ Redis（生产） |
| 通用端点 | `*`（默认） | 60 次 | 1 分钟 / IP | 内存（开发）/ Redis（生产） |

### 3.2 限速触发行为

```
[请求进入]
    ↓
匹配路由对应的 rate limiter
    ↓
检查 IP 在窗口期内请求次数
    ↓
超过限制？
    ├─ 是 → 返回 429
    │       响应头：Retry-After: <剩余秒数>
    │       响应头：X-RateLimit-Limit: <限制数>
    │       响应头：X-RateLimit-Remaining: 0
    │       响应体：{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁，请稍后再试" } }
    │       记录安全日志："Rate limit triggered", { ip, path, limit }
    └─ 否 → 请求次数 +1，继续后续中间件
```

### 3.3 存储切换行为

```
process.env.REDIS_URL 存在？
    ├─ 是 → 使用 RedisStore（生产环境，多实例共享计数）
    └─ 否 → 使用 MemoryStore（开发环境，单进程）
```

---

## 4. 输入验证行为

### 4.1 验证原则

- 所有 `POST` / `PATCH` / `PUT` 请求体必须经过 Zod schema 校验
- Zod schema 使用 `.strict()` 或 `.passthrough()` 控制：默认 `strict()`，拒绝未知字段
- 校验失败返回 `400 Bad Request`，不进入业务逻辑

### 4.2 各端点校验规则

#### 4.2.1 聊天消息（POST /chat）

```typescript
const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().uuid(),
  knowledgeBaseIds: z.array(z.string().uuid()).optional(),
  config: z.object({
    provider: z.enum(['openai', 'claude', 'deepseek', 'custom', 'ollama']),
    model: z.string().min(1),
    temperature: z.number().min(0).max(2).default(0.7),
  }).strict(),
}).strict()
```

#### 4.2.2 知识库创建/重命名（POST / PATCH /knowledge-bases）

```typescript
const kbSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[^<>\\/:*?"|]+$/),
  description: z.string().max(500).optional(),
}).strict()
```

> `name` 正则过滤路径穿越与特殊符号字符。

#### 4.2.3 文件上传（POST /knowledge-bases/:id/documents）

- 后端校验 `Content-Length` 或实际接收大小，上限 **50MB**
- 超过限制返回 `413 Payload Too Large`
- 文件名过滤：移除 `..`, `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` 等字符
- 文件名长度限制：1-255 字符

#### 4.2.4 认证端点（与 b-01 对齐）

```typescript
const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/),
  name: z.string().min(1).max(50).optional(),
}).strict()

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
}).strict()
```

### 4.3 校验失败响应

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": [
      { "field": "message", "issue": "String must contain at most 4000 character(s)" }
    ]
  }
}
```

> `details` 字段仅在开发环境返回；生产环境仅返回 `code` 和 `message`。

---

## 5. SSRF 防护行为

### 5.1 校验时机

在 `streamChatCompletion` 调用外部 LLM API 前，校验用户配置的 `baseUrl`。

### 5.2 白名单规则

```
允许的域名：
    - api.openai.com
    - api.deepseek.com
    - api.anthropic.com
    - localhost:11434（Ollama 本地服务）

拒绝的地址：
    - 169.254.x.x（链路本地）
    - 10.x.x.x（私有 A 类）
    - 172.16.x.x ~ 172.31.x.x（私有 B 类）
    - 192.168.x.x（私有 C 类）
    - 127.x.x.x（除 localhost:11434 外）
    - 0.0.0.0/8, ::1 等
```

### 5.3 校验失败行为

```
[streamChatCompletion 被调用]
    ↓
解析 baseUrl → hostname + port
    ↓
hostname 在白名单？
    ├─ 否 → 解析为 IP
    │       IP 为内网地址且不是 localhost:11434？
    │           ├─ 是 → 抛出 SSRFError
    │           └─ 否 → 继续（域名形式的外部地址）
    └─ 是 → 继续
    ↓
SSRFError 被全局错误处理捕获
    → 返回 400 { "error": { "code": "SSRF_BLOCKED", "message": "不合法的 API 地址" } }
    → 记录安全日志："SSRF attempt blocked", { baseUrl, userId }
```

---

## 6. 错误响应安全行为

### 6.1 统一错误格式

所有错误响应使用统一 JSON 结构：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "用户友好的错误信息"
  }
}
```

### 6.2 脱敏规则

全局 `app.onError` 处理流程：

```
[发生异常]
    ↓
判断错误类型
    ├─ ValidationError / ZodError
    │   → code: VALIDATION_ERROR, message: "请求参数校验失败"
    │   → 开发环境附加 details
    ├─ AuthError
    │   → code: AUTH_ERROR, message: "认证失败"
    ├─ RateLimitError
    │   → code: RATE_LIMIT_EXCEEDED, message: "请求过于频繁，请稍后再试"
    ├─ SSRFError
    │   → code: SSRF_BLOCKED, message: "不合法的 API 地址"
    ├─ RepositoryError / 业务错误
    │   → 映射到对应 code，message 使用预定义文案
    └─ Error / 未知错误
        → code: INTERNAL_ERROR, message: "服务器内部错误"
        → 原始错误（含堆栈）仅输出到服务端日志，绝不返回给客户端
```

### 6.3 禁止泄露的信息

- 堆栈跟踪（`err.stack`）
- SQL 语句或数据库字段名
- 文件系统路径
- 环境变量键名
- 第三方服务内部错误详情

---

## 7. 日志行为

### 7.1 安全事件类型

| 事件 | 日志级别 | 内容 |
|------|----------|------|
| 登录失败 | `warn` | `{ event: 'auth_failure', ip, emailHash, reason }` |
| 速率限制触发 | `warn` | `{ event: 'rate_limit', ip, path, limit, window }` |
| 非法输入 | `warn` | `{ event: 'invalid_input', ip, path, issues }` |
| SSRF 拦截 | `warn` | `{ event: 'ssrf_blocked', ip, userId, baseUrl }` |
| 认证成功 | `info` | `{ event: 'auth_success', userId, ip }` |

### 7.2 脱敏规则

- 密码字段：替换为 `[REDACTED]`
- API Key：仅保留前 4 位 + `...` + 后 4 位（如 `sk-12...34`）
- 邮箱：可选哈希存储，原始值不进入 info 级别以上日志
- Session Token：完全不记录

---

## 8. 边界情况

| 场景 | 预期行为 |
|------|----------|
| 请求携带未知 JSON 字段 | 400 `VALIDATION_ERROR`，拒绝处理 |
| 文件上传实际大小超过 50MB | 413 `PAYLOAD_TOO_LARGE`，流式中断 |
| 文件名包含 `../etc/passwd` | 过滤非法字符后存储，或返回 400 |
| baseUrl 配置为 `http://192.168.1.1/v1` | 400 `SSRF_BLOCKED`，拒绝请求 |
| baseUrl 配置为 `http://evil.com/api.openai.com` | 域名白名单严格匹配，拒绝 |
| 生产环境未配置 HTTPS | HSTS 头仍发送，但依赖部署层保证 TLS |
| Redis 限速器连接失败 | 降级为内存存储，记录 error 日志 |
| Zod 校验失败同时触发速率限制 | 先返回 400 校验错误，不计入限速次数（或按策略决定） |
