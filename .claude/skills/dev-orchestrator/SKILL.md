---
name: dev-orchestrator
description: >
  当用户说"开始做 issue f-15"、"开发 issue b-02"、"issue 怎么实现"、
  "怎么开发这批功能"时触发。
  自动协调完整开发准备流程：解析 issue → 读取 spec → 检查计划 → 检查测试 → 引导进入开发。
  支持单 issue 开发和多 issue 并行开发两种模式。
  核心目的：避免在无规格、无计划、无测试的情况下直接写代码。
  务必在以下场景主动使用：用户准备开始编码、需要执行 plan、需要协调前后端开发、
  需要检查开发前置条件是否满足。
---

# 开发编排器

协调 issue 分析、spec 读取、计划检查、测试检查和开发执行的完整工作流。

**核心理念**：开发前必须先有 spec，有 spec 后必须先有计划，有计划后必须先有测试代码。不要在没有行为契约和验收标准的情况下直接写代码。

**开始时声明：** "正在使用 dev-orchestrator skill 协调开发流程。"

---

## 读取协议

**每步读取必须遵守分层读取，避免全文加载浪费 token：**

1. **先读索引** — 查 `BACKLOG.md` 或 `CHANGELOG.md` 定位目标 issue
2. **再读 frontmatter** — 读目标 issue 的 YAML 头部获取 `status`/`summary`/`blocked_by`/`checklist`/`plan`/`specs`
3. **按需深入正文** — 仅当 frontmatter 确认 status 非 closed，且与当前任务相关时，才继续读正文
4. **读 spec/plan 同理** — 先读其 frontmatter 获取 `status`/`summary`，确认后再深入
5. **尽量避免全文扫读** — 不得在未读 frontmatter 前直接读取完整文档

---

## 路径约定

| 文档类型  | 路径                                  | 验证规则                                      |
|-----------|---------------------------------------|-----------------------------------------------|
| Issue     | `docs/issues/{dir}/issue.md`          | frontmatter 必须包含 id/status/track/priority/blocked_by/checklist/plan/specs |
| Spec      | `docs/issues/{dir}/specs/`            | 目录在 issue 目录下                           |
| Plan      | `docs/issues/{dir}/plan.md`           | 当前生效版本                                  |
| 历史 Plan | `docs/issues/{dir}/plans/v{N}.md`     | 版本归档                                      |
| 审查记录  | `docs/reviews/{scope}/{type}-v{N}.md` | scope 语义化，type 限定枚举                   |

**测试代码路径（按测试层级分层，不再使用 `tests/issues/`）：**

| Issue Track | 测试层级 | 测试路径 |
|-------------|---------|---------|
| `b-*`, `d-*` | 后端单元 | `tests/unit/server/{name}.spec.ts` |
| `f-*` | 前端单元 | `tests/unit/webui/{name}.spec.ts` |
| `i-*` | 集成测试 | `tests/integration/{name}.spec.ts` |
| `q-*` (E2E) | 端到端测试 | `tests/e2e/specs/` 或 `tests/e2e/flows/` |

> 测试文件命名：`{feature-name}.spec.ts`，测试用例名以 `AC-XX:` 开头。
> Issue → 测试映射关系记录在 `tests/README.md`。

**轨道前缀：**
- `f-XX`: 前端功能
- `b-XX`: 后端接口
- `d-XX`: 设计
- `i-XX`: 基础设施
- `q-XX`: 质量

---

## TDD 检查点格式

每个任务完成后必须输出：
```
[CHECKPOINT] ✅ 测试通过 | 🔍 已验证 | ⏳ 待办 | 🚨 阻塞
```

---

## 两种工作模式

### 模式 A：单 Issue 开发

用户说"开始做 f-15"，只处理一个 issue。

### 模式 B：多 Issue 并行开发

用户说"开发这批功能"、"并行实现 f-15 和 b-02"，需要协调多个 issue。

**协调逻辑：**
1. 读取所有指定 issue
2. 检查依赖关系（`blocked_by`）
3. 若存在前后端配对（如 f-15 + b-02）：
   - 检查后端 issue 是否已完成
   - 若未完成，前端 plan 中需包含 Mock 方案
   - 标记 `TODO: 联调` 在双方 plan 中
4. 分别检查每个 issue 的 spec、plan、测试代码
5. 全部就绪后，引导并行执行

---

## 工作流程

### 0. 设置隔离工作区（可选）

如需要隔离当前工作区，使用 `superpowers:using-git-worktrees` 创建 git worktree。

