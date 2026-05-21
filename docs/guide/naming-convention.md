# 文档命名规范

> 核心原则：**Issue 编号是全文档体系的唯一标识。**
> 所有下游文档（spec / plan / review / test）通过 issue 编号寻址。

---

## 目录结构总览

```
docs/
├── issues/                              # 活跃 issue
│   └── {prefix}-{NN}-{kebab-slug}/      # issue 目录
│       ├── issue.md                     # 项目管理卡片
│       ├── plan.md                      # 当前生效计划
│       ├── plans/                       # 历史版本归档
│       │   └── v{N}.md
│       ├── checklist.json               # 验收状态
│       └── specs/                       # 技术契约
│           ├── feature-spec.md
│           ├── behavior-spec.md
│           └── api-spec.md
├── reviews/                          # 审查记录
│   └── {scope}/
│       └── {type}-v{N}.md
└── 99-archived/                         # 历史归档
    └── issues/
        └── {prefix}-{NN}-{kebab-slug}/  # 归档 issue（同活跃结构）

tests/
└── issues/                              # 按 issue 组织的单元测试
    └── {prefix}-{NN}-{kebab-slug}/
        └── *.spec.ts
```

---

## Issue 目录

### 命名格式

```
{prefix}-{NN}-{kebab-case-slug}
```

| 元素     | 规则                                                           |
|----------|----------------------------------------------------------------|
| `prefix` | 轨道：`f` 前端 / `b` 后端 / `d` 设计 / `i` 基础设施 / `q` 质量 |
| `NN`     | 两位数字，全局递增，不分轨道，从 01 开始                       |
| `slug`   | 简短功能描述，kebab-case，不超过 5 个单词                      |

### 示例

```
f-15-global-tab-bar/
b-02-knowledge-base-crud-api/
i-01-docker-compose-infra/
q-03-v1-cleanup/
```

### 编号规则

- 全局递增，不分轨道
- 编号一旦分配永久保留，关闭的 issue 编号不回收
- 新 issue 取当前最大编号 + 1
- 禁止跳号（除非预留批量编号）

---

## Spec 文件

### 目录结构

```
docs/issues/{issue-dir}/specs/
├── feature-spec.md      # 功能规格（必须）
├── behavior-spec.md     # 行为规格（前端必须）
└── api-spec.md          # API 规格（后端必须）
```

### 规则

- spec 文件放在 issue 目录下的 `specs/` 子目录中
- 纯前端功能（无 API）可省略 `api-spec.md`
- 纯后端功能（无 UI）可省略 `behavior-spec.md`
- 基础设施类 issue 至少包含 `feature-spec.md`

---

## Plan 文件

### 目录结构

```
docs/issues/{issue-dir}/
├── plan.md              # 当前生效版本
└── plans/
    └── v{N}.md          # 历史版本归档
```

### 规则

- 当前生效版本固定为 `plan.md`
- 历史版本归档在 `plans/v{N}.md`，N 从 1 开始递增
- 每次重新生成计划时新建版本，保留历史
- 禁止用时间戳（`2026-05-17.md`）或 `latest.md` 等别名

### 版本递增时机

- Spec 发生重大变更需要重新编码
- 计划执行中发现原方案不可行
- 审查后需要大规模重构

---

## Review 文件

### 目录结构

```
docs/reviews/{scope}/
└── {type}-v{N}.md
```

### Scope 命名规则

| 场景                | Scope 格式   | 示例                 |
|---------------------|--------------|----------------------|
| Phase 批次审查      | `phase-{N}`  | `phase-3`            |
| 单 Issue 深度审查   | `{issue-id}` | `f-15`               |
| 跨 Issue 功能组审查 | 语义化组名   | `file-manager-group` |
| 全项目综合审查      | `project`    | `project`            |
| 专项审查            | 专项名称     | `security-baseline`  |

**Scope 命名约束**：
- 使用 kebab-case
- 优先使用已有约定（`phase-{N}`、`project`）
- 自定义组名应直观反映审查范围
- 禁止用 `overall`、`all`、`temp` 等模糊名称

### Type 枚举

| Type         | 含义         |
|--------------|--------------|
| `code`       | 代码审查     |
| `spec`       | 规格对齐审查 |
| `security`   | 安全审查     |
| `acceptance` | 验收审查     |

### 规则

- 同一 scope + 同 type 审查多次时，版本号递增
- 每次审查必须生成独立文件，**禁止**在已有文件上追加

---

## 测试文件

### 目录结构

```
tests/issues/{issue-dir}/
└── *.spec.ts
```

### 规则

- 测试文件放在 `tests/issues/{issue-dir}/` 下
- 测试用例名必须以 `AC-XX:` 开头，与 checklist.json 的 `id` 对应
- 一个测试文件可包含多个 AC，一个 AC 只能有一个测试用例

---

## 快速定位速查表

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
| 单元测试   | `tests/issues/f-15-global-tab-bar/*.spec.ts`             |

已知审查范围 = `phase-3`：

| 文档类型 | 路径                              |
|----------|-----------------------------------|
| 代码审查 | `docs/reviews/phase-3/code-v1.md` |
| 规格对齐 | `docs/reviews/phase-3/spec-v1.md` |

---

## 禁止事项

| 禁止                            | 错误示例                                   | 正确示例                            |
|---------------------------------|--------------------------------------------|-------------------------------------|
| 时间戳命名 plan                 | `plans/v2026-05-17.md`                     | `plans/v2.md`                       |
| 用 feature-slug 命名 issue 目录 | `docs/issues/knowledge-base-file-manager/` | `docs/issues/f-15-global-tab-bar/`  |
| 用 phase 名命名 plan 文件       | `plan-phase-3.md`                          | `plan.md`                           |
| Review 用日期命名               | `reviews/phase-3/code-2026-05-17.md`       | `reviews/phase-3/code-v1.md`        |
| 创建 `overall` 等模糊 scope     | `reviews/overall/`                         | `reviews/project/`                  |
| 多个 issue 共用一个 spec 目录   | `specs/auth-system/` 对应 b-01 + f-01      | `b-01/specs/` 和 `f-01/specs/` 分开 |

---

## Skill 强制执行点

| Skill               | 验证逻辑                                                                    |
|---------------------|-----------------------------------------------------------------------------|
| `/issue-generator`  | 目录名必须符合 `{prefix}-{NN}-{slug}`；检查编号不重复                       |
| `/spec-validator`   | issue 目录下必须存在 `specs/`；三个 spec 文件至少存在一个                   |
| `/plan-generator`   | 当前版本为 `plan.md`；历史版本归档到 `plans/v{N}.md`                        |
| `/kb-review`        | 输出路径必须为 `reviews/{scope}/{type}-v{N}.md`；必须包含 frontmatter       |
| `/dev-orchestrator` | 测试文件必须放在 `tests/issues/{issue-dir}/` 下；用例名必须以 `AC-XX:` 开头 |
