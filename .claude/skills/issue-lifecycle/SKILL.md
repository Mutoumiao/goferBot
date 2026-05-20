---
name: issue-lifecycle
description: >
  当用户说"更新 issue 状态"、"标记 issue 为完成"、"issue f-05 已完成"时触发。
  自动查找并更新 issue 文件、checklist.json 与 BACKLOG.md/CHANGELOG.md。
  支持双轨前缀（f-/b-/d-/i-/q-）。
---

# Issue 生命周期管理

根据 issue 编号，自动更新对应的 issue Markdown 文件、`checklist.json` 和进度文档。

---

## 读取协议

**每步读取必须遵守分层读取，避免全文加载：**

1. **先读索引** — 查 `BACKLOG.md` 或 `CHANGELOG.md` 快速索引表确认 issue 当前状态
2. **再读 frontmatter** — 读目标 issue 的 YAML 头部获取 `status`/`summary`/`blocked_by`/`checklist`/`plan`/`specs`
3. **按需深入正文** — 仅当需要更新验收标准或正文内容时才深入读全文
4. **更新同步** — 修改正文状态/验收标准时，必须同步更新 frontmatter 的 `status` 字段
5. **尽量避免全文扫读** — 定位 issue 文件和提取状态时，不得读全文，先读 frontmatter

---

## 路径约定

| 文档类型 | 路径 | 验证规则 |
|----------|------|----------|
| Issue | `docs/issues/{prefix}-{NN}-{slug}/issue.md` | 目录名必须符合格式 |
| Spec | `docs/issues/{dir}/specs/` | 目录在 issue 目录下 |
| Plan | `docs/issues/{dir}/plan.md` | 当前生效版本 |
| 测试代码 | `tests/issues/{dir}/*.spec.ts` | 必须存在，且包含 AC-XX 用例 |
| checklist | `docs/issues/{dir}/checklist.json` | 机器管理，AC-XX 条目 |
| 审查记录 | `docs/07-reviews/{scope}/{type}-v{N}.md` | scope 语义化，type 限定枚举 |
| 进度文档 | `BACKLOG.md` / `CHANGELOG.md`（根目录） |

**双轨前缀：**
- `f-XX`: 前端功能
- `b-XX`: 后端接口
- `d-XX`: 设计
- `i-XX`: 基础设施
- `q-XX`: 质量

---

## 工作流程

### 1. 解析 Issue 编号

支持：`f-05`、`b-07`、`issue f-05`、`f-05-file-upload`

统一提取前缀 + 数字部分。

### 2. 定位 Issue 文件

在 `docs/issues/` 查找匹配的目录。

- 唯一匹配：**先读 frontmatter**（`---` 之间），提取 `status`/`summary`/`blocked_by`/`checklist`/`plan`/`specs`
- 多个匹配：列出请用户确认
- 未找到：报错并停止

### 3. 读取并分析 Issue

**先读 frontmatter**（`---` 之间），提取：
- `status` — 当前状态
- `summary` — 功能描述
- `blocked_by` — 阻塞依赖
- `checklist` / `plan` / `specs` — 关联文档路径

**仅当需要更新正文内容时**，才深入读取完整文档。

### 4. 检查测试覆盖

更新验收标准前，先验证测试覆盖。

**定位测试代码：**

在 `tests/issues/{dir}/` 查找 `.spec.ts` 文件。
- 例如 `f-05` → `tests/issues/f-05-file-upload/*.spec.ts`

**路径验证：**
- 测试文件放在 issue 目录下
- 测试用例名以 `AC-XX:` 开头，与 checklist.json 的 `id` 对应

**统计与验证：**

1. 读取 `docs/issues/{dir}/checklist.json`，统计所有 AC-XX 条目
2. 检查 `manual: true` 的条目（非自动化测试覆盖）
3. 运行 `npx vitest run tests/issues/{dir}/` 验证是否全部通过

**判定规则：**

| 场景 | 处理方式 |
|------|----------|
| 测试文件不存在 | 警告缺少测试，询问是否继续 |
| 测试未全部通过 | 列出失败测试，阻止更新 |
| 测试通过但覆盖不完整 | 提示未覆盖的 AC-XX，由用户决定 |
| 测试全部通过且覆盖完整 | 允许继续更新 |

**判定 issue 是否可标记完成：**

- 状态已是 `closed`：询问是否仍需同步
- 状态不是 `closed`：先执行测试检查，通过后询问是否完成

**关闭前路径验证：**
- [ ] 审查记录已归档到 `docs/07-reviews/{scope}/{type}-v{N}.md`
- [ ] 测试代码存在于 `tests/issues/{dir}/`
- [ ] checklist.json 中所有 AC-XX 状态为 `passed`
- [ ] 以上路径存在对应文件，否则提示用户补全

### 5. 更新 Issue 文件

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

### 6. 更新进度文档

1. **更新 BACKLOG.md**：检查该 issue 对应行的状态是否已标记为 `closed`。若未标记，询问是否同步更新
2. **更新 CHANGELOG.md**（如需要）：新增变更记录
3. **避免意外删除**：仅修改状态相关文本，不删除章节标题或内容区块

### 7. 归档（可选）

用户要求归档已关闭 issue 时：

1. issue 目录：`docs/issues/{dir}/` → `docs/99-archived/v2-issues/{dir}/`
2. review 记录：`docs/07-reviews/{scope}/` → `docs/99-archived/v2-reviews/{scope}/`
3. 测试代码保留在 `tests/issues/{dir}/`（历史参考）

### 8. 提交变更（可选）

展示 diff 摘要。用户要求提交时：
1. `git diff --stat` 确认变更范围
2. 简洁提交消息，如：
   ```
   docs: 更新 f-05 文件上传组件 issue 状态与 checklist
   ```
3. `git add` 和 `git commit`

---

## 边界情况

| 场景 | 处理方式 |
|------|----------|
| Issue 文件不存在 | 报错，列出所有 issue 供核对 |
| 多个 issue 匹配同一编号 | 列出匹配项，请用户指定完整目录名 |
| BACKLOG.md 不存在 | 仅更新 issue 文件，提示未找到进度文档 |
| 验收标准已是 `[x]` | 跳过，告知无需重复更新 |
| 用户未明确说"完成" | 先检查状态，询问意图后再执行 |
| 测试代码路径不存在 | 提示未找到，询问是否跳过检查 |

---

## 文件路径约定

- Issue 目录：`docs/issues/{prefix}-{NN}-{slug}/`
- Spec 目录：`docs/issues/{dir}/specs/`
- Plan 文件：`docs/issues/{dir}/plan.md`
- checklist：`docs/issues/{dir}/checklist.json`
- 测试代码：`tests/issues/{dir}/`
- 审查记录目录：`docs/07-reviews/{scope}/`
- 归档目录：`docs/99-archived/`
- 进度文档：`BACKLOG.md` / `CHANGELOG.md`

项目根目录通过当前工作目录确定。若不存在上述路径，向上遍历一级，最多两级。
