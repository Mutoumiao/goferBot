# Companion UI 渲染开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为 [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md)（WHAT）。Memory 5 种类型 / CompanionForm 字段定义 / 组件树业务约束 / SSE 流式契约 应以 OpenSpec 为准。

---

## Purpose

帮助开发者在 Companion 前端 UI 渲染模块中高效工作：理解打字机动画、流式渲染、双模式表单等实现模式，避免重复踩坑。业务字段定义、组件树业务约束请直接查阅 OpenSpec。

## Primary OpenSpec

- [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md) — Companion 业务规范（字段定义、组件树、Memory 类型、SSE 契约权威源）

## Related OpenSpec

- [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md) — SSE 双轨方案（Companion 流式渲染参考）

## Module Dependencies

- **Zustand** — `useCompanionStore` 管理消息列表与流式状态
- **原生 fetch + ReadableStream** — Companion SSE 流式接收（不依赖 XStream）
- **shadcn/ui** — 表单组件（Input / Textarea / Button / Dialog / AlertDialog / DropdownMenu / Badge）
- **@ant-design/x** — `Bubble` 消息气泡组件
- **XMarkdown** — AI 完成消息的 Markdown 渲染

## Development Entry

- `packages/web/src/features/companion/` — Companion 全部前端文件
- `packages/web/src/features/companion/components/` — 组件树（CompanionTypingIndicator / CompanionMessageItem / CompanionForm 等）
- `packages/web/src/features/companion/types.ts` — 前端类型定义
- `packages/web/src/stores/companion.ts` — Companion Store（流式状态管理）

## Implementation Notes

### 打字机动画（CompanionTypingIndicator）

与 Chat 的 `XMarkdown streaming.hasNextChunk` 不同，Companion 使用自研逐字打字机：

- **核心机制**：`setInterval` + `displayedCount` 状态推进，每 tick `+1`
- **默认间隔**：18ms/字（约 55 字/秒，模拟真人中等速度）
- **光标**：尾部 `<span className="animate-pulse w-0.5 h-4 bg-current" />` 闪烁竖线
- **完成回调**：`displayedCount >= content.length` 时 `clearInterval` 并触发 `onComplete`
- **重置**：`content` 变长后 `useEffect` 重启 interval，光标推进新内容
- **适用范围**：纯文本场景（AI 流式中覆写 content）；Markdown 增量渲染仍走 XMarkdown

### 流式渲染性能优化

- AI 流式中：`CompanionTypingIndicator` 直接消费 `message.content`，避免每 token 重渲染整个组件树
- AI 完成后：切换为 `XMarkdown` 一次性渲染，`streaming={{ hasNextChunk: false }}`
- 用户消息：纯文本 `Bubble`，无 Markdown 解析开销
- 流式中不显示反馈按钮，避免不必要的交互节点

### CompanionMessageItem 三态渲染策略

按 `role` + `streaming` 状态分流：
- **用户消息**：`Bubble` `placement=end, variant=filled, shape=round`，纯文本
- **AI 流式中**：`Bubble` `placement=start, variant=borderless`，children 为 `<CompanionTypingIndicator />`
- **AI 完成**：`Bubble` `placement=start, variant=borderless`，children 为 `<XMarkdown />`，配点赞/踩按钮

### 反馈按钮交互模式

- 默认 `opacity-0`，父元素 `group hover` 时 `opacity-100`（`transition-opacity`）
- 已投票按钮 `variant='secondary'` 高亮，未投票 `variant='ghost'`
- 点击调用 `submitFeedback(messageId, { rating: 1 | -1 })`
- 流式中不渲染反馈按钮

### 头像渲染模式

Card 与 Header 共用逻辑：
- 有 `avatarKey` → CSS `backgroundImage: url(/api/files/{key})`
- 无 `avatarKey` → 首字母 fallback（`.charAt(0)` 居中）
- 尺寸由调用方决定（Card `h-14 w-14`，Header `h-10 w-10`）

### CompanionForm 双模式实现

- `mode: 'create' | 'edit'` prop 切换提交端点（POST / PATCH）和 toast 文案
- **统一 trim 处理**：所有字段 `trim()`，空字符串转 `undefined`（避免后端存空串）
- 字段定义详见 OpenSpec，本文件不复制

### CompanionStatusTag 三态映射

`draft → default`、`published → secondary`、`archived → destructive`，中文标签由状态键查表。

### useCompanionStore 流式状态管理

- 流式标记 `streaming: true` 写入消息对象，UI 据此选择渲染分支
- 完成时清 `streaming`，触发 XMarkdown 切换
- 中断时需清理半成品消息（见 Common Pitfalls）

## Testing Checklist

- [ ] 打字机动画流畅无卡顿（长文本下仍稳定 55 字/秒）
- [ ] 流式渲染不阻塞主线程（输入框、滚动条可交互）
- [ ] AI 流式中→完成切换无内容跳变（光标位置正确）
- [ ] CompanionForm create/edit 双模式正确提交
- [ ] 所有字段 trim 处理生效（空串 → undefined）
- [ ] 反馈按钮 group-hover 显示/隐藏正确
- [ ] 已投票按钮高亮状态正确
- [ ] 头像 avatarKey / 首字母 fallback 正确切换
- [ ] 流式中断后状态正确清理（无残留 streaming 标记）
- [ ] 组件树正确渲染（按 OpenSpec 组件约束）

## Review Checklist

- [ ] 新增字段是否同步更新 OpenSpec（不在本文件追加字段表）
- [ ] Memory 类型变更是否同步更新 OpenSpec
- [ ] 组件树变更是否同步更新 OpenSpec
- [ ] 打字机间隔改动是否影响体感（默认 18ms）
- [ ] 流式分支是否复用 CompanionTypingIndicator（不重复实现）
- [ ] 反馈按钮是否复用 group-hover 模式
- [ ] 表单是否复用 trim + undefined 处理

## Common Pitfalls

- **打字机 useEffect 依赖**：`displayedCount` 进入依赖会导致每次 tick 重启 interval；正确做法是只依赖 `content`，用函数式 `setDisplayedCount(prev => ...)` 推进
- **流式中断未清理**：组件卸载或请求中断时若未清 `streaming` 标记，消息会卡在"流式中"状态，永远不切 XMarkdown
- **反馈按钮在流式中渲染**：会触发不必要的 re-render，且点击会提交到不完整 messageId
- **表单未 trim 空串**：后端存入空字符串导致列表页显示空白副标题
- **打字机用于 Markdown**：代码块、表格会被逐字破坏渲染，Markdown 内容必须走 XMarkdown
- **头像首字母未处理大小写**：`charAt(0)` 应配合 `toUpperCase()` 保证视觉一致

## Reusable Patterns

### 打字机动画实现模式

`setInterval + displayedCount + slice(0, n)`，配合 `animate-pulse` 光标；适用于任何纯文本逐字输出场景。

### 流式渲染性能优化模式

流式中用轻量组件（如 CompanionTypingIndicator）消费 token 流，避免每 token 重渲染 Markdown；完成后切换到重量级 Markdown 渲染器。

### 双模式表单实现模式

`mode` prop 切换端点 + toast 文案；统一 trim + undefined 处理；字段定义外置于 OpenSpec，本文件只保留实现骨架。

### group-hover 反馈交互模式

父元素 `group`，子元素 `opacity-0 group-hover:opacity-100 transition-opacity`；适用于消息气泡、卡片操作按钮等"聚焦时显式"场景。

### 三态渲染分支模式

按 `role × streaming` 矩阵分流到不同 children 渲染器，状态切换由 store 标记驱动，组件本身保持无感。