**适用场景：**
- 当前分支有未提交更改
- 需要并行处理多个 issue
- 需要干净的基线测试

**不适用：**
- 当前工作区已干净
- 单 issue 快速修复

---

### 1. 解析 Issue 编号

支持格式：`f-15`、`b-02`、`issue f-15`、`f-15-global-tab-bar`

可一次传入多个：`f-15 b-02`、`开发 f-15 和 b-02`

统一提取前缀 + 数字部分。

### 2. 读取 Issue 文件

在 `docs/issues/` 查找匹配目录。

- 唯一匹配：**先读 frontmatter**（`---` 之间），提取 `status`/`summary`/`blocked_by`/`checklist`/`plan`/`specs`
- 多个匹配：列出请用户确认
- 未找到：报错并列出所有 issue

**仅当 frontmatter `status` 非 closed 时继续**。`status: closed` → 告知已完成，询问是否重新打开。

### 3. 读取对应 Spec

根据 issue 目录查找：

```
docs/issues/{dir}/specs/
├── feature-spec.md       # 必须存在
├── behavior-spec.md      # 前端 issue 必须存在
└── api-spec.md           # 后端 issue 必须存在
```

**路径验证：**
- spec 文件放在 issue 目录下的 `specs/` 子目录中

**若 spec 不存在：**
1. 告知用户未找到行为契约
2. 调用 `spec-validator` skill 创建 spec
3. Spec 完成后进入步骤 4

**若 spec 存在：**
1. 确认是否包含交互状态表格（前端）或 API 契约（后端）
2. 若不完整，提示需补充
3. 进入步骤 4

### 4. 检查执行计划

在 `docs/issues/{dir}/` 查找计划文件。

**路径验证：**
- 当前生效版本为 `plan.md`
- 历史版本在 `plans/v{N}.md`

**若不存在：**
1. 告知用户未找到执行计划
2. 调用 `plan-generator` skill 创建计划
3. 计划完成后进入步骤 5

**若已存在：**
1. 读取 `plan.md`
2. 确认是否完整（任务分解、文件结构、验证步骤）
3. **关键检查**：计划中的每个任务是否都以"编写失败测试"开始？
4. 若不是，提示计划不符合 TDD 规范，需重写
5. 展示计划概要，进入步骤 5

**多 issue 并行时的特殊处理：**
- 若存在前后端配对且后端未完成，检查前端 plan 是否包含 Mock 方案
- 若缺少 Mock 方案，提示补充

### 5. 检查测试代码（TDD 关卡）

**这是核心关卡。根据 issue 的 track 前缀确定测试层级目录，检查对应的 `.spec.ts` 文件。**

根据 plan 中声明的测试文件路径，检查：

**检查内容：**
1. 测试文件是否存在？
2. 是否包含 `describe` + `it` 块？
3. 测试用例名是否以 `AC-XX:` 开头？
4. 测试用例是否覆盖 spec 中的交互状态/错误场景？
5. 测试是否是"失败"状态（即实现代码尚未编写）？

**若测试不存在：**
1. 告知用户未找到测试代码
2. 根据 spec 生成测试骨架（`.spec.ts` 文件）
3. 运行测试确认失败（red 阶段）
4. 进入步骤 6

**若测试已存在：**
1. 读取测试代码，统计测试用例数量
2. 检查是否覆盖所有验收标准和边界条件
3. 若有遗漏，提示并询问是否补充
4. 进入步骤 5b

### 5b. 检查集成/E2E 测试（补充闸门）

**b-*, d-* track**：如果 issue 涉及 API 端点或数据库操作，检查 `tests/integration/` 下是否有对应的集成测试。若无，提示用户补充（参考 `docs/guide/backend/integration-testing-guide.md`）。

**i-*, q-*（集成）track**：必须存在 `tests/integration/{name}.spec.ts`，否则阻塞。

**q-*（E2E）track**：必须存在 `tests/e2e/specs/{name}.spec.ts` 或 `tests/e2e/flows/{name}.spec.ts`，用 Playwright 运行确认失败。验证命令：`npx playwright test --config tests/e2e/playwright.config.ts -g "AC-"`。

### 6. 引导进入开发

spec、plan 和测试代码都就绪后，汇报状态：

**单 issue 模式：**

```
f-15 文件上传组件 — 开发准备就绪

- Issue 状态: open
- 行为契约: docs/issues/f-15-global-tab-bar/specs/behavior-spec.md
- 执行计划: docs/issues/f-15-global-tab-bar/plan.md (X 个任务)
- 测试代码: tests/unit/webui/TabBar.spec.ts (Y 条测试用例)
- TDD 状态: 🔴 测试已编写，运行失败（等待实现）

请选择开发执行方式：
1. /subagent-driven-development — 子代理并行开发（推荐）
2. /executing-plans — 当前会话顺序执行
3. 先 review spec 再决定
```

