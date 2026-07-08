# 质量指南

> 前端开发的代码质量标准。

---

## 概述

Admin 前端使用 **Biome** 作为代码规范工具，配合 **Vitest** 进行单元测试。遵循 React 19 最佳实践和 Ant Design 6.x 组件模式。

---

## 禁止模式

| 禁止 | 描述 | 正确做法 |
|------|------|----------|
| `any` 类型 | 使用 `any` 绕过类型检查 | 使用明确的类型或 `unknown` |
| 内联 `style={{}}` | 使用内联样式 | 使用 Tailwind 类名或 Ant Design 的 `style`/`className` |
| 直接修改 Ant Design 组件 | 修改 `node_modules` 中的组件 | 创建 wrapper 组件或使用 `style`/`className` 属性 |
| 在组件内直接调用 API | 绕过 services 层直接调用 alova | 通过 `api/` → `services.ts` → 组件的调用链 |
| 忽略 loading/error 状态 | 只处理成功状态 | 使用 `useQueryWithRetry` 处理完整三态 |
| 未处理错误 | 不捕获异常 | 使用 `try-catch` + `toast` 或 `error-mapper` |
| 使用 `localStorage` 存储 Token | 将认证凭据存储在 localStorage | 使用 HttpOnly Cookie（由后端处理） |
| 直接操作 DOM | 使用 `document.getElementById` | 使用 React refs |
| 未验证路由参数 | 直接使用 `params.id` | 使用 Zod 或 TypeScript 类型守卫 |
| 重复代码 | 多个组件中存在相同逻辑 | 提取为自定义 Hook 或工具函数 |
| 前后端共享常量定义在前端 | 角色权限映射（`ROLE_PERMISSIONS`）、权限码（`PERMISSIONS`）、角色标签等常量仅在 `packages/admin` 中硬编码 | 迁移到 `@goferbot/data` 作为共享常量，前后端从同一源导入 |
| 在 Promise 内调用 React Hooks | `Modal.confirm({ onOk: () => Form.useForm() })` 等模式 | 使用 `let` 闭包变量 + `Modal.confirm` + `modal.update()` 模式 |
| 角色列表硬编码 | 在组件内定义 `ALL_ROLES`、`ASSIGNABLE_ROLES` 等静态常量 | 从后端 API `GET /admin/roles` 动态获取，支持新增自定义角色 |

---

## 必需模式

### 代码结构

1. **组件文件不超过 400 行**：超过时拆分为多个组件或提取逻辑到 hooks/services
2. **单一职责**：每个组件只负责一件事
3. **Props 接口定义**：始终为组件定义 Props 接口
4. **导出类型**：如果 Props 需要在其他地方使用，导出类型

### 错误处理

1. **统一错误映射**：使用 `error-mapper.ts` 中的 `mapErrorMessage` 映射错误
2. **Toast 反馈**：所有操作（成功/失败）都需要 toast 反馈
3. **特定错误处理**：使用 `isConflict`、`isForbidden` 等工具函数处理特定错误

### 认证与权限

1. **路由守卫**：受保护路由必须在 `_authenticated` 路由组内
2. **权限检查**：使用 `auth-guard.ts` 中的 `hasPermission`/`hasAnyPermission`
3. **SUPER_ADMIN 豁免**：SUPER_ADMIN 拥有所有权限，无需额外检查

### 命令式弹窗模式

当需要以命令式方式（非 JSX）打开弹窗并等待用户确认时，使用以下模式避免 React Hooks 违规：

```tsx
export function roleForm(initial?: RoleData): Promise<RoleData | null> {
  return new Promise((resolve) => {
    let formValues = { ...initial }
    const modal = Modal.confirm({
      title: initial ? '编辑角色' : '新建角色',
      content: (
        <Form
          initialValues={initial}
          onValuesChange={(_, all) => { formValues = all }}
        >
          {/* fields */}
        </Form>
      ),
      onOk: () => resolve(formValues),
      onCancel: () => resolve(null),
    })
  })
}
```

**关键点**：
- 使用 `let` 闭包变量存储表单状态，而非 `useState`
- 使用 `onValuesChange` 同步表单值到闭包变量
- 使用 `Modal.confirm` + `modal.update({content})` 更新内容

### 动态角色获取

角色列表必须从后端 API 动态获取，禁止硬编码：

```tsx
// ✅ 正确：从后端 API 获取
const { data: roles } = useQueryWithRetry(fetchRoles)

// ❌ 错误：硬编码角色列表
const ALL_ROLES = [{ value: 'admin', label: '管理员' }, { value: 'user', label: '用户' }]
```

**角色分配规则**：
- `super_admin` 角色永不出现在分配列表中
- 当前用户拥有的角色在分配时设为 `disabled`，并显示 tooltip 提示

### 数据获取

1. **API 封装**：所有 API 调用必须通过 `api/` 目录封装
2. **Services 层**：业务逻辑必须通过 `services.ts` 封装
3. **useQueryWithRetry**：数据查询必须使用 `useQueryWithRetry` Hook

---

## 测试要求

### 覆盖率要求

| 模块类型 | 覆盖率要求 | 说明 |
|----------|------------|------|
| 工具函数 | >= 80% | utils/*.ts |
| Store | >= 70% | stores/*.ts |
| Hook | >= 70% | hooks/*.ts |
| Services | >= 60% | features/*/services.ts |
| 组件 | >= 50% | features/*/components/*.tsx |

### 测试文件命名

```
features/module-name/services.ts        → features/module-name/services.spec.ts
utils/auth-guard.ts                     → utils/auth-guard.spec.ts
stores/auth.ts                          → stores/auth.spec.ts
hooks/useQueryWithRetry.ts              → hooks/useQueryWithRetry.spec.ts
```

### 测试模式

```tsx
import { describe, it, expect } from 'vitest'

describe('UserService', () => {
  it('should fetch users successfully', async () => {
    // 模拟 API 响应
    // 调用服务函数
    // 断言结果
  })

  it('should handle API errors', async () => {
    // 模拟 API 错误
    // 调用服务函数
    // 断言错误处理
  })
})
```

---

## 代码审查清单

### 安全性检查

- [ ] 所有敏感操作（删除、修改）是否有二次确认？
- [ ] 是否正确处理了权限检查？
- [ ] 是否使用 HttpOnly Cookie 进行认证？
- [ ] 是否过滤了用户输入？

### 性能检查

- [ ] 是否避免了不必要的重新渲染？
- [ ] 是否使用了 `useMemo`/`useCallback` 优化？
- [ ] 是否避免了在渲染中执行副作用？

### 代码质量检查

- [ ] 是否遵循了命名约定？
- [ ] 是否有未使用的变量或导入？
- [ ] 是否使用了 `any` 类型？
- [ ] 是否有重复代码？

### 可维护性检查

- [ ] 组件是否超过 400 行？
- [ ] 是否有清晰的错误处理？
- [ ] 是否有适当的测试覆盖？
- [ ] 是否有足够的注释说明复杂逻辑？