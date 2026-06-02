---
id: q-18
status: closed
track: quality
priority: p1
summary: E2E 聊天 SSE 流式响应与会话管理测试
blocked_by:
  - q-16-e2e-infra-migration
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

基于 q-16 建立的真实 API E2E 基础设施，编写聊天和会话模块的端到端测试。

包含：
- `specs/03-chat-with-rag.spec.ts` — SSE 流式聊天 + @提及知识库测试
- `specs/04-session-management.spec.ts` — 会话标签 CRUD + 历史管理测试

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 聊天测试需验证 SSE 流式响应（mock 外部 LLM API）
- @提及需验证知识库选择器下拉、多选标签、删除标签
- 会话管理需验证标签栏新建/切换/关闭/重命名
- 历史记录需验证列表加载、点击恢复、删除/重命名
- 外部 LLM 调用使用 `page.route()` 或全局 fetch mock
