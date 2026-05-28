---
name: plan-generator
description: >
  基于 issue 和 spec 生成可执行实现计划。
  当用户说"写计划"、"生成实现方案"、"怎么开发这个"、"基于 spec 生成 plan"时触发。
  保存路径：docs/issues/{dir}/plan.md（当前生效版）+ plans/v{N}.md（历史归档）
  务必在以下场景主动使用：用户有 spec 需要转化为开发步骤、需要为 issue 编写执行计划、
  需要规划具体代码实现路径、需要拆分为可执行的任务步骤。
---

# 计划生成器

编写全面的实现计划，假设工程师对代码库零了解。记录一切：每个任务要碰哪些文件、写什么代码、测试、需查阅的文档、如何验证。DRY。YAGNI。**TDD 强制**。频繁提交。

**开始时声明：** "正在使用 plan-generator skill 创建实现计划。"

**保存到：** `docs/issues/{dir}/plan.md`（当前生效版本）

**历史版本归档到：** `docs/issues/{dir}/plans/v{N}.md`

**路径验证（强制执行）：**
- 当前生效版本固定为 `plan.md`
- 历史版本归档在 `plans/v{N}.md`，N 从 1 开始递增
- 每次重新生成计划时，保留旧版本到 `plans/`，新建 `plan.md`

**版本规则：**

| 场景 | 操作 |
|------|------|
| 首次生成计划 | 创建 `plan.md` |
| Spec 发生重大变更 | 保留原 `plan.md` 到 `plans/v1.md`，新建 `plan.md` |
| 审查后需大规模重构 | 保留当前版本到 `plans/v{N}.md`，新建 `plan.md` |
| 执行中发现方案不可行 | 保留当前版本到 `plans/v{N}.md`，新建 `plan.md` |

---

## 计划前阅读

1. **Issue 文件**: `docs/issues/{dir}/issue.md`
   - 提取：id、status、track、priority、summary、blocked_by、checklist、plan、specs

2. **Spec 文件**: `docs/issues/{dir}/specs/`
   - `feature-spec.md` — 用户故事、边界、涉及页面
   - `behavior-spec.md` — 前端：交互状态表、错误场景、动画
   - `api-spec.md` — 后端：路由、DTO、错误码、异步行为

3. **现有计划**（如有）: `docs/issues/{dir}/plan.md` 和 `plans/`

4. **审查记录**（如有）: `docs/reviews/{scope}/`

---

## 范围检查

如果 spec 覆盖多个独立子系统，建议拆分为独立计划 —— 每个子系统一个 plan。每个 plan 应产出可独立运行、可测试的代码。

**本项目典型拆分：**
- 前端 f-XX 和后端 b-XX 各自独立生成 plan
- 一个 plan 只覆盖一个 issue 的范围

---

## 文件结构

定义任务前，先规划哪些文件将被创建或修改：

- 每个文件应有单一清晰职责
- 优先小而聚焦的文件，避免大文件
- 一起变更的文件应放在一起，按职责拆分而非按技术层拆分
- 遵循代码库既定模式

**必须包含测试文件：**
- 测试文件放在 `tests/{layer}/` 下（按轨道分层：f→unit/webui, b→unit/server, i→integration, q→e2e）
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

## 计划文档头部

**每个 plan 必须以以下头部开始：**

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

## TDD 执行细节

### Red-Green-Refactor 循环

```
RED（编写失败测试） → 验证失败 → GREEN（最小实现） → 验证通过 → REFACTOR（清理代码） → 保持绿色 → 下一个
```

**核心原则：如果你没看到测试失败，你就不知道它是否测试了正确的东西。**

**铁律：没有先失败的测试，不写生产代码。**

### RED - 编写失败测试

编写一个最小测试展示期望行为。

**好测试标准：**
- 一个行为（名称中有 "and"？拆分它）
- 清晰名称描述行为
- 真实代码（不 mock，除非不可避免）

