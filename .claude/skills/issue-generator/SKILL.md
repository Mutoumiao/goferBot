---
name: issue-generator
description: >
  将 PRD 或计划拆分为可独立领取的 issue，使用垂直切片。
  当用户说"拆 issue"、"生成工单"、"任务拆分"时触发。
  输出路径：docs/issues/{prefix}-{NN}-{kebab-slug}/issue.md
---

# Issue 生成器

将计划拆分为垂直切片，每个切片是一条端到端的完整路径。

---

## 生成前阅读

1. **PRD**: `docs/prd/v2-cloud-native.md`
2. **架构规格**: `docs/adrs/`
3. **现有 Issues**: `docs/issues/` — 避免编号重复
4. **工作流**: `docs/guide/workflow.md`

---

## 流程

### 1. 范围检查（融入自 brainstorming）

**如果 PRD 描述多个独立子系统（如"构建包含聊天、文件存储、计费、分析的平台"），立即标记。**

不要花时间细化一个需要分解的项目的细节。

**处理：**
1. 帮助用户分解为子项目：独立模块、依赖关系、构建顺序
2. 每个子项目走独立的 issue → spec → plan → dev 循环
3. 先 brainstorm 第一个子项目

### 2. 收集上下文

基于对话上下文工作。如用户传入了 issue 引用，获取并阅读完整内容。

### 3. 探索代码库（可选）

Issue 标题和描述应使用项目领域词汇，尊重相关 ADR。

### 4. 起草垂直切片

每个 issue 是贯穿所有层的薄垂直切片，**不是**单一层的水平切片。

**轨道前缀：**

| 前缀   | 轨道     | 示例                           |
|--------|----------|--------------------------------|
| `f-XX` | 前端功能 | `f-15-global-tab-bar`          |
| `b-XX` | 后端接口 | `b-02-knowledge-base-crud-api` |
| `d-XX` | 设计     | `d-01-rag-sdk-contracts`       |
| `i-XX` | 基础设施 | `i-01-docker-compose-infra`    |
| `q-XX` | 质量     | `q-01-security-baseline`       |

切片类型：
- **HITL**: 需人工交互（架构决策、设计评审）
- **AFK**: 可自动实现、测试、合并（优先）

**垂直切片规则：**
- 每个切片交付贯穿每一层的完整路径（schema → API → UI → tests）
- 完成的切片可独立演示或验证
- 优先薄切片，避免厚切片
- 每个切片在 `docs/issues/{dir}/specs/` 下有对应 spec

### 4. 向用户确认

展示提议的拆分，每个切片包含：

- **标题**、**前缀**、**类型**（HITL/AFK）
- **阻塞于**：哪些切片必须先完成
- **覆盖的用户故事**
- **Spec 路径**：`docs/issues/{dir}/specs/`

询问用户：粒度、依赖、合并/拆分、HITL/AFK 标记、前缀是否合理。

### 5. 发布 issue

对每个批准的切片，创建目录和文件到 `docs/issues/{dir}/`。

**命名验证（强制执行）：**
- 目录格式：`{prefix}-{NN}-{kebab-case-slug}`
- `prefix` 必须是 `f` / `b` / `d` / `i` / `q` 之一
- `NN` 必须是两位数字，全局递增，不分轨道
- `slug` 使用 kebab-case，不超过 5 个单词

**编号规则：**
- 全局递增，不分轨道，从 01 开始
- 已关闭的 issue 编号不复用
- 新 issue 取当前最大编号 + 1

按依赖顺序发布（先阻塞者），以便在 "阻塞于" 中引用真实标识符。

**创建目录结构：**

```bash
mkdir -p docs/issues/{dir}/specs
mkdir -p docs/issues/{dir}/plans
mkdir -p tests/issues/{dir}
```

**Issue 正文（issue.md）：**

```markdown
---
id: f-15
status: open
track: frontend
priority: p1
summary: {一句话描述}
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

{垂直切片的简洁描述}

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md（前端 issue）
- API 规格: specs/api-spec.md（后端 issue）

## 补充说明

{垂直切片的补充信息，如依赖关系、技术难点、注意事项}
```

**创建 checklist.json：**

```json
{
  "issue_id": "f-15",
  "version": 1,
  "updated_at": "{ISO日期}",
  "items": [
    {"id": "AC-01", "desc": "{验收项1}", "status": "pending"},
    {"id": "AC-02", "desc": "{验收项2}", "status": "pending"}
  ]
}
```

### 6. 创建 Spec 占位符

**路径验证：**
- spec 文件放在 issue 目录下的 `specs/` 子目录中

创建三个占位文件：
- `specs/feature-spec.md` — > 在 spec-validator 会话中填写
- `specs/behavior-spec.md` — > 在 spec-validator 会话中填写（前端 issue）
- `specs/api-spec.md` — > 在 spec-validator 会话中填写（后端 issue）

### 7. 生成后验证

创建完成后，验证：
- [ ] Issue 目录名符合 `{prefix}-{NN}-{slug}`
- [ ] 编号全局唯一
- [ ] issue.md frontmatter 包含必要字段
- [ ] checklist.json 已创建
- [ ] specs/ 目录和占位文件已创建
- [ ] 阻塞引用的 issue 已存在
