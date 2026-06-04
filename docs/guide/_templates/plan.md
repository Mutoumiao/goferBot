# Plan 模板

```markdown
---
id: {prefix}-{NN}
issue: issue.md
version: 1
---

# {功能名称} 实现计划

> **目标：** {一句话描述要做什么}
> **架构：** {技术方案概述}
> **技术栈：** {关键技术栈，如 Vue 3 + Pinia / NestJS + Prisma 等}

**Issue 引用：** `issue.md`
**Spec 引用：** `specs/`
**测试引用：** 按 track 前缀确定层级：
- `f-*` → `tests/unit/webui/`
- `b-*` / `d-*` → `tests/unit/server/`
- `i-*` → `tests/integration/`
- `q-*` → `tests/e2e/`

---

## 文件结构

### 后端（新增/修改）

- `{路径}` — {描述}
- `{路径}` — {描述}

### 前端（新增/修改）

- `{路径}` — {描述}
- `{路径}` — {描述}

---

## 任务列表

### 任务 1: {任务名称}

**文件：**
- 创建：`{路径}`
- 修改：`{路径}`

**规格引用：**
- {引用 spec 的具体章节}

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/{layer}/{name}.spec.ts
import { describe, it, expect } from 'vitest'
import { myFunction } from './file'

describe('myFunction', () => {
  it('AC-01: should return expected result for valid input', () => {
    const result = myFunction('valid-input')
    expect(result).toBe('expected-output')
  })

  it('AC-02: should throw error for invalid input', () => {
    expect(() => myFunction('invalid')).toThrow('Invalid input')
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

运行：`npx vitest run tests/{layer}/{name}.spec.ts`
预期：FAIL — "myFunction is not defined" 或断言失败

- [ ] **步骤 3: 编写最小实现**

```typescript
// file.ts
export function myFunction(input: string): string {
  if (input === 'invalid') {
    throw new Error('Invalid input')
  }
  return 'expected-output'
}
```

- [ ] **步骤 4: 运行测试确认通过**

运行：`npx vitest run tests/{layer}/{name}.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 提交**

```bash
git add tests/{layer}/{name}.spec.ts file.ts
git commit -m "feat(scope): add myFunction with tests"
```

---

### 任务 2: {任务名称}

...

---

## 规格覆盖检查

- [ ] 功能规格：{列出覆盖的验收标准}
- [ ] 行为规格：{列出覆盖的交互状态}
- [ ] API 规格：{列出覆盖的端点}
- [ ] 无占位符（"TODO" / "稍后实现" / "TBD"）

---

## 阻塞与依赖

- 阻塞于：{阻塞 issue 或 "无"}
```

---

## Frontmatter 字段说明

| 字段 | 说明 | 必填 |
|------|------|------|
| `id` | 对应 issue 编号 | ✅ |
| `issue` | 指向 issue.md 的相对路径 | ✅ |
| `version` | 版本号 N（plans/v{N}.md 中的 N） | ✅ |

## 正文填写说明

| 字段 | 说明 |
|------|------|
| `目标` | 一句话概括计划要交付什么 |
| `任务` | 每个任务不超过 8 个步骤 |
| `步骤` | 必须包含具体代码示例和验证命令 |
| `规格覆盖检查` | 自检是否覆盖 spec 中所有要求 |
