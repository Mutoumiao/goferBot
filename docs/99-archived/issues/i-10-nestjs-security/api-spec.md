---
issue_id: i-10-nestjs-security
type: api-spec
status: approved
summary: 定义全局成功响应格式 { data }、统一错误格式 { error: { code, message } }、422 验证错误格式、CORS Origin 白名单策略和速率限制头规范，无独立 REST 端点。
---
# NestJS 安全基线 — API 规格

> 对应 issue: `i-10-nestjs-security`
> 依赖: `i-08-nestjs-server-setup`
> 对齐: PRD v2-cloud-native、ADR-0004
> 取代: `q-01-security-baseline` API 规格

---

## 1. 基础信息

- **Base URL**: `http://localhost:3000`（NestJS Sidecar 开发端口）
- **Content-Type**: `application/json`
- **认证方式**: JWT Bearer Token（Access Token）或公开访问
- **CORS**: Origin 白名单，非 `*`，`Access-Control-Allow-Credentials: true`
- **框架**: NestJS 10 + Fastify

---

## 2. 全局规范

### 2.1 成功响应统一格式

所有成功响应（2xx）经过 `ResponseInterceptor` 包装为：

```json
{
  "data": { ... }
}
```

当原始响应为数组时，自动包装为对象：

```json
{
  "data": {
    "items": [ ... ]
  }
}
```

使用 `@BypassResponse()` 装饰器的端点返回原始响应，不经过包装。

### 2.2 错误响应统一格式

所有错误响应（4xx / 5xx）经过 `AllExceptionsFilter` 处理为：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "用户友好的错误信息"
  }
}
```

开发环境（`NODE_ENV !== 'production'`）可额外返回 `details` 与 `stack` 辅助调试：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": [
      { "field": "message", "issue": "String must contain at most 4000 character(s)" }
    ],
    "stack": "Error: ...\n    at ..."
  }
}
```

### 2.3 错误码汇总

| 状态码 | Code | 含义 | 使用场景 |
|--------|------|------|----------|
| `400` | `VALIDATION_ERROR` | 参数校验失败 | Zod 校验失败、字段缺失、格式错误 |
| `400` | `SSRF_BLOCKED` | SSRF 拦截 | baseUrl 不在白名单或为内网地址 |
| `401` | `AUTH_ERROR` | 认证失败 | 未登录、Token 无效/过期 |
| `403` | `FORBIDDEN` | 禁止访问 | 权限不足、SpiderGuard 拦截 |
| `404` | `NOT_FOUND` | 资源不存在 | 路由或资源未找到 |
| `413` | `PAYLOAD_TOO_LARGE` | 请求体过大 | 文件上传超过 50MB |
| `429` | `RATE_LIMIT_EXCEEDED` | 速率限制 | 请求过于频繁 |
| `500` | `INTERNAL_ERROR` | 服务器内部错误 | 未捕获异常、数据库连接失败 |

### 2.4 速率限制响应头

当触发 `429` 时，响应包含：

```http
Retry-After: 60
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
```

### 2.5 安全响应头

