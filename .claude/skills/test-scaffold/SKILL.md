---
name: test-scaffold
description: >
  TDD 测试骨架生成器。根据 issue 的 spec 文件自动生成 `.spec.ts` 测试骨架，
  并运行确认 red（失败）状态。
  当用户说"生成测试骨架"、"写测试"、"根据 spec 生成测试"、
  "TDD 初始化"、"red 阶段"时触发。
  应在 dev-orchestrator 检测到测试不存在时自动调用。
---

# TDD 测试骨架生成器

## 执行摘要

| 项目 | 内容 |
|------|------|
| **触发词** | "生成测试骨架"、"写测试"、"根据 spec 生成测试"、"red 阶段" |
| **硬关卡** | 测试必须运行失败（red）后才能进入 green 阶段 |
| **核心输出** | `tests/{layer}/{name}.spec.ts` + 运行确认 red 状态 |
| **禁止行为** | 生成测试后直接开始实现、不运行验证 red 状态 |
| **下一步** | red 确认后 → 进入 dev-orchestrator / executing-plans 执行开发 |

**核心理念**：测试即契约。测试骨架是 spec 到代码的第一层翻译，必须在实现前完成并验证失败。

**开始时声明：** "正在使用 test-scaffold skill 根据 spec 生成测试骨架。"

---

## 输入来源

生成测试骨架前，必须读取以下文档（按优先级）：

| 优先级 | 文档 | 提取内容 |
|--------|------|----------|
| 1 | `docs/issues/{dir}/specs/api-spec.md` | 端点定义、请求/响应结构、错误码、DTO 定义 |
| 2 | `docs/issues/{dir}/specs/behavior-spec.md` | 交互状态表格（loading/empty/error/success/partial）、测试映射 |
| 3 | `docs/issues/{dir}/specs/feature-spec.md` | 用户故事、边界条件、涉及页面/组件 |
| 4 | `docs/issues/{dir}/issue.md` | frontmatter（id、track、checklist）、验收标准 |
| 5 | `docs/issues/{dir}/checklist.json` | AC 编号列表（如 AC-01 ~ AC-15） |

---

## 测试文件路径决策

根据 issue track 前缀和 spec 内容，确定测试文件位置：

| Track | 测试层级 | 路径模板 | 参考文档 |
|-------|----------|----------|----------|
| `b-*`（后端 API） | 单元测试 | `tests/unit/server/{name}.spec.ts` | 单元测试指南 |
| `b-*`（后端 API） | 集成测试 | `tests/integration/{name}.spec.ts` | 集成测试指南 |
| `f-*`（前端组件） | 单元测试 | `tests/unit/webui/{name}.spec.ts` | 单元测试指南 |
| `i-*`（基础设施） | 集成测试 | `tests/integration/{name}.spec.ts` | 集成测试指南 |
| `q-*`（E2E） | E2E 测试 | `tests/e2e/specs/{name}.spec.ts` | E2E 测试指南 |

**命名规则**：
- 文件名使用 kebab-case，与 issue slug 一致或取功能名
- 示例：`b-14-admin-user-management` → `tests/unit/server/prisma-pagination.spec.ts` + `tests/integration/admin-user-management.spec.ts`

---

## 生成规则（按 Spec 类型）

### 规则 1：从 API Spec 生成后端测试

**读取 api-spec.md 中的：**
- 端点列表（`### GET/POST/PATCH/DELETE /api/...`）
- 请求参数表格（查询参数、请求体 DTO）
- 响应结构（成功、错误）
- 错误码表格
- 测试映射表格（如有）

**生成结构：**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from '../helpers/test-app.factory'
import { TestDatabaseManager } from '../helpers/test-database.manager'

// 如需要认证
// import { AuthFixtures } from '../helpers/auth.fixtures'

