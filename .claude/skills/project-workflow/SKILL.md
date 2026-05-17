---
name: project-workflow
description: >
  当用户说"怎么开始"、"流程是什么"、"我该怎么做"、"从哪开始"、
  "这份 PRD 怎么执行"、"怎么拆分工作"、"怎么协调开发"时触发。
  提供知识库项目完整的 AI 辅助开发流程指引，根据用户当前阶段推荐下一步操作。
---

# 项目开发流程指引

> 本 skill 不执行具体操作，只提供流程导航和阶段判断。
> 根据你当前所处的阶段，推荐下一步该用什么 skill、读什么文档、做什么决策。

---

## 核心原则

1. **契约先行** — 不写 spec 不生成 plan，不生成 plan 不写代码
2. **分批执行** — 大 PRD 拆小批，每批 1~3 个相关功能，走完完整闭环再下一批
3. **双轨并行** — 前端 f-XX 与后端 b-XX 独立拆分、独立计划、并行开发
4. **质量内建** — spec-validator 确保交互状态完整，tdd 确保测试先行，review 确保代码质量

---

## 项目文档架构

```
docs/
├── 00-meta/           # 流程规范、skills 说明、命名规范
│   ├── naming-convention.md   # 全文档命名规范（必读）
│   ├── workflow.md            # 本文件：流程阶段
│   ├── writing-issues.md      # Issue 规范
│   ├── writing-specs.md       # Spec 规范
│   ├── writing-plans.md       # Plan 规范
│   ├── writing-reviews.md     # Review 规范
│   ├── writing-test-cases.md  # Test Case 规范
│   └── _templates/            # 所有模板
├── 01-prd/            # 产品需求（唯一入口）
├── 02-issues/         # 活跃 issue（双轨前缀 f-/b-/d-/i-/q-）
├── 03-specs/          # 契约层（按 issue-id 组织）
├── 04-plans/          # 执行计划（按 issue-id 组织，v{N}.md 版本化）
├── 05-adrs/           # 架构决策记录
├── 06-design/         # 设计系统、视觉稿
├── 07-reviews/        # 审查记录（按 scope 组织）
├── 08-test-cases/     # 测试用例（按 issue-id 组织）
└── 99-archived/       # 历史归档
```

**命名规范速查**：

| 目录 | 命名规则 | 示例 |
|------|----------|------|
| `02-issues/` | `{prefix}-{NN}-{kebab-slug}.md` | `f-06-knowledge-base-file-manager.md` |
| `03-specs/` | `{issue-id}/*.md` | `f-06/feature-spec.md` |
| `04-plans/` | `{issue-id}/v{N}.md` | `f-06/v1.md` |
| `07-reviews/` | `{scope}/{type}-v{N}.md` | `phase-3/code-v1.md` |
| `08-test-cases/` | `{issue-id}/{scope}.md` | `f-06/behavior.md` |

---

## 阶段判断与下一步

### 阶段 0：你只有一堆想法 / 一份大 PRD

**状态**：刚头脑风暴完，或 PRD 里塞了太多功能，不知道从哪下手。

**该做什么**：
1. **稳定 PRD** — 明确本期要做的功能清单，标记优先级（P0/P1/P2）
2. **划分批次** — 每批 1~3 个相关功能，相关功能放同一批（如"登录"批：登录页 + 认证 API）
3. **在 PRD 中记录批次**：

```markdown
## 功能批次

| 批次 | 功能 | 优先级 | 状态 |
|------|------|--------|------|
| 01 | 登录/注册 | P0 | 待启动 |
| 02 | 知识库列表 | P0 | 待启动 |
| 03 | 文件上传 | P1 | 待启动 |
```

**下一步**：进入阶段 1，选第一批启动。

---

### 阶段 1：选定一批功能，需要拆 issue

**状态**：已确定本期做哪 1~3 个功能。

**使用 skill**：`/issue-generator`

