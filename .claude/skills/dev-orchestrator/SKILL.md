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

## 执行摘要

| 项目 | 内容 |
|------|------|
| **触发词** | "开发 issue"、"开始做 f-15"、"issue 怎么实现" |
| **硬关卡** | 阶段 1 完成（issue + spec + plan + 架构合规）→ 测试存在 → 架构合规预审通过（缺一不可） |
| **核心输出** | `[CHECKPOINT] 任务完成验证`（含 RED + GREEN 证据） |
| **禁止行为** | 阶段 1 未完成就编码、无 RED 证据声明完成、跳过验证声明完成 |
| **下一步** | 阶段 1 未完成 → 调用对应 skill 补全；阶段 1 已完成 → 进入编码 |

协调 issue 分析、spec 读取、计划检查、测试检查和开发执行的完整工作流。

**核心理念**：开发前必须先完成阶段 1（定义），即 issue + spec + plan + 架构合规全部就绪。不要在没有完整契约的情况下直接写代码。

**阶段归属**：本 skill 执行 **阶段 2（实现）**，前提是阶段 1（定义）已全部完成。

**开始时声明：** "正在使用 dev-orchestrator skill 协调阶段 2（实现）开发流程。"

---

## 读取协议

**每步读取必须遵守分层读取，避免全文加载浪费 token：**

1. **先读索引** — 查 `BACKLOG.md` 或 `CHANGELOG.md` 定位目标 issue
2. **再读 frontmatter** — 读目标 issue 的 YAML 头部获取 `status`/`summary`/`blocked_by`/`checklist`/`plan`/`specs`
3. **按需深入正文** — 仅当 frontmatter 确认 status 非 closed，且与当前任务相关时，才继续读正文
4. **读 spec/plan 同理** — 先读其 frontmatter 获取 `status`/`summary`，确认后再深入
5. **尽量避免全文扫读** — 不得在未读 frontmatter 前直接读取完整文档

---

## 开发前必读文档

根据 issue track 前缀，**必须**阅读以下文档：

| Track | 必读文档 | 读取方式 |
|-------|---------|---------|
| `f-*` | [`docs/guide/frontend/README.md`](mdc:docs/guide/frontend/README.md) | 必读全文 |
| `f-*`（浮层） | [`docs/guide/frontend/overlay-conventions.md`](mdc:docs/guide/frontend/overlay-conventions.md) | 按需阅读 |
| `f-*` | 前端测试规范 → `docs/guide/testing/unit-testing-guide.md` 第 5-6 章 | 必读 |
| `b-*` / `d-*` | [`docs/guide/backend/README.md`](mdc:docs/guide/backend/README.md) | 必读全文（含规范索引，按需深入各规范） |
| `b-*` / `d-*` | 后端测试规范 → `docs/guide/testing/unit-testing-guide.md` 第 7 章 | 必读 |
| `i-*` | [`docs/guide/testing/integration-testing-guide.md`](mdc:docs/guide/testing/integration-testing-guide.md) | 必读全文 |
| `q-*` | [`docs/guide/testing/e2e-testing-guide.md`](mdc:docs/guide/testing/e2e-testing-guide.md) | 必读全文 |

**为什么必须读**：代码库规范定义了实际目录结构、开发流程、目录约束。测试指南定义了实际测试基础设施（`TestAppFactory`、`AuthFixtures`、`injectMockToken` 等）。不阅读直接写 = 大概率与现有模式冲突。

**分层读取原则**：先读 README 了解全貌（5 分钟），再按需深入相关章节。

---

## 路径约定

| 文档类型  | 路径                                  | 验证规则                                      |
|-----------|---------------------------------------|-----------------------------------------------|
| Issue     | `docs/issues/{dir}/issue.md`          | frontmatter 必须包含 id/status/track/priority/blocked_by/checklist/plan/specs |
| Spec      | `docs/issues/{dir}/specs/`            | 目录在 issue 目录下                           |
| Plan      | `docs/issues/{dir}/plan.md`           | 当前生效版本                                  |
| 历史 Plan | `docs/issues/{dir}/plans/v{N}.md`     | 版本归档                                      |
| 审查记录  | `docs/reviews/{scope}/{type}-v{N}.md` | scope 语义化，type 限定枚举                   |

