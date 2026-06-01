---
id: q-17-rev
issue: issue.md
version: 1
---

# q-17 真实 API 版本计划

> **目标：** 实现 q-17 剩余 5 个 pending AC，使用真实后端 API
> **架构：** TestAppFactory + 真实数据库 + 集成测试层
> **技术栈：** vitest + NestJS + Prisma + pgvector

**Issue 引用：** `issue.md`
**Spec 引用：** `specs/`
**测试引用：** `tests/integration/`

---

## 文件结构

### 测试（新增）

- `tests/integration/q-17-rev.spec.ts` — 新增：5 个 pending AC 的真实 API 测试

---

## 任务列表

### 任务 1: 创建 q-17-rev.spec.ts

**文件：**
- 创建：`tests/integration/q-17-rev.spec.ts`

**规格引用：**
- api-spec.md "AC-06~AC-16"

- [ ] **步骤 1: 编写测试骨架**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { checkInfrastructure } from './helpers/infra-check.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('q-17 Real API Tests', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let infraAvailable = false

  beforeAll(async () => {
    const infraResult = await checkInfrastructure()
    infraAvailable = infraResult.allAvailable
    if (!infraAvailable) {
      console.log('[q-17-rev] 基础设施不可用，跳过')
      return
    }

    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('q17_rev')
    dbName = new URL(dbUrl).pathname.slice(1)

    app = await TestAppFactory.create(dbUrl, { realMode: true })
  }, 120000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  beforeEach(async () => {
    if (!infraAvailable) return
    const prisma = app.get('PrismaService')
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE "Chunk", "Document", "KnowledgeBase", "User" RESTART IDENTITY CASCADE
    `)
  })

  // AC-06: 未登录重定向
  it('AC-06: 未登录访问保护路由返回 401', async () => {
    if (!infraAvailable) return
    // 实现...
  })

  // AC-08: 重复注册
  it('AC-08: 重复注册相同邮箱返回 409', async () => {
    if (!infraAvailable) return
    // 实现...
  })

  // AC-12: 上传文档
  it('AC-12: 上传文档到知识库，状态变为 ready', async () => {
    if (!infraAvailable) return
    // 实现...
  }, 90000)

  // AC-15: 用户隔离
  it('AC-15: 用户 B 无法操作用户 A 的知识库', async () => {
    if (!infraAvailable) return
    // 实现...
  })

  // AC-16: 多类型文档
  it('AC-16: 上传 txt/md/pdf 三种类型文档', async () => {
    if (!infraAvailable) return
    // 实现...
  }, 120000)
})
```

- [ ] **步骤 2: 实现 AC-06**
  - 测试无 token 访问 `/api/auth/me` 返回 401
  - 测试无 token 访问 `/api/knowledge-bases` 返回 401

- [ ] **步骤 3: 实现 AC-08**
  - 注册用户 A
  - 再次使用相同邮箱注册
  - 验证返回 409

- [ ] **步骤 4: 实现 AC-12**
  - 创建用户、登录、创建 KB
  - 上传 txt 文件
  - 等待状态变为 ready（最长 60 秒）
  - 验证 document.status === 'ready'

- [ ] **步骤 5: 实现 AC-15**
  - 创建用户 A 和 KB
  - 创建用户 B
  - 用户 B 尝试访问/操作用户 A 的 KB
  - 验证返回 403

- [ ] **步骤 6: 实现 AC-16**
  - 上传 txt、md、pdf 三种类型
  - 验证均成功（或 pdf 标记为 failed 如未实现解析）

---

### 任务 2: 运行并验证

- [ ] **步骤 1: 启动 Docker**
  ```bash
  docker-compose up -d
  ```

- [ ] **步骤 2: 运行测试**
  ```bash
  npx vitest run tests/integration/q-17-rev.spec.ts --reporter=verbose
  ```

- [ ] **步骤 3: 确认全部通过**
  - 5 个 AC 全部 pass
  - 非跳过（基础设施可用）

---

### 任务 3: 关闭 q-17

- [ ] **步骤 1: 更新 q-17 checklist.json**
  - 将 5 个 pending AC 标记为 passed
  - 更新 q-17 status 为 closed

- [ ] **步骤 2: 更新 BACKLOG.md**
  - 移除 q-17
  - 添加 q-17-rev 到 closed

- [ ] **步骤 3: 更新 CHANGELOG.md**
  - 记录 q-17 关闭

---

## 规格覆盖检查

- [ ] 功能规格：AC-06, AC-08, AC-12, AC-15, AC-16 全部覆盖
- [ ] API 规格：全部涉及端点覆盖
- [ ] 无占位符（"TODO" / "稍后实现" / "TBD"）

---

## 阻塞与依赖

- 阻塞于：q-23（需要集成测试基础设施完整）
- 阻塞下游：无（本 issue 是重建计划最后一步）
