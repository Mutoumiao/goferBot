---
name: skills-development-process
description: >
  当用户提到"开始做 issue #XX"、"开发 issue #XX"、"执行 issue #XX"、
  "issue #XX 还没完成"或"issue #XX 怎么实现"时触发。自动协调完整的
  开发准备流程：解析 issue 编号 → 读取 issue 内容 → 检查是否有执行计划
  → 检查是否有测试用例 → 最终引导用户进入开发执行阶段。
  也适用于"给我看看 #07 的进度"、"#08 缺什么"、"#05 有测试用例吗"
  等查询类请求。核心目的是避免开发者在无计划、无测试的情况下直接写代码。
---

# Skills 开发流程

协调 issue 分析、计划编写、测试用例创建和开发执行的完整工作流。

## 核心理念

开发前必须先有计划，有计划后必须先有测试。不要在没有执行方案和验收标准的情况下直接写代码。

## 工作流程

### 1. 解析 Issue 编号

从用户输入中提取 issue 编号。支持格式：
- `#07`
- `issue 7`
- `#07-ollama-error-handling`
- `07`

统一提取数字部分（如 `07`），忽略前导零。

### 2. 定位并读取 Issue 文件

在 `.scratch/knowledge-base/issues/` 目录下查找文件名以提取的编号开头的 `.md` 文件。

- 若找到唯一匹配：直接读取
- 若找到多个匹配：列出文件列表，请用户确认
- 若未找到：报错并列出所有 issue 文件供核对

**读取内容后提取：**
- `Status` 字段（第一行）
- `What to build` 或 `Summary`（了解目标）
- `Acceptance criteria`（验收标准）
- `Blocked by`（依赖关系）

### 3. 状态检查与分流

**若 `Status` 为 `closed`：**
告知用户该 issue 已完成，询问是否查看内容或重新打开。

**若 `Status` 为 `ready-for-agent` / `in-progress` / 其他非 closed 状态：**
进入开发准备流程（步骤 4）。

### 4. 检查执行计划

在 `docs/superpowers/plans/` 目录下查找与该 issue 相关的计划文件。匹配策略：
- 文件名包含 issue 编号（如 `07-ollama`）
- 文件名包含 issue 描述中的关键词（如 `error-handling`）

**若不存在计划文件：**
1. 告知用户："未找到该 issue 的执行计划"
2. 说明正在调用 `writing-plans` skill 为其创建计划
3. 执行 `Skill({ skill: "writing-plans", ... })`
4. 计划完成后告知用户计划文件路径，并进入步骤 5

**若已存在计划文件：**
1. 读取计划文件，确认计划是否完整（是否有任务分解、文件结构、验证步骤）
2. 告知用户已找到计划，展示计划概要（任务数量、预计范围）
3. 直接进入步骤 5

### 5. 检查测试用例

在 `docs/test-cases/` 目录下查找与该 issue 相关的测试用例文件。文件名匹配：`NN-*-test-cases.md`。

**若不存在测试用例文件：**
1. 告知用户："未找到该 issue 的测试用例"
2. 说明正在参考 `tdd` skill 为其创建测试用例
3. 读取 issue 的 `Acceptance criteria`，将其转化为测试用例表格
4. 创建文件 `docs/test-cases/NN-description-test-cases.md`，格式参考已有测试用例：
   - 按功能模块分组
   - 每行包含 TC-ID、测试项、前置条件、测试步骤、预期结果
   - 底部标注建议的自动化测试文件路径
5. 创建完成后告知用户文件路径，并进入步骤 6

**若已存在测试用例文件：**
1. 读取测试用例，统计 TC-ID 数量
2. 检查测试用例是否覆盖了 issue 的所有验收标准
3. 若有遗漏，提示用户并询问是否补充
4. 进入步骤 6

### 6. 引导进入开发执行

在计划和测试用例都就绪后，向用户汇报当前状态：

```
#07 Ollama 与错误处理 — 开发准备就绪

- Issue 状态: ready-for-agent
- 执行计划: docs/superpowers/plans/2026-05-08-ollama-error-handling.md (X 个任务)
- 测试用例: docs/test-cases/07-ollama-error-handling-test-cases.md (Y 条 TC-ID)

请选择开发执行方式：
1. /subagent-driven-development — 使用子代理并行开发（推荐，质量更高）
2. /executing-plans — 在当前会话中顺序执行
3. 先 review 计划再决定
```

根据用户选择，执行对应的 skill。

## 边界情况处理

| 场景 | 处理方式 |
|------|----------|
| Issue 文件不存在 | 报错，列出所有可用 issue |
| 多个 issue 文件匹配 | 请用户确认 |
| 计划文件存在但内容不完整 | 提示用户计划需要补充，询问是否重写 |
| 测试用例存在但覆盖不完整 | 列出未覆盖的验收标准，询问是否补充 |
| Issue 有 `Blocked by` 依赖且依赖未完成 | 警告用户先完成依赖 issue |
| 用户只说"查看进度"不执行 | 仅展示 issue + 计划 + 测试用例的当前状态 |

## 文件路径约定

- Issue 目录：`<project-root>/.scratch/knowledge-base/issues/`
- 计划目录：`<project-root>/docs/superpowers/plans/`
- 测试用例目录：`<project-root>/docs/test-cases/`

项目根目录通过当前工作目录确定。

## 依赖的 Skills

本 skill 在流程中会按需调用以下 skills，不需要用户手动触发：
- `writing-plans` — 编写执行计划
- `tdd` — 指导测试用例设计
- `subagent-driven-development` — 子代理并行开发
- `executing-plans` — 顺序执行计划
