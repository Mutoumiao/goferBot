---
name: issue-lifecycle
description: >
  当用户说"更新 issue 状态"、"标记 issue 为完成"、"issue f-05 已完成"时触发。
  自动查找并更新 issue 文件、checklist.json 与 BACKLOG.md/CHANGELOG.md。
  支持双轨前缀（f-/b-/d-/i-/q-）。
---

# Issue 生命周期管理

## 执行摘要

| 项目 | 内容 |
|------|------|
| **触发词** | "更新 issue 状态"、"标记完成"、"issue f-05 已完成" |
| **硬关卡** | 关闭前必须通过全部测试 + 类型检查 + 全量回归 |
| **核心输出** | 更新后的 issue.md、checklist.json、进度文档 |
| **禁止行为** | 测试未通过就关闭、不验证就声明完成 |
| **下一步** | 验证通过后 → 更新 BACKLOG.md/CHANGELOG.md |

根据 issue 编号，自动更新对应的 issue Markdown 文件、`checklist.json` 和进度文档。

---

## 读取协议

**每步读取必须遵守分层读取，避免全文加载浪费 token：**

1. **先读索引** — 查 `BACKLOG.md` 或 `CHANGELOG.md` 快速索引表确认 issue 当前状态
2. **再读 frontmatter** — 读目标 issue 的 YAML 头部获取 `status`/`summary`/`blocked_by`/`checklist`/`plan`/`specs`
3. **按需深入正文** — 仅当需要更新验收标准或正文内容时才深入读全文
4. **更新同步** — 修改正文状态/验收标准时，必须同步更新 frontmatter 的 `status` 字段
5. **尽量避免全文扫读** — 定位 issue 文件和提取状态时，不得读全文，先读 frontmatter

---

## 路径约定

| 文档类型  | 路径                                        | 验证规则                    |
|-----------|---------------------------------------------|-----------------------------|
| Issue     | `docs/issues/{prefix}-{NN}-{slug}/issue.md` | 目录名必须符合格式          |
| Spec      | `docs/issues/{dir}/specs/`                  | 目录在 issue 目录下         |
| Plan      | `docs/issues/{dir}/plan.md`                 | 当前生效版本                |
| 测试代码  | `tests/{layer}/{name}.spec.ts`              | 参见 [`_shared/references/test-paths.md`](mdc:.claude/skills/_shared/references/test-paths.md) |
| checklist | `docs/issues/{dir}/checklist.json`          | 机器管理，AC-XX 条目        |
| 审查记录  | `docs/reviews/{scope}/{type}-v{N}.md`       | scope 语义化，type 限定枚举 |
| 进度文档  | `BACKLOG.md` / `CHANGELOG.md`（根目录）     |                             |

**轨道前缀**参见 [`_shared/references/track-prefixes.md`](mdc:.claude/skills/_shared/references/track-prefixes.md)。

---

## 工作流程

### 1. 解析 Issue 编号

支持：`f-05`、`b-07`、`issue f-05`、`f-05-file-upload`

统一提取前缀 + 数字部分。

---

### 2. 定位 Issue 文件

在 `docs/issues/` 查找匹配的目录。

- 唯一匹配：**先读 frontmatter**（`---` 之间），提取 `status`/`summary`/`blocked_by`/`checklist`/`plan`/`specs`
- 多个匹配：列出请用户确认
- 未找到：报错并停止

---

### 3. 读取并分析 Issue

**先读 frontmatter**（`---` 之间），提取：
- `status` — 当前状态
- `summary` — 功能描述
- `blocked_by` — 阻塞依赖
- `checklist` / `plan` / `specs` — 关联文档路径

**仅当需要更新正文内容时**，才深入读取完整文档。

---

### 4. 检查测试覆盖

更新验收标准前，先验证测试覆盖。

**定位测试代码：**

在 `tests/{layer}/` 查找 `.spec.ts` 文件。路径规则参见 [`_shared/references/test-paths.md`](mdc:.claude/skills/_shared/references/test-paths.md)。

**统计与验证：**

1. 读取 `docs/issues/{dir}/checklist.json`，统计所有 AC-XX 条目
2. 检查 `manual: true` 的条目（非自动化测试覆盖）
3. 运行对应层级的测试命令验证是否全部通过

**判定规则：**

| 场景                   | 处理方式                       |
|------------------------|--------------------------------|
| 测试文件不存在         | 警告缺少测试，询问是否继续     |
| 测试未全部通过         | 列出失败测试，阻止更新         |
| 测试通过但覆盖不完整   | 提示未覆盖的 AC-XX，由用户决定 |
| 测试全部通过且覆盖完整 | 允许继续更新                   |

**判定 issue 是否可标记完成：**

- 状态已是 `closed`：询问是否仍需同步
- 状态不是 `closed`：先执行测试检查，通过后询问是否完成

---

### 5. 关闭前强制验证

**验证命令**参见 [`_shared/references/verification-commands.md`](mdc:.claude/skills/_shared/references/verification-commands.md)。

