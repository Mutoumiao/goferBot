# 测试体系总览

> 本文档定义 GoferBot 项目的测试金字塔结构、分层职责、命令速查与目录映射。
> 所有测试规范按**测试层级**（unit / integration / e2e）组织，与 `tests/` 目录结构对齐。

---

## 1. 测试金字塔

```
        /\
       /  \     E2E 测试（少而精）— 验证完整用户旅程
      /----\
     /      \   集成测试（中等）— 验证模块联调 + 真实数据库
    /--------\
   /          \ 单元测试（最多）— 验证单一函数/组件/Service
  /------------\
```

| 层级 | 目录 | 运行命令 | 配置文件 | 指南 |
|------|------|----------|----------|------|
| **单元测试** | `tests/unit/` | `pnpm test` | `vitest.config.ts` | [unit-testing-guide.md](./unit-testing-guide.md) |
| **集成测试** | `tests/integration/` | `pnpm test:integration` | `vitest.integration.config.ts` | [integration-testing-guide.md](./integration-testing-guide.md) |
| **E2E 测试** | `tests/e2e/` | `pnpm test:e2e` | `playwright.config.ts` | [e2e-testing-guide.md](./e2e-testing-guide.md) |

---

## 2. 分层职责

### 单元测试（Unit）

- **范围**：单一函数、React 组件、Zustand Store、NestJS Service、纯工具函数
- **原则**：无外部依赖（数据库、网络、文件系统），全部 mock
- **速度**：毫秒级，可频繁运行
- **数量**：最多，覆盖所有业务逻辑分支

### 集成测试（Integration）

- **范围**：NestJS Controller + Service + 真实数据库，通过 HTTP 请求验证
- **原则**：数据库真实，外部 IO（Redis/MinIO/Queue）mock
- **速度**：秒级，每个 `it()` 创建独立数据库
- **数量**：中等，覆盖核心 API 流程和错误场景

### E2E 测试（End-to-End）

- **范围**：完整用户流程，真实浏览器操作前后端联调
- **原则**：黑盒测试，从用户视角验证功能
- **速度**：分钟级，完整启动应用栈
- **数量**：最少，覆盖关键用户旅程

---

## 3. 目录结构

```
tests/
├── unit/
│   ├── server/        # 后端单元测试（Service/Util/Worker）— .spec.ts
│   ├── web/           # 前端 Issue 验收测试 — .spec.tsx
│   │   └── (已迁移至 packages/web/tests/)
│   ├── components/    # 历史 Vue 组件测试 — .test.ts（已冻结）
│   ├── stores/        # 历史 Pinia Store 测试 — .test.ts（已冻结）
│   ├── composables/   # 历史组合式函数测试 — .test.ts（已冻结）
│   └── utils/         # 工具函数测试 — .test.ts
├── integration/       # 后端 API 集成测试 — .spec.ts
│   └── helpers/
│       ├── test-app.factory.ts
│       ├── auth.fixtures.ts
│       ├── test-database.manager.ts
│       ├── infra-check.ts          # 基础设施可用性检测
│       ├── external-service.mocker.ts  # nock 封装
│       ├── setup.ts                # 共享生命周期（setupE2E/teardownE2E）
│       └── teardown.ts             # 共享数据清理
└── e2e/
    ├── specs/         # 单页面功能测试
    ├── flows/         # 跨模块用户旅程
    ├── pages/         # Page Object 模式
    ├── fixtures/      # 测试夹具
    ├── mocks/         # Mock 路由
    ├── debug/         # 临时调试测试（不提交）
    ├── .gstack/       # QA 报告截图
    ├── playwright.config.ts
    ├── playwright.global-setup.ts
    └── playwright.global-teardown.ts
```

---

## 4. Issue 前缀与测试目录映射

| Issue 前缀 | 轨道 | 测试目录 | 测试层级 | 示例 |
|------------|------|----------|----------|------|
| `f-XX` | 前端功能 | `packages/web/tests/` | 单元 | `f-16-kb-selector` → `packages/web/tests/kb-selector.spec.tsx` |
| `b-XX` | 后端功能 | `tests/unit/server/` 或 `tests/integration/` | 单元/集成 | `b-04-kb-crud` → `tests/integration/knowledge-base.spec.ts` |
| `i-XX` | 基础设施 | `tests/integration/` | 集成 | `i-01-infra` → `tests/integration/infra.spec.ts` |
| `q-XX` | 质量/测试 | `tests/e2e/` 或 `tests/integration/` | E2E / 集成 | `q-01-onboarding` → `tests/e2e/flows/onboarding.spec.ts`<br>`q-17-rev` → `tests/integration/auth-kb-document.spec.ts` |
| `d-XX` | 设计 | — | — | 无测试代码 |

---

## 5. 文件命名规范

| 后缀 | 用途 | 位置 | 用例命名 |
|------|------|------|----------|
| `.spec.ts` / `.spec.tsx` | **Issue 验收测试**（TDD，与 checklist.json 对齐） | `packages/web/tests/`、`tests/unit/server/`、`tests/integration/`、`tests/e2e/` | 必须以 `AC-XX:` 开头 |
| `.test.ts` | 通用单元测试（组件、Store、工具函数） | `tests/unit/components/`、`tests/unit/stores/`、`tests/unit/composables/`、`tests/unit/utils/` | 描述式，无 AC-XX 要求 |

---

## 6. 快速命令

### 单元测试

