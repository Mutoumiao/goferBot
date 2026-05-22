---
id: b-05
status: open
track: backend
priority: p1
summary: ChatController SSE 模块级集成测试 + Chat 链路 E2E
blocked_by: ["i-01"]
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

为 ChatController 编写模块级集成测试和 HTTP E2E 测试，覆盖 SSE 流式响应、客户端断开处理、abort 逻辑、消息持久化。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- SSE 流式响应需用 Fastify `inject()` 的 `payload` 模拟，或解析 `res.payload` 中的 `data:` 行
- LLM/Embedding 需 mock（nock 返回固定 SSE 流）
- 需覆盖 abort/客户端断开场景
- 所有请求路径需包含 `/api` 前缀
