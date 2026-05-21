# Test Case 编写规范（已废弃）

> **重要：本文档已废弃。**
>
> 测试用例不再以 markdown 形式保存在 `docs/08-test-cases/` 中。
> 所有测试直接以 `.spec.ts` 文件形式编写在 `tests/issues/{issue-dir}/` 目录下。
>
> 保留此文件仅作历史参考。

---

## 新规范

### 测试文件位置

| 类型 | 路径 |
|------|------|
| 按 issue 组织的单元测试 | `tests/issues/{issue-dir}/*.spec.ts` |
| 集成测试 | `tests/integration/**/*.spec.ts` |
| E2E 测试 | `tests/e2e/**/*.spec.ts` |

### 测试编写时机

**TDD 强制**：在实现代码之前编写测试。

1. 读取 spec 中的"测试映射"表格
2. 在 `tests/issues/{issue-dir}/` 下创建 `.spec.ts` 文件
3. 编写失败测试（red）
4. 运行确认失败
5. 编写最小实现使测试通过（green）
6. 重构（refactor）

### 测试内容要求

每个 `.spec.ts` 必须覆盖：
- 正常路径（happy path）
- 错误路径（error cases）
- 边界条件（empty、loading、partial 状态）

### 命名规则

- 测试用例名必须以 `AC-XX:` 开头，与 checklist.json 的 `id` 对应
- 一个测试文件可包含多个 AC，一个 AC 只能有一个测试用例

### 示例

```typescript
// tests/issues/f-15-global-tab-bar/TabBar.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TabBar from '@/components/layout/TabBar.vue'

describe('TabBar', () => {
  it('AC-01: renders TabBar in AuthenticatedLayout header', () => {
    // ...
  })

  it('AC-04: rejects closing home tab', () => {
    // ...
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
