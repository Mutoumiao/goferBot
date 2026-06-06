---
name: project-workflow
description: >
  当用户说"怎么开始"、"流程是什么"、"我该怎么做"、"从哪开始"、
  "这份 PRD 怎么执行"、"怎么拆分工作"、"怎么协调开发"时触发。
  提供知识库项目完整的 AI 辅助开发流程指引，根据用户当前阶段推荐下一步操作。
---

# 项目开发流程指引

## 执行摘要

| 项目 | 内容 |
|------|------|
| **触发词** | "怎么开始"、"流程是什么"、"从哪开始"、"这份 PRD 怎么执行" |
| **核心目的** | 判断用户当前阶段，推荐下一步 skill 和文档 |
| **禁止行为** | 不判断阶段就直接执行、跳过 spec 写 plan |
| **下一步** | 根据阶段判断调用对应 skill |

> 本 skill 不执行具体操作，只提供流程导航和阶段判断。

---

## 核心原则

1. **契约先行** — 不写 spec 不生成 plan，不生成 plan 不写代码
2. **分批执行** — 大 PRD 拆小批，每批 1~3 个相关功能，走完完整闭环再下一批
3. **双轨并行** — 前端 f-XX 与后端 b-XX 独立拆分、独立计划、并行开发
4. **质量内建** — spec-validator 确保交互状态完整，tdd 确保测试先行，review 确保代码质量

---

## 项目文档架构（Issue-Centric）

```
docs/
├── guide/           # 流程规范、skills 说明、命名规范
│   ├── naming-convention.md   # 全文档命名规范（必读）
│   ├── workflow.md            # 本文件：流程阶段
│   ├── writing-issues.md      # Issue 规范
│   ├── writing-specs.md       # Spec 规范
│   ├── writing-plans.md       # Plan 规范
│   ├── writing-reviews.md     # Review 规范
│   └── _templates/            # 所有模板
├── prd/               # 产品需求（唯一入口）
├── issues/            # 活跃 issue（Issue-Centric 结构）
│   └── {prefix}-{NN}-{slug}/
│       ├── issue.md           # issue 正文
│       ├── checklist.json     # 验收清单（机器管理）
│       ├── plan.md            # 当前生效计划
│       ├── plans/
│       │   └── v{N}.md        # 历史计划版本
│       └── specs/
│           ├── feature-spec.md
│           ├── behavior-spec.md（前端）
│           └── api-spec.md（后端）
├── adrs/           # 架构决策记录
├── design/         # 设计系统、视觉稿
├── reviews/        # 审查记录（按 scope 组织）
└── archived/          # 历史归档

tests/
├── unit/
│   ├── webui/          # 前端单元测试（f-*）
│   └── server/         # 后端单元测试（b-*, d-*）
├── integration/        # 集成测试（i-*）
└── e2e/                # 端到端测试（q-*）
    ├── specs/
    └── flows/
```

**命名规范速查**：

| 目录                  | 命名规则                      | 示例                                |
|-----------------------|-------------------------------|-------------------------------------|
| `issues/`             | `{prefix}-{NN}-{kebab-slug}/` | `f-06-knowledge-base-file-manager/` |
| `issues/{dir}/specs/` | `*.md`                        | `feature-spec.md`                   |
| `issues/{dir}/plans/` | `v{N}.md`                     | `v1.md`                             |
| `reviews/`            | `{scope}/{type}-v{N}.md`      | `phase-3/code-v1.md`                |
| `tests/{layer}/`      | `{name}.spec.ts`              | `TabBar.spec.ts`                    |

---

## 阶段判断与下一步（精简为 3 阶段）

**流程已精简**：原 7 个阶段（0~6）合并为 3 个阶段，减少执行偏差空间。
- 阶段 1「定义」= 原阶段 0+1+2+3.5（PRD 稳定 → Issue 拆分 → Spec 编写 → Plan 生成 → 架构审查）
- 阶段 2「实现」= 原阶段 4（编码 + 测试 + CHECKPOINT）
- 阶段 3「验收」= 原阶段 5+6（联调整合 + 关闭归档）