**坏测试示例：**
```typescript
// 坏：模糊名称，测试 mock 而非真实代码
test('retry works', async () => {
  const mock = vi.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success')
  await retryOperation(mock)
  expect(mock).toHaveBeenCalledTimes(3)
})
```

### Verify RED - 观察失败（强制，不可跳过）

运行：`npx vitest run tests/{layer}/{name}.spec.ts`

确认：
- 测试失败（不是报错）
- 失败消息符合预期
- 因功能缺失而失败（不是拼写错误）

**测试通过了？** 你在测试已有行为。修复测试。

**测试报错了？** 修复错误，重跑直到正确失败。

### GREEN - 最小实现

编写最简单代码让测试通过。

**禁止：**
- 添加计划外的功能
- 重构其他代码
- "改进"超出测试范围

### Verify GREEN - 观察通过（强制）

运行：`npx vitest run tests/{layer}/{name}.spec.ts`

确认：
- 测试通过
- 其他测试仍通过
- 输出干净（无错误、警告）

**测试失败？** 修复代码，不是测试。

**其他测试失败？** 立即修复。

### REFACTOR - 清理

仅在 green 后：
- 消除重复
- 改善命名
- 提取辅助函数

保持测试绿色。不添加行为。

### 常见辩解与反驳

| 辩解 | 现实 |
|------|------|
| "太简单了不用测试" | 简单代码也会坏。测试只需 30 秒。 |
| "我后面再补测试" | 后补的测试立即通过，证明不了什么。 |
| "后补测试目标一样" | 后补 = "这代码做什么？" 先写 = "这代码该做什么？" |
| "我已经手动测过所有边界" | 手动 ≠ 系统化。无记录，无法重跑。 |
| "删了 X 小时工作太浪费" | 沉没成本谬误。保留未验证代码才是技术债。 |
| "TDD 太教条，我 pragmatic" | TDD 就是 pragmatic：比生产环境调试快。 |

### TDD 红线 - 立即停止重来

- 先写代码后写测试
- 测试在实现之后
- 测试立即通过
- 无法解释测试为何失败
- "这次例外"
- "我已经手动测过了"

**以上任何一条出现：删除代码，用 TDD 重新开始。**

---

## 任务结构（TDD 强制）

**每个任务必须以测试开始，以测试通过结束。**

````markdown
### 任务 N: [组件/功能名称]

**文件：**
- 创建：`exact/path/to/file.ts`
- 修改：`exact/path/to/existing.ts:123-145`
- 测试：`tests/{layer}/{name}.spec.ts`（必须存在）

**规格引用：**
- 行为规格：[第 X 节 - 交互状态 Y]
- API 规格：[端点 Z - 错误码 W]

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

- [ ] **步骤 2: 运行测试验证失败**

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

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/{layer}/{name}.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 提交**

```bash
git add tests/{layer}/{name}.spec.ts file.ts
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

## 自检

写完完整计划后，用 fresh eyes 对照 spec 检查。这是你自己运行的检查清单 —— 不是子代理任务。

**1. 规格覆盖：** 浏览 spec 的每个章节/需求。能指出实现它的任务吗？列出遗漏。

**2. 占位符扫描：** 搜索计划中的 red flags —— "禁止占位符" 中的任何模式。修复它们。

**3. 类型一致性：** 后续任务中的类型、方法签名、属性名是否与早期任务一致？任务 3 叫 `clearLayers()` 但任务 7 叫 `clearFullLayers()` 是 bug。

发现问题直接修复，无需重新审查。发现没有任务的规格需求，添加任务。

---

## 规格覆盖检查

写完计划后验证：

1. **功能规格覆盖**：每个用户故事都有对应任务？
2. **行为规格覆盖**（前端）：所有交互状态、错误场景、动画都实现了？
3. **API 规格覆盖**（后端）：所有路由、DTO、错误码都实现了？
4. **测试覆盖**：每个任务都有对应的 `tests/{layer}/{name}.spec.ts` 文件？
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
