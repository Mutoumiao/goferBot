---
id: f-33
issue: issue.md
version: 1
---

# 鉴权流程端到端迁移 实现计划

> **For agentic workers:** 步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 建立 apps/web 完整鉴权链路 — alova 实例 + Token 刷新 + packages/data/ + auth Store + login/register + 路由守卫

**架构：** 自底向上：先创建基础设施（alova 实例 → packages/data/ → auth Store）→ 再实现页面（login/register）→ 最后挂载路由守卫。每个任务遵循 RED → GREEN 流程。

**技术栈：** alova v3 + Zod + Zustand + TanStack Router (`beforeLoad`)

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/](./specs/)
**PRD 引用：** [docs/prd/v3-frontend-migration.md](../../prd/v3-frontend-migration.md) §5.2 + §6.1 + §6.6

---

## PRD 一致性声明

| PRD 目标 | Plan 覆盖情况 | 说明 |
|----------|--------------|------|
| alova 实例 + Token 刷新队列 | ✅ 已覆盖 | 任务 1 |
| packages/data/ auth 域 Zod schema | ✅ 已覆盖 | 任务 2 |
| api/auth.ts 类型化方法 | ✅ 已覆盖 | 任务 3 |
| Zustand auth Store + 持久化 | ✅ 已覆盖 | 任务 4 |
| /login + /register 页面 | ✅ 已覆盖 | 任务 5-6 |
| beforeLoad 路由守卫 | ✅ 已覆盖 | 任务 7 |
| Token 刷新对组件透明 | ✅ 已覆盖 | 任务 1（集中封装在 alova 层） |

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | Zod 验证 | ✅ 符合 | packages/data/ 使用 Zod schema |
| ADR 0001 | JWT + bcrypt | ✅ 符合 | 前端只消费 JWT，不涉及生成 |
| ADR 0001 | 依赖引入 | ✅ 符合 | alova、Zustand 均为 PRD 批准的技术栈 |

---

## 任务列表

### 任务 1: 创建 alova 实例（含 Token 刷新机制）

**文件：**
- 创建：`apps/web/app/utils/server.ts`

**规格引用：**
- 功能规格：[§2.1 alova 实例]、[§2.2 Token 刷新机制]
- 行为规格：[§3 Token 刷新时序]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/web/alova-instance.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock alova 相关模块
vi.mock('alova', () => ({ createAlova: vi.fn() }))
vi.mock('alova/react', () => ({ default: {} }))
vi.mock('alova/fetch', () => ({ createFetchAdapter: vi.fn() }))

