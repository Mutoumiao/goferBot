# 文档体系总览

> 本文档目录（`docs/guide/`）是项目开发流程的**规范契约层**。
> 所有规范只写"规则"，不写"内容"。具体内容模板见 `_templates/`。

---

## 文档体系架构

```
docs/
├── guide/                 ← 规范契约层（本文档目录）
│   ├── README.md            # 体系总览与快速导航
│   ├── workflow.md          # 开发流程阶段定义与 Skill 路由
│   ├── naming-convention.md # 全文档命名规范（唯一标识体系）
│   ├── writing-issues.md    # Issue 编写规范
│   ├── writing-specs.md     # Spec 编写规范
│   ├── writing-plans.md     # Plan 编写规范
│   ├── writing-reviews.md   # Review 归档规范
│   └── _templates/          # 所有模板集中存放
│
├── frontend/             # 前端开发指南
│   └── README.md
│
├── backend/              # 后端开发指南
│   └── README.md
│
├── testing/              # 测试规范（按层级组织）
│   ├── README.md         # 测试体系总览
│   ├── unit-testing-guide.md
│   ├── integration-testing-guide.md
│   └── e2e-testing-guide.md
│
├── prd/                  # 产品需求文档
├── issues/                  # 活跃 Issue（Issue-Centric 结构）
│   └── {prefix}-{NN}-{slug}/
│       ├── issue.md
│       ├── plan.md
│       ├── plans/
│       │   └── v{N}.md
│       ├── checklist.json
│       └── specs/
│           ├── feature-spec.md
│           ├── behavior-spec.md
│           └── api-spec.md
├── adrs/                 # 架构决策记录
├── design/               # 设计系统
├── reviews/              # 审查记录
└── archived/             # 历史归档

tests/
├── unit/                    # 单元测试（按层次组织）
│   ├── server/              # 后端 Service/Util 测试
│   └── webui/               # 前端组件/Store/工具测试
├── integration/             # 集成测试
└── e2e/                     # E2E 测试

BACKLOG.md                   # 待办事项（open / in-progress）
CHANGELOG.md                 # 完成日志（closed，按日期倒序）
```

---

## 核心原则

### 1. Issue 编号是唯一标识

Issue 编号（如 `f-15`、`b-02`）贯穿全文档体系：

```
docs/issues/f-15-global-tab-bar/issue.md
docs/issues/f-15-global-tab-bar/specs/feature-spec.md
docs/issues/f-15-global-tab-bar/plan.md
tests/unit/webui/TabBar.spec.ts
```

### 2. meta 只写规则，不写内容

| 位置                    | 内容                         |
|-------------------------|------------------------------|
| `guide/*.md`            | 规范定义、约束条件、验证规则 |
| `guide/_templates/*.md` | 具体模板内容、示例、填写说明 |

### 3. Skill 是规范的执行者

每个 Skill 在生成文档前必须验证路径和命名是否符合规范，生成后必须确认文件位置正确。

---

## 规范文件索引

| 规范文件                                                                     | 说明                                              |
|------------------------------------------------------------------------------|---------------------------------------------------|
| [workflow.md](workflow.md)                                                   | 开发流程阶段、TDD 强制规则、Skill 路由、常见陷阱  |
| [naming-convention.md](naming-convention.md)                                 | 全文档命名规范、目录结构、禁止事项                |
| [writing-issues.md](writing-issues.md)                                       | Issue 模板、frontmatter 规范、checklist.json 格式 |
| [writing-specs.md](writing-specs.md)                                         | 三层规格模板、测试映射表、编写顺序                |
| [writing-plans.md](writing-plans.md)                                         | Plan 模板、版本归档规则、步骤粒度                 |
| [writing-reviews.md](writing-reviews.md)                                     | Review 类型、Scope 命名、Frontmatter 规范         |
| [testing/README.md](testing/README.md)                                       | 测试体系总览：金字塔、命令速查、目录映射          |
| [testing/unit-testing-guide.md](testing/unit-testing-guide.md)               | 单元测试完整指南（前后端）                        |
| [testing/integration-testing-guide.md](testing/integration-testing-guide.md) | 集成测试完整指南（NestJS API + 真实数据库）       |
| [testing/e2e-testing-guide.md](testing/e2e-testing-guide.md)                 | E2E 测试完整指南（Playwright）                    |

---

## 快速定位

已知 issue 目录名 = `f-15-global-tab-bar`：

| 文档类型   | 路径                                                     |
|------------|----------------------------------------------------------|
| Issue 原文 | `docs/issues/f-15-global-tab-bar/issue.md`               |
| 功能规格   | `docs/issues/f-15-global-tab-bar/specs/feature-spec.md`  |
| 行为规格   | `docs/issues/f-15-global-tab-bar/specs/behavior-spec.md` |
| API 规格   | `docs/issues/f-15-global-tab-bar/specs/api-spec.md`      |
| 执行计划   | `docs/issues/f-15-global-tab-bar/plan.md`                |
| 历史计划   | `docs/issues/f-15-global-tab-bar/plans/v1.md`            |
| 验收状态   | `docs/issues/f-15-global-tab-bar/checklist.json`         |
| 单元测试   | `tests/unit/webui/*.spec.ts`                             |

已知审查范围 = `phase-3`：

| 文档类型 | 路径                         |
|----------|------------------------------|
| 代码审查 | `reviews/phase-3/code-v1.md` |
| 规格对齐 | `reviews/phase-3/spec-v1.md` |
