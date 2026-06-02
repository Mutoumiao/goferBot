---
id: b-07
issue: issue.md
version: 1
---

# HealthController + 全局中间件验证测试 实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 为 HealthController 和全局中间件（ResponseInterceptor、AllExceptionsFilter、ZodValidationPipe、ThrottlerGuard）编写模块级集成测试，验证统一响应格式、异常处理、验证管道、速率限制。

**架构：** 使用 TestAppFactory 创建完整 NestJS 应用（不 mock 中间件），通过动态注册测试 Controller 触发特定中间件行为，避免污染生产代码。每个测试独立创建 app 实例，防止状态污染。

**技术栈：** NestJS 10 + Fastify + Vitest + nestjs-zod + @nestjs/throttler

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/](specs/)

---

## 文件结构

- 创建：`tests/issues/b-07-health-and-middleware-testing/health.spec.ts`
- 创建：`tests/issues/b-07-health-and-middleware-testing/exception.spec.ts`
- 创建：`tests/issues/b-07-health-and-middleware-testing/validation.spec.ts`
- 创建：`tests/issues/b-07-health-and-middleware-testing/throttle.spec.ts`

---

## 任务分解

### 任务 1: HealthController 基础测试（AC-01 + AC-02）

**文件：**
- 创建：`tests/issues/b-07-health-and-middleware-testing/health.spec.ts`

**规格引用：**
- API 规格：[GET /health — 响应 200]
- API 规格：[ResponseInterceptor — data 包装]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-07-health-and-middleware-testing/health.spec.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { HealthModule } from '../../../packages/server/src/modules/health/health.module.js'
import { ResponseInterceptor } from '../../../packages/server/src/common/interceptors/response.interceptor.js'
import { AllExceptionsFilter } from '../../../packages/server/src/common/filters/all-exception.filter.js'
import { Reflector } from '@nestjs/core'

async function setupHealthApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [HealthModule],
  }).compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  )
  app.useGlobalInterceptors(new ResponseInterceptor(new Reflector()))
  app.useGlobalFilters(new AllExceptionsFilter())
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}

describe('HealthController', () => {
  it('AC-01: returns health status with data wrapper', async () => {
    const app = await setupHealthApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toBeDefined()
    expect(body.data.status).toBe('ok')
    expect(body.data).toHaveProperty('timestamp')
    expect(body.data).toHaveProperty('version')
    await app.close()
  })

  it('AC-02: wraps response in data field', async () => {
    const app = await setupHealthApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    const body = res.json()
    expect(body).toHaveProperty('data')
    expect(body).not.toHaveProperty('status')
    await app.close()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-07-health-and-middleware-testing/health.spec.ts --config vitest.integration.config.ts`
预期：FAIL — `ResponseInterceptor` 或 `AllExceptionsFilter` 未正确注册，或 `HealthModule` 依赖缺失。

> 注意：`setupHealthApp` 使用精简模块而非完整 `AppModule`，因为 HealthController 无需数据库/认证/其他业务模块。但需手动注册全局 interceptor/filter。

- [ ] **步骤 3: 调整测试使 RED 正确**

若失败原因不是预期中的"功能缺失"，而是模块依赖错误（如 `Reflector` 未正确提供），修复 `setupHealthApp` 中的 provider 配置，直到测试因断言失败（而非报错）而失败。

- [ ] **步骤 4: 编写最小实现（无生产代码变更）**

HealthController 和中间件已实现。测试应直接通过。若测试通过，说明现有代码已满足 spec。

- [ ] **步骤 5: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-07-health-and-middleware-testing/health.spec.ts --config vitest.integration.config.ts`
预期：PASS（2 个测试通过）

- [ ] **步骤 6: 提交**

```bash
git add tests/issues/b-07-health-and-middleware-testing/health.spec.ts
git commit -m "test(b-07): add HealthController response format tests (AC-01, AC-02)"
```

---

### 任务 2: AllExceptionsFilter 异常格式测试（AC-03）

**文件：**
- 创建：`tests/issues/b-07-health-and-middleware-testing/exception.spec.ts`

**规格引用：**
- API 规格：[AllExceptionsFilter — 异常格式]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-07-health-and-middleware-testing/exception.spec.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { Controller, Get } from '@nestjs/common'
import { HealthModule } from '../../../packages/server/src/modules/health/health.module.js'
import { ResponseInterceptor } from '../../../packages/server/src/common/interceptors/response.interceptor.js'
import { AllExceptionsFilter } from '../../../packages/server/src/common/filters/all-exception.filter.js'
import { Reflector } from '@nestjs/core'

@Controller('test-exception')
class TestExceptionController {
  @Get('throw')
  throwError() {
    throw new Error('Test error')
  }
}

async function setupExceptionApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [HealthModule],
    controllers: [TestExceptionController],
  }).compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  )
  app.useGlobalInterceptors(new ResponseInterceptor(new Reflector()))
  app.useGlobalFilters(new AllExceptionsFilter())
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}

