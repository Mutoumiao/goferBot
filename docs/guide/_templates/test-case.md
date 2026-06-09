# Test Case 模板（已废弃）

> **重要：本文档已废弃。**
>
> 测试用例不再以 markdown 形式保存。
> 所有测试直接以 `.spec.ts` 文件形式编写在测试层级目录下（`tests/unit/`、`tests/integration/`、`tests/e2e/`）。
>
> 保留此模板仅作历史参考。

---

## 新规范

### 测试文件位置

| 类型 | 路径 |
|------|------|
| 单元测试（前端） | `packages/web/tests/*.spec.ts` |
| 单元测试（后端） | `tests/unit/server/*.spec.ts` |
| 集成测试 | `tests/integration/**/*.spec.ts` |
| E2E 测试 | `tests/e2e/**/*.spec.ts` |

### 测试编写时机

**TDD 强制**：在实现代码之前编写测试。

1. 读取 spec 中的"测试映射"表格
2. 在对应的 `tests/unit/`、`tests/integration/` 或 `tests/e2e/` 目录下创建 `.spec.ts` 文件
3. 编写失败测试（red）
4. 运行确认失败
5. 编写最小实现使测试通过（green）
6. 重构（refactor）

### 命名规则

- 测试用例名必须以 `AC-XX:` 开头，与 checklist.json 的 `id` 对应
- 一个测试文件可包含多个 AC，一个 AC 只能有一个测试用例

### 示例

```typescript
// packages/web/tests/{ComponentName}.spec.tsx
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { ComponentName } from '@/components/{path}/{ComponentName}.vue'

describe('{ComponentName}', () => {
  it('AC-01: renders {ComponentName} in {expected location}', () => {
    // ...
  })

  it('AC-02: {behavior description}', () => {
    // ...
  })
})
```

---

## 历史模板（仅供参考）

```markdown
---
issue_id: {issue-id}
type: test-case
kind: {behavior / api / e2e / unit}
tc_count: {N}
status: {drafted / reviewed / automated}
summary: {测试覆盖范围、核心场景、自动化状态，2-3 句话}
---

# {issue-id} {kind} 测试用例

> 对应 issue: `docs/issues/{issue-dir}/issue.md`
> 规格引用:
> - `docs/issues/{issue-dir}/specs/feature-spec.md`
> - `docs/issues/{issue-dir}/specs/behavior-spec.md`
> - `docs/issues/{issue-dir}/specs/api-spec.md`
> - `docs/issues/{issue-dir}/plan.md`

---

## 1. {功能模块} 测试

### TC-{issue-id}-{NNN}: {用例名称}

- **前置条件**: {执行测试前必须满足的条件}
- **步骤**:
  1. {具体操作}
  2. {具体操作}
- **预期结果**:
  - {具体断言}
  - {具体断言}
- **优先级**: P0 / P1 / P2

---

## 测试用例汇总

| TC-ID | 名称 | 优先级 | 类型 |
|-------|------|--------|------|
| TC-{issue-id}-001 | {名称} | P0 | API |
| TC-{issue-id}-002 | {名称} | P0 | API |

---

## 覆盖检查

- [ ] 覆盖所有验收标准
- [ ] 覆盖所有错误场景
- [ ] 覆盖所有交互状态（loading/empty/error/success/partial）
- [ ] 每个错误场景有恢复路径验证
```