describe('AC-01: {端点功能描述}', () => {
  const dbManager = new TestDatabaseManager()
  let app: any
  let dbUrl: string

  beforeAll(async () => {
    dbUrl = await dbManager.createDatabase()
    app = await TestAppFactory.create(dbUrl)
  })

  afterAll(async () => {
    await app.close()
    await dbManager.dropDatabase()
  })

  it('should {成功场景描述}', async () => {
    // Arrange: 准备数据
    // Act: 发送请求
    const response = await app.inject({
      method: 'GET',
      url: '/api/{endpoint}',
      // headers: { authorization: `Bearer ${token}` },
      // payload: { ... },
    })

    // Assert: 验证响应
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data).toBeDefined()
    // 根据 api-spec 的响应结构添加具体断言
  })

  it('should {错误场景描述}', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/{endpoint}',
    })

    expect(response.statusCode).toBe(401) // 或对应的错误码
    const body = JSON.parse(response.body)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })
})
```

**AC 编号映射规则：**

| api-spec 中的测试映射 | 生成的 describe/it |
|----------------------|-------------------|
| `AC-01: admin users list with pagination` | `describe('AC-01: admin users list with pagination', () => { it('should return paginated user list for admin', ...) })` |
| 错误码场景 | 独立的 `it('should return {码} for {场景}', ...)` |

---

### 规则 2：从 Behavior Spec 生成前端测试

**读取 behavior-spec.md 中的：**
- 交互状态表格（loading / empty / error / success / partial）
- 错误场景表格
- 正常流程步骤
- 测试映射表格

**生成结构：**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MyComponent from '../../../packages/webui/src/components/MyComponent.vue'

describe('AC-01: {组件功能}', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders in loading state', () => {
    const wrapper = mount(MyComponent, {
      props: { loading: true },
    })
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
  })

  it('renders in empty state', () => {
    const wrapper = mount(MyComponent, {
      props: { data: [] },
    })
    expect(wrapper.find('[data-testid="empty"]').exists()).toBe(true)
  })

  it('renders in error state', () => {
    const wrapper = mount(MyComponent, {
      props: { error: new Error('test error') },
    })
    expect(wrapper.find('[data-testid="error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="retry-button"]').exists()).toBe(true)
  })

  it('renders in success state', () => {
    const wrapper = mount(MyComponent, {
      props: { data: [{ id: '1', name: 'Test' }] },
    })
    expect(wrapper.findAll('[data-testid="item"]').length).toBe(1)
  })
})
```

---

### 规则 3：从 Feature Spec 生成分层测试

**feature-spec.md 提供：**
- 用户故事 → 确定测试的"角色"和"目标"
- 边界条件 → 确定边界测试用例
- 范围外内容 → 避免生成无关测试

**示例映射：**

```markdown
feature-spec.md:
- 范围内：知识库 CRUD、文件夹管理
- 范围外：文件内容预览、权限共享

→ 测试骨架只包含 CRUD + 文件夹相关 AC，不包含预览/权限
```

---

### 规则 4：从 Checklist 生成 AC 覆盖

**checklist.json 格式：**

```json
{
  "items": [
    { "id": "AC-01", "description": "Prisma paginate 返回正确数据" },
    { "id": "AC-02", "description": "Session 列表返回分页格式" },
    { "id": "AC-03", "description": "Schema 包含 role 和 isActive" }
  ]
}
```

**生成规则：**
- 每个 AC 对应至少一个 `it()` 块
- `describe()` 块可按功能分组多个 AC
- 生成的测试用例名必须包含 AC 编号：`it('AC-01: Prisma paginate returns correct data', ...)`

---

## 测试基础设施适配

根据项目现有测试基础设施生成适配代码：

### 后端集成测试基础设施

```typescript
// 标准导入（来自 tests/integration/helpers/）
import { TestAppFactory } from '../helpers/test-app.factory'
import { TestDatabaseManager } from '../helpers/test-database.manager'

// 如需认证
import { AuthFixtures } from '../helpers/auth.fixtures'

// 使用模式
const dbManager = new TestDatabaseManager()
let app: any
let dbUrl: string

beforeAll(async () => {
  dbUrl = await dbManager.createDatabase()
  app = await TestAppFactory.create(dbUrl)
})

afterAll(async () => {
  await app.close()
  await dbManager.dropDatabase()
})
```

### 前端单元测试基础设施

```typescript
// Vue 组件测试
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// 如需路由
import { createRouter, createWebHistory } from 'vue-router'

beforeEach(() => {
  setActivePinia(createPinia())
})
```

### Infra 可用性检查（集成/E2E）

对于依赖外部服务的测试，生成 infra-check：

```typescript
import { infraAvailable } from '../helpers/infra-check'

const itIfInfra = await infraAvailable(['postgres', 'redis']) ? it : it.skip

describe('AC-03: {功能}', () => {
  itIfInfra('should {场景}', async () => {
    // ...
  })
})
```

---

## 执行流程

### 步骤 1：读取 Spec 和 Checklist

```
读取 docs/issues/{dir}/specs/*.md
读取 docs/issues/{dir}/checklist.json
读取 docs/issues/{dir}/issue.md frontmatter
```

### 步骤 2：确定测试文件路径与存在性处理