describe('AllExceptionsFilter', () => {
  it('AC-03: returns structured error for thrown exception', async () => {
    const app = await setupExceptionApp()
    const res = await app.inject({ method: 'GET', url: '/test-exception/throw' })
    expect(res.statusCode).toBe(500)
    const body = res.json()
    expect(body.error).toBeDefined()
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('Test error')
    await app.close()
  })

  it('AC-03b: returns structured error for unknown route (404)', async () => {
    const app = await setupExceptionApp()
    const res = await app.inject({ method: 'GET', url: '/nonexistent-route-12345' })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.error).toBeDefined()
    expect(body.error.code).toBe('NOT_FOUND')
    await app.close()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-07-health-and-middleware-testing/exception.spec.ts --config vitest.integration.config.ts`
预期：FAIL — 断言失败（若中间件已正确工作则直接通过，需确认 RED 状态）。

> 若测试直接通过，说明 AllExceptionsFilter 已正常工作。这是允许的，因为本 issue 是**验证测试**而非**新增功能**。但需确认测试确实验证了正确的行为。

- [ ] **步骤 3: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-07-health-and-middleware-testing/exception.spec.ts --config vitest.integration.config.ts`
预期：PASS（2 个测试通过）

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-07-health-and-middleware-testing/exception.spec.ts
git commit -m "test(b-07): add AllExceptionsFilter error format tests (AC-03)"
```

---

### 任务 3: ZodValidationPipe 字段级校验测试（AC-04）

**文件：**
- 创建：`tests/issues/b-07-health-and-middleware-testing/validation.spec.ts`

**规格引用：**
- API 规格：[ZodValidationPipe — 400 + 字段级错误]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-07-health-and-middleware-testing/validation.spec.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { Controller, Post, Body } from '@nestjs/common'
import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { ZodValidationPipe } from '../../../packages/server/src/common/pipes/zod-validation.pipe.js'
import { AllExceptionsFilter } from '../../../packages/server/src/common/filters/all-exception.filter.js'
import { Reflector } from '@nestjs/core'

const testSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  age: z.number().int().min(0, '年龄不能为负数'),
})

class TestDto extends createZodDto(testSchema) {}

@Controller('test-validation')
class TestValidationController {
  @Post()
  create(@Body() dto: TestDto) {
    return dto
  }
}

async function setupValidationApp() {
  const moduleRef = await Test.createTestingModule({
    controllers: [TestValidationController],
  }).compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  )
  app.useGlobalPipes(new ZodValidationPipe())
  app.useGlobalFilters(new AllExceptionsFilter())
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}

describe('ZodValidationPipe', () => {
  it('AC-04: returns 400 with field-level errors for invalid input', async () => {
    const app = await setupValidationApp()
    const res = await app.inject({
      method: 'POST',
      url: '/test-validation',
      payload: { name: '', age: -1 },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error).toBeDefined()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('请求参数校验失败')
    expect(Array.isArray(body.error.details)).toBe(true)
    expect(body.error.details.length).toBeGreaterThanOrEqual(1)
    expect(body.error.details[0]).toHaveProperty('field')
    expect(body.error.details[0]).toHaveProperty('issue')
    await app.close()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-07-health-and-middleware-testing/validation.spec.ts --config vitest.integration.config.ts`
预期：FAIL — 断言失败。

- [ ] **步骤 3: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-07-health-and-middleware-testing/validation.spec.ts --config vitest.integration.config.ts`
预期：PASS（1 个测试通过）

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-07-health-and-middleware-testing/validation.spec.ts
git commit -m "test(b-07): add ZodValidationPipe field-level error test (AC-04)"
```

---

### 任务 4: ThrottlerGuard 速率限制测试（AC-05）

**文件：**
- 创建：`tests/issues/b-07-health-and-middleware-testing/throttle.spec.ts`

**规格引用：**
- API 规格：[ThrottlerGuard — 429 + Retry-After]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-07-health-and-middleware-testing/throttle.spec.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { Controller, Get } from '@nestjs/common'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { AllExceptionsFilter } from '../../../packages/server/src/common/filters/all-exception.filter.js'

@Controller('test-throttle')
class TestThrottleController {
  @Get()
  getData() {
    return { ok: true }
  }
}

async function setupThrottleApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot([{ name: 'test', ttl: 60000, limit: 1 }]),
    ],
    controllers: [TestThrottleController],
  }).compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  )
  app.useGlobalGuards(new ThrottlerGuard())
  app.useGlobalFilters(new AllExceptionsFilter())
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}

