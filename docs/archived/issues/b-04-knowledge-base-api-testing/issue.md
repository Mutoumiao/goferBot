---
id: b-04
status: closed
track: backend
priority: p1
summary: KnowledgeBaseController 模块级集成测试 + KB 链路 E2E
blocked_by: ["i-01"]
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

为 KnowledgeBaseController 编写模块级集成测试和 HTTP E2E 测试，覆盖 CRUD + 搜索全部端点。旧 SQLite 路由测试需迁移至 NestJS 模块级。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 旧测试 `tests/integration/knowledgeBases.test.ts` 和 `knowledgeBasesExtended.test.ts` 需参考但不直接复用
- 需补充认证隔离测试（多用户场景）和分页测试
- 所有请求路径需包含 `/api` 前缀
