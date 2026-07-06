# Server 基础设施代码审计报告

> 审计日期: 2026-07-06
> 审计范围: `packages/server/src/common/` + `packages/server/src/auth/` 中的中间件、异常过滤器、管道、守卫、拦截器、自定义装饰器、工具函数等基础设施代码
> 原则: Ponytail — 未使用的代码就是噪声。YAGNI — 不被消费的导出就是负债。
> 状态: **已全部清理** — 二次验证无遗漏，type-check + lint 通过。

---

## 一、死代码 — 已删除

### 1.1 `TraceContextService` — 整个服务无人消费 (CRITICAL) ✅

| 字段     | 内容                                                                                                                             |
|----------|----------------------------------------------------------------------------------------------------------------------------------|
| 文件     | `packages/server/src/common/services/trace-context.service.ts`                                                                   |
| 关联文件 | `packages/server/src/common/common.module.ts` (provider + export)                                                                |
| 消费者   | **无**。仅 `common.module.ts` 自身引用。全局 injectable 但不被任何 Controller/Service/Resolver 注入。                            |
| 备注     | `currentEmail()` 返回 `getRequestContext()?.email`，但 `RequestContext.email` 字段从未在任何地方被赋值，返回值恒为 `undefined`。 |

**已执行**: 删除文件，移除 common.module.ts 中的 provider 和 export，删除关联测试。

---

### 1.2 `normalizeEmail` — 无引用 ✅

| 字段   | 内容                                                  |
|--------|-------------------------------------------------------|
| 文件   | `packages/server/src/common/utils/request-context.ts` |
| 消费者 | **无**。定义了但从未被 import。                       |

**已执行**: 删除该函数。

---

### 1.3 `getApiPrefix` / `buildApiPath` — 无引用 ✅

| 字段   | 内容                                                                                                                                   |
|--------|----------------------------------------------------------------------------------------------------------------------------------------|
| 文件   | `packages/server/src/common/utils/api-path.ts`                                                                                         |
| 消费者 | **无**。`categorizePath` + `isAdminOnlyPath` 被 `app.guard.ts` + `jwt.strategy.ts` 消费，`getApiPrefix` 和 `buildApiPath` 从未被导入。 |

**已执行**: 删除两个函数，简化 `initializeApiPath` 为空钩子（保留供 bootstrap.ts 兼容），删除关联测试。

---

### 1.4 Auth 错误工厂 — 5 个未使用 (MEDIUM) ✅

| 文件 | `packages/server/src/auth/errors.ts`（22 个函数，17 个在用，5 个死） |

以下错误工厂仅在此文件中定义，外部无任何 import 或调用：

| 函数                          | 说明                                                      |
|-------------------------------|-----------------------------------------------------------|
| `decryptFailedError`          | 密码解密失败 — 可能预留给 admin 登录 RSA 加密使用但未落地 |
| `validationError`             | 通用校验错误 — 有 ZodValidationPipe 覆盖，不需要          |
| `captchaRequiredError`        | 验证码必填 — CAPTCHA 功能未上线                           |
| `captchaInvalidError`         | 验证码错误 — 同上                                         |
| `systemRoleDeleteDeniedError` | 系统角色不可删除 — admin role.controller 未使用           |

> **修正**: 原始报告标题误写"6 个"，实际为 **5 个**。原始报告称"16 个函数中 11 个在用"，实际为 22 个函数，17 个在用，5 个死。

**已执行**: 删除 5 个死函数，剩余 17 个全部在用的函数。

---

### 1.5 `SseResponseHelper.onClose()` — 公开但从未被调用 ✅

| 字段   | 内容                                                                                      |
|--------|-------------------------------------------------------------------------------------------|
| 文件   | `packages/server/src/common/helpers/sse-response.helper.ts`                               |
| 消费者 | **无**。`onCloseCallbacks` 数组仅被内部 `init()` / `end()` / `runCloseCallbacks()` 使用。 |

**已执行**: 删除 `onClose()` 方法。

---

## 二、过度导出 — 已降级

### 2.1 `isPublicPath` / `isWebOnlyPath` — 降级为私有 ✅

