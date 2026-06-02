# q-18 功能规格

## 概述

聊天 SSE 流式响应和会话管理的端到端测试，验证用户对话体验和会话生命周期管理。

## 功能需求

### FR-01: SSE 流式聊天测试
- 聊天输入框发送消息
- 用户消息立即显示在列表
- SSE 流式接收 AI 响应
- 响应内容逐字显示
- 错误处理（LLM 失败）

### FR-02: @提及知识库测试
- 输入 `@` 触发知识库选择器
- 下拉列表显示所有知识库
- 选择后显示标签 pill
- 支持多选
- 支持删除已选标签
- 发送后请求携带 knowledgeBaseIds

### FR-03: 会话标签管理测试
- 初始仅首页标签
- 新建标签创建会话
- 切换标签加载对应会话历史
- 关闭标签（首页不可关闭）
- 双击重命名标签

### FR-04: 历史记录管理测试
- 历史列表页面加载
- 显示所有历史会话
- 点击会话恢复对话（跳转到 chat）
- 删除会话（软删除）
- 重命名会话

## 外部依赖 Mock

LLM API 调用必须 mock：
```typescript
await page.route('**/v1/chat/completions', (route) => {
  route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n'
  })
})
```