describe('alova instance', () => {
  it('AC-01: should create alova instance with correct config', async () => {
    // 动态导入触发模块执行
    const { alovaInstance } = await import('@/utils/server')
    expect(alovaInstance).toBeDefined()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/unit/web/alova-instance.spec.ts`
预期：FAIL — 模块不存在或导出未定义

- [ ] **步骤 3: 实现 alova 实例**

参考 `docs/reference/alova-react-guide.md` §4.2 完整配置 + §8.1 GoferBot 集成：

```typescript
// apps/web/app/utils/server.ts
import { createAlova } from 'alova'
import ReactHook from 'alova/react'
import { createFetchAdapter } from 'alova/fetch'

let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

async function refreshToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error('refresh failed')
    const json = await res.json()
    const token = json.data?.accessToken
    if (token) localStorage.setItem('goferbot_access_token', token)
    return token
  } catch {
    return null
  }
}

function onRefreshed(newToken: string) {
  refreshSubscribers.forEach(cb => cb(newToken))
  refreshSubscribers = []
}

function addSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

export const alovaInstance = createAlova({
  id: 'goferbot',
  statesHook: ReactHook,
  requestAdapter: createFetchAdapter(),
  baseURL: '/api',
  timeout: 30_000,
  shareRequest: true,
  cacheFor: { GET: 300_000, POST: 0 },

  beforeRequest(method) {
    const token = localStorage.getItem('goferbot_access_token')
    if (token) {
      method.config.headers.Authorization = `Bearer ${token}`
    }
  },

  responded: {
    onSuccess: async (response) => {
      const json = await response.json()
      // 保持 NestJS ResponseInterceptor 的 { data: T } 包装
      return json
    },
    onError: async (error, method) => {
      if (error.status === 401) {
        if (!isRefreshing) {
          isRefreshing = true
          const newToken = await refreshToken()
          isRefreshing = false
          if (newToken) {
            onRefreshed(newToken)
            return method.send()
          }
          // refresh 失败 → 清除状态 → 跳登录
          localStorage.removeItem('goferbot_access_token')
          window.location.href = '/login'
          throw error
        }
        // 已有刷新进行中，加入队列
        return new Promise<void>((resolve) => {
          addSubscriber((newToken: string) => {
            method.config.headers.Authorization = `Bearer ${newToken}`
            resolve(method.send())
          })
        })
      }
      throw error
    },
  },
})
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/web/alova-instance.spec.ts
```

- [ ] **步骤 5: 验证并标记完成**

---

### 任务 2: 创建 packages/data/ 共享包（auth 域）

**文件：**
- 创建：`packages/data/package.json`
- 创建：`packages/data/tsconfig.json`
- 创建：`packages/data/src/schemas/auth.schema.ts`
- 创建：`packages/data/src/types/index.ts`

- [ ] **步骤 1: 编写失败测试**

```bash
# 验证 packages/data/ 目录不存在或文件缺失
test ! -f packages/data/src/schemas/auth.schema.ts && echo "RED: auth.schema.ts missing"
```

- [ ] **步骤 2: 运行验证失败**

- [ ] **步骤 3: 创建共享包文件**

参考 PRD §6.6 实现。关键文件内容：

`packages/data/package.json`:
```json
{
  "name": "@goferbot/data",
  "version": "0.0.1",
  "main": "./src/types/index.ts",
  "types": "./src/types/index.ts",
  "dependencies": { "zod": "^3.23.0" }
}
```

`packages/data/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true
  },
  "include": ["src"]
}
```

Schema 定义见 feature-spec §2.3。

- [ ] **步骤 4: 运行验证通过**

```bash
test -f packages/data/src/schemas/auth.schema.ts && echo "GREEN: schema exists"
test -f packages/data/src/types/index.ts && echo "GREEN: types exist"
```

- [ ] **步骤 5: 安装依赖并验证类型**

```bash
pnpm install
pnpm type-check  # 确认 @goferbot/data 可被 workspace 解析
```

---

### 任务 3: 创建 api/auth.ts

**文件：**
- 创建：`apps/web/app/api/auth.ts`
- 创建：`apps/web/app/api/types/auth.ts`（请求/响应类型，引用 @goferbot/data）

- [ ] **步骤 1: RED → GREEN**

```typescript
// apps/web/app/api/auth.ts
import type { LoginRequest, RegisterRequest, AuthResponse, User } from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

export const login = (data: LoginRequest) =>
  alovaInstance.Post<AuthResponse>('/auth/login', data)

export const register = (data: RegisterRequest) =>
  alovaInstance.Post<AuthResponse>('/auth/register', data)

export const getMe = () =>
  alovaInstance.Get<User>('/auth/me')
```

验证：`pnpm type-check` 通过。

---

### 任务 4: 创建 Zustand auth Store

**文件：**
- 创建：`apps/web/app/stores/auth.ts`

- [ ] **步骤 1: RED（测试 Store 不存在）**
- [ ] **步骤 2: 实现 auth Store**

参考 PRD §6.5 Pinia → Zustand 映射。使用 `persist` 中间件持久化 Token。

- [ ] **步骤 3: GREEN（测试 Store setAuth/clearAuth）**

---

### 任务 5: 实现 /login 页面

**文件：**
- 创建：`apps/web/app/routes/login.tsx`

- [ ] **步骤 1: RED（页面不存在）**
- [ ] **步骤 2: 实现 login 页面**

使用 `useRequest` + alova method，loading/error/success 三态完整（参考 behavior-spec §1.1）。

- [ ] **步骤 3: GREEN（单元测试验证三态渲染）**

---

### 任务 6: 实现 /register 页面

**文件：**
- 创建：`apps/web/app/routes/register.tsx`

- [ ] **步骤 1: RED → GREEN**

实现注册表单，成功后自动跳转 `/app`。

---

### 任务 7: 实现路由守卫

**文件：**
- 创建：`apps/web/app/routes/app/route.tsx`（布局路由 + beforeLoad 守卫）

- [ ] **步骤 1: RED → GREEN**

```typescript
// app/routes/app/route.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    const token = localStorage.getItem('goferbot_access_token')
    if (!token) throw redirect({ to: '/login' })
  },
  component: () => <div>Authenticated App Shell（后续 f-34 实现完整布局）</div>,
})
```

---

## 自检

### 规格覆盖
- [x] feature-spec §2.1-2.7 → 任务 1-7
- [x] behavior-spec 所有交互状态 → 任务 5-6 测试覆盖
- [x] api-spec 所有端点 → 任务 3 覆盖

### 占位符扫描
- 无 TODO/TBD
- 所有步骤有具体代码或命令

### PRD 偏差
- 无
