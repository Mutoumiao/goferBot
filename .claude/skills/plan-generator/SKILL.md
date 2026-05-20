---
name: plan-generator
description: >
  基于 issue 和 spec 生成可执行实现计划。
  当用户说"写计划"、"生成实现方案"、"怎么开发这个"时触发。
  保存路径：docs/issues/{dir}/plan.md（当前生效版）+ plans/v{N}.md（历史归档）
---

# 计划生成器

编写全面的实现计划，假设工程师对代码库零了解。记录一切：每个任务要碰哪些文件、代码、测试、需查阅的文档、如何验证。DRY。YAGNI。**TDD 强制**。频繁提交。

**开始时声明：** "正在使用 plan-generator skill 创建实现计划。"

**保存到：** `docs/issues/{dir}/plan.md`（当前生效版本）

**历史版本归档到：** `docs/issues/{dir}/plans/v{N}.md`

**路径验证（强制执行）：**
- 当前生效版本固定为 `plan.md`
- 历史版本归档在 `plans/v{N}.md`，N 从 1 开始递增
- 每次重新生成计划时，保留旧版本到 `plans/`，新建 `plan.md`

---

## 计划前阅读

1. **Issue 文件**: `docs/issues/{dir}/issue.md`
   - 提取：状态、构建内容、验收标准、阻塞于

2. **Spec 文件**: `docs/issues/{dir}/specs/`
   - `feature-spec.md` — 用户故事、边界、涉及页面
   - `behavior-spec.md` — 前端：交互状态表、错误场景、动画
   - `api-spec.md` — 后端：路由、DTO、错误码、异步行为

3. **现有计划**（如有）: `docs/issues/{dir}/plan.md` 和 `plans/`

4. **审查记录**（如有）: `docs/07-reviews/{scope}/`

---

## 计划文档头部

```markdown
---
id: f-15
issue: issue.md
version: 1
---

# [功能名称] 实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** [一句话描述构建什么]

**架构：** [2-3 句话关于方法]

**技术栈：** [关键技术/库]

**Issue 引用：** [链接到 issue.md]
**Spec 引用：** [链接到 specs/]

---
```

---

## 文件结构

定义任务前，先规划哪些文件将被创建或修改：

- 每个文件应有单一清晰职责
- 优先小而聚焦的文件，避免大文件
- 一起变更的文件应放在一起，按职责拆分而非按技术层拆分
- 遵循代码库既定模式

**必须包含测试文件：**
- 测试文件放在 `tests/issues/{dir}/` 下
- 测试用例名必须以 `AC-XX:` 开头，与 checklist.json 的 `id` 对应

---

## 任务粒度

**每个步骤是一个动作（2-5 分钟）：**
- "编写失败测试" — 步骤
- "运行它确保失败" — 步骤
- "编写最小代码使测试通过" — 步骤
- "运行测试确保通过" — 步骤
- "提交" — 步骤

---

## 任务结构（TDD 强制）

**每个任务必须以测试开始，以测试通过结束。**

````markdown
### 任务 N: [组件/功能名称]

**文件：**
- 创建：`exact/path/to/file.ts`
- 修改：`exact/path/to/existing.ts:123-145`
- 测试：`tests/issues/{dir}/file.spec.ts`（必须存在）

**规格引用：**
- 行为规格：[第 X 节 - 交互状态 Y]
- API 规格：[端点 Z - 错误码 W]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/{dir}/file.spec.ts
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

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/{dir}/file.spec.ts`
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

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/{dir}/file.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 提交**

```bash
git add tests/issues/{dir}/file.spec.ts file.ts
git commit -m "feat(scope): add myFunction with tests"
```
````

---

## TDD 红线规则

以下情况计划**必须打回重写**：

| 违规 | 示例 | 正确做法 |
|------|------|----------|
| 任务不以测试开始 | "创建 LoginView.vue" | "编写 LoginView.spec.ts 失败测试" |
| 测试放在最后 | 任务 1-5 实现，任务 6 写测试 | 每个任务都是 red-green-refactor |
| 测试只有 happy path | `it('should work')` | 必须包含错误场景、边界条件 |
| 测试代码模糊 | "测试表单提交" | 具体断言：`expect(wrapper.find('.error').exists()).toBe(true)` |
| 无验证命令 | 步骤结束无运行命令 | 每个任务末尾必须有 `npx vitest run ...` |

---

## 禁止占位符

以下这些是**计划失败**，永远不要写：
- "TBD"、"TODO"、"稍后实现"、"填写细节"
- "添加适当的错误处理" / "添加验证" / "处理边界情况"
- "为上述编写测试"（没有实际测试代码）
- "类似于任务 N"（重复代码 —— 工程师可能按不同顺序阅读任务）
- 描述做什么但不展示如何做的步骤（代码步骤需要代码块）
- 引用任何任务中未定义的类型、函数或方法

---

## 规格覆盖检查

写完计划后验证：

1. **功能规格覆盖**：每个用户故事都有对应任务？
2. **行为规格覆盖**（前端）：所有交互状态、错误场景、动画都实现了？
3. **API 规格覆盖**（后端）：所有路由、DTO、错误码都实现了？
4. **测试覆盖**：每个任务都有对应的 `tests/issues/{dir}/.spec.ts` 文件？
5. **占位符扫描**：搜索 "禁止占位符" 中的模式并修复
6. **类型一致性**：后续任务中的类型、签名与早期任务一致？

发现问题直接修复，无需重新审查。发现没有任务的规格需求，添加任务。

---

## 执行交接

保存计划后，提供选择：

**"计划已保存到 `docs/issues/{dir}/plan.md`。两种执行方式：**

1. **子代理驱动（推荐）** — 每个任务新子代理，任务间审查
2. **内联执行** — 当前会话顺序执行，带检查点

**选择哪种？"**

- 子代理驱动：使用 `superpowers:subagent-driven-development`
- 内联执行：使用 `superpowers:executing-plans`