**多 issue 并行模式：**

```
批次开发准备就绪 — 2 个 issue

f-15 TabBar 全局化
- 状态: open
- 计划: 5 个任务
- 测试: TabBar.spec.ts (8 条用例)
- 注意: 后端 b-02 未完成，将使用 Mock 数据

b-02 知识库 CRUD API
- 状态: open
- 计划: 4 个任务
- 测试: knowledgeBaseCrud.spec.ts (6 条用例)

依赖关系: f-15 阻塞于 b-02（接口对接阶段）

建议执行顺序：
1. 先并行启动 b-02 + f-15（前端用 Mock）
2. b-02 完成后，f-15 移除 Mock 联调
3. 联调通过后再关闭两个 issue

请选择：
1. 按建议顺序执行
2. 只执行其中一个
3. 调整执行顺序
```

根据用户选择执行对应 skill。

---

## 执行方式详解

### 方式一：子代理驱动（推荐）

使用 `superpowers:subagent-driven-development`。

**核心模式：** 每个任务一个新鲜子代理 + 两阶段审查（spec 对齐 → 代码质量）

**为什么用子代理：**
- 委托任务给隔离上下文的专用代理
- 精确构建指令和上下文，确保专注成功
- 子代理不继承你的会话历史 —— 你构建它们需要的精确内容
- 保留你自己的上下文用于协调工作

**核心原则：** 新鲜子代理 per 任务 + 两阶段审查 = 高质量，快速迭代

**模型选择策略：**

| 任务复杂度 | 模型选择 | 信号 |
|-----------|---------|------|
| 机械实现（1-2 文件，完整 spec） | 快速/轻量模型 | 成本低，速度快 |
| 集成判断（多文件协调，模式匹配） | 标准模型 | 需要一定推理能力 |
| 架构/设计/审查 | 最强可用模型 | 需要深度理解和判断 |

**执行流程：**

```
读取 plan，提取所有任务及完整文本，记录上下文，创建 TodoWrite
  ↓
任务 1: 派发实现子代理（提供完整任务文本 + 上下文）
  ↓
实现子代理提问？ → 是 → 回答问题，提供上下文 → 重新派发
  ↓ 否
实现子代理实现、测试、提交、自检
  ↓
派发 spec 对齐审查子代理
  ↓
Spec 审查通过？ → 否 → 实现子代理修复 → 重新审查
  ↓ 是
派发代码质量审查子代理
  ↓
代码审查通过？ → 否 → 实现子代理修复 → 重新审查
  ↓ 是
标记任务完成
  ↓
还有更多任务？ → 是 → 下一个任务
  ↓ 否
派发最终代码审查子代理
  ↓
使用 `superpowers:finishing-a-development-branch` 完成
```

**子代理状态处理：**

实现子代理报告四种状态之一：

| 状态 | 含义 | 处理方式 |
|------|------|----------|
| **DONE** | 完成 | 进入 spec 对齐审查 |
| **DONE_WITH_CONCERNS** | 完成但有疑虑 | 先读疑虑，正确性/范围问题先解决，观察性问题记录后继续 |
| **NEEDS_CONTEXT** | 需要更多信息 | 提供缺失上下文，重新派发 |
| **BLOCKED** | 无法完成 | 1. 上下文问题 → 提供更多上下文，同模型重试<br>2. 需要更多推理 → 更强模型重试<br>3. 任务太大 → 拆分为更小的任务<br>4. 计划本身错误 → 升级给人类 |

**审查顺序（强制）：**
1. **spec 对齐审查** 先于 **代码质量审查**
2. 代码质量审查在 spec 对齐通过前**禁止开始**
3. reviewer 发现问题 → implementer 修复 → reviewer **重新审查**
4. 禁止跳过重新审查

**禁止并行：**
- 禁止同时 dispatch 多个实现子代理（会冲突）
- 禁止让实现子代理自己读 plan 文件（由你提供完整文本）

---

### 方式二：内联执行

使用 `superpowers:executing-plans`。

**适用场景：** 当前会话顺序执行，适合任务间有强依赖、需要连续上下文的情况。

**执行流程：**