| 文件       | `packages/server/src/common/utils/api-path.ts`                                                                                      |
|------------|-------------------------------------------------------------------------------------------------------------------------------------|
| 外部消费者 | `isAdminOnlyPath` 被 `jwt.strategy.ts` 引用；`isPublicPath` 和 `isWebOnlyPath` 仅通过 `categorizePath` 间接使用，无外部直接消费者。 |

> **修正**: 原始报告建议同时降级 `extractSecondSegment` 和 `extractThirdSegment`，但二者本就未 export，无需处理。

**已执行**: 移除 `isPublicPath` 和 `isWebOnlyPath` 的 `export`，保留 `categorizePath` 和 `isAdminOnlyPath` 作为公共 API。

---

### 2.2 `ValidatedFile` / `FileValidationOptions` — 降级为私有 ✅

| 文件       | `packages/server/src/common/pipes/file-validation.pipe.ts`                   |
|------------|------------------------------------------------------------------------------|
| 外部消费者 | **无**。只在 pipe 自身和 `document.controller.ts` 中使用，接口未被外部导入。 |

**已执行**: 移除 `export`。

---

### 2.3 `ApiResponse<T>` / `ErrorResponse` — 降级为私有 ✅

| 文件       | `response.interceptor.ts` / `all-exception.filter.ts` |
|------------|-------------------------------------------------------|
| 外部消费者 | **无**。类型只用于自身文件。                          |

**已执行**: 移除 `export`。

---

## 三、逻辑冗余 / 过度工程 — 已简化

### 3.1 文件名清洗逻辑重复 (MEDIUM) ✅