---

### 阶段 1：定义 — 从想法到完整契约

**状态**：有 PRD 或用户故事，需要产出可执行的契约文档。

**该做什么**（按顺序执行，不可跳步）：

**1a. PRD 稳定化**（若 PRD 未稳定）
- 明确本期要做的功能清单，标记优先级（P0/P1/P2）
- 划分批次：每批 1~3 个相关功能
- **硬关卡**：PRD 未稳定前禁止拆 issue

**1b. Issue 拆分** — 使用 `/issue-generator`
- 每个功能拆为 f-XX + b-XX 两个独立 issue
- 输出：`docs/issues/{dir}/issue.md` + `checklist.json`

**1c. 契约编写** — 使用 `/spec-validator`
- 为每个 issue 编写三层 spec（feature-spec + behavior-spec + api-spec）
- **硬关卡**：spec 须经用户批准后才能进入 1d
- 输出：`docs/issues/{dir}/specs/*.md`

**1d. 执行计划** — 使用 `/plan-generator`
- 将 spec 转化为可执行任务列表
- **硬关卡**：plan 保存前必须通过 `/architecture-guard` 扫描（无 Critical 违规）
- 输出：`docs/issues/{dir}/plan.md`

**阶段 1 完成标准**：
- [ ] issue 目录创建完成
- [ ] 三层 spec 编写完成且包含测试映射
- [ ] plan.md 生成完成，无 TODO，含 ADR 合规声明
- [ ] `/architecture-guard` 扫描通过（无 Critical）

**下一步**：进入阶段 2，调用 `/dev-orchestrator` 开始编码。

---

### 阶段 2：实现 — 编码与测试

**状态**：阶段 1 全部完成，issue + spec + plan + 架构合规均已就绪。

**使用 skill**：`/dev-orchestrator`

**核心要求**：
1. **读取 issue → 读取 spec → 读取 plan**
2. **检查测试代码**（若无则调用 `/test-scaffold` 创建）
3. **每个任务必须输出 CHECKPOINT**（含 RED + GREEN 证据）
4. **引导选择执行方式**：
   - **子代理驱动**（推荐）：`superpowers:subagent-driven-development`
   - **内联执行**：`superpowers:executing-plans`

**Agent CHECKPOINT 协议**（解决 TDD 执行不到位）：
每个编码任务必须输出可验证的 CHECKPOINT，证明 RED → GREEN 真实发生：

```markdown
[CHECKPOINT] 任务完成验证
- 测试文件：`tests/unit/server/xxx.spec.ts`
- RED 证据：（粘贴测试失败输出，至少包含失败的断言信息）
- 实现文件：`packages/server/src/xxx.ts`
- GREEN 证据：（粘贴测试通过输出，包含 Tests: N passed）
- 对应 spec：AC-XX 描述
- 架构合规：`/architecture-guard` 扫描结果
```

**违规判定**：
- 无 CHECKPOINT → 任务视为未完成
- 有 CHECKPOINT 但无 RED 证据 → 视为"后补测试"，需回退到 RED 阶段重新执行
- RED 和 GREEN 之间无代码变更 → 视为伪造证据

**关键规则**：
- 前端若后端 API 未完成，先用 Mock 数据，标记 `TODO: 联调`
- 每完成一个任务运行测试，不要攒到最后一起测
- **提交策略**：整个 issue 完成后统一审查、统一提交。任务中途不执行 `git commit`，仅输出 CHECKPOINT 作为进度标记。保持 issue → commit 的一对一关系，提升 `git log` 的可读性。

**下一步**：进入阶段 3，验收。

---

### 阶段 3：验收 — 联调与关闭

**状态**：f-XX 和对应的 b-XX 编码完成，所有任务 CHECKPOINT 已验证。

