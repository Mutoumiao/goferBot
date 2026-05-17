---
id: f-09-chat-page
type: issue
status: closed
track: frontend
priority: p0
summary: 实现问答对话页，包含空会话态和对话态两种状态。支持快捷提问胶囊、知识库提及、流式回复，用户可在对话页与 AI 交流。
blocked_by: [b-04-chat-sse-api, f-04-tab-bar]
blocks: []
spec: docs/03-specs/f-09-chat-page/
plan: docs/04-plans/f-09-chat-page/v1.md
tests: docs/08-test-cases/f-09-chat-page/
token_estimate: 1100
---

状态: closed
分类: enhancement

## 要构建的内容

实现问答对话页，包含空会话态和对话态两种状态。

## 规格引用

- 功能规格: docs/03-specs/f-09-chat-page/feature-spec.md
- 行为规格: docs/03-specs/f-09-chat-page/behavior-spec.md
- API 规格: docs/03-specs/b-04-chat-sse-api/api-spec.md

## 验收标准

- [ ] `packages/webui/src/views/ChatView.vue` 实现问答对话页
- [ ] **空会话态**：
  - [ ] 中间区域：大输入框 + 发送按钮
  - [ ] 输入框下方：3-4 个快捷提问示例胶囊按钮
  - [ ] 点击示例自动填入输入框并发送
- [ ] **对话态**：
  - [ ] 底部：固定输入框（多行文本，Enter 发送，Shift+Enter 换行）
  - [ ] 支持 `@知识库名称` 提及触发知识库选择下拉
  - [ ] 上部：可滚动消息流
- [ ] 顶部：会话标题（可编辑，双击或点击编辑图标）、模型切换下拉
- [ ] 发送消息后自动切换到对话态
- [ ] 新会话默认标题"首页"（不可关闭）
- [ ] 加载状态：发送按钮显示加载动画
- [ ] 错误状态：发送失败显示错误提示，支持重试
- [ ] 使用 Pinia Store 管理当前会话状态

## 阻塞于

- b-04-chat-sse-api（需要对话 API）
- f-04-tab-bar（需要标签栏管理多会话）

## 范围外

- 语音输入
- 图片上传/多模态
- 消息编辑/删除

## Agent 简报

**分类：** enhancement
**摘要：** 问答对话页，空会话态 + 对话态，支持快捷提问和知识库提及

**当前行为：**
前端无对话界面。

**期望行为：**
用户可在对话页与 AI 交流，空会话时显示快捷提问，对话时流式接收回复。

**关键接口：**
- `packages/webui/src/views/ChatView.vue` — 对话页
- API: `POST /api/chat` — SSE 流
- Pinia Store — 会话状态

**验收标准：**
- [ ] 空会话态：大输入框 + 快捷提问胶囊
- [ ] 快捷提问点击自动发送
- [ ] 对话态：底部固定输入框
- [ ] Enter 发送，Shift+Enter 换行
- [ ] `@知识库名称` 提及触发选择
- [ ] 可滚动消息流
- [ ] 顶部可编辑标题 + 模型切换
- [ ] 发送后自动切换对话态
- [ ] "首页"标签不可关闭
- [ ] 发送加载动画
- [ ] 错误提示 + 重试
- [ ] Pinia Store 管理状态

**范围外：**
- 语音输入
- 图片上传
- 消息编辑/删除
