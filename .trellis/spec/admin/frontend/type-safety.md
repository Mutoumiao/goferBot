# 类型安全

> 本项目中的类型安全模式。

---

## 概述

Admin 前端使用 **TypeScript** 进行类型检查，配合 **Zod**（通过 `@goferbot/data` 包）进行运行时验证。类型定义遵循"单一数据源"原则，共享类型从 `@goferbot/data` 导入。

---

## 类型组织

### 类型来源

```
┌──────────────────────────────────────────┐
│         @goferbot/data (共享类型)          │
│  - 前后端共享的 Zod Schema                │
│  - API 请求/响应类型                      │
│  - Prisma 生成的类型                      │
├──────────────────────────────────────────┤
│         packages/admin/src (本地类型)      │
│  - 组件 Props 类型                        │
│  - Store 状态类型                         │
│  - 工具函数类型                           │
└──────────────────────────────────────────┘
```

### 类型导入规则

1. **优先从 `@goferbot/data` 导入**：API 请求/响应类型必须从共享包导入
2. **本地定义组件 Props**：组件的 Props 类型在组件文件内定义
3. **导出公共类型**：需要在多个文件中使用的类型必须导出

### 示例：共享类型导入

```tsx
import type {
  AdminUser,
  AdminUserListQuery,
  AdminUserListResponse,
  AssignRoleRequest,
  CreateAdminUserRequest,
} from '@goferbot/data'
```

### 示例：本地类型定义

```tsx
interface UserTableProps {
  data: AdminUser[]
  loading?: boolean
  onToggleStatus?: (id: string, isActive: boolean) => void
}

export interface UsersState {
  list: AdminUser[]
  total: number
  loading: boolean
}
```

---

## 验证

### 运行时验证

Admin 前端通过 `@goferbot/data` 使用 Zod 进行运行时验证：

```tsx
import { z } from 'zod'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  captchaId: z.string().optional(),
  captchaCode: z.string().optional(),
})

type LoginRequest = z.infer<typeof LoginSchema>
```

### Ant Design Form 验证

使用 Ant Design Form 的 rules 属性进行表单验证：

```tsx
import { Form, Input } from 'antd'

<Form layout="vertical">
  <Form.Item
    label="邮箱"
    name="email"
    rules={[
      { required: true, message: '请输入邮箱' },
      { type: 'email', message: '请输入有效的邮箱地址' },
    ]}
  >
    <Input placeholder="请输入邮箱" />
  </Form.Item>
  <Form.Item
    label="密码"
    name="password"
    rules={[
      { required: true, message: '请输入密码' },
      { min: 8, message: '密码长度不能少于 8 位' },
    ]}
  >
    <Input.Password placeholder="请输入密码" />
  </Form.Item>
</Form>
```

### 错误映射

使用 `error-mapper.ts` 统一处理 API 错误：

```tsx
export function mapErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return '未知错误'
}

export function isConflict(err: unknown): boolean {
  return err instanceof Error && (err as Error & { code?: string }).code === 'CONFLICT'
}

export function isForbidden(err: unknown): boolean {
  return err instanceof Error && (err as Error & { status?: number }).status === 403
}
```

---

## 常见模式

### 类型守卫

```tsx
export interface AuthStateSnapshot {
  isAuthenticated: boolean
  role: string | null
  permissions: string[]
}

export function hasPermission(snapshot: AuthStateSnapshot, permission: string): boolean {
  if (!snapshot.isAuthenticated) return false
  if (snapshot.role === 'SUPER_ADMIN') return true
  return snapshot.permissions.includes(permission)
}
```

### 泛型工具

```tsx
export interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export function useQueryWithRetry<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  immediate = true,
): UseQueryWithRetryResult<T> {
  // ...
}
```

### 类型推断

```tsx
const alovaInstance = createAlova({
  // ...
})

export const listUsers = (query: AdminUserListQuery) =>
  alovaInstance.Get<AdminUserListResponse>('/admin/users', { params: query })
```

---

## 禁止模式

| 禁止 | 描述 | 正确做法 |
|------|------|----------|
| `any` 类型 | 使用 `any` 绕过类型检查 | 使用明确的类型或 `unknown` |
| 类型断言 (`as`) | 使用 `as` 强制转换类型 | 使用类型守卫或更精确的类型 |
| 未使用的类型导入 | 导入了但未使用的类型 | 删除未使用的导入 |
| 重复类型定义 | 在多个文件中定义相同的类型 | 在 `@goferbot/data` 中定义并共享 |
| 隐式 `any` | 未标注类型导致隐式 any | 启用 `noImplicitAny` 并添加类型注解 |
| 忽略类型错误 | 使用 `// @ts-ignore` | 修复类型错误 |

---

## Biome 配置

Admin 前端使用 Biome 进行类型检查和代码规范：

```json
{
  "$schema": "https://biomejs.dev/schemas/1.8.3/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "style": {
        "noVar": "error",
        "useConst": "error"
      },
      "suspicious": {
        "noExplicitAny": "error",
        "noImplicitAny": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```