**输入**：PRD 中该批功能的相关章节

**输出**：
- `docs/02-issues/f-XX-*.md`（前端 issue）
- `docs/02-issues/b-XX-*.md`（后端 issue）
- `docs/03-specs/{issue-id}/`（spec 占位目录，目录名与 issue 编号一致）

**路径验证**：
- issue 文件名必须符合 `{prefix}-{NN}-{kebab-slug}.md`
- spec 目录名必须与 issue 编号一致（如 `f-06`），禁止用 feature-slug

**关键决策**：
- 每个功能拆成 f-XX + b-XX 两个独立 issue
- 若功能极简单（纯 UI 无 API），可只拆 f-XX
- 若功能纯后端（如数据库迁移），可只拆 b-XX

**下一步**：进入阶段 2，为这批 issue 编写 spec。

---

### 阶段 2：有 issue，需要写 behavior spec / api spec

**状态**：issue 已创建，但缺少交互状态表格或 API 契约。

**使用 skill**：`/spec-validator`

**执行方式**：
- **前端 issue (f-XX)**：重点编写 `behavior-spec.md`，必须包含 5 种交互状态（loading/empty/error/success/partial）
- **后端 issue (b-XX)**：重点编写 `api-spec.md`，必须包含请求/响应示例和错误码场景

**输入**：
- issue 文件 `docs/02-issues/f-XX-*.md`
- PRD 相关章节
- 现有代码（探索代码库确认当前状态）

**输出**：
- `docs/03-specs/{issue-id}/feature-spec.md`
- `docs/03-specs/{issue-id}/behavior-spec.md`（前端）
- `docs/03-specs/{issue-id}/api-spec.md`（后端）

**路径验证**：
- spec 目录名必须与 issue 编号一致（如 `f-06`）
- 禁止用 feature-slug（如 `knowledge-base-file-manager`）作为目录名

**关键规则**：
- 一次只处理一个 issue 的 spec，不要批量写
- 交互状态表格必须具体到"按钮是否禁用"、"显示什么颜色"
- 发现术语冲突时立即解决，不要留到编码阶段

**下一步**：进入阶段 3，生成执行计划。

---

### 阶段 3：有 spec，需要生成执行计划

**状态**：spec 已完成，需要转化为可执行的任务列表。

**使用 skill**：`/plan-generator`

**输入**：
- issue 文件 `docs/02-issues/{prefix}-{NN}-*.md`
- spec 文件 `docs/03-specs/{issue-id}/`

**输出**：
- `docs/04-plans/{issue-id}/v{N}.md`

**路径验证**：
- plan 目录名必须与 issue 编号一致
- 文件名必须为 `v{N}.md`（如 `v1.md`），禁止用时间戳

**关键规则**：
- 每个步骤 2~5 分钟，禁止占位符（"TODO"、"稍后实现"）
- 必须包含具体代码示例和验证命令
- 计划生成后自检：是否覆盖了 spec 中的所有交互状态/端点？

**下一步**：进入阶段 4，开始编码。

---

### 阶段 4：有计划，需要开发执行

**状态**：plan 文件已生成，准备写代码。

**使用 skill**：`/dev-orchestrator`

**执行方式**：
1. 读取 issue → 读取 spec → 读取 plan
2. 检查测试用例（若无则创建 `docs/08-test-cases/{issue-id}/`）
3. 引导选择执行方式：
   - **子代理驱动**（推荐）：`superpowers:subagent-driven-development`
   - **内联执行**：`superpowers:executing-plans`

**前端开发额外步骤**：
- 编码前可用 gstack `/plan-design-review` 审查设计
- 编码后可用 gstack `/design-review` 做视觉审计

**后端开发额外步骤**：
- 编码后可用 gstack `/review` 做代码审查

**关键规则**：
- 前端若后端 API 未完成，先用 Mock 数据，标记 `TODO: 联调`
- 每完成一个任务运行测试，不要攒到最后一起测
- 频繁提交（每个任务一个 commit）