**执行方式**：
1. 前端移除 Mock，对接真实 API
2. 运行端到端测试（Playwright）
3. 使用 `/kb-review` 执行审查：
   - 代码审查：验证代码质量、安全问题
   - 规格对齐审查：验证交互状态是否按 behavior-spec 实现
   - **TDD 合规审查：验证每个任务的 CHECKPOINT 存在且 RED → GREEN 真实发生**
   - 安全审查：验证安全基线是否满足
4. 使用 `/integration-check` 检查：
   - 前端 API 调用与后端 api-spec 一致性
   - 参数、响应格式、错误码匹配
   - Mock 残留清理
5. 审查记录归档到 `docs/reviews/`
6. 使用 `/issue-lifecycle` 关闭 issue：
   - 更新 issue 状态为 `closed`
   - 更新 checklist.json 中 AC-XX 状态为 `passed`
   - 更新 `BACKLOG.md` / `CHANGELOG.md`

**发现问题**：
- 前端问题 → 回到阶段 2 修复 f-XX
- 后端问题 → 回到阶段 2 修复 b-XX
- spec 问题 → 回到阶段 1 更新 spec（允许回溯）

**阶段 3 完成标准**：
- [ ] 所有 Critical/Major 问题已修复
- [ ] 每个任务的 CHECKPOINT 已验证（含 RED + GREEN 证据）
- [ ] `.spec.ts` 测试全部通过
- [ ] 类型检查通过
- [ ] 审查记录已归档到 `docs/reviews/`
- [ ] BACKLOG.md + CHANGELOG.md 已更新

**下一步**：回到阶段 1，启动下一批功能。

---

## 快速决策树

```
你当前有什么？
├── 只有想法 / 大 PRD
│   └── → 阶段 1（定义）：稳定 PRD → /issue-generator 拆 issue → /spec-validator 写 spec → /plan-generator 生成计划
├── 有完整契约（issue + spec + plan）
│   └── → 阶段 2（实现）：/dev-orchestrator 编码 + 测试 + CHECKPOINT
├── 编码完成
│   └── → 阶段 3（验收）：联调 → /kb-review 审查 → /issue-lifecycle 关闭
```

---

## 各阶段使用的 skills 汇总

| 阶段           | 目标           | 自定义 skills                              | gstack skills                                        |
|----------------|----------------|-------------------------------------------|------------------------------------------------------|
| 1 - 定义       | 产出完整契约   | `/issue-generator` → `/spec-validator` → `/plan-generator` → `/architecture-guard` | `/grill-with-docs`（可选）                           |
| 2 - 实现       | 编码 + 测试    | `/dev-orchestrator` + `/test-scaffold` + `/architecture-guard` | `/subagent-driven-development` 或 `/executing-plans` |
| 2 - 设计审查   | —              | —                                         | `/plan-design-review`                                |
| 2 - 代码审查   | —              | —                                         | `/review`                                            |
| 3 - 验收       | 联调 + 关闭    | `/kb-review` + `/integration-check` + `/issue-lifecycle` | —                                                    |

---

## 常见陷阱

| 陷阱                    | 后果                       | 正确做法                       |
|-------------------------|----------------------------|--------------------------------|
| 跳过 spec 直接写 plan   | plan 太粗，交互不符预期    | 必须先写 behavior-spec         |
| 一次拆完 PRD 所有 issue | issue 质量低，后期大量返工 | 按批次拆分，做完一批再拆下一批 |
| 一个 issue 包含前后端   | 无法并行，plan 臃肿        | 拆成 f-XX + b-XX               |
| plan 里写 "TODO"        | 工程师不知道怎么做         | 每个步骤给具体代码和命令       |
| 前后端不联调直接关闭    | 接口不匹配                 | 必须联调验证后再关闭           |
| 发现 spec 错了硬改代码  | 代码和文档脱节             | 回溯更新 spec，再改代码        |
| **Agent 输出 CHECKPOINT 但无 RED 证据** | 测试是后补的，TDD 流于形式 | **必须粘贴测试失败输出，禁止文字描述代替** |
| **阶段 1 未完成就进入阶段 2** | 无契约编码 = 返工 | **必须确认 issue + spec + plan + 架构合规全部就绪** |
