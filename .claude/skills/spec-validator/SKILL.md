---
name: spec-validator
description: >
  编写并验证 issue 的三层规格文档（feature-spec / behavior-spec / api-spec）。
  当用户说"写 spec"、"编写 behavior spec"、"生成 api spec"、"审查 spec"、"spec 对吗"时触发。
  输出路径：docs/issues/{dir}/specs/
---

# Spec 验证器

## 执行摘要

| 项目 | 内容 |
|------|------|
| **触发词** | "写 spec"、"审查 spec"、"spec 对吗" |
| **硬关卡** | spec 须经**用户批准**才能进入 plan-generator |
| **核心输出** | `docs/issues/{dir}/specs/*.md` |
| **禁止行为** | 未经用户确认自动生成 plan、批量写多个 spec |
| **下一步** | 用户批准后 → 调用 plan-generator |

为 issue 编写完整的三层规格文档，确保交互状态完整、API 契约清晰、术语一致。编写过程中通过质询澄清模糊需求。

---

## 会前阅读

1. **PRD**: `docs/prd/v2-cloud-native.md`
2. **架构规格**: `docs/adrs/`
3. **相关 Specs**: `docs/issues/{related-dir}/specs/`
4. **设计系统**: `docs/design/system/DESIGN.md`
5. **命名规范**: `docs/guide/naming-convention.md`
6. **代码库规范**（按 issue track 选择，参考）：
   - `f-*` → [`docs/guide/frontend/README.md`](mdc:docs/guide/frontend/README.md)
   - `f-*`（涉及浮层）→ [`docs/guide/frontend/overlay-conventions.md`](mdc:docs/guide/frontend/overlay-conventions.md)
   - `b-*` / `d-*` → [`docs/guide/backend/README.md`](mdc:docs/guide/backend/README.md)
7. **测试指南**（按 issue track 选择，参考）：
   - 测试路径与命名规范 → [`_shared/references/test-paths.md`](mdc:.claude/skills/_shared/references/test-paths.md)
   - 详细测试写法 → `docs/guide/testing/unit-testing-guide.md`（f/b）、`integration-testing-guide.md`（i）、`e2e-testing-guide.md`（q）

---

## 会话期间

### 挑战术语表

当用户术语与 PRD 或架构规格冲突时，立即指出。

> "你的 PRD 将 'knowledge base' 定义为 X，但你似乎指的是 Y —— 到底是哪个？"

### 精炼模糊语言

当用户使用模糊术语时，提出精确规范术语。

> "你说 'upload' —— 是指用户选择文件、HTTP 传输，还是后端保存到 MinIO？"

### 讨论具体场景

用边界情况场景对领域关系进行压力测试，迫使用户精确概念界限。

### 与代码交叉验证

当用户陈述某物如何工作时，检查代码是否同意。发现矛盾时提出来。

---

## Spec 输出模板

### 路径验证（强制执行）

生成 spec 前必须确认：
- 对应 issue 存在于 `docs/issues/{dir}/issue.md`
- spec 文件放在 issue 目录下的 `specs/` 子目录中

### 功能规格

保存到：`docs/issues/{dir}/specs/feature-spec.md`

```markdown
# 功能规格：{功能名称}

## 用户故事
作为 {用户类型}，我希望 {操作}，以便 {收益}。

## 边界
- 范围内：{包含的内容}
- 范围外：{明确排除的内容}

## 涉及页面/组件
- {页面/组件 1}
- {页面/组件 2}

## 相关功能
- {上游功能} — 提供 {什么}
- {下游功能} — 消费 {什么}

## 已做决策
| 决策     | 理由   | 可逆？  |
|----------|--------|---------|
| {决策 1} | {原因} | {是/否} |
```

### 行为规格（前端）

保存到：`docs/issues/{dir}/specs/behavior-spec.md`

