---
name: dev-orchestrator
description: >
  当用户说"开始做 issue f-05"、"开发 issue b-07"、"issue 怎么实现"、
  "怎么开发这批功能"时触发。
  自动协调完整开发准备流程：解析 issue → 读取 spec → 检查计划 → 检查测试用例 → 引导进入开发。
  支持单 issue 开发和多 issue 并行开发两种模式。
  核心目的：避免在无规格、无计划、无测试的情况下直接写代码。
---

# 开发编排器

协调 issue 分析、spec 读取、计划检查、测试用例检查和开发执行的完整工作流。

**核心理念**：开发前必须先有 spec，有 spec 后必须先有计划，有计划后必须先有测试。不要在没有行为契约和验收标准的情况下直接写代码。

---

## 路径约定

| 文档类型 | 路径 | 验证规则 |
|----------|------|----------|
| Issue | `docs/02-issues/{prefix}-{NN}-{slug}.md` | 文件名必须符合格式 |
| Spec | `docs/03-specs/{issue-id}/` | 目录名必须与 issue 编号一致 |
| Plan | `docs/04-plans/{issue-id}/v{N}.md` | 目录名 = issue-id，文件名 = v{N}.md |
| 测试用例 | `docs/08-test-cases/{issue-id}/` | 目录名必须与 issue 编号一致 |
| 审查记录 | `docs/07-reviews/{scope}/{type}-v{N}.md` | scope 语义化，type 限定枚举 |

**双轨前缀：**
- `f-XX`: 前端功能
- `b-XX`: 后端接口
- `d-XX`: 设计
- `i-XX`: 基础设施
- `q-XX`: 质量

---

## 两种工作模式

### 模式 A：单 Issue 开发

用户说"开始做 f-05"，只处理一个 issue。

### 模式 B：多 Issue 并行开发

用户说"开发这批功能"、"并行实现 f-05 和 b-05"，需要协调多个 issue。

**协调逻辑**：
1. 读取所有指定 issue
2. 检查依赖关系（`Blocked by`）
3. 若存在前后端配对（如 f-05 + b-05）：
   - 检查后端 issue 是否已完成
   - 若未完成，前端 plan 中需包含 Mock 方案
   - 标记 `TODO: 联调` 在双方 plan 中
4. 分别检查每个 issue 的 spec、plan、测试用例
5. 全部就绪后，引导并行执行

---

## 工作流程

### 1. 解析 Issue 编号

支持格式：`f-05`、`b-07`、`issue f-05`、`f-05-file-upload`

可一次传入多个：`f-05 b-07`、`开发 f-05 和 b-05`

统一提取前缀 + 数字部分。

### 2. 读取 Issue 文件

在 `docs/02-issues/` 查找匹配文件。

- 唯一匹配：直接读取
- 多个匹配：列出请用户确认
- 未找到：报错并列出所有 issue

提取：状态、构建内容、验收标准、阻塞于、规格引用。

### 3. 读取对应 Spec

根据 issue 编号查找：

```
docs/03-specs/{issue-id}/
├── feature-spec.md       # 必须存在
├── behavior-spec.md      # 前端 issue 必须存在
└── api-spec.md           # 后端 issue 必须存在
```

**路径验证：**
- 目录名必须与 issue 编号一致（如 `f-06`）
- **禁止**用 feature-slug 作为目录名

**若 spec 不存在：**
1. 告知用户未找到行为契约
2. 调用 `spec-validator` skill 创建 spec
3. Spec 完成后进入步骤 4

**若 spec 存在：**
1. 确认是否包含交互状态表格（前端）或 API 契约（后端）
2. 若不完整，提示需补充
3. 进入步骤 4

### 4. 检查执行计划

在 `docs/04-plans/{issue-id}/` 查找计划文件。

**路径验证：**
- 目录名必须与 issue 编号一致
- 文件名必须为 `v{N}.md`（如 `v1.md`）
- 禁止用时间戳命名

**若不存在：**
1. 告知用户未找到执行计划
2. 调用 `plan-generator` skill 创建计划
3. 计划完成后进入步骤 5

**若已存在：**
1. 读取最新版本（最大 N 的 `v{N}.md`）
2. 确认是否完整（任务分解、文件结构、验证步骤）
3. 展示计划概要，进入步骤 5

**多 issue 并行时的特殊处理**：
- 若存在前后端配对且后端未完成，检查前端 plan 是否包含 Mock 方案
- 若缺少 Mock 方案，提示补充

### 5. 检查测试用例

在 `docs/08-test-cases/{issue-id}/` 查找测试用例。

**路径验证：**
- 目录名必须与 issue 编号一致
- 文件名使用 kind：`behavior.md`、`api.md`、`e2e.md`、`unit.md`

**若不存在：**
1. 告知用户未找到测试用例
2. 读取 issue 的验收标准和 spec 的边界条件
3. 转化为测试用例表格
4. 创建文件 `docs/08-test-cases/{issue-id}/behavior.md`
5. 进入步骤 6

**若已存在：**
1. 读取测试用例，统计 TC-ID 数量
2. 检查是否覆盖所有验收标准和边界条件
3. 若有遗漏，提示并询问是否补充
4. 进入步骤 6

### 6. 引导进入开发

spec、plan 和测试用例都就绪后，汇报状态：

**单 issue 模式：**

```
f-05 文件上传组件 — 开发准备就绪

- Issue 状态: ready-for-agent
- 行为契约: docs/03-specs/f-05/behavior-spec.md
- 执行计划: docs/04-plans/f-05/v1.md (X 个任务)
- 测试用例: docs/08-test-cases/f-05/behavior.md (Y 条 TC-ID)

请选择开发执行方式：
1. /subagent-driven-development — 子代理并行开发（推荐）
2. /executing-plans — 当前会话顺序执行
3. 先 review spec 再决定
```

**多 issue 并行模式：**

```
批次开发准备就绪 — 2 个 issue

f-05 文件上传组件
- 状态: ready-for-agent
- 计划: 5 个任务
- 注意: 后端 b-07 未完成，将使用 Mock 数据

b-07 文档上传 API
- 状态: ready-for-agent
- 计划: 4 个任务

依赖关系: f-05 阻塞于 b-07（接口对接阶段）

建议执行顺序：
1. 先并行启动 b-07 + f-05（前端用 Mock）
2. b-07 完成后，f-05 移除 Mock 联调
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
| 测试用例覆盖不完整 | 列出未覆盖项，询问是否补充 |
| Issue 有未完成的阻塞依赖 | 警告用户先完成依赖 |
| 用户仅"查看进度" | 仅展示当前状态 |
| Issue 状态为 `closed` | 告知已完成，询问是否重新打开 |
| 多 issue 中有前后端配对但后端未完成 | 前端 plan 中补充 Mock 方案 |

---

## 依赖 Skills

- `spec-validator` — 验证/生成行为契约
- `plan-generator` — 生成执行计划
- `subagent-driven-development` — 子代理并行开发
- `executing-plans` — 顺序执行计划