**测试代码路径**参见 [`_shared/references/test-paths.md`](mdc:.claude/skills/_shared/references/test-paths.md)。

**轨道前缀**参见 [`_shared/references/track-prefixes.md`](mdc:.claude/skills/_shared/references/track-prefixes.md)。

---

## Agent CHECKPOINT 协议（阶段 2 核心机制）

**目的**：解决 TDD 执行不到位的问题，要求每个编码任务提供 RED → GREEN 的可验证证据。

**每个任务完成后必须输出**：

```markdown
[CHECKPOINT] 任务完成验证
- 测试文件：`tests/unit/server/xxx.spec.ts`
- RED 证据：（粘贴测试失败输出。模式 A：断言失败输出；模式 B：先贴编译错误输出，再贴二次断言失败输出）
- 实现文件：`packages/server/src/xxx.ts`
- GREEN 证据：（粘贴测试通过输出，包含 Tests: N passed）
- 对应 spec：AC-XX 描述
- 架构合规：`/architecture-guard` 扫描结果（无 Critical / N 个 Major）
```

**RED 证据要求（满足其一即可）：**

| 类型 | 要求 | 适用场景 |
|------|------|----------|
| **断言失败 RED** | 必须包含具体的失败断言（如 `expected 200 to be 401`）和失败的测试用例名称 | 补测试、重构 |
| **编译失败 RED + 二次断言失败 RED** | 必须包含两次运行输出：第一次显示 import/类型错误，第二次显示断言失败 | 新功能开发 |

**两种 RED 的共同点：**
- 禁止用"测试已失败"等文字描述代替实际输出
- RED 和 GREEN 之间必须有实现代码变更（空壳不算实现代码）

**GREEN 证据要求**：
- 必须包含 `Tests: N passed` 或等价输出
- 如果是部分通过，需说明哪些 AC 尚未覆盖

**违规判定**：
- 无 CHECKPOINT → 任务视为未完成
- 有 CHECKPOINT 但无 RED 证据 → 视为"后补测试"，需回退到 RED 阶段重新执行
- RED 和 GREEN 之间无代码变更（空壳不计入） → 视为伪造证据
- 模式 B 下只有一次运行输出（缺少二次断言失败 RED） → 视为未完成空壳步骤

---

## 两种工作模式

### 模式 A：单 Issue 开发

用户说"开始做 f-15"，只处理一个 issue。

### 模式 B：多 Issue 并行开发

用户说"开发这批功能"、"并行实现 f-15 和 b-02"。

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

---

### 1. 阶段 1 完成度检查（进入编码前的硬关卡）

在读取任何代码前，**必须先验证阶段 1（定义）是否全部完成**。这是进入阶段 2（实现）的硬关卡。

**检查清单**：

| 检查项 | 验证内容 | 未通过的处理 |
|--------|----------|-------------|
| **issue 存在** | `docs/issues/{dir}/issue.md` 存在且 status 非 closed | 报错，列出所有 issue |
| **spec 存在** | `docs/issues/{dir}/specs/` 下至少有一个 spec 文件 | 调用 `/spec-validator` 补全 |
| **spec 完整** | feature-spec.md + behavior-spec.md（前端）/ api-spec.md（后端） | 提示补充 |
| **plan 存在** | `docs/issues/{dir}/plan.md` 存在 | 调用 `/plan-generator` 补全 |
| **plan 合规** | 每个任务以测试开始，无 TODO，含 ADR 合规声明 | 提示重写 |
| **架构合规** | plan 已通过 `/architecture-guard` 扫描（无 Critical） | 调用 `/architecture-guard` 补扫 |

**阶段 1 未完成的阻断逻辑**：

```
用户说"开发 f-15"
    ↓
检查 docs/issues/f-15-*/issue.md
    ↓
检查 specs/ 目录
    ↓
❌ spec 不存在 → "阶段 1 未完成：缺少 spec。调用 /spec-validator 补全？"
    ↓
检查 plan.md
    ↓
❌ plan 不存在 → "阶段 1 未完成：缺少 plan。调用 /plan-generator 补全？"
    ↓
检查 plan 是否通过 /architecture-guard
    ↓
❌ 未通过 → "阶段 1 未完成：plan 未通过架构审查。调用 /architecture-guard 扫描？"
    ↓
✅ 全部通过 → "阶段 1（定义）已完成，进入阶段 2（实现）"
```

