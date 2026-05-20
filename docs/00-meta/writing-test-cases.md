# Test Case 编写规范（已废弃）

> **重要：本文档已废弃。**
>
> 测试用例不再以 markdown 形式保存在 `docs/08-test-cases/` 中。
> 所有测试直接以 `.spec.ts` 文件形式编写在 `packages/` 对应目录下。
>
> 保留此文件仅作历史参考。

---

## 新规范

### 测试文件位置

| 类型 | 路径 |
|------|------|
| 前端单元测试 | `packages/webui/src/**/*.spec.ts` |
| 后端单元测试 | `packages/server/src/**/*.spec.ts` |
| 集成测试 | `tests/integration/**/*.spec.ts` |
| E2E 测试 | `tests/e2e/**/*.spec.ts` |

### 测试编写时机

**TDD 强制**：在实现代码之前编写测试。

1. 读取 spec 中的"测试映射"表格
2. 创建对应的 `.spec.ts` 文件
3. 编写失败测试（red）
4. 运行确认失败
5. 编写最小实现使测试通过（green）
6. 重构（refactor）

### 测试内容要求

每个 `.spec.ts` 必须覆盖：
- 正常路径（happy path）
- 错误路径（error cases）
- 边界条件（empty、loading、partial 状态）

### 示例

```typescript
// packages/webui/src/composables/useAuthForm.spec.ts
import { describe, it, expect } from 'vitest'
import { useAuthForm } from './useAuthForm'

describe('useAuthForm', () => {
  it('validates email format', () => {
    const form = useAuthForm()
    form.email.value = 'invalid-email'
    expect(form.validateEmail()).toBe(false)
    expect(form.emailError.value).toBe('请输入有效的邮箱地址')
  })

  it('validates password length', () => {
    const form = useAuthForm()
    form.password.value = '123'
    expect(form.validatePassword()).toBe(false)
    expect(form.passwordError.value).toBe('密码长度不能少于 6 位')
  })

  it('validates confirm password match', () => {
    const form = useAuthForm({ confirmPassword: true })
    form.password.value = 'password123'
    form.confirmPassword.value = 'different'
    expect(form.validateConfirmPassword()).toBe(false)
    expect(form.confirmPasswordError.value).toBe('两次输入的密码不一致')
  })
})
```

---

## 历史规范（仅供参考）

```
docs/08-test-cases/
└── {issue-id}/
    └── {kind}.md

kind: behavior / api / e2e / unit
```

此目录不再使用。如需查看历史测试用例，请查阅 `docs/99-archived/`。
