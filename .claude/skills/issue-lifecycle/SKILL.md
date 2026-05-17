---
name: issue-lifecycle
description: >
  当用户说"更新 issue 状态"、"标记 issue 为完成"、"issue f-05 已完成"时触发。
  自动查找并更新 issue 文件与 PROGRESS.md。
  支持双轨前缀（f-/b-/d-/i-/q-）。
---

# Issue 生命周期管理

根据 issue 编号，自动更新对应的 issue Markdown 文件和 `PROGRESS.md` 进度文档。

---

## 路径约定

| 文档类型 | 路径 | 验证规则 |
|----------|------|----------|
| Issue | `docs/02-issues/{prefix}-{NN}-{slug}.md` | 文件名必须符合格式 |
| 测试用例 | `docs/08-test-cases/{issue-id}/` | 目录名必须与 issue 编号一致 |
| 审查记录 | `docs/07-reviews/{scope}/{type}-v{N}.md` | scope 语义化，type 限定枚举 |
| 进度文档 | `PROGRESS.md`（根目录） |

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

在 `docs/02-issues/` 查找匹配的 `.md` 文件。

- 唯一匹配：直接选用
- 多个匹配：列出请用户确认
- 未找到：报错并停止

### 3. 读取并分析 Issue

提取：
- `Status` 字段（第一行）
- `Acceptance criteria` 验收标准列表
- `Spec reference` 规格引用路径
- `Blocked by` / `Comments` 等其他区域

### 4. 检查测试覆盖

更新验收标准前，先验证测试覆盖。

**定位测试用例：**

在 `docs/08-test-cases/{issue-id}/` 查找 `{kind}.md`。
- 例如 `f-05` → `docs/08-test-cases/f-05/behavior.md`

**路径验证：**
- 目录名必须与 issue 编号一致
- 文件名使用 kind：`behavior.md`、`api.md`、`e2e.md`、`unit.md`

**统计与验证：**

1. 统计所有 `TC-ID` 数量
2. 提取已有/待补充自动化测试文件路径
3. 提取覆盖范围标注（如 `TC-f05-001 ~ TC-f05-008`）

**验证自动化测试：**

1. 检查标注的自动化测试文件是否存在
2. 若存在，运行 `pnpm test` 验证是否全部通过
3. 对比测试用例数量与自动化测试数量

**判定规则：**

| 场景 | 处理方式 |
|------|----------|
| 测试用例文件不存在 | 跳过检查，提示未找到 |
| 自动化测试文件不存在 | 警告缺少自动化测试，询问是否继续 |
| 测试未全部通过 | 列出失败测试，阻止更新 |
| 测试通过但覆盖不完整 | 提示未覆盖的 TC-ID，由用户决定 |
| 测试全部通过且覆盖完整 | 允许继续更新 |

**判定 issue 是否可标记完成：**

- 状态已是 `closed`：询问是否仍需同步
- 状态不是 `closed`：先执行测试检查，通过后询问是否完成

**关闭前路径验证：**
- [ ] 审查记录已归档到 `docs/07-reviews/{scope}/{type}-v{N}.md`
- [ ] 测试用例已归档到 `docs/08-test-cases/{issue-id}/`
- [ ] 以上路径存在对应文件，否则提示用户补全

### 5. 更新 Issue 文件

**验收标准 `[ ]` → `[x]`**

issue 中通常有两处验收标准：
1. `## 验收标准` 正文区域
2. `## Agent 简报` 中的 `**验收标准：**`

两处都需同步更新。使用 `replace_all: false`，通过更大上下文片段确保唯一匹配。

**更新 `Status`**

用户确认完成后，将第一行 `Status` 更新为 `closed`（或用户指定状态）。

**更新 `Completed at`**

issue 标记为 closed 时，添加或更新：
```markdown
Completed at: 2026-05-20
```

### 6. 更新 PROGRESS.md

1. **更新头部日期**：将 `> **更新日期**：YYYY-MM-DD` 更新为当前日期
2. **确认状态一致性**：检查进度表格中该 issue 对应行的状态是否已标记为 `closed`。若未标记，询问是否同步更新
3. **避免意外删除**：仅修改日期和状态相关文本，不删除章节标题或内容区块

### 7. 归档（可选）

用户要求归档已关闭 issue 时：

1. issue 文件：`docs/02-issues/` → `docs/99-archived/v2-issues/`
2. plan 文件：`docs/04-plans/{issue-id}/` → `docs/99-archived/v2-plans/{issue-id}/`
3. review 记录：`docs/07-reviews/{scope}/` → `docs/99-archived/v2-reviews/{scope}/`
4. 测试用例保留在 `docs/08-test-cases/`（历史参考）

### 8. 提交变更（可选）

展示 diff 摘要。用户要求提交时：
1. `git diff --stat` 确认变更范围
2. 简洁提交消息，如：
   ```
   docs: 更新 f-05 文件上传组件 issue 状态与 PROGRESS.md 日期
   ```
3. `git add` 和 `git commit`

---

## 边界情况

| 场景 | 处理方式 |
|------|----------|
| Issue 文件不存在 | 报错，列出所有 issue 供核对 |
| 多个 issue 匹配同一编号 | 列出匹配项，请用户指定完整文件名 |
| PROGRESS.md 不存在 | 仅更新 issue 文件，提示未找到进度文档 |
| 验收标准已是 `[x]` | 跳过，告知无需重复更新 |
| 用户未明确说"完成" | 先检查状态，询问意图后再执行 |
| 测试用例路径不存在 | 提示未找到，询问是否跳过检查 |

---

## 文件路径约定

- Issue 目录：`docs/02-issues/`
- 测试用例目录：`docs/08-test-cases/{issue-id}/`
- 审查记录目录：`docs/07-reviews/{scope}/`
- 归档目录：`docs/99-archived/`
- 进度文档：`PROGRESS.md`

项目根目录通过当前工作目录确定。若不存在上述路径，向上遍历一级，最多两级。
