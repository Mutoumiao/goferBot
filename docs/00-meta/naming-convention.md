# 文档命名规范

> 核心原则：**Issue 编号是全文档体系的唯一标识。**
> 所有下游文档（spec / plan / review / test-case）通过 issue 编号寻址。

---

## 目录结构总览

```
docs/
├── 02-issues/
│   └── {prefix}-{NN}-{kebab-slug}.md
├── 03-specs/
│   └── {issue-id}/
│       ├── feature-spec.md
│       ├── behavior-spec.md
│       └── api-spec.md
├── 04-plans/
│   └── {issue-id}/
│       └── v{N}.md
├── 07-reviews/
│   └── {scope}/
│       └── {type}-v{N}.md
└── 08-test-cases/
    └── {issue-id}/
        └── {scope}.md
```

---

## 02-issues：Issue 文件

### 命名格式

```
{prefix}-{NN}-{kebab-case-slug}.md
```

| 元素 | 规则 |
|------|------|
| `prefix` | 轨道：`f` 前端 / `b` 后端 / `d` 设计 / `i` 基础设施 / `q` 质量 |
| `NN` | 两位数字，每条轨道独立递增，**关闭后编号不复用** |
| `slug` | 简短功能描述，kebab-case，不超过 5 个单词 |

### 示例

```
f-01-auth-pages.md
f-06-knowledge-base-file-manager.md
b-02-knowledge-base-crud-api.md
i-01-docker-compose-infra.md
q-03-v1-cleanup.md
```

### 编号规则

- 每条轨道独立编号，互不干扰
- 编号一旦分配永久保留，关闭的 issue 编号不回收
- 新 issue 取该轨道当前最大编号 + 1
- 禁止跳号（除非预留批量编号）

---

## 03-specs：规格文档

### 目录结构

```
03-specs/{issue-id}/
├── feature-spec.md      # 功能规格（必须）
├── behavior-spec.md     # 行为规格（前端功能必须）
└── api-spec.md          # API 规格（后端功能必须）
```

### 规则

- 目录名**必须**与 issue 编号完全一致
- 一个 issue 对应一个 spec 目录，**禁止**多个 issue 共用一个 spec 目录
- 纯前端功能（无 API）可省略 `api-spec.md`
- 纯后端功能（无 UI）可省略 `behavior-spec.md`
- 基础设施类 issue 至少包含 `feature-spec.md`

### 示例

```
03-specs/f-06/feature-spec.md
03-specs/f-06/behavior-spec.md
03-specs/b-02/api-spec.md
03-specs/i-01/feature-spec.md
```

---

## 04-plans：执行计划

### 目录结构

```
04-plans/{issue-id}/
└── v{N}.md
```

### 规则

- 目录名 = issue 编号
- 文件名 = `v{N}.md`，N 从 1 开始递增
- 每次重新生成计划时新建版本，保留历史
- 禁止用时间戳（`2026-05-17.md`）或 `latest.md` 等别名

### 示例

```
04-plans/f-06/v1.md        # 初版计划
04-plans/f-06/v2.md        # 修订版（spec 变更后重新生成）
04-plans/b-02/v1.md
```

### 版本递增时机

- Spec 发生重大变更需要重新编码
- 计划执行中发现原方案不可行
- 审查后需要大规模重构

---

## 07-reviews：审查记录

### 目录结构

```
07-reviews/{scope}/
└── {type}-v{N}.md
```

### Scope 命名规则

Scope 表示审查覆盖的范围，使用**语义化名称**：

| 场景 | Scope 格式 | 示例 |
|------|-----------|------|
| Phase 批次审查 | `phase-{N}` | `phase-3` |
| 单 Issue 深度审查 | `{issue-id}` | `f-06` |
| 跨 Issue 功能组审查 | 语义化组名 | `file-manager-group` |
| 全项目综合审查 | `project` | `project` |
| 专项审查 | 专项名称 | `security-baseline` |

