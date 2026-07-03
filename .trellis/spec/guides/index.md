# Thinking Guides

> **Purpose**：扩展你的思维，捕捉可能忽略的问题。

---

## 为什么需要 Thinking Guides？

**大多数 Bug 和技术债务源于"没想到"**，而非缺乏技能：

- 没想到层边界会发生什么 → cross-layer bugs
- 没想到代码模式会重复 → 到处都是重复代码
- 没想到边缘情况 → runtime errors
- 没想到未来维护者 → 难以阅读的代码

这些指南帮助你 **在编码前提出正确的问题**。

---

## 可用指南

| Guide | Purpose | When to Use |
|-------|---------|-------------|
| [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md) | 识别模式并减少重复 | 当你注意到重复模式时 |
| [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md) | 思考跨层数据流 | 跨多层的功能 |

---

## 快速参考：思维触发点

### 何时思考跨层问题

- [ ] 功能涉及 3+ 层（API、Service、Component、Database）
- [ ] 层之间数据格式发生变化
- [ ] 多个消费者需要相同的数据
- [ ] 不确定某些逻辑应该放在哪里
- [ ] 正在添加 event kind、JSONL record、RPC payload 或 config field
- [ ] UI / command 代码开始直接对原始 payload 字段进行类型转换

→ 阅读 [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md)

### 何时思考代码复用

- [ ] 正在编写与现有代码类似的代码
- [ ] 看到相同模式重复出现 3+ 次
- [ ] 正在向多个地方添加新字段
- [ ] **正在修改任何常量或配置**
- [ ] **正在创建新的 utility/helper 函数** ← 先搜索！
- [ ] 两个文件使用本地类型转换读取相同的非类型化 payload 字段
- [ ] 多个分支从 `kind` / `action` 更新相同的派生状态

→ 阅读 [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md)

### 验证 AI 交叉审查结果时

- [ ] 审查者声称"用户输入可能是恶意的" → 检查实际数据源（内部 manifest？用户配置？外部 API？）
- [ ] 审查者标记"缺少验证" → 数据是否来自可信的内部源？
- [ ] 审查者说"行为改变" → 阅读代码注释 — 这是有意的设计吗？
- [ ] 审查者在测试中发现"bug" → 在脑海中删除被测试的功能 — 测试是否仍然通过？如果是 → 同义反复的测试

**AI 审查者常见误报模式**：
1. **信任边界混淆**：将内部数据（捆绑的 JSON manifests）视为不受信任的外部输入
2. **忽略设计注释**：将代码注释中记录的有意行为标记为 bug
3. **变量误读**：未追溯变量到其实际定义（例如，按路径键控的 Map 与按名称键控的 Map）

**验证规则**：在确定优先级之前，必须对照实际代码验证每个 CRITICAL/WARNING 发现。AI 审查的误报率预算约为 35%。

---

## 修改前规则（CRITICAL）

> **修改任何值之前，务必先搜索！**

```bash
# 搜索你即将修改的值
grep -r "value_to_change" .
```

这个习惯可以防止大多数"忘记更新 X"的 bug。

---

## 如何使用此目录

1. **编码前**：浏览相关的思维指南
2. **编码中**：如果感觉某些内容重复或复杂，请查阅指南
3. **修复 Bug 后**：将新见解添加到相关指南中（从错误中学习）

---

## 贡献

发现新的"没想到"时刻？将其添加到相关指南中。

---

**核心原则**：30 分钟的思考可以节省 3 小时的调试时间。