describe('ThrottlerGuard', () => {
  it('AC-05: returns 429 with Retry-After header on second request', async () => {
    const app = await setupThrottleApp()

    // 第一次请求应成功
    const res1 = await app.inject({ method: 'GET', url: '/test-throttle' })
    expect(res1.statusCode).toBe(200)

    // 第二次请求应被限流
    const res2 = await app.inject({ method: 'GET', url: '/test-throttle' })
    expect(res2.statusCode).toBe(429)
    const body = res2.json()
    expect(body.error).toBeDefined()
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(res2.headers['retry-after']).toBeDefined()
    await app.close()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-07-health-and-middleware-testing/throttle.spec.ts --config vitest.integration.config.ts`
预期：FAIL — 断言失败。

- [ ] **步骤 3: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-07-health-and-middleware-testing/throttle.spec.ts --config vitest.integration.config.ts`
预期：PASS（1 个测试通过）

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-07-health-and-middleware-testing/throttle.spec.ts
git commit -m "test(b-07): add ThrottlerGuard rate limit test (AC-05)"
```

---

### 任务 5: 全量验证（AC-06）

**规格引用：**
- checklist：[AC-06 — 所有测试在 pnpm test:integration 中通过]

- [ ] **步骤 1: 运行 b-07 全部测试**

运行：`npx vitest run tests/issues/b-07-health-and-middleware-testing/ --config vitest.integration.config.ts`
预期：PASS（5+ 个测试全部通过）

- [ ] **步骤 2: 运行类型检查**

运行：`pnpm type-check`
预期：0 错误

- [ ] **步骤 3: 运行全量测试确认无回归**

运行：`npx vitest run --config vitest.integration.config.ts`
预期：所有测试通过，无回归

- [ ] **步骤 4: 提交**

```bash
git add docs/issues/b-07-health-and-middleware-testing/checklist.json
git commit -m "test(b-07): complete all middleware integration tests (AC-01~AC-05)"
```

---

## 自检

**1. 规格覆盖：**
- AC-01 (Health 200) → 任务 1
- AC-02 (ResponseInterceptor) → 任务 1
- AC-03 (AllExceptionsFilter) → 任务 2
- AC-04 (ZodValidationPipe) → 任务 3
- AC-05 (ThrottlerGuard) → 任务 4
- AC-06 (全量通过) → 任务 5

**2. 占位符扫描：** 无 TBD/TODO/稍后实现。

**3. 类型一致性：** 所有测试使用一致的 `setupXxxApp` 模式，动态注册测试 Controller。

**4. TDD 合规：** 每个任务以测试代码开始，以验证命令结束。本 issue 为验证测试（中间件已存在），测试可能直接通过（GREEN），这是允许的，因为目标是验证现有行为而非新增功能。
