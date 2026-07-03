# 代码复用思考指南

> **目的**：在创建新代码前先停下来思考 —— 它是否已经存在？

---

## Module Purpose

帮助开发者识别重复模式并减少代码重复，防止不一致性 Bug 的产生。当你注意到重复模式时，使用此指南进行思考。

---

## Related Specifications

| 类型 | 规范文件 | 说明 |
|------|---------|------|
| Required | [.trellis/spec/guides/index.md](./index.md) | Guides 目录索引 |
| Reference | [.trellis/spec/guides/cross-layer-thinking-guide.md](./cross-layer-thinking-guide.md) | 跨层数据流思考指南 |
| Reference | [.trellis/spec/web/frontend/index.md](../web/frontend/index.md) | Web 前端模块规范 |
| Reference | [.trellis/spec/server/backend/index.md](../server/backend/index.md) | Server 后端模块规范 |

---

## OpenSpec References

本指南适用于所有功能模块的代码开发。相关功能规范请参考：

| 功能模块 | OpenSpec 文档 |
|---------|-------------|
| Chat 聊天 | [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md) |
| Companion AI 伴侣 | [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md) |
| Knowledge Base 知识库 | [openspec/specs/knowledge-base/spec.md](../../../../openspec/specs/knowledge-base/spec.md) |
| Admin 管理后台 | [openspec/specs/admin/spec.md](../../../../openspec/specs/admin/spec.md) |

---

## Development Entry

### 使用时机

- [ ] 正在编写与现有代码类似的代码
- [ ] 看到相同模式重复出现 3+ 次
- [ ] 正在向多个地方添加新字段
- [ ] 正在修改任何常量或配置
- [ ] 正在创建新的 utility/helper 函数
- [ ] 两个文件使用本地类型转换读取相同的非类型化 payload 字段
- [ ] 多个分支从 `kind` / `action` 更新相同的派生状态

---

## Implementation Checklist

- [ ] 搜索过现有的相似代码
- [ ] 没有应该共享的复制粘贴逻辑
- [ ] 没有在共享解码器之外重复提取未类型化的 payload 字段
- [ ] 常量在一处定义
- [ ] 相似模式遵循相同结构
- [ ] Reducer/action 转换存在于一个 reducer 或命令分发器中

---

## Required Skills

| Skill | 用途 |
|-------|------|
| `codebase-onboarding` | 代码库架构分析，了解现有代码模式 |
| `web-artisan` | 前端代码实现 |
| `nestjs-patterns` | 后端代码实现 |

---

## DO NOT

- 不要在没有搜索的情况下创建新代码
- 不要复制粘贴逻辑而不考虑抽象
- 不要为只使用一次的代码进行过度抽象
- 不要让抽象比重复更复杂

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