所有响应默认包含（由 `helmet` 设置）：

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains  # 仅生产环境
```

### 2.6 CORS 响应头

```http
Access-Control-Allow-Origin: http://localhost:1420
Access-Control-Allow-Methods: GET,POST,PATCH,DELETE
Access-Control-Allow-Headers: Content-Type,Authorization
Access-Control-Allow-Credentials: true
```

---

## 3. 端点清单

安全基线本身不引入新端点，但为所有现有/未来端点施加安全策略。以下列出受安全基线直接约束的端点：

| 方法 | 路径 | 安全策略 | 认证 |
|------|------|----------|------|
| `GET` | `/health` | 通用限速、安全头 | 否 |
| `POST` | `/chat` | 聊天限速、Zod 校验、SSRF 防护、安全头 | 是（预留） |
| `POST` | `/api/auth/login` | 认证限速、Zod 校验、安全头 | 否 |
| `POST` | `/api/auth/register` | 认证限速、Zod 校验、安全头 | 否 |
| `POST` | `/api/auth/refresh` | 认证限速、安全头 | 否 |
| `GET` | `/api/auth/me` | 通用限速、安全头 | 是 |
| `GET/POST/PATCH/DELETE` | `/knowledge-bases/**` | 通用限速、Zod 校验、安全头 | 是 |
| `POST` | `/knowledge-bases/:id/documents` | 上传限速、文件大小校验、文件名过滤、安全头 | 是 |
| `GET/POST` | `/settings` | 通用限速、Zod 校验、SSRF 防护（settings 中 baseUrl）、安全头 | 是 |

---

## 4. 端点详情

### 4.1 GET /health

健康检查端点。不暴露敏感信息。

#### Request

```http
GET /health HTTP/1.1
```

#### Success Response — 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Content-Type-Options: nosniff
X-Frame-Options: DENY

{
  "data": {
    "status": "ok"
  }
}
```

> 仅返回最小化信息。不返回服务器版本、数据库状态、内存使用等。

---

### 4.2 POST /chat

聊天端点。受聊天限速（10 req/min/IP）和 SSRF 防护约束。

#### Request

```http
POST /chat HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJ...

{
  "message": "你好",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "knowledgeBaseIds": ["7c9e6679-7425-40de-944b-e07fc1f90ae7"],
  "config": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7
  }
}
```

#### 安全相关 Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败" } }` | message 超过 4000 字符或字段非法 |
| `400` | `{ "error": { "code": "SSRF_BLOCKED", "message": "不合法的 API 地址" } }` | config 中 baseUrl 被 SSRF 拦截 |
| `429` | `{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁，请稍后再试" } }` | 超过 10 req/min |

---

### 4.3 POST /knowledge-bases

创建知识库。受通用限速和名称校验约束。

#### Request

```http
POST /knowledge-bases HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJ...

{
  "name": "我的知识库",
  "description": "用于存储技术文档"
}
```

#### 安全相关 Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败" } }` | name 包含非法字符或长度超限 |

---

### 4.4 POST /knowledge-bases/:id/documents

文件上传。受上传限速、文件大小校验、文件名过滤约束。

#### Request

```http
POST /knowledge-bases/7c9e6679-7425-40de-944b-e07fc1f90ae7/documents HTTP/1.1
Content-Type: multipart/form-data
Authorization: Bearer eyJ...

--boundary
Content-Disposition: form-data; name="file"; filename="report.pdf"

<binary data>
```

#### 安全相关 Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `413` | `{ "error": { "code": "PAYLOAD_TOO_LARGE", "message": "文件大小超过 50MB 限制" } }` | 文件超过 50MB |
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "文件名包含非法字符" } }` | 文件名过滤失败 |
| `429` | `{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁，请稍后再试" } }` | 超过 30 req/min |

---

## 5. NestJS 组件 API 规格

### 5.1 ResponseInterceptor

```typescript
// src/common/interceptors/response.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface ApiResponse<T> {
  data: T
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>>
}
```

**行为：**
- 检查 handler 或 controller 是否带有 `@BypassResponse()` 元数据
- 若有，直接返回原始响应
- 若原始响应为数组，包装为 `{ data: { items: array } }`
- 否则包装为 `{ data: response }`

### 5.2 BypassResponse 装饰器

```typescript
// src/common/decorators/bypass-response.decorator.ts
import { SetMetadata } from '@nestjs/common'

export const BYPASS_RESPONSE_KEY = 'bypassResponse'
export const BypassResponse = () => SetMetadata(BYPASS_RESPONSE_KEY, true)
```

### 5.3 AllExceptionsFilter

```typescript
// src/common/filters/all-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { FastifyReply } from 'fastify'

export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: unknown
    stack?: string
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void
}
```

**行为：**
- 映射 NestJS `HttpException` → 使用其状态码与响应体
- 映射 Zod / `nestjs-zod` 校验错误 → `400 VALIDATION_ERROR`
- 映射未知错误 → `500 INTERNAL_ERROR`
- 生产环境仅返回 `code` + `message`；开发环境附加 `details` + `stack`
- 所有错误记录到 Logger

### 5.4 LoggingInterceptor

```typescript
// src/common/interceptors/logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>
}
```

**行为：**
- 仅在 `NODE_ENV !== 'production'` 时记录日志
- 记录内容：`{ method, path, statusCode, durationMs }`
- 使用 NestJS 内置 `Logger`

### 5.5 ZodValidationPipe

```typescript
// src/common/pipes/zod-validation.pipe.ts
import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common'
import { ZodSchema } from 'zod'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema)
  transform(value: unknown, metadata: ArgumentMetadata): unknown
}
```

**行为：**
- 使用 `schema.parse(value)` 校验输入
- 失败时抛出 `BadRequestException`，格式化为 `{ error: { code: 'VALIDATION_ERROR', message, details } }`
- 在 controller 中使用：`@Body(new ZodValidationPipe(chatSchema))`
- 或全局注册为 `APP_PIPE` 结合 `nestjs-zod` 的 `createZodDto`

### 5.6 SpiderGuard

```typescript
// src/common/guards/spider.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common'

@Injectable()
export class SpiderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean
}
```

**行为：**
- 读取请求头 `User-Agent`
- 匹配黑名单正则（如 `scrapy`, `curl`, `python-requests`, `bot`, `spider`, `crawler` 等）
- 匹配成功 → 抛出 `403 FORBIDDEN`
- 不匹配 → 放行

---

## 6. Bootstrap 安全配置

### 6.1 src/bootstrap.ts

```typescript
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import helmet from '@fastify/helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  )

  // 1. Helmet 安全头
  await app.register(helmet, {
    contentSecurityPolicy: false, // API 不需要 CSP
    hsts: process.env.NODE_ENV === 'production',
  })

  // 2. CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:1420',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })

  // 3. 全局前缀
  app.setGlobalPrefix('api')

  await app.listen(3000, '0.0.0.0')
}
```

### 6.2 src/app.module.ts

```typescript
import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { AllExceptionsFilter } from './common/filters/all-exception.filter'
import { SpiderGuard } from './common/guards/spider.guard'

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 5,
      },
    ]),
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SpiderGuard },
  ],
})
export class AppModule {}
```

---

## 7. 数据模型（安全相关）

### 7.1 日志事件结构

```typescript
interface SecurityLogEvent {
  event: 'auth_failure' | 'auth_success' | 'rate_limit' | 'invalid_input' | 'ssrf_blocked' | 'spider_blocked'
  timestamp: string // ISO 8601
  ip: string
  userId?: string
  path?: string
  metadata?: Record<string, unknown>
}
```

### 7.2 限速计数结构（内存 / Redis）

```
key: throttler:<ip>:<route_group>
value: <count>
ttl: <windowMs> 毫秒
```

---

## 8. 测试验证（curl）

### 8.1 安全头检查

```bash
curl -I http://localhost:3000/health
```

期望响应头包含：
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

### 8.2 CORS 预检检查

```bash
curl -I -X OPTIONS \
  -H "Origin: http://localhost:1420" \
  -H "Access-Control-Request-Method: POST" \
  http://localhost:3000/api/auth/login
```

期望响应头包含：
```http
Access-Control-Allow-Origin: http://localhost:1420
Access-Control-Allow-Methods: GET,POST,PATCH,DELETE
```

### 8.3 速率限制检查

```bash
# 快速请求 6 次认证端点，第 6 次应返回 429
for i in {1..6}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/auth/login
done
```

期望第 6 次返回 `429`，响应体：
```json
{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁，请稍后再试" } }
```

### 8.4 统一响应格式检查

```bash
curl http://localhost:3000/health
```

期望：
```json
{ "data": { "status": "ok" } }
```

### 8.5 错误响应格式检查

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid"}'
```

期望：
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败" } }
```
