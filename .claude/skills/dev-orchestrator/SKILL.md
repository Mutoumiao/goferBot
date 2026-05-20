---
name: dev-orchestrator
description: >
  当用户说"开始做 issue f-15"、"开发 issue b-02"、"issue 怎么实现"、
  "怎么开发这批功能"时触发。
  自动协调完整开发准备流程：解析 issue → 读取 spec → 检查计划 → 检查测试 → 引导进入开发。
  支持单 issue 开发和多 issue 并行开发两种模式。
  核心目的：避免在无规格、无计划、无测试的情况下直接写代码。
---

# 开发编排器

协调 issue 分析、spec 读取、计划检查、测试检查和开发执行的完整工作流。

**核心理念**：开发前必须先有 spec，有 spec 后必须先有计划，有计划后必须先有测试代码。不要在没有行为契约和验收标准的情况下直接写代码。

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

| 文档类型 | 路径 | 验证规则 |
|----------|------|----------|
| Issue | `docs/issues/{dir}/issue.md` | frontmatter 必须包含 id/status/track/priority |
| Spec | `docs/issues/{dir}/specs/` | 目录在 issue 目录下 |
| Plan | `docs/issues/{dir}/plan.md` | 当前生效版本 |
| 历史 Plan | `docs/issues/{dir}/plans/v{N}.md` | 版本归档 |
| 测试代码 | `tests/issues/{dir}/*.spec.ts` | 必须存在，且包含 AC-XX 用例 |
| 审查记录 | `docs/07-reviews/{scope}/{type}-v{N}.md` | scope 语义化，type 限定枚举 |

**轨道前缀：**
- `f-XX`: 前端功能
- `b-XX`: 后端接口
- `d-XX`: 设计
- `i-XX`: 基础设施
- `q-XX`: 质量

---

## 两种工作模式

### 模式 A：单 Issue 开发

用户说"开始做 f-15"，只处理一个 issue。

### 模式 B：多 Issue 并行开发

用户说"开发这批功能"、"并行实现 f-15 和 b-02"，需要协调多个 issue。

**协调逻辑**：
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

**多 issue 并行时的特殊处理**：
- 若存在前后端配对且后端未完成，检查前端 plan 是否包含 Mock 方案
- 若缺少 Mock 方案，提示补充

### 5. 检查测试代码（TDD 关卡）

**这是核心关卡。检查 `tests/issues/{dir}/` 下的 `.spec.ts` 文件。**

根据 plan 中声明的测试文件路径，检查：

```
tests/issues/{dir}/*.spec.ts
```

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
4. 进入步骤 6

### 6. 引导进入开发

spec、plan 和测试代码都就绪后，汇报状态：

**单 issue 模式：**

```
f-15 文件上传组件 — 开发准备就绪

- Issue 状态: open
- 行为契约: docs/issues/f-15-global-tab-bar/specs/behavior-spec.md
- 执行计划: docs/issues/f-15-global-tab-bar/plan.md (X 个任务)
- 测试代码: tests/issues/f-15-global-tab-bar/TabBar.spec.ts (Y 条测试用例)
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

## 边界情况

| 场景 | 处理方式 |
|------|----------|
| Issue 文件不存在 | 报错，列出所有 issue 供核对 |
| 多个 issue 匹配 | 请用户确认 |
| Spec 不存在 | 调用 `spec-validator` 生成 |
| Plan 存在但不完整 | 提示需补充，询问是否重写 |
| Plan 不符合 TDD | 提示必须重写，每个任务以测试开始 |
| 测试代码不存在 | 根据 spec 生成测试骨架，确认失败后再开发 |
| 测试覆盖不完整 | 列出未覆盖项，询问是否补充 |
| Issue 有未完成的阻塞依赖 | 警告用户先完成依赖 |
| 用户仅"查看进度" | 仅展示当前状态 |
| Issue 状态为 `closed` | 告知已完成，询问是否重新打开 |
| 多 issue 中有前后端配对但后端未完成 | 前端 plan 中补充 Mock 方案 |

---

## 依赖 Skills

- `spec-validator` — 验证/生成行为契约
- `plan-generator` — 生成执行计划（TDD 强制）
- `subagent-driven-development` — 子代理并行开发
- `executing-plans` — 顺序执行计划
