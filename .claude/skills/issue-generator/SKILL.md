---
name: issue-generator
description: >
  将 PRD 或计划拆分为可独立领取的 issue，使用垂直切片。
  当用户说"拆 issue"、"生成工单"、"任务拆分"时触发。
  输出路径：docs/issues/{prefix}-{NN}-{kebab-slug}/issue.md
---

# Issue 生成器

## 执行摘要

| 项目 | 内容 |
|------|------|
| **触发词** | "拆 issue"、"生成工单"、"任务拆分" |
| **硬关卡** | PRD 未稳定前禁止拆 issue |
| **核心输出** | `docs/issues/{dir}/issue.md` + `checklist.json` + `specs/` 占位 |
| **禁止行为** | 一次拆完所有 issue、一个 issue 包含前后端 |
| **下一步** | issue 创建后 → 调用 spec-validator 写 spec |

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

### 2. 收集上下文（含 PRD 读取）

基于对话上下文工作。如用户传入了 issue 引用，获取并阅读完整内容。

**如果用户指令引用 PRD（如"按 api-testing-prd.md 拆 issue"）：**
1. **必须先读取完整 PRD 文档**，理解全部目标、优先级、验收标准
2. 拆分时每个 issue 必须标注来源 PRD 和对应章节
3. issue.md 中必须嵌入 PRD 关键内容（核心目标 + 验收标准），不能只写一句话

**如果用户指令未引用 PRD（如"把测试架构治理拆成 issue"）：**
1. 询问用户是否有对应的 PRD
2. 如有，要求提供 PRD 路径，然后按上述流程执行
3. 如没有 PRD，在 issue.md 中标注 `prd: null`，并在补充说明中记录"无 PRD，基于口头需求生成"

### 3. 探索代码库（可选）

Issue 标题和描述应使用项目领域词汇，尊重相关 ADR。

### 4. 起草垂直切片

每个 issue 是贯穿所有层的薄垂直切片，**不是**单一层的水平切片。

**轨道前缀**参见 [`_shared/references/track-prefixes.md`](mdc:.claude/skills/_shared/references/track-prefixes.md)。

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
```

**测试目录**按轨道选择（参见 [`_shared/references/test-paths.md`](mdc:.claude/skills/_shared/references/test-paths.md)）：
- `f-*` → `tests/unit/webui/`
- `b-*`, `d-*` → `tests/unit/server/`
- `i-*` → `tests/integration/`
- `q-*` → `tests/e2e/`

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
prd: {PRD 文件路径，如 docs/prd/api-testing-prd.md}
prd_section: {PRD 中对应章节，如 "第一批核心目标 / AuthController 模块级集成测试"}
---

## 要构建的内容

{垂直切片的简洁描述}

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md（前端 issue）
- API 规格: specs/api-spec.md（后端 issue）

## PRD 引用

- **来源 PRD**: {PRD 文件路径}
- **对应章节**: {PRD 章节标题}
- **核心目标**: {从 PRD 复制的关键目标，2-3 句话}
- **验收标准**: {从 PRD 复制的对应验收项}

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

**checklist 中的验收项必须来源于 PRD 或 issue 中明确的验收标准，不能凭空创造。**

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
- [ ] issue.md frontmatter 包含必要字段（含 `prd` 和 `prd_section`）
- [ ] issue.md 正文中"PRD 引用"章节已填写（如有 PRD）
- [ ] checklist.json 已创建，验收项与 PRD 或 issue 目标一致
- [ ] specs/ 目录和占位文件已创建
- [ ] 阻塞引用的 issue 已存在

**PRD 一致性检查：**
- [ ] 每个 issue 的核心目标能从 PRD 中找到对应来源
- [ ] issue 的验收标准与 PRD 的验收标准不矛盾
- [ ] 如有偏差，在 issue.md 补充说明中记录原因