**禁止**：在阶段 1 未完成时引导用户进入编码。即使用户催促，也必须先补全阶段 1。

---

### 2. 读取 Issue 文件

在 `docs/issues/` 查找匹配目录。

- 唯一匹配：**先读 frontmatter**（`---` 之间），提取 `status`/`summary`/`blocked_by`/`checklist`/`plan`/`specs`
- 多个匹配：列出请用户确认
- 未找到：报错并列出所有 issue

**仅当 frontmatter `status` 非 closed 时继续**。`status: closed` → 告知已完成，询问是否重新打开。

---

### 3. 读取对应 Spec

根据 issue 目录查找：

```
docs/issues/{dir}/specs/
├── feature-spec.md       # 必须存在
├── behavior-spec.md      # 前端 issue 必须存在
└── api-spec.md           # 后端 issue 必须存在
```

**若 spec 不存在或不全：**
1. 告知用户阶段 1 未完成
2. 调用 `/spec-validator` skill 创建 spec
3. Spec 完成后回到步骤 1 重新检查

**若 spec 存在：**
1. 确认是否包含交互状态表格（前端）或 API 契约（后端）
2. 确认是否包含测试映射表格
3. 若不完整，提示需补充
4. 进入步骤 4

---

### 4. 检查执行计划

在 `docs/issues/{dir}/` 查找计划文件。

**路径验证：**
- 当前生效版本为 `plan.md`
- 历史版本在 `plans/v{N}.md`

**若不存在：**
1. 告知用户阶段 1 未完成
2. 调用 `/plan-generator` skill 创建计划
3. 计划完成后回到步骤 1 重新检查

**若已存在：**
1. 读取 `plan.md`
2. 确认是否完整（任务分解、文件结构、验证步骤）
3. **关键检查**：计划中的每个任务是否都以"编写失败测试"开始？
4. 若不是，提示计划不符合 TDD 规范，需重写
5. 展示计划概要，进入步骤 5

**多 issue 并行时的特殊处理：**
- 若存在前后端配对且后端未完成，检查前端 plan 是否包含 Mock 方案
- 若缺少 Mock 方案，提示补充

---

### 5a. 检查测试代码（TDD 关卡）

**这是核心关卡。** 根据 issue 的 track 前缀确定测试层级目录，检查对应的 `.spec.ts` 文件。

根据 plan 中声明的测试文件路径，检查：

**检查内容：**
1. 测试文件是否存在？
2. 是否包含 `describe` + `it` 块？
3. 测试用例名是否以 `AC-XX:` 开头？
4. 测试用例是否覆盖 spec 中的交互状态/错误场景？
5. 测试是否是"失败"状态（即实现代码尚未编写）？
6. **测试代码是否符合对应测试指南的规范？**（infra-check、realMode、fixtures 使用等）

**若测试不存在：**
1. 告知用户未找到测试代码
2. **调用 `/test-scaffold` skill** 根据 spec 生成测试骨架（`.spec.ts` 文件）
3. 运行测试确认失败（red 阶段）
4. 进入步骤 5c

**若测试已存在：**
1. 读取测试代码，统计测试用例数量
2. 检查是否覆盖所有验收标准和边界条件
3. 若有遗漏，**调用 `/test-scaffold` 追加缺失的 `it()` 块**，然后运行 red 验证
4. 进入步骤 5b

---

### 5b. 检查集成/E2E 测试（补充闸门）

**b-*, d-* track**：如果 issue 涉及 API 端点或数据库操作，检查 `tests/integration/` 下是否有对应的集成测试。若无，提示用户补充。

**i-*, q-*（集成）track**：必须存在 `tests/integration/{name}.spec.ts`，否则阻塞。

**q-*（E2E）track**：必须存在 `tests/e2e/specs/{name}.spec.ts` 或 `tests/e2e/flows/{name}.spec.ts`，用 Playwright 运行确认失败。

测试路径与命名规范参见 [`_shared/references/test-paths.md`](mdc:.claude/skills/_shared/references/test-paths.md)。

---

### 5c. 架构合规预审（执行前硬关卡）

在引导进入开发前，**必须调用 `/architecture-guard` 进行架构合规预审**。这不是可选审查，而是进入编码阶段的硬关卡。

**预审执行流程：**