**Scope 命名约束**：
- 使用 kebab-case
- 优先使用已有约定（`phase-{N}`、`project`）
- 自定义组名应直观反映审查范围
- 禁止用 `overall`、`all`、`temp` 等模糊名称

### Type 枚举

| Type | 含义 |
|------|------|
| `code` | 代码审查 |
| `spec` | 规格对齐审查 |
| `security` | 安全审查 |
| `acceptance` | 验收审查 |

### 规则

- 同一 scope + 同 type 审查多次时，版本号递增
- 每次审查必须生成独立文件，**禁止**在已有文件上追加

### 示例

```
07-reviews/phase-3/code-v1.md
07-reviews/phase-3/spec-v1.md
07-reviews/phase-3/code-v2.md          # 修复后复查
07-reviews/f-06/code-v1.md             # 单 issue 深度审查
07-reviews/file-manager-group/code-v1.md
07-reviews/project/security-v1.md
07-reviews/security-baseline/v1.md
```

### 审查报告 Frontmatter（必须）

每个审查文件头部必须包含：

```yaml
---
scope: phase-3
type: code
date: 2026-05-17
issues: [f-06, f-07, f-08, b-02]
status: completed
---
```

| 字段 | 说明 |
|------|------|
| `scope` | 审查范围标识符 |
| `type` | 审查类型 |
| `date` | 审查日期（ISO 8601） |
| `issues` | 覆盖的 issue 编号列表 |
| `status` | `completed` / `partial` / `failed` |
| `summary` | 审查发现的核心问题与总体结论 |

---

## 08-test-cases：测试用例

### 目录结构

```
08-test-cases/{issue-id}/
└── {kind}.md
```

### Kind 枚举

| Kind | 含义 |
|------|------|
| `behavior` | 行为测试用例（前端交互） |
| `api` | API 测试用例（后端接口） |
| `e2e` | 端到端测试用例 |
| `unit` | 单元测试用例 |

### 规则

- 目录名 = issue 编号
- 一个 issue 可包含多个 kind 文件
- 优先写 `behavior.md` 或 `api.md`，跨端集成写 `e2e.md`

### 示例

```
08-test-cases/b-01/api.md
08-test-cases/f-06/behavior.md
08-test-cases/f-09/e2e.md
08-test-cases/b-02/api.md
08-test-cases/b-02/unit.md
```

---

## 快速定位速查表

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

## 禁止事项

| 禁止 | 错误示例 | 正确示例 |
|------|----------|----------|
| 时间戳命名 plan | `04-plans/f-06/2026-05-17.md` | `04-plans/f-06/v1.md` |
| 用 feature-slug 命名 spec 目录 | `03-specs/knowledge-base-file-manager/` | `03-specs/f-06/` |
| 用 phase 名命名 plan 目录 | `04-plans/phase-3/v1.md` | `04-plans/f-06/v1.md` |
| Review 用日期命名 | `07-reviews/phase-3/code-2026-05-17.md` | `07-reviews/phase-3/code-v1.md` |
| Test case 混合 slug | `08-test-cases/i-00-core-interfaces/` | `08-test-cases/i-00/` |
| 创建 `overall` 等模糊 scope | `07-reviews/overall/` | `07-reviews/project/` |
| 多个 issue 共用一个 spec 目录 | `03-specs/auth-system/` 对应 b-01 + f-01 | `03-specs/b-01/` 和 `03-specs/f-01/` 分开 |

---

## Skill 强制执行点

| Skill | 验证逻辑 |
|-------|----------|
| `/issue-generator` | 文件名必须符合 `{prefix}-{NN}-{slug}.md`；检查编号不重复 |
| `/spec-validator` | 目录名必须与 issue 编号一致；三个 spec 文件至少存在一个 |
| `/plan-generator` | 路径必须为 `04-plans/{issue-id}/v{N}.md`；自动计算下一个版本号 |
| `/kb-review` | 输出路径必须为 `07-reviews/{scope}/{type}-v{N}.md`；必须包含 frontmatter |
| 测试用例生成 | 路径必须为 `08-test-cases/{issue-id}/{kind}.md` |
