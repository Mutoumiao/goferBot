---
name: issue-progress-sync
description: >
  当用户提到"更新 issue 状态"、"标记 issue 为完成"、"同步 issue 进度"、
  "issue #XX 已完成"或类似意图时，自动查找并更新对应的 issue 文件与
  PROGRESS.md。适用于项目使用 `.scratch/knowledge-base/issues/` 目录管理
  issue 且根目录存在 `PROGRESS.md` 的仓库。触发关键词包括：issue 状态、
  验收标准、PROGRESS.md、完成 issue、关闭 issue、更新进度。
---

# Issue 进度同步

根据 issue 编号，自动更新对应的 issue Markdown 文件和 `PROGRESS.md` 进度文档。

## 工作流程

### 1. 解析 Issue 编号

从用户输入中提取 issue 编号。支持格式：
- `#06`
- `issue 6`
- `#06-chat-history`
- `06`

统一提取数字部分（如 `06`），忽略前导零（即 `6` 也匹配 `06`）。

### 2. 定位 Issue 文件

在 `.scratch/knowledge-base/issues/` 目录下查找文件名以提取的编号开头的 `.md` 文件。

- 若找到唯一匹配：直接选用
- 若找到多个匹配（如 `03-` 和 `03b-`）：列出文件列表，请用户确认
- 若未找到：报错并停止

**示例匹配：**
- 输入 `#06` → 匹配 `06-chat-history.md`
- 输入 `#03` → 可能匹配 `03-knowledge-base-management.md` 和 `03b-kb-context-menus-and-file-operations.md`，需用户确认

### 3. 读取并分析 Issue 文件

读取匹配的 issue Markdown 文件，提取以下信息：
- `Status` 字段（第一行，格式 `Status: <state>`）
- `Acceptance criteria` 区域的验收标准列表
- `Blocked by` / `Comments` 等其他区域

### 3b. 检查测试用例（质量控制）

在允许更新验收标准之前，先验证该 issue 的测试覆盖情况。

**定位测试用例文件：**

在 `docs/test-cases/` 目录下查找文件名以提取的编号开头的 `*-test-cases.md` 文件。
- 例如 `#06` → 匹配 `06-chat-history-test-cases.md`

**读取测试用例并统计：**

1. 读取测试用例文档，统计所有 `TC-ID` 数量
2. 提取每个测试分组底部标注的**已有/待补充自动化测试**文件路径
3. 提取**覆盖范围**标注（如 `TC-06-001 ~ TC-06-008`）

**验证自动化测试：**

1. 检查标注的自动化测试文件是否存在于项目中（如 `tests/unit/server/sessions.test.ts`）
2. 若文件存在，运行 `pnpm test`（或项目指定的测试命令）验证测试是否全部通过
3. 对比测试用例数量与自动化测试数量，判断是否完全覆盖

**判定规则：**

| 场景 | 处理方式 |
|------|----------|
| 测试用例文件不存在 | 跳过检查，提示用户未找到测试用例文档 |
| 自动化测试文件不存在 | 警告用户缺少自动化测试，询问是否继续 |
| 测试未全部通过 | 列出失败测试，阻止更新，告知用户先修复 |
| 测试通过但覆盖不完整 | 提示未覆盖的 TC-ID，由用户决定是否继续 |
| 测试全部通过且覆盖完整 | 允许继续更新 issue 状态 |

**判定 issue 是否可标记为完成：**

- 若 `Status` 已经是 `closed`：询问用户是否仍需同步（如更新验收标准勾选状态）
- 若 `Status` 不是 `closed`：先执行上述测试用例检查，通过后询问用户是否已完成

### 4. 更新 Issue 文件

**将验收标准从 `[ ]` 改为 `[x]`**

issue 文件中通常有两处验收标准列表：
1. `## Acceptance criteria` 正文区域
2. `## Agent Brief` 区域的 `**Acceptance criteria:**`

两处都需要同步更新。使用 `replace_all: false`，通过更大的上下文片段（包含前后标题）确保唯一匹配。

**更新 `Status` 字段**

若用户确认 issue 已完成，将第一行的 `Status` 更新为 `closed`（或其他用户指定的状态）。

### 5. 更新 PROGRESS.md

读取项目根目录的 `PROGRESS.md`，执行以下同步：

1. **更新头部日期**：将 `> **更新日期**：YYYY-MM-DD` 更新为当前日期
2. **确认状态一致性**：检查进度表格中该 issue 对应行的 `状态` 列是否已标记为 `closed`。若未标记，询问用户是否需要同步更新
3. **避免意外删除**：仅修改日期和状态相关的文本，不删除章节标题或内容区块。若发现 diff 中出现了非预期的删除（如章节标题消失），立即回滚并重新编辑

### 6. 提交变更（可选）

变更完成后，展示 diff 摘要给用户。若用户要求提交：
1. 执行 `git diff --stat` 确认变更范围
2. 使用简洁的提交消息，如：
   ```
   docs: 更新 #06 对话历史 issue 状态与 PROGRESS.md 日期
   ```
3. 执行 `git add` 和 `git commit`

## 边界情况处理

| 场景 | 处理方式 |
|------|----------|
| Issue 文件不存在 | 报错，列出 `.scratch/knowledge-base/issues/` 目录下的所有文件供用户核对 |
| 多个 issue 文件匹配同一编号 | 列出匹配项，请用户指定完整文件名 |
| PROGRESS.md 不存在 | 仅更新 issue 文件，提示用户未找到进度文档 |
| 验收标准已经是 `[x]` | 跳过该文件，告知用户无需重复更新 |
| 用户未明确说"完成" | 先检查当前状态，询问用户意图后再执行修改 |

## 文件路径约定

- Issue 目录：`<project-root>/.scratch/knowledge-base/issues/`
- 进度文档：`<project-root>/PROGRESS.md`

项目根目录通过当前工作目录确定。若工作目录下不存在上述路径，向上遍历一级目录查找，最多查找两级。