声明 issue 完成前，必须运行以下验证并确认输出：

1. **按 track 运行对应测试**：
   - `f-*`, `b-*`, `d-*`：`npx vitest run tests/unit/` — 预期全部通过
   - `i-*`, `q-*`（集成）：`pnpm test:integration` — 预期全部通过
   - `q-*`（E2E）：`pnpm test:e2e` — 预期全部通过

2. **全量回归**：`npx vitest run && pnpm test:integration && pnpm test:e2e`
   - 确保其他 issue 的测试无退化

3. **类型检查**：`pnpm type-check`
   - 预期：0 错误

4. **测试覆盖确认**：
   - 所有 checklist.json 中的 AC-XX 都有对应测试
   - 测试用例名以 `AC-XX:` 开头

**验证失败 = 禁止关闭。** 必须先修复，再重新验证。

**关闭前路径验证：**
- [ ] 测试代码存在于 `tests/{layer}/`
- [ ] checklist.json 中所有 AC-XX 状态为 `passed`
- [ ] `tests/README.md` 中有对应映射条目

---

### 6. 更新 Issue 文件

**验收标准 `[ ]` → `[x]`**

issue 中通常有两处验收标准：
1. `## 验收标准` 正文区域
2. `## Agent 简报` 中的 `**验收标准：**`

两处都需同步更新。使用 `replace_all: false`，通过更大上下文片段确保唯一匹配。

**更新 checklist.json**

同步更新 `docs/issues/{dir}/checklist.json`：
- 将对应 AC-XX 条目的 `status` 改为 `passed`
- 更新 `updated_at` 为当前 ISO 日期

**更新 `Status`**

用户确认完成后，保守更新 frontmatter：仅替换 `status:` 行。

---

### 7. 更新进度文档（必须）

关闭 issue 时，**必须**同步更新 BACKLOG.md 和 CHANGELOG.md。

#### 两个文件的范围定义

| 文件 | 定位 | 写入内容 | 禁止写入 |
|------|------|----------|----------|
| **BACKLOG.md** | 待办清单 | 待办事项、进行中、技术债务等**未完成**内容 | 已 closed 的 issue、纯管理动作记录 |
| **CHANGELOG.md** | 产品变更日志（如同 GitHub Release Notes） | 已完成的**实际交付物**：功能实现、Bug 修复、性能优化、测试补齐、有实质内容变更的文档更新 | `open`/`in-progress` 状态条目、纯管理动作（issue 创建/补全、spec/plan 编写、进度统计、BACKLOG.md/CHANGELOG.md 自身同步记录） |

#### CHANGELOG.md 准入标准

只有满足以下条件的条目才能写入 CHANGELOG.md：
- ✅ 功能实现、Bug 修复、性能优化、测试补齐
- ✅ 有实际文件变更的文档更新（如新增参考手册、流程规范重构）
- ❌ issue 创建/补全文档（仅产出 issue.md/spec/plan，无实现代码）
- ❌ 进度统计、进度总览更新
- ❌ BACKLOG.md 或 CHANGELOG.md 自身的同步记录

#### 更新操作

1. **更新 BACKLOG.md**：将该 issue 从"待启动"或"进行中"表中移除；检查是否有被该 issue 阻塞的其他 issue，解除其 `blocked_by` 引用
2. **更新 CHANGELOG.md**：先通过准入标准校验 → 在对应日期段下新增 `[closed]` 条目，格式：`- [closed] {id} {summary} [issue](docs/issues/{dir}/)`
3. **避免意外删除**：仅修改状态相关文本，不删除章节标题或内容区块

> 系统性的全量进度重扫使用 `/issue-updater` skill。本 skill 在关闭 issue 时做增量同步。

---

### 8. 归档（可选）

用户要求归档已关闭 issue 时：

1. issue 目录：`docs/issues/{dir}/` → `docs/archived/v2-issues/{dir}/`
2. review 记录：`docs/reviews/{scope}/` → `docs/archived/v2-reviews/{scope}/`
3. 测试代码保留在 `tests/{layer}/`（历史参考）

---

### 9. 提交变更（可选）

展示 diff 摘要。用户要求提交时：
1. `git diff --stat` 确认变更范围
2. 简洁提交消息，如：
   ```
   docs: 更新 f-05 文件上传组件 issue 状态与 checklist
   ```
3. `git add` 和 `git commit`

---

## 边界情况

| 场景                    | 处理方式                              |
|-------------------------|---------------------------------------|
| Issue 文件不存在        | 报错，列出所有 issue 供核对           |
| 多个 issue 匹配同一编号 | 列出匹配项，请用户指定完整目录名      |
| BACKLOG.md 不存在       | 仅更新 issue 文件，提示未找到进度文档 |
| 验收标准已是 `[x]`      | 跳过，告知无需重复更新                |
| 用户未明确说"完成"      | 先检查状态，询问意图后再执行          |
| 测试代码路径不存在      | 提示未找到，询问是否跳过检查          |
