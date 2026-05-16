状态: closed
分类: enhancement

## 要构建的内容

实现消息流渲染组件，支持 Markdown 渲染、代码块语法高亮和复制按钮。

## 规格引用

- 功能规格: docs/03-specs/features/message-renderer/feature-spec.md
- 行为规格: docs/03-specs/features/message-renderer/behavior-spec.md
- API 规格: 无（纯 UI）

## 验收标准

- [ ] `packages/webui/src/components/chat/MessageList.vue` 实现消息列表容器
- [ ] `packages/webui/src/components/chat/MessageItem.vue` 实现单条消息
- [ ] 用户消息：靠右，浅色背景（`bg-surface-2`）
- [ ] AI 消息：靠左，白色背景
- [ ] 支持 Markdown 渲染（标题、列表、表格、引用、粗体、斜体等）
- [ ] 代码块：语法高亮 + 复制按钮
- [ ] 复制按钮点击后显示"已复制"提示，2 秒后恢复
- [ ] 行内代码：等宽字体 + 浅色背景
- [ ] 链接：可点击，新标签页打开
- [ ] 消息流自动滚动到底部（新消息到达时）
- [ ] 用户可手动滚动查看历史，滚动到底部后恢复自动滚动
- [ ] 支持流式打字机效果（SSE chunk 逐步显示）
- [ ] 空消息占位：AI 思考中显示闪烁光标或加载动画

## 阻塞于

- f-09-chat-page（需要对话页容器）

## 范围外

- 消息折叠/展开
- 消息引用/回复
- 消息点赞/点踩

## Agent 简报

**分类：** enhancement
**摘要：** 消息流渲染：Markdown、代码高亮、复制、流式显示

**当前行为：**
前端无消息渲染组件。

**期望行为：**
对话消息正确渲染 Markdown 和代码块，流式显示 AI 回复，用户体验流畅。

**关键接口：**
- `packages/webui/src/components/chat/MessageList.vue` — 消息列表
- `packages/webui/src/components/chat/MessageItem.vue` — 单条消息
- Markdown 渲染库
- 代码高亮库

**验收标准：**
- [ ] 消息列表容器
- [ ] 单条消息组件
- [ ] 用户消息靠右浅色背景
- [ ] AI 消息靠左白色背景
- [ ] Markdown 渲染（标题、列表、表格等）
- [ ] 代码块语法高亮 + 复制按钮
- [ ] 复制后"已复制"提示
- [ ] 行内代码样式
- [ ] 链接可点击新标签打开
- [ ] 自动滚动到底部
- [ ] 手动滚动后恢复自动滚动
- [ ] 流式打字机效果
- [ ] AI 思考中加载动画

**范围外：**
- 消息折叠/展开
- 消息引用/回复
- 点赞/点踩
