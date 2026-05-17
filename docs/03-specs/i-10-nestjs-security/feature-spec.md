---
issue_id: i-10-nestjs-security
type: feature-spec
status: approved
summary: 建立 NestJS 全局安全基础设施：统一响应拦截器（{ data } 包装）、全局异常过滤器、请求日志、Helmet/CORS/速率限制（全局60/min，认证5/min）、Zod 验证管道、爬虫防护守卫。
---
# NestJS 安全基线 — 功能规格

> 对应 issue: `i-10-nestjs-security`
> 依赖: `i-08-nestjs-server-setup`
> 对齐: ADR-0004（Hono → NestJS 迁移）、PRD v2-cloud-native
> 取代: `q-01-security-baseline`（Hono 版安全基线已废弃）

---

## 1. 用户故事

作为 GoferBot 后端开发者，我希望 NestJS 应用具备全局安全基础设施（响应拦截、异常过滤、请求日志、安全头、CORS、速率限制、输入验证、爬虫防护），以便所有业务 API 在上线前拥有统一、可审计的安全基线，避免常见 Web 攻击和信息泄露。

---

## 2. 边界

### 2.1 范围内（MVP）

- **统一响应拦截器** (`ResponseInterceptor`)：将所有成功响应包装为 `{ data: T }` 格式；支持数组自动包装；支持 `@BypassResponse()` 装饰器跳过包装
- **全局异常过滤器** (`AllExceptionsFilter`)：捕获所有未处理异常，统一返回 `{ error: { code, message } }`；生产环境隐藏堆栈与内部信息；记录错误日志
- **请求日志拦截器** (`LoggingInterceptor`)：开发环境记录请求方法、路径、耗时、状态码
- **Bootstrap 安全配置**：
  - `helmet` — 安全响应头（X-Content-Type-Options、X-Frame-Options、X-XSS-Protection、HSTS 生产环境启用）
  - `cors` — 白名单 origin（Tauri WebView origin），不允许通配符 `*`
  - `@nestjs/throttler` — 全局速率限制（默认 60/min/IP），认证端点独立限制（5/min/IP）
- **Zod 验证管道** (`ZodValidationPipe`)：基于 `nestjs-zod`，所有 `@Body()` 自动校验；422 错误格式统一为 `{ error: { code, message, details? } }`
- **爬虫防护守卫** (`SpiderGuard`)（可选）：基于 User-Agent 黑名单拦截常见爬虫/扫描器

### 2.2 范围外

- 具体业务验证逻辑（由业务模块的 Zod schema 负责）
- WAF、DDoS 网络层防护
- 高级认证加固（MFA、设备绑定）—— 见 `q-02-auth-hardening`
- 安全事件持久化存储（仅输出到日志）

---

## 3. 涉及模块/组件

| 文件路径 | 类型 | 说明 |
|----------|------|------|
| `src/common/interceptors/response.interceptor.ts` | Interceptor | 统一响应包装 |
| `src/common/interceptors/logging.interceptor.ts` | Interceptor | 请求日志（开发环境） |
| `src/common/filters/all-exception.filter.ts` | ExceptionFilter | 全局异常处理 |
| `src/common/pipes/zod-validation.pipe.ts` | Pipe | Zod 输入验证 |
| `src/common/guards/spider.guard.ts` | Guard | 爬虫防护（可选） |
| `src/common/decorators/bypass-response.decorator.ts` | Decorator | 跳过响应包装标记 |
| `src/bootstrap.ts` | 启动文件 | Helmet、CORS、Throttler 全局注册 |
| `src/app.module.ts` | 根模块 | ThrottlerModule、全局 Guard/Interceptor/Filter 注册 |

---

## 4. 相关功能

- **上游** — `i-08-nestjs-server-setup`：提供 NestJS 模块结构、Fastify 适配器、`AppModule` 入口
- **上游** — `b-01-auth-api`（已废弃，功能合并至后续认证迭代）：定义认证端点，消费速率限制与异常过滤器
- **下游** — 所有业务模块（知识库、会话、聊天、设置）：消费响应拦截器、异常过滤器、Zod 验证管道
- **替代** — `q-01-security-baseline`：Hono 版安全基线，随框架迁移一并废弃

---

## 5. 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 NestJS 原生 Interceptor/Filter/Pipe/Guard 替代 Hono 中间件 | ADR-0004 已决定迁移至 NestJS 10 + Fastify，利用其模块化 DI 生态 | 否（架构级决策） |
| 响应格式统一包装为 `{ data }` | 前后端契约一致，便于前端类型推导；数组自动包装避免返回裸数组 | 否（契约级决策） |
| 异常过滤器隐藏堆栈（生产环境） | 防止信息泄露；开发环境可通过 `NODE_ENV` 开关 | 是（配置调整） |
| 速率限制使用 `@nestjs/throttler` + 内存存储 | MVP 阶段单实例运行，内存存储足够；后续可切换为 Redis（`ThrottlerStorageRedisService`） | 是（配置调整） |
| Zod 验证基于 `nestjs-zod` 的 `ZodValidationPipe` | 与项目技术栈（Zod）保持一致，避免引入 class-validator | 否（技术栈决策） |
| CORS origin 白名单仅允许 Tauri WebView | Tauri 桌面应用同机通信，无需开放跨域；开发期 `http://localhost:1420`，生产期 `tauri://localhost` | 是（配置调整） |
| 爬虫防护使用简单 User-Agent 黑名单 | MVP 阶段轻量防护，不引入复杂 WAF；可后续替换为更精细的规则引擎 | 是（模块替换） |
| 日志拦截器仅在开发环境启用 | 生产环境避免日志噪音与性能损耗；生产日志由独立 LoggerService 负责 | 是（配置调整） |