```
dev-orchestrator 步骤 5c
    ↓
调用 /architecture-guard 审查以下内容：
    - plan.md 中的代码块
    - specs/*.md 中的 DTO 定义和依赖声明
    - 已存在的相关实现文件（如有）
    ↓
❌ 发现 Critical 违规 → 阻断编码，输出违规详情 → 修复后重新调用 /architecture-guard
✅ 审查通过 → 进入步骤 6
```

**审查内容（由 /architecture-guard 执行）：**
- 验证方案合规：Zod schema + `createZodDto`，无 class-validator
- 响应格式合规：直接返回原始数据，无无正当理由的 `@BypassResponse()`
- 依赖引入合规：无与现有技术栈冲突的新依赖
- NestJS 规范合规：模块分层、RESTful 端点、认证守卫

**预审结果处理：**

| 检查结果 | 处理方式 |
|----------|----------|
| 🔴 发现 Critical 违规 | **阻断编码**：必须修复后才能继续。修复方式：<br>1. 若 plan 中存在违规代码 → 修改 plan.md → 重新调用 /architecture-guard<br>2. 若已有代码存在违规 → 先修复已有代码 → 重新调用 /architecture-guard |
| 🟠 发现 Major 违规 | **警告**：建议修复，用户可申请豁免（需说明理由） |
| 🟡 发现 Minor 违规 | **提示**：记录但不阻断 |
| ✅ 审查通过 | 进入步骤 6，引导进入开发 |

**禁止**：在未经确认的情况下，为了「局部简单」而绕过架构决策。

---

### 6. 引导进入开发（阶段 2）

阶段 1（定义）全部完成后，汇报状态并进入阶段 2（实现）：

**单 issue 模式：**

```
阶段 1（定义）已完成 — 进入阶段 2（实现）

f-15 文件上传组件
- Issue 状态: open
- 行为契约: docs/issues/f-15-global-tab-bar/specs/behavior-spec.md
- 执行计划: docs/issues/f-15-global-tab-bar/plan.md (X 个任务)
- 测试代码: tests/unit/webui/TabBar.spec.ts (Y 条测试用例)
- TDD 状态: 🔴 测试已编写，运行失败（等待实现）
- 架构合规: ✅ plan 已通过 /architecture-guard 扫描

阶段 2 执行方式：
1. /subagent-driven-development — 子代理并行开发（推荐）
2. /executing-plans — 当前会话顺序执行
3. 先 review spec 再决定
```

**多 issue 并行模式：**

