# 文档体系总览

> 本文档目录（`docs/00-meta/`）是项目开发流程的**规范契约层**。
> 所有规范只写"规则"，不写"内容"。具体内容模板见 `_templates/`。

---

## 文档体系架构

```
docs/
├── 00-meta/                 ← 规范契约层（本文档目录）
│   ├── README.md            # 本文档：体系总览与快速导航
│   ├── workflow.md          # 开发流程阶段定义与 Skill 路由
│   ├── naming-convention.md # 全文档命名规范（唯一标识体系）
│   ├── writing-issues.md    # Issue 编写规范
│   ├── writing-specs.md     # Spec 编写规范
│   ├── writing-plans.md     # Plan 编写规范
│   ├── writing-reviews.md   # Review 归档规范
│   ├── writing-test-cases.md# Test Case 编写规范
│   └── _templates/          # 所有模板集中存放
│       ├── issue.md
│       ├── feature-spec.md
│       ├── behavior-spec.md
│       ├── api-spec.md
│       ├── plan.md
│       ├── review.md
│       └── test-case.md
│
├── 01-prd/                  # 产品需求文档
├── 02-issues/               # 活跃 Issue（双轨前缀 f-/b-/d-/i-/q-）
├── 03-specs/                # 契约层（Feature/Behavior/API）
├── 04-plans/                # 执行计划
├── 05-adrs/                 # 架构决策记录
├── 06-design/               # 设计系统
├── 07-reviews/              # 审查记录
├── 08-test-cases/           # 测试用例
└── 99-archived/             # 历史归档
```

---

## 核心原则

### 1. Issue 编号是唯一标识

Issue 编号（如 `f-06`、`b-02`）贯穿全文档体系：

```
02-issues/f-06-knowledge-base-file-manager.md
03-specs/f-06/feature-spec.md
04-plans/f-06/v1.md
07-reviews/phase-3/code-v1.md   ← 审查报告中引用 f-06
08-test-cases/f-06/behavior.md
```

### 2. 00-meta 只写规则，不写内容

| 位置 | 内容 |
|------|------|
| `00-meta/*.md` | 规范定义、约束条件、验证规则 |
| `00-meta/_templates/*.md` | 具体模板内容、示例、填写说明 |

### 3. Skill 是规范的执行者

每个 Skill 在生成文档前必须验证路径和命名是否符合规范，生成后必须确认文件位置正确。

---

## 流程阶段速查

| 阶段 | 输入 | 输出 | Skill | 规范文档 |
|------|------|------|-------|----------|
| 0. PRD 稳定化 | 需求草案 | 功能批次 | - | - |
| 1. Issue 拆分 | PRD 批次 | `02-issues/{prefix}-{NN}-{slug}.md` | `/issue-generator` | [Issue 规范](writing-issues.md) |
| 2. 契约编写 | Issue | `03-specs/{issue-id}/*.md` | `/spec-validator` | [Spec 规范](writing-specs.md) |
| 3. 执行计划 | Issue + Spec | `04-plans/{issue-id}/v{N}.md` | `/plan-generator` | [Plan 规范](writing-plans.md) |
| 4. 并行开发 | Plan + Spec | 代码 | `/dev-orchestrator` | - |
| 5. 联调整合 | 代码 | 审查记录 | `/kb-review` | [Review 规范](writing-reviews.md) |
| 6. 关闭归档 | 已验证代码 | 测试用例 + 关闭 issue | `/issue-lifecycle` | [Test Case 规范](writing-test-cases.md) |

---

## 文档依赖链

```
01-prd/ → 02-issues/ → 03-specs/ → 04-plans/ → 代码 → 07-reviews/ → 08-test-cases/
   ↑___________________________________________|
              （发现 spec 不足时回溯更新）
```

---

## 快速定位

已知 issue 编号 = `f-06`：

| 文档类型 | 路径 |
|----------|------|
| Issue 原文 | `02-issues/f-06-knowledge-base-file-manager.md` |
| 功能规格 | `03-specs/f-06/feature-spec.md` |
| 行为规格 | `03-specs/f-06/behavior-spec.md` |
| API 规格 | `03-specs/f-06/api-spec.md` |
| 执行计划 | `04-plans/f-06/v1.md` |
| 测试用例 | `08-test-cases/f-06/behavior.md` |

已知审查范围 = `phase-3`：

| 文档类型 | 路径 |
|----------|------|
| 代码审查 | `07-reviews/phase-3/code-v1.md` |
| 规格对齐 | `07-reviews/phase-3/spec-v1.md` |

---

## 规范文件索引

| 规范文件 | 说明 |
|----------|------|
| [workflow.md](workflow.md) | 开发流程阶段、Skill 路由、常见陷阱 |
| [naming-convention.md](naming-convention.md) | 全文档命名规范、目录结构、禁止事项 |
| [writing-issues.md](writing-issues.md) | Issue 模板、双轨前缀、状态流转、垂直切片 |
| [writing-specs.md](writing-specs.md) | 三层规格模板、编写顺序、审查规则 |
| [writing-plans.md](writing-plans.md) | Plan 模板、版本规则、步骤粒度 |
| [writing-reviews.md](writing-reviews.md) | Review 类型、Scope 命名、Frontmatter 规范 |
| [writing-test-cases.md](writing-test-cases.md) | Test Case 模板、优先级、覆盖标准 |
