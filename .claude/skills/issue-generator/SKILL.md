---
name: issue-generator
description: >
  将 PRD 或计划拆分为可独立领取的 issue，使用垂直切片。
  当用户说"拆 issue"、"生成工单"、"任务拆分"时触发。
  输出路径：docs/02-issues/{prefix}-{NN}-{slug}.md
---

# Issue 生成器

将计划拆分为垂直切片，每个切片是一条端到端的完整路径。

---

## 生成前阅读

1. **PRD**: `docs/01-prd/v2-cloud-native.md`
2. **架构规格**: `docs/03-specs/architecture/v2-cloud-native.md`
3. **现有 Issues**: `docs/02-issues/` — 避免编号重复
4. **工作流**: `docs/00-meta/workflow.md`

---

## 流程

### 1. 收集上下文

基于对话上下文工作。如用户传入了 issue 引用，获取并阅读完整内容。

### 2. 探索代码库（可选）

Issue 标题和描述应使用项目领域词汇，尊重相关 ADR。

### 3. 起草垂直切片

每个 issue 是贯穿所有层的薄垂直切片，**不是**单一层的水平切片。

**双轨前缀：**

| 前缀 | 轨道 | 示例 |
|------|------|------|
| `f-XX` | 前端功能 | `f-06-knowledge-base-file-manager` |
| `b-XX` | 后端接口 | `b-02-knowledge-base-crud-api` |
| `d-XX` | 设计 | `d-01-design-system-tokens` |
| `i-XX` | 基础设施 | `i-01-docker-compose-setup` |
| `q-XX` | 质量 | `q-01-security-baseline` |

切片类型：
- **HITL**: 需人工交互（架构决策、设计评审）
- **AFK**: 可自动实现、测试、合并（优先）

**垂直切片规则：**
- 每个切片交付贯穿每一层的完整路径（schema → API → UI → tests）
- 完成的切片可独立演示或验证
- 优先薄切片，避免厚切片
- 每个切片在 `docs/03-specs/{issue-id}/` 下有对应 spec（目录名 = issue 编号）

### 4. 向用户确认

展示提议的拆分，每个切片包含：

- **标题**、**前缀**、**类型**（HITL/AFK）
- **阻塞于**：哪些切片必须先完成
- **覆盖的用户故事**
- **Spec 路径**：`docs/03-specs/{issue-id}/`

询问用户：粒度、依赖、合并/拆分、HITL/AFK 标记、前缀是否合理。

### 5. 发布 issue

对每个批准的切片，创建文件到 `docs/02-issues/`。

**命名验证（强制执行）：**
- 格式：`{prefix}-{NN}-{kebab-case-slug}.md`
- `prefix` 必须是 `f` / `b` / `d` / `i` / `q` 之一
- `NN` 必须是两位数字，该轨道内不重复
- `slug` 使用 kebab-case，不超过 5 个单词

**编号规则：**
- 每条轨道从 01 开始，独立递增
- 已关闭的 issue 编号不复用
- 新 issue 取该轨道当前最大编号 + 1

按依赖顺序发布（先阻塞者），以便在 "阻塞于" 中引用真实标识符。

**Issue 正文：**

```markdown
状态: needs-triage
分类: enhancement

## 要构建的内容

{垂直切片的简洁描述}

## 规格引用

- 功能规格: docs/03-specs/{issue-id}/feature-spec.md
- 行为规格: docs/03-specs/{issue-id}/behavior-spec.md（前端 issue）
- API 规格: docs/03-specs/{issue-id}/api-spec.md（后端 issue）

## 验收标准

- [ ] {标准 1}
- [ ] {标准 2}
- [ ] {标准 3}

## 阻塞于

- {阻塞 issue 引用或 "无"}

## 范围外

- {不包含的内容}

## Agent 简报

**分类：** {enhancement/bug/refactor}
**摘要：** {一句话摘要}

**当前行为：**
{现在存在什么}

**期望行为：**
{此 issue 完成后应发生什么}

**关键接口：**
- {接口 1}
- {接口 2}

**验收标准：**
- [ ] {标准 1}
- [ ] {标准 2}

**范围外：**
- {不包含的内容}
```

### 6. 创建 Spec 占位符

**路径验证：**
- 目录名必须与 issue 编号完全一致（如 `f-06`）
- **禁止**用 feature-slug（如 `knowledge-base-file-manager`）作为目录名

```bash
mkdir -p docs/03-specs/{issue-id}/
```

创建三个占位文件：
- `feature-spec.md` — > 在 spec-validator 会话中填写
- `behavior-spec.md` — > 在 spec-validator 会话中填写（前端 issue）
- `api-spec.md` — > 在 spec-validator 会话中填写（后端 issue）

### 7. 生成后验证

创建完成后，验证：
- [ ] Issue 文件名符合 `{prefix}-{NN}-{slug}.md`
- [ ] 编号在该轨道内唯一
- [ ] Spec 目录名与 issue 编号一致
- [ ] 阻塞引用的 issue 已存在