```
1. 加载并审查 plan
   - 读取 plan 文件
   - 批判性审查 —— 识别任何问题或顾虑
   - 如有顾虑：向用户提出
   - 如无顾虑：创建 TodoWrite 并继续

2. 执行任务
   对每个任务：
   - 标记为 in_progress
   - 严格遵循每个步骤（plan 已拆分为 bite-sized 步骤）
   - 运行 plan 指定的验证
   - 标记为 completed

3. 完成开发
   - 所有任务完成并验证后：
   - 声明："使用 `superpowers:finishing-a-development-branch` skill 完成工作"
   - 运行测试验证
   - 提供合并/PR/保留/丢弃选项
```

**验证铁律（融入自 verification-before-completion）：**

声明任何状态或表达满意前必须运行验证。

```
声明完成前：
1. 识别：什么命令能证明这个声明？
2. 运行：执行完整命令（新鲜、完整）
3. 读取：完整输出，检查退出码，统计失败数
4. 验证：输出是否确认声明？
   - 否：陈述实际状态并附证据
   - 是：附证据陈述声明
5. 只有此时：做出声明

跳过任何步骤 = 撒谎，不是验证
```

**常见失败：**

| 声明 | 需要 | 不足够 |
|------|------|--------|
| 测试通过 | 测试命令输出：0 失败 | 上次运行、"应该通过" |
| 类型检查通过 | `pnpm type-check` exit 0 | linter 通过 |
| Bug 修复 | 原症状测试：通过 | 代码改了、假设已修复 |
| 需求满足 | 逐条对照 spec 检查 | 测试通过 |

**红旗 - 停止：**
- 使用 "应该"、"可能"、"看起来"
- 验证前表达满意（"好了！"、"完成！"）
- 信任子代理成功报告而不独立验证
- 依赖部分验证
- "这次例外"

**何时停止并求助：**
- 遇到阻塞（缺少依赖、测试失败、指令不清）
- Plan 有关键缺口导致无法开始
- 不理解某个指令
- 验证反复失败

**不要强行通过阻塞** —— 停下来询问。

---

---

## 开发完成检查清单（融入自 finishing-a-development-branch）

所有任务完成后、关闭 issue 前，必须运行以下验证：

### 强制验证（未通过禁止关闭）

1. **按 track 运行对应测试全部通过**
   - f-*, b-*, d-*：`npx vitest run tests/unit/`
   - i-*, q-*（集成）：`pnpm test:integration`
   - q-*（E2E）：`pnpm test:e2e`
   - 预期：0 失败，全部绿色

2. **类型检查通过**
   ```bash
   pnpm type-check
   ```
   - 预期：0 错误

3. **全量回归无退化**
   ```bash
   npx vitest run && pnpm test:integration && pnpm test:e2e
   ```
   - 预期：所有层级的测试全部通过

### 验证通过后

向用户汇报并提供选项：

```
开发完成，所有验证通过：
- 单元测试：✅ 全部通过
- 类型检查：✅ 通过

请选择下一步：
1. 提交并继续下一个任务
2. 请求代码审查（/kb-review）
3. 标记 issue 为完成（/issue-lifecycle）
```

**禁止：**
- 测试未通过就呈现"完成"选项
- "应该可以了"式的完成声明

---

## 边界情况

| 场景                                | 处理方式                                 |
|-------------------------------------|------------------------------------------|
| Issue 文件不存在                    | 报错，列出所有 issue 供核对              |
| 多个 issue 匹配                     | 请用户确认                               |
| Spec 不存在                         | 调用 `spec-validator` 生成               |
| Plan 存在但不完整                   | 提示需补充，询问是否重写                 |
| Plan 不符合 TDD                     | 提示必须重写，每个任务以测试开始         |
| 测试代码不存在                      | 根据 spec 生成测试骨架，确认失败后再开发 |
| 测试覆盖不完整                      | 列出未覆盖项，询问是否补充               |
| Issue 有未完成的阻塞依赖            | 警告用户先完成依赖                       |
| 用户仅"查看进度"                    | 仅展示当前状态                           |
| Issue 状态为 `closed`               | 告知已完成，询问是否重新打开             |
| 多 issue 中有前后端配对但后端未完成 | 前端 plan 中补充 Mock 方案               |

---

## 依赖 Skills

- `spec-validator` — 验证/生成行为契约
- `plan-generator` — 生成执行计划（TDD 强制）
- `subagent-driven-development` — 子代理并行开发（推荐）
- `executing-plans` — 顺序执行计划
- `kb-review` — 代码审查与质量检查
- `finishing-a-development-branch` — 完成开发分支
- `issue-lifecycle` — issue 状态管理与关闭流程
- `issue-updater` — 更新 BACKLOG.md 和 CHANGELOG.md
