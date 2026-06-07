---
id: f-44
status: open
track: frontend
priority: p1
summary: ChatView SSE 流式接收 — useSSE hook 集成、流式内容渲染、错误重连、打字机动画
blocked_by:
  - f-40
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.7 阶段三深化
---

## 要构建的内容

在 `routes/app/chat.tsx` 中接入 alova `useSSE` hook，实现消息的流式接收和渲染。替换当前的 `TODO: SSE 流式调用` 占位。覆盖：流式 chunk 追加、连接中断重连、完成后的消息终结。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.7 阶段三深化
- **核心目标**: ChatView 从骨架升级为可真正对话的功能页面
- **验收标准**: 输入消息后可见 AI 流式逐字输出，与后端 SSE 端点连通

## 验收标准

- [ ] `useSSE('/chat/stream', ...)` 在 ChatInput onSubmit 时触发
- [ ] 流式 chunk 追加到 `chatStore.appendStreamContent`
- [ ] 流式完成后 `chatStore.flushStreamContent` 生成完整 assistant message
- [ ] 连接中断时显示错误提示 + 重连按钮
- [ ] 流式传输中禁用 ChatInput（正在实现）
- [ ] 停止生成按钮（AbortController）

## 阻塞于

f-40（session store — 需要 activeSession.id）

## 范围外

- 不在此 issue 实现会话创建/切换（由 f-45 负责）
- 不涉及后端 SSE 端点修改