| 文件                                   | 问题                                                                               |
|----------------------------------------|------------------------------------------------------------------------------------|
| `common/utils/filename-sanitizer.ts`   | 提供 `sanitizeFilename` + `buildStorageKey`，过滤 `[\\/:*?"<>                      |
| `common/pipes/file-validation.pipe.ts` | 自有 `sanitizeFilename` 仅过滤 `[\x00-\x1f\x7f]`（仅 control chars），安全策略更弱 |

**已执行**: pipe 改为 import 并使用 `filename-sanitizer.ts` 的统一实现，安全策略一致，同时减少约 25 行重复代码。

---

### 3.2 `withTrace` — 仅 2 文件消费 (LOW) ⏳ 保留不动

| 文件       | `packages/server/src/common/utils/with-trace.ts`                                       |
|------------|----------------------------------------------------------------------------------------|
| 外部消费者 | `stream-finalize.service.ts` (3 处), `chat-finalize.processor.ts` (8 处)，共 11 处调用 |

> **修正**: 原始报告称 `chat-finalize.processor.ts` 仅 2 处调用，实际为 8 处。

**决策**: 保留不动。11 处消费量已足够证明价值，且跨两个模块（common + processors），内联反而不便。

---

### 3.3 `RequestContext.email` 字段从未被填充 (MEDIUM) ✅

| 文件 | `packages/server/src/common/utils/request-context.ts`                                                   |
|------|---------------------------------------------------------------------------------------------------------|
| 问题 | `RequestContext` 接口定义了 `email?: string`，但 `extractRequestContext()` 中未提取，也无其他代码写入。 |

**已执行**: 从 `RequestContext` 接口删除 `email` 字段（连带删除 `normalizeEmail`）。

---

## 四、代码质量良好，无需改动

以下基础设施经过审查，**全部被正确消费、逻辑合理、无明显冗余**：

| 分类           | 文件                            | 消费者数量               | 评价                                    |
|----------------|---------------------------------|--------------------------|-----------------------------------------|
| 中间件         | `request-id.middleware.ts`      | bootstrap.ts 直接实例化  | 简洁有效                                |
| 中间件         | `request-context.middleware.ts` | bootstrap.ts 直接实例化  | 简洁有效                                |
| 过滤器         | `all-exception.filter.ts`       | APP_FILTER 全局注册      | AppException/HttpException/Error 全覆盖 |
| 拦截器         | `logging.interceptor.ts`        | APP_INTERCEPTOR 全局注册 | 采样/慢请求/脱敏逻辑                    |
| 拦截器         | `response.interceptor.ts`       | APP_INTERCEPTOR 全局注册 | BigInt 序列化兜底                       |
| 守卫           | `app.guard.ts`                  | APP_GUARD 全局注册       | 按路径前缀区分 app 上下文               |
| 守卫           | `spider.guard.ts`               | APP_GUARD 全局注册       | UA 白名单                               |
| 管道           | `zod-validation.pipe.ts`        | APP_PIPE 全局注册        | nestjs-zod 封装                         |
| 管道           | `file-validation.pipe.ts`       | document.controller.ts   | 已统一用 `filename-sanitizer.ts`        |
| 装饰器         | `public.decorator.ts`           | 3 个 controller          | 配合 AppGuard                           |
| 装饰器         | `bypass-response.decorator.ts`  | 2 个 controller          | SSE 流跳过包装                          |
| 装饰器( auth ) | `current-user.decorator.ts`     | 14 个 controller         | 高使用率                                |
| 装饰器( auth ) | `permission.decorator.ts`       | 5 个 controller          | RBAC 核心                               |
| 守卫( auth )   | `jwt.guard.ts`                  | 全局注册                 | Passport 封装                           |
| 守卫( auth )   | `permission.guard.ts`           | 全局注册                 | RBAC 权限校验                           |
| 策略( auth )   | `jwt.strategy.ts`               | Passport 注册            | Cookie + 双 app 上下文                  |
| 工具           | `api-path.ts`                   | app.guard + jwt.strategy | categorizer 合理                        |
| 工具           | `ssrf-guard.ts`                 | bootstrap.ts + settings  | 白名单 + 内网阻断                       |
| 工具           | `filename-sanitizer.ts`         | 3 个 service             | 带 buildStorageKey                      |
| 工具           | `request-context-storage.ts`    | 6 个消费者               | AsyncLocalStorage 单例                  |
| Helper         | `sse-response.helper.ts`        | 7 个消费者               | SSE 帧写入 + AbortController            |
| 事件           | `domain-event.base.ts`          | 4 个 event 子类          | 极简基类                                |
| 接口           | `IStorageProvider.ts`           | storage.service.ts       | 存储适配器契约                          |
| 服务           | `stream-finalize.service.ts`    | chat.service.ts          | BullMQ + microtask fallback             |
| 策略           | `auth-policy.ts`                | auth.service.ts          | web/admin 差异化策略表                  |
| 错误工厂       | `auth/errors.ts`                | 8 个消费者               | 17 个函数全部在用                       |

---

## 五、清理执行总结

### 删除 / 修改清单

| 操作 | 文件                                          | 内容                                                                                          |
|------|-----------------------------------------------|-----------------------------------------------------------------------------------------------|
| 删除 | `common/services/trace-context.service.ts`    | 整文件                                                                                        |
| 编辑 | `common/common.module.ts`                     | 移除 TraceContextService                                                                      |
| 编辑 | `common/utils/request-context.ts`             | 移除 `email` 字段 + `normalizeEmail`                                                          |
| 编辑 | `auth/errors.ts`                              | 移除 5 个死函数                                                                               |
| 编辑 | `common/utils/api-path.ts`                    | 移除 `getApiPrefix`/`buildApiPath`，降级 `isPublicPath`/`isWebOnly`，简化 `initializeApiPath` |
| 编辑 | `common/pipes/file-validation.pipe.ts`        | 统一用 `filename-sanitizer.ts`，降级 `ValidatedFile`/`FileValidationOptions`                  |
| 编辑 | `common/interceptors/response.interceptor.ts` | 降级 `ApiResponse<T>`                                                                         |
| 编辑 | `common/filters/all-exception.filter.ts`      | 降级 `ErrorResponse`                                                                          |
| 编辑 | `common/helpers/sse-response.helper.ts`       | 移除 `onClose()`                                                                              |
| 删除 | `tests/common/trace-context.service.spec.ts`  | 随服务删除                                                                                    |
| 编辑 | `tests/common/utils/api-path.spec.ts`         | 移除死函数测试                                                                                |

### 验证结果

- `pnpm type-check`: 4/4 packages 通过
- `pnpm lint`: 通过（无新增 warning）
- 所有剩余 lint warning 均为已有问题，与本次修改无关

### 统计数据

| 指标               | 数量                 |
|--------------------|----------------------|
| 删除文件           | 2（1 源码 + 1 测试） |
| 删除函数/方法/字段 | 10                   |
| export 降级为私有  | 6                    |
| 重复逻辑收敛       | 1                    |
| 编辑文件数         | 11                   |