```
根据 track 前缀 → 确定 tests/{layer}/ 目录
根据功能名 → 确定文件名
检查文件是否已存在
    ↓ 不存在
生成全新测试骨架
    ↓ 已存在
读取现有测试，统计已有 AC 覆盖
```

**文件已存在时的处理：**

| 情况 | 处理方式 |
|------|----------|
| 测试已存在且覆盖全部 AC | 跳过生成，直接运行 red 验证 |
| 测试已存在但缺少部分 AC | 追加缺失的 `it()` 块，保留已有测试 |
| 测试已存在但结构不符规范 | 询问用户：覆盖重写 / 手动修复 / 跳过 |

**追加缺失 AC 示例：**

```typescript
// 已有测试文件 tests/unit/server/session.service.spec.ts
// 已有 AC-01、AC-02
// checklist.json 新增 AC-03

// 在已有 describe 块中追加：
describe('AC-03: schema migration adds role and isActive columns', () => {
  it('should have role and isActive columns in User table', async () => {
    // 新测试逻辑
  })
})
```

### 步骤 3：生成测试骨架

```
按规则 1-4 生成测试代码：
- 导入语句（根据测试类型选择基础设施）
- describe 块（按功能分组）
- it 块（每个 AC 一个，包含 AC 编号）
- 断言（根据 spec 中的响应结构/交互状态）
```

### 步骤 4：保存并运行 red 验证

```bash
# 保存测试文件
cd D:/projects/ai-stared-project/knowledge-base

# 运行测试，确认失败（red）
pnpm test tests/unit/server/{name}.spec.ts
# 或
pnpm test:integration tests/integration/{name}.spec.ts
# 或
pnpm test:e2e tests/e2e/specs/{name}.spec.ts
```

**预期输出：**
```
FAIL  tests/unit/server/{name}.spec.ts
  AC-01: ...
    ✕ should ... (ReferenceError: MyService is not defined)

Test Files  1 failed (1)
```

### 步骤 5：输出状态报告

```markdown
## 测试骨架生成报告

- **Spec 来源**：`docs/issues/{dir}/specs/api-spec.md`
- **生成文件**：`tests/unit/server/{name}.spec.ts`
- **AC 覆盖**：AC-01 ~ AC-05（5/5 全部覆盖）
- **运行状态**：🔴 Red（预期失败）
- **失败原因**：`MyService` 未定义（预期内）

## 测试结构

| AC 编号 | 测试用例 | 状态 |
|---------|----------|------|
| AC-01 | should return paginated list | 🔴 失败 |
| AC-02 | should return 401 for unauthorized | 🔴 失败 |
| AC-03 | should validate input | 🔴 失败 |

**TDD 准备就绪，可以开始实现。**
```

---

## 与现有 Skill 的集成

### dev-orchestrator 集成

dev-orchestrator 步骤 5（检查测试代码）中，若测试不存在：

```
dev-orchestrator 步骤 5
    ↓
测试文件不存在？
    ↓ 是
test-scaffold 生成测试骨架
    ↓
运行测试确认 red
    ↓
返回 dev-orchestrator 继续步骤 6
```

### plan-generator 集成

plan-generator 生成 plan 时，为每个任务预声明测试文件路径：

```markdown
### 任务 N: {功能}

**测试：**
- 文件：`tests/unit/server/{name}.spec.ts`
- AC：`AC-0N: {描述}`
- 由 test-scaffold 生成骨架
```

---

## 常见陷阱

| 陷阱 | 后果 | 正确做法 |
|------|------|----------|
| 只生成 happy path 测试 | 错误场景遗漏 | 根据 behavior-spec 的错误场景表格生成错误用例 |
| AC 编号与 checklist 不一致 | 验收标准混乱 | 严格从 checklist.json 读取 AC 编号 |
| 不运行 red 验证 | 测试本身有语法错误 | 必须运行并确认失败原因符合预期 |
| 使用错误的测试基础设施 | 测试无法运行 | 读取对应测试指南，使用正确的 helper |
| 生成测试后直接开始实现 | 违反 TDD 流程 | red 确认后才能进入 green |

---

## 自检清单

生成完成后自查：

- [ ] 所有 checklist.json 中的 AC 都有对应测试用例？
- [ ] 测试用例名包含 AC 编号？
- [ ] 是否包含错误场景测试？
- [ ] 是否使用了正确的测试基础设施（TestAppFactory / mount）？
- [ ] 测试文件路径是否符合 `tests/{layer}/` 规范？
- [ ] 运行测试是否 red（失败）？失败原因是否符合预期？

---

*本文档与 `docs/guide/testing/` 下的测试指南配套使用。*