```markdown
# 行为规格：{功能名称}

## 入口
- 路由：{路径}
- 触发：{用户如何到达此功能}

## 初始状态
- {用户首先看到什么}

## 交互状态

| 状态    | 视觉   | 用户操作    | 系统响应   |
|---------|--------|-------------|------------|
| loading | {描述} | {禁用/启用} | {发生什么} |
| empty   | {描述} | {可用操作}  | {发生什么} |
| error   | {描述} | {重试/取消} | {发生什么} |
| success | {描述} | {下一步}    | {发生什么} |
| partial | {描述} | {可用操作}  | {发生什么} |

## 正常流程
| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1    | {操作}   | {响应}   | {状态}   |

## 错误场景
| 场景     | 触发   | 视觉   | 恢复       |
|----------|--------|--------|------------|
| {错误 1} | {触发} | {视觉} | {如何恢复} |

## 测试映射

| 交互状态 | 测试文件                                          | 测试用例                                              |
|----------|---------------------------------------------------|-------------------------------------------------------|
| loading  | `tests/unit/webui/TabBar.spec.ts` | `AC-01: renders TabBar in AuthenticatedLayout header` |
| error    | `tests/unit/webui/TabBar.spec.ts` | `AC-02: displays error on unauthorized`               |

> 测试文件和用例必须与 [`_shared/references/test-paths.md`](mdc:.claude/skills/_shared/references/test-paths.md) 中的规范对齐。
```

### API 规格（后端）

保存到：`docs/issues/{dir}/specs/api-spec.md`

```markdown
# API 规格：{功能名称}

## 端点

### POST /api/{资源}

#### 认证
{Bearer Token / 无 / 等}

#### 请求
```json
{
  "field": "type (constraints)"
}
```

#### 响应 200/201
```json
{
  "field": "type"
}
```

#### 错误码
| 码  | 场景   | 响应体               |
|-----|--------|----------------------|
| 400 | {场景} | `{ "error": "..." }` |
| 409 | {场景} | `{ "error": "..." }` |

#### 异步行为
- {异步发生什么}
- {客户端如何轮询状态}

## 测试映射

| 场景     | 测试文件                                                              | 测试用例                                        |
|----------|-----------------------------------------------------------------------|-------------------------------------------------|
| 正常请求 | `tests/unit/server/knowledge-base-crud.spec.ts` | `AC-01: creates knowledge base with valid data` |
| 参数错误 | `tests/unit/server/knowledge-base-crud.spec.ts` | `AC-02: returns 400 for invalid input`          |

> 测试文件和用例必须与 [`_shared/references/test-paths.md`](mdc:.claude/skills/_shared/references/test-paths.md) 中的规范对齐。
```

---

## 内联更新规则

- 术语或决策解决时，**立即**更新 spec 文件，不要批量处理
- 不要将 spec 与实现细节耦合，只包含对领域专家有意义的术语

### 谨慎提供 ADR

仅当三点全部为真时才创建 ADR：

1. **难以逆转** — 改变主意的成本是实质性的
2. **没有上下文会令人惊讶** — 未来读者会想知道"为什么这样做？"
3. **真实权衡的结果** — 存在真正的替代方案，出于特定原因选择了其中一个

保存到 `docs/adrs/NNNN-{slug}.md`。

---

## 用户审批门（硬关卡）

**spec 未经用户批准，禁止进入 plan-generator。**

写完 spec 后：
1. 自检（检查清单下方）
2. 向用户展示 spec 摘要
3. **询问用户**："spec 已写入 `docs/issues/{dir}/specs/`。请审查并确认无修改后再生成 plan。"
4. 用户要求修改 → 修改 → 重新自检 → 再次询问
5. 用户批准 → 方可调用 `plan-generator`

**禁止：**
- 未经用户确认就自动生成 plan
- "spec 看起来没问题，我继续生成 plan 了"

---

## 完成检查清单

- [ ] 功能规格有清晰的用户故事和边界
- [ ] 行为规格包含全部 5 种交互状态（loading/empty/error/success/partial）
- [ ] 行为规格有带恢复路径的错误场景
- [ ] API 规格有所有端点及请求/响应示例
- [ ] API 规格有所有错误码及场景
- [ ] **行为规格包含测试映射表格（测试文件路径 + 用例名）**
- [ ] **API 规格包含测试映射表格（测试文件路径 + 用例名）**
- [ ] 无模糊术语残留（"appropriate"、"reasonable"、"etc."）
- [ ] 所有决策都有理由记录
- [ ] Spec 文件放在 issue 目录下的 `specs/` 子目录中
- [ ] 三个 spec 文件至少存在一个（按 issue 类型）
