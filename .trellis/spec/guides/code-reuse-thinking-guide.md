# 代码复用思考指南

> **目的**：在创建新代码前先停下来思考 —— 它是否已经存在？

---

## 问题所在

**重复代码是不一致性 Bug 的头号来源。**

当你复制粘贴或重写现有逻辑时：
- Bug 修复无法传播
- 行为随时间产生偏差
- 代码库变得难以理解

---

## 编写新代码之前

### 步骤 1：先搜索

```bash
# 搜索相似的函数名
grep -r "functionName" .

# 搜索相似的逻辑
grep -r "keyword" .
```

### 步骤 2：问自己这些问题

| 问题 | 如果是... |
|------|-----------|
| 是否存在类似的函数？ | 使用或扩展它 |
| 这个模式在其他地方使用过吗？ | 遵循现有的模式 |
| 这可以成为一个共享工具吗？ | 在正确的位置创建它 |
| 我正在从另一个文件复制代码吗？ | **停止** —— 提取到共享模块 |

---

## 常见的重复模式

### 模式 1：复制粘贴函数

**坏**：将验证函数复制到另一个文件

**好**：提取到共享工具，在需要的地方导入

### 模式 2：相似组件

**坏**：创建一个与现有组件 80% 相似的新组件

**好**：用 props/variants 扩展现有组件

### 模式 3：重复常量

**坏**：在多个文件中定义相同的常量

**好**：单一来源，到处导入

### 模式 4：重复的 Payload 字段提取

**坏**：多个消费者在本地强制转换相同的 JSON/event 字段：

```typescript
const description = (ev as { description?: string }).description;
const context = (ev as { context?: ContextEntry[] }).context;
```

即使代码只有两行，这也是重复的契约逻辑。每个消费者现在都有自己对有效 payload 的定义。

**好**：将解码器、类型守卫或投影放在数据所有者旁边：

```typescript
if (isThreadEvent(ev)) {
  renderThreadEvent(ev);
}
```

**规则**：如果同一个未类型化的 payload 字段在 2 个或更多地方被读取，在添加第三个读取者之前创建一个共享的类型守卫 / 归一化器 / 投影。

---

## 何时抽象

**进行抽象时**：
- 相同代码出现 3 次以上
- 逻辑足够复杂，可能存在 Bug
- 多人可能需要这个功能

**不进行抽象时**：
- 只使用一次
- 简单的单行代码
- 抽象比重复更复杂

---

## 批量修改之后

当你对多个文件进行了类似的更改时：

1. **审查**：你是否覆盖了所有实例？
2. **搜索**：运行 grep 查找遗漏的地方
3. **考虑**：这应该被抽象吗？

### Reducer 应使用穷举结构

当状态派生自类似 action 的值（`action`、`kind`、`status`、`phase`）时，优先使用带有一个 `switch` 的 reducer，而不是分散的 `if/else` 更新。

```typescript
// BAD - action 特定的状态转换难以审计
if (action === "opened") { ... }
else if (action === "comment") { ... }
else if (action === "status") { ... }

// GOOD - 一个 reducer 拥有转换表
switch (event.action) {
  case "opened":
    ...
    return;
  case "comment":
    ...
    return;
}
```

当事件日志是事实来源时，这一点很重要。Reducer 是有文档记录的重放模型；显示代码和命令不应该重复该重放模型的各个部分。

---

## 提交前检查清单

- [ ] 搜索过现有的相似代码
- [ ] 没有应该共享的复制粘贴逻辑
- [ ] 没有在共享解码器之外重复提取未类型化的 payload 字段
- [ ] 常量在一处定义
- [ ] 相似模式遵循相同结构
- [ ] Reducer/action 转换存在于一个 reducer 或命令分发器中

---

## 陷阱：Python if/elif/else 穷举检查

**问题**：Python 的 if/elif/else 链没有编译时穷举检查。当你向 `Literal` 类型添加新值（例如 `Platform`）时，现有的 if/elif/else 链会静默地落入 `else`，使用错误的默认值。

**症状**：新平台部分工作 —— 某些方法返回 Claude 默认值而不是平台特定值。没有错误被抛出。

**示例**（`cli_adapter.py`）：
```python
# BAD: "gemini" 落入 else，返回 "claude"
@property
def cli_name(self) -> str:
    if self.platform == "opencode":
        return "opencode"
    else:
        return "claude"  # gemini 静默获取 "claude"！

# GOOD: 每个平台都有显式分支
@property
def cli_name(self) -> str:
    if self.platform == "opencode":
        return "opencode"
    elif self.platform == "gemini":
        return "gemini"
    else:
        return "claude"
```

**预防**：当向 Python `Literal` 类型添加新值时，搜索所有基于该类型切换的 if/elif/else 链并添加显式分支。不要依赖 `else` 对新值是正确的。

---

## 陷阱：产生相同输出的不对称机制

**问题**：当两种不同机制必须产生相同的文件集时（例如，init 使用递归目录复制，而 update 使用手动 `files.set()`），结构更改（重命名、移动、添加子目录）只会通过自动机制传播。手动机制会静默地偏离。

**症状**：Init 工作完美，但 update 在错误的路径创建文件或完全遗漏文件。

**预防**：
- **最佳**：消除不对称性 —— 让手动路径调用自动路径（例如，`collectTemplateFiles()` 调用 `getAllScripts()` 而不是维护自己的列表）
- **如果不对称性不可避免**：添加回归测试，比较两种机制的输出
- 迁移目录结构时，搜索所有引用旧结构的代码路径

**实际示例**：`trellis update` 有一个手动的 `files.set()` 列表，包含 11 个 `getAllScripts()` 已经追踪的脚本。修复：用 `for..of getAllScripts()` 循环替换手动列表。参见 v0.4.0-beta.3 中的 `update.ts` 重构。

---

## 模板文件注册（Trellis 特定）

向 `src/templates/trellis/scripts/` 添加新文件时：

**单一注册点**：`src/templates/trellis/index.ts`

1. 添加 `export const xxxScript = readTemplate("scripts/path/file.py");`
2. 添加到 `getAllScripts()` Map

就这样。`commands/update.ts` 直接使用 `getAllScripts()` —— 无需手动同步。

**为什么这很重要**：如果不在 `getAllScripts()` 中注册，`trellis update` 不会将文件同步到用户项目。Bug 修复和功能不会传播。

**历史**：在 v0.4.0-beta.3 之前，`update.ts` 有自己手动维护的文件列表，经常与 `getAllScripts()` 不同步。这导致 11 个 Python 文件在 `trellis update` 期间被静默跳过。修复是消除重复列表并使用 `getAllScripts()` 作为单一事实来源。

### 新脚本快速检查清单

```bash
# 添加新的 .py 文件后，验证它是否在 getAllScripts() 中：
grep -l "newFileName" src/templates/trellis/index.ts  # 应该匹配
```

### 模板同步约定

`.trellis/scripts/`（内部使用）和 `packages/cli/src/templates/trellis/scripts/`（模板）必须保持一致。编辑 `.trellis/scripts/` 后，始终同步：

```bash
rsync -av --delete --exclude='__pycache__' .trellis/scripts/ packages/cli/src/templates/trellis/scripts/
```

**陷阱**：使用错误的源/目标路径运行 rsync 可能会创建嵌套的垃圾目录（例如 `.trellis/scripts/packages/cli/...`）。运行前始终仔细检查路径。