**下一步**：进入阶段 5，联调整合。

---

### 阶段 5：前后端都完成，需要联调

**状态**：f-XX 和对应的 b-XX 都已编码完成。

**执行方式**：
1. 前端移除 Mock，对接真实 API
2. 运行端到端测试（Playwright）
3. 验证交互状态是否按 behavior-spec 实现
4. 验证 API 是否按 api-spec 返回正确错误码

**发现问题**：
- 前端问题 → 回到阶段 4 修复 f-XX
- 后端问题 → 回到阶段 4 修复 b-XX
- spec 问题 → 回到阶段 2 更新 spec（罕见但允许）

**下一步**：进入阶段 6，关闭 issue。

---

### 阶段 6：功能完成，需要关闭 issue

**状态**：代码已合并，测试通过。

**使用 skill**：`/issue-lifecycle`

**操作**：
1. 更新 issue 状态为 `closed`
2. 勾选验收标准 `[x]`
3. 更新 `PROGRESS.md` 进度
4. 确认审查记录已归档到 `docs/07-reviews/{scope}/{type}-v{N}.md`
5. 确认测试用例已归档到 `docs/08-test-cases/{issue-id}/`
6. 可选：归档到 `docs/99-archived/`

**路径验证**：
- 关闭前必须确认 `07-reviews/` 和 `08-test-cases/` 存在对应文件
- 禁止关闭无审查记录的 issue

**下一步**：回到阶段 1，启动下一批功能。

---

## 快速决策树

```
你当前有什么？
├── 只有想法 / 大 PRD
│   └── → 阶段 0：稳定 PRD + 划分批次
├── 已选定一批功能
│   └── → 阶段 1：/issue-generator 拆 issue
├── 有 issue 无 spec
│   └── → 阶段 2：/spec-validator 写 spec
├── 有 spec 无 plan
│   └── → 阶段 3：/plan-generator 生成计划
├── 有 plan 未编码
│   └── → 阶段 4：/dev-orchestrator 开发执行
├── 前后端都完成
│   └── → 阶段 5：联调整合
└── 功能已验证
    └── → 阶段 6：/issue-lifecycle 关闭
```

---

## 各阶段使用的 skills 汇总

| 阶段 | 自定义 skills | gstack skills |
|------|--------------|---------------|
| 0 - PRD 稳定 | — | — |
| 1 - 拆 issue | `/issue-generator` | — |
| 2 - 写 spec | `/spec-validator` | `/grill-with-docs`（可选） |
| 3 - 生成 plan | `/plan-generator` | — |
| 4 - 开发执行 | `/dev-orchestrator` | `/subagent-driven-development` 或 `/executing-plans` |
| 4 - 前端设计审查 | — | `/plan-design-review` |
| 4 - 前端视觉审计 | — | `/design-review` |
| 4 - 后端代码审查 | — | `/review` |
| 4 - 测试 | — | `/tdd` |
| 5 - 联调 | — | — |
| 6 - 关闭 | `/issue-lifecycle` | — |

---

## 常见陷阱

| 陷阱 | 后果 | 正确做法 |
|------|------|----------|
| 跳过 spec 直接写 plan | plan 太粗，交互不符预期 | 必须先写 behavior-spec |
| 一次拆完 PRD 所有 issue | issue 质量低，后期大量返工 | 按批次拆分，做完一批再拆下一批 |
| 一个 issue 包含前后端 | 无法并行，plan 臃肿 | 拆成 f-XX + b-XX |
| plan 里写 "TODO" | 工程师不知道怎么做 | 每个步骤给具体代码和命令 |
| 前后端不联调直接关闭 | 接口不匹配 | 必须联调验证后再关闭 |
| 发现 spec 错了硬改代码 | 代码和文档脱节 | 回溯更新 spec，再改代码 |