```bash
pnpm test                    # 全部单元测试
pnpm vitest run tests/unit/components/ChatMessage.test.ts   # 单个文件
pnpm vitest run -t "AC-01"   # 按名称过滤
pnpm vitest                  # 监视模式
pnpm vitest --ui             # UI 模式
```

### 集成测试

```bash
pnpm test:integration                    # 全部集成测试
pnpm vitest run --config vitest.integration.config.ts tests/integration/chat.spec.ts   # 单个文件
pnpm vitest run --config vitest.integration.config.ts -t "AC-03"   # 按 AC 过滤
pnpm test:integration:watch              # 监视模式
```

### E2E 测试

```bash
pnpm test:e2e              # 全部 E2E 测试
pnpm test:e2e --ui         # UI 模式（可调试）
pnpx playwright test tests/e2e/flows/onboarding.spec.ts   # 单个文件
```

---

## 7. 覆盖率门槛

| 层级 | 行覆盖率 | 函数覆盖率 | 分支覆盖率 | 语句覆盖率 |
|------|----------|------------|------------|------------|
| 前端单元 | 70% | 60% | 55% | 70% |
| **后端单元** | **60%** | **50%** | **40%** | **60%** |
| 集成测试 | — | — | — | — |
| E2E 测试 | — | — | — | — |

> **渐进式实施计划：**
> - **阶段 1（当前）**：仅报告覆盖率，不阻断 CI
> - **阶段 2**：低于门槛时 CI 警告（黄色）
> - **阶段 3**：低于门槛时 CI 阻断（红色）
>
> 后端单元/集成/E2E 覆盖率门槛已定义，当前处于阶段 1（报告模式）。

---

## 8. 测试数据管理

### Fixtures（前后端通用）

- **定义**：可复用的测试数据构造器，封装复杂对象的创建逻辑
- **命名**：`*.fixtures.ts`
- **后端示例**：`tests/integration/helpers/auth.fixtures.ts`
- **前端示例**：组件 props fixture、Pinia 初始状态 fixture

### Factories

- **定义**：动态生成测试数据的工厂函数，支持覆盖默认值
- **命名**：`*.factory.ts`
- **用途**：批量生成相似但不同的测试实体

详见各层级指南中的"测试数据"章节。

---

## 9. 编写规范

### Arrange-Act-Assert（AAA）

所有测试用例遵循三段式结构：

```typescript
it('AC-01: returns user profile for authenticated request', async () => {
  // Arrange: 准备数据和依赖
  const user = await AuthFixtures.createUser(app, { email: 'test@gofer.bot' })
  const token = await AuthFixtures.loginAs(app, { email: 'test@gofer.bot', password: 'Test1234!' })

  // Act: 执行被测操作
  const res = await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: `Bearer ${token}` } })

  // Assert: 验证结果
  expect(res.statusCode).toBe(200)
  expect(res.json().data.email).toBe('test@gofer.bot')
})
```

### Given-When-Then（GWT）

适用于行为描述性较强的场景（尤其是 E2E）：

```typescript
it('AC-01: user can create a knowledge base', async () => {
  // Given: 用户已登录
  await authPage.login('user@gofer.bot', 'password')

  // When: 用户填写表单并提交
  await kbPage.fillName('Test KB')
  await kbPage.submit()

  // Then: 知识库出现在列表中
  await expect(kbPage.listItem('Test KB')).toBeVisible()
})
```

---

## 10. 真实数据库 vs Mock 决策原则

| 依赖类型 | 单元测试 | 集成测试 | E2E 测试 |
|----------|----------|----------|----------|
| PostgreSQL | ❌ Mock / 不使用 | ✅ 真实数据库（每个 it 隔离） | ✅ 共享测试数据库 |
| Redis / BullMQ | ❌ Mock | ❌ Mock（空实现） | ✅ 真实（如需要） |
| 向量数据库 (pgvector) | ❌ Mock | ❌ Mock（空实现） | ✅ 真实（如需要） |
| MinIO / S3 | ❌ Mock | ❌ Mock（固定返回值） | ✅ 真实（如需要） |
| 外部 API（OpenAI） | ❌ Mock | ❌ Mock（vi.spyOn fetch） | ❌ Mock |
| NestJS Service | ✅ 直接实例化 | ✅ 通过模块加载 | ✅ 黑盒，不直接调用 |
| React 组件子组件 | ✅ Mock / 直接渲染 | — | — |

---

## 11. 常见问题

### Q: `.spec.ts` 和 `.test.ts` 有什么区别？

A: `.spec.ts` 是**Issue 验收测试**，与 issue 的 `checklist.json` 对齐，用例名必须以 `AC-XX:` 开头。`.test.ts` 是**通用单元测试**，无 AC-XX 要求，用于覆盖组件、Store、工具函数等基础单元。

### Q: 前端单元测试需要数据库吗？

A: **不需要**。前端单元测试在 `happy-dom` 虚拟环境中运行，所有 API 调用通过 `vi.mock` 或 `vi.fn()` mock。

### Q: 集成测试为什么每个 `it()` 都创建新数据库？

A: 确保测试隔离，避免数据污染。`TestDatabaseManager` 使用随机数据库名，测试结束后自动删除。

### Q: E2E 测试需要启动哪些服务？

A: 完整应用栈：PostgreSQL、Redis、后端服务（`pnpm dev:server`）、前端（`pnpm dev:web`）。详见 [e2e-testing-guide.md](./e2e-testing-guide.md)。
