---
issue_id: f-09-chat-page
type: behavior-spec
status: approved
summary: 定义空会话态（大输入框+快捷胶囊）与对话态（消息流+固定输入框）两种布局，含消息发送、@知识库提及、模型切换、loading/empty/error 交互状态的完整流转。
---
# Behavior Spec: 聊天页面 (Chat Page)

> 对应 issue: `f-09-chat-page`
> 依赖: `b-04-chat-sse-api`（SSE 联调后续进行，先实现基础 UI）

---

## 两种状态

### 空会话态 (Empty State)

- 中间区域：大输入框 + 发送按钮
- 输入框下方：3 个快捷提问胶囊按钮
- 点击胶囊自动填入输入框并发送
- 输入框支持 Shift+Enter 换行，Enter 发送

### 对话态 (Chat State)

- 顶部：会话标题（可编辑）、模型切换下拉
- 上部：可滚动消息流（用户/AI 消息交替）
- 底部：固定输入框（多行文本）
- 支持 `@知识库名称` 提及触发下拉选择
- 发送按钮 loading 状态

---

## 交互状态

| 状态 | 触发 | UI |
|------|------|-----|
| empty | 无消息 | 大输入框 + 快捷胶囊 |
| chatting | 有消息 | 消息流 + 底部输入框 |
| loading | 发送中 | 按钮 spinner，输入框禁用 |
| error | 发送失败 | 错误提示 + 重试按钮 |

---

## 关键组件

- `ChatView.vue` — 主页面（空态/对话态切换）
- `EmptySession.vue` — 空会话态（已存在，需适配新 Store）
- `ChatInput.vue` — 底部输入框（已存在）
- `ChatMessageList.vue` — 消息列表（已存在）
- `ChatMessage.vue` — 单条消息（已存在）

---

## 范围外

- SSE 流式接收（依赖 b-04）
- 语音输入
- 图片上传
- 消息编辑/删除
