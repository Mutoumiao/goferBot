# Logging Guidelines

> GoferBot 结构化日志约定

---

## Logger 实例化

**统一模式**：`private readonly logger = new Logger(ClassName.name)`

```typescript
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name)
}
```

**规则**:
- 永远使用 `ClassName.name`，**不要**用字符串字面量（重构时自动跟随）
- `private readonly` — 不可变、不可被子类访问
- Controller / Service / Worker / Repository / Listener / Filter / Interceptor **全部遵循此模式**（56/56 一致性验证通过）

---

## 日志级别使用场景

| 级别 | 使用场景 | 示例 |
|------|---------|------|
| `logger.log()` | 正常业务事件 | "Document worker started", "Password changed for user" |
| `logger.warn()` | 降级行为、非致命异常 | "Redis 连接失败，队列功能已禁用", "PDF backend degraded to raw-buffer" |
| `logger.error()` | 需要人工介入的错误 | 索引失败、数据库连接异常、未捕获异常（含 stack） |
| `logger.debug()` | 跳过/幂等操作 | "Bootstrap skipped: super admin already exists" |
| `logger.verbose()` | 详细调试信息 | "Registered parser 'pdf' for application/pdf" |

**原则**:
- `logger.log` → 正常流程里程碑
- `logger.warn` → 服务降级但不影响主流程
- `logger.error` → 需要告警/排查的问题
- `logger.debug` → 幂等跳过（预期行为）
- `logger.verbose` → 调试用，生产环境默认关闭

---

## 请求链路追踪

### RequestId

```typescript
// AllExceptionsFilter 中注入
const requestId = (request as any).requestId || 'unknown'

// 日志格式
this.logger.error(`[${requestId}] ${request.method} ${request.url} ${stack}`)
this.logger.warn(`[${requestId}] ${request.method} ${request.url} ${status} ${message}`)
```

由 `RequestIdMiddleware` 为每个请求生成唯一 ID，全链路传递。

### 操作日志格式

```
// 组件日志
this.logger.log(`Super admin created: ${email} in ${ms}ms`)
this.logger.log(`Indexed document ${documentId}: ${totalChunks} chunks (source=${mimeType})`)

// Worker 日志
this.logger.log(`Document job ${job.id} completed`)
this.logger.error(`Document job ${job?.id} failed: ${err.message}`)
```

**格式规范**: `{动作描述} {关键标识}: {详细信息}`

---

## 敏感信息保护

| 做 | 不做 |
|----|------|
| ✅ `emailHash: sha256(email)` | ❌ `email: user@example.com` |
| ✅ `user ${userId}` | ❌ `user password: ***` |
| ✅ `token expired for session ${id}` | ❌ `token: eyJhbG...` |

---

## 不要做的事

- ❌ 使用 `console.log()` / `console.error()` — 统一走 `Logger`
- ❌ 在日志中输出敏感信息（密码、token、API key）
- ❌ 日志消息使用硬编码字符串（重构时不会跟随）
- ❌ error 级别日志不包含 stack trace（排查成本高）
- ❌ 在循环中大量 log（考虑使用 debug/verbose）
- ❌ 使用 `logger.log()` 记录错误事件

## Common Mistakes

1. **`new Logger('SessionService')`** → 应该用 `new Logger(SessionService.name)`
2. **日志丢失 requestId** → 自定义 Logger 必须保留 `[requestId]` 前缀
3. **中文和英文混用** → 日志消息可中文，但关键字段名和标识符用英文
4. **过度使用 error 级别** → 业务校验失败用 warn，只有系统级故障用 error