```
阶段 1（定义）已完成 — 2 个 issue 准备进入阶段 2（实现）

f-15 TabBar 全局化
- 状态: open
- 计划: 5 个任务
- 测试: TabBar.spec.ts (8 条用例)
- 架构合规: ✅
- 注意: 后端 b-02 未完成，将使用 Mock 数据

b-02 知识库 CRUD API
- 状态: open
- 计划: 4 个任务
- 测试: knowledgeBaseCrud.spec.ts (6 条用例)
- 架构合规: ✅

依赖关系: f-15 阻塞于 b-02（接口对接阶段）

阶段 2 建议执行顺序：
1. 先并行启动 b-02 + f-15（前端用 Mock）
2. b-02 完成后，f-15 移除 Mock 联调
3. 联调通过后进入阶段 3（验收）

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

**模型选择策略：**

| 任务复杂度 | 模型选择 | 信号 |
|-----------|---------|------|
| 机械实现（1-2 文件，完整 spec） | 快速/轻量模型 | 成本低，速度快 |
| 集成判断（多文件协调，模式匹配） | 标准模型 | 需要一定推理能力 |
| 架构/设计/审查 | 最强可用模型 | 需要深度理解和判断 |

**执行流程（简化）：**

1. 读取 plan，提取所有任务及完整文本
2. 对每个任务：派发实现子代理 → 自检 → 审查 → 标记完成
3. 所有任务完成后，派发最终审查
4. 使用 `superpowers:finishing-a-development-branch` 完成

**子代理状态处理：**

| 状态 | 含义 | 处理方式 |
|------|------|----------|
| **DONE** | 完成 | 进入 spec 对齐审查 |
| **DONE_WITH_CONCERNS** | 完成但有疑虑 | 先读疑虑，正确性/范围问题先解决 |
| **NEEDS_CONTEXT** | 需要更多信息 | 提供缺失上下文，重新派发 |
| **BLOCKED** | 无法完成 | 1. 上下文问题 → 提供更多上下文<br>2. 需要更多推理 → 更强模型<br>3. 任务太大 → 拆分<br>4. 计划本身错误 → 升级给人类 |

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

1. 加载并审查 plan
2. 对每个任务：标记 in_progress → 执行步骤 → 运行验证 → 标记 completed
3. 所有任务完成后，使用 `superpowers:finishing-a-development-branch`

**验证铁律**参见 [`_shared/references/verification-commands.md`](mdc:.claude/skills/_shared/references/verification-commands.md)。

---

### 方式二补充：编码中架构合规检查 + CHECKPOINT 输出

内联执行时，**每个任务完成后**必须：
1. 调用 `/architecture-guard` 进行快速检查，确保本次变更未引入架构违规
2. 输出 `[CHECKPOINT] 任务完成验证`（含 RED + GREEN 证据）

**检查时机：**
- 每个任务编码完成后、提交前
- 发现疑似违规时随时调用

**每个任务的标准输出**：

```markdown
[CHECKPOINT] 任务完成验证
- 测试文件：`tests/unit/server/xxx.spec.ts`
- RED 证据：（粘贴测试失败输出）
- 实现文件：`packages/server/src/xxx.ts`
- GREEN 证据：（粘贴测试通过输出）
- 对应 spec：AC-XX 描述
- 架构合规：`/architecture-guard` 扫描结果
```

**何时停止并求助：**
- 遇到阻塞（缺少依赖、测试失败、指令不清）
- Plan 有关键缺口导致无法开始
- 不理解某个指令
- 验证反复失败
- CHECKPOINT 无法提供 RED 证据（说明测试是后补的）

**不要强行通过阻塞** —— 停下来询问。

---

## 开发完成检查清单

所有任务完成后、关闭 issue 前，必须运行以下验证：

### 强制验证（未通过禁止关闭）

验证命令参见 [`_shared/references/verification-commands.md`](mdc:.claude/skills/_shared/references/verification-commands.md)。

1. **所有任务的 CHECKPOINT 已验证**（含 RED + GREEN 证据）
2. **按 track 运行对应测试全部通过**
3. **类型检查通过**：`pnpm type-check`
4. **架构合规后检通过**：调用 `/architecture-guard` 进行最终审查，确认无 Critical 违规
5. **全量回归无退化**：`npx vitest run && pnpm test:integration && pnpm test:e2e`

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
| Spec 不存在                         | 调用 `/spec-validator` 补全，完成后回到步骤 1 重新检查阶段 1 完成度 |
| Plan 存在但不完整                   | 提示需补充，询问是否重写                 |
| Plan 不符合 TDD                     | 提示必须重写，每个任务以测试开始         |
| 测试代码不存在                      | 根据 spec 生成测试骨架，确认失败后再开发 |
| 测试覆盖不完整                      | 列出未覆盖项，询问是否补充               |
| Issue 有未完成的阻塞依赖            | 警告用户先完成依赖                       |
| 用户仅"查看进度"                    | 仅展示当前状态                           |
| Issue 状态为 `closed`               | 告知已完成，询问是否重新打开             |
| 多 issue 中有前后端配对但后端未完成 | 前端 plan 中补充 Mock 方案               |
| /architecture-guard 审查失败（含预审、编码中、后检） | **阻断/暂停**：修复违规后重新调用 /architecture-guard 审查通过方可继续 |
| 阶段 1 未完成就要求编码 | **阻断**：必须先完成 issue + spec + plan + 架构合规 |
| Agent 输出 CHECKPOINT 但无 RED 证据 | **回退**：视为后补测试，需回到 RED 阶段重新执行 |
| 模式 B 下缺少二次断言失败 RED | **回退**：视为未完成空壳步骤，需重新执行编译失败 → 空壳 → 二次 RED 流程 |

---

## 依赖 Skills

- `spec-validator` — 验证/生成行为契约
- `plan-generator` — 生成执行计划（TDD 强制）
- `subagent-driven-development` — 子代理并行开发（推荐）
- `executing-plans` — 顺序执行计划
- `kb-review` — 代码审查与质量检查
- `finishing-a-development-branch` — 完成开发分支
- `issue-lifecycle` — issue 状态管理与关闭流程
