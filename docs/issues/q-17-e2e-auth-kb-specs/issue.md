---
id: q-17
status: open
track: quality
priority: p1
summary: E2E 认证流程与知识库生命周期测试
blocked_by:
  - q-16-e2e-infra-migration
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

基于 q-16 建立的真实 API E2E 基础设施，编写认证和知识库模块的端到端测试。

包含：
- `specs/01-auth-flow.spec.ts` — 完整认证流程测试
- `specs/02-kb-lifecycle.spec.ts` — 知识库全生命周期测试

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 所有测试必须走真实后端 API，禁止 mock
- 认证测试需验证 RSA 加密、JWT 获取、Token 刷新、路由守卫
- 知识库测试需验证创建、列表、上传文档、删除、回收站
- 每个测试用例独立创建/清理数据
