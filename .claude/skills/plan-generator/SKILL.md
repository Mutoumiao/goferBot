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

## 执行摘要

| 项目 | 内容 |
|------|------|
| **触发词** | "写计划"、"生成实现方案"、"基于 spec 生成 plan" |
| **硬关卡** | 禁止占位符（"TODO"、"TBD"）；每个任务必须以测试开始；保存前必须通过架构合规扫描 |
| **核心输出** | `docs/issues/{dir}/plan.md` + `plans/v{N}.md` |
| **禁止行为** | 写 TODO、任务不以测试开始、无验证命令 |
| **下一步** | plan 生成后 → 用户确认 → 调用 `/dev-orchestrator` 进入阶段 2（实现） |

编写全面的实现计划，假设工程师对代码库零了解。记录一切：每个任务要碰哪些文件、写什么代码、测试、需查阅的文档、如何验证。DRY。YAGNI。**TDD 强制**。频繁提交。

**开始时声明：** "正在使用 plan-generator skill 创建实现计划。"

---

## 保存路径

- **当前生效版**：`docs/issues/{dir}/plan.md`
- **历史归档**：`docs/issues/{dir}/plans/v{N}.md`，N 从 1 开始递增
- **每次重新生成计划时**，保留旧版本到 `plans/`，新建 `plan.md`

---

## 计划前阅读

1. **Issue 文件**: `docs/issues/{dir}/issue.md`
   - 提取：id、status、track、priority、summary、blocked_by、checklist、plan、specs

2. **Spec 文件**: `docs/issues/{dir}/specs/`
   - `feature-spec.md` — 用户故事、边界、涉及页面
   - `behavior-spec.md` — 前端：交互状态表、错误场景、动画
   - `api-spec.md` — 后端：路由、DTO、错误码、异步行为

3. **代码库规范**（按 track 选择，必读）：
   - `f-*` → [`docs/guide/frontend/README.md`](mdc:docs/guide/frontend/README.md)（含规范索引，按需深入）
   - `f-*`（涉及浮层）→ [`docs/guide/frontend/overlay-conventions.md`](mdc:docs/guide/frontend/overlay-conventions.md)
   - `b-*` / `d-*` → [`docs/guide/backend/README.md`](mdc:docs/guide/backend/README.md)（含规范索引，按需深入）

4. **测试指南**（参考）：
   - 测试路径与命名 → [`_shared/references/test-paths.md`](mdc:.claude/skills/_shared/references/test-paths.md)
   - TDD 规则详情 → [`_shared/references/tdd-rules.md`](mdc:.claude/skills/_shared/references/tdd-rules.md)

5. **现有计划**（如有）: `docs/issues/{dir}/plan.md` 和 `plans/`

6. **审查记录**（如有）: `docs/reviews/{scope}/`

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
- 测试文件放在 `tests/{layer}/` 下（按轨道分层，参见 [`_shared/references/test-paths.md`](mdc:.claude/skills/_shared/references/test-paths.md)）
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

## 任务结构模板

每个任务必须以测试开始，以测试通过结束。

```markdown
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
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/{layer}/{name}.spec.ts`
预期：FAIL — "myFunction is not defined" 或断言失败

- [ ] **步骤 3: 编写最小实现**

```typescript
// file.ts
export function myFunction(input: string): string {
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
```

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

**TDD 规则详情参见** [`_shared/references/tdd-rules.md`](mdc:.claude/skills/_shared/references/tdd-rules.md)。以下是 plan 中必须遵守的摘要：

### 核心原则

- **铁律**：没有先失败的测试，不写生产代码
- **循环**：RED（失败测试）→ 验证失败 → GREEN（最小实现）→ 验证通过 → REFACTOR → 保持绿色
- **每个任务**必须以测试开始，以测试通过结束

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

## ADR 合规声明

### plan 头部必填

每个 plan.md 必须在头部包含以下章节：

```markdown
## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | 验证方案、响应格式 | ✅ 符合 | 使用 Zod + ResponseInterceptor |
| ADR 0001 | 依赖引入 | ✅ 符合 | 未引入禁止依赖 |
```

### 生成时自检（必须执行）

生成 plan 前，逐条确认以下检查项。任何一项未确认，plan 不得进入保存流程。

| 检查项 | 确认内容 | 阻断规则 |
|--------|---------|----------|
| **ADR 清单** | 列出本 issue 涉及的所有 ADR | 未列出 → 阻断 |
| **验证方案** | 是否新增/修改 DTO？→ 必须使用 Zod + `createZodDto` | 计划使用 class-validator → 阻断 |
| **响应格式** | 是否新增 API 端点？→ 必须走 `ResponseInterceptor` | 计划使用 `@BypassResponse()`（非 SSE）→ 阻断 |
| **依赖引入** | 是否计划引入新 npm 包？→ 检查禁止清单 | 计划引入 class-validator / class-transformer → 阻断 |
| **冲突声明** | 若 spec 技术选型与 ADR 冲突 | 未声明冲突 → 阻断 |

### plan 保存前审查流程

plan.md 保存前，**必须调用 `/architecture-guard` 进行审查**：

```
plan-generator 完成 plan 编写
    ↓
调用 /architecture-guard 审查 plan.md
    ↓
❌ 发现 Critical → 修复违规代码块 → 重新调用 /architecture-guard 审查
✅ 无违规 → 保存 plan.md
```

**审查内容：**
- plan.md 中的所有 TypeScript 代码块
- specs/*.md 中的 DTO 定义和依赖声明
- 与 ADR 0001 等架构决策的一致性

**若发现冲突：**
1. 不保存 plan.md
2. 向用户说明冲突：「spec 中提议使用 X，但 ADR 0001 决策使用 Y」
3. 提供选项：
   - 选项 A：修改 spec 以符合 ADR
   - 选项 B：申请 ADR 豁免（需说明理由和回归计划）
4. 获得用户明确确认后再继续

---

## 自检

写完完整计划后，用 fresh eyes 对照 spec 检查：

1. **规格覆盖**：浏览 spec 的每个章节/需求。能指出实现它的任务吗？列出遗漏。
2. **占位符扫描**：搜索计划中的 red flags —— "禁止占位符" 中的任何模式。修复它们。
3. **类型一致性**：后续任务中的类型、方法签名、属性名是否与早期任务一致？

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
7. **ADR 合规**：计划中的技术选型是否与 ADR 合规声明一致？

---

## 执行交接

保存计划后，明确阶段 1（定义）已完成：

**"计划已保存到 `docs/issues/{dir}/plan.md`。阶段 1（定义）已完成，包含：**
- ✅ issue 已创建
- ✅ spec 已编写（feature-spec + behavior-spec/api-spec）
- ✅ plan 已生成（含 ADR 合规声明）
- ✅ `/architecture-guard` 扫描通过

**下一步进入阶段 2（实现），两种执行方式：**

1. **子代理驱动（推荐）** — 每个任务新子代理，任务间审查
2. **内联执行** — 当前会话顺序执行，带 CHECKPOINT

**选择哪种？"**

- 子代理驱动：使用 `superpowers:subagent-driven-development`
- 内联执行：使用 `superpowers:executing-plans`
