---
id: q-19
status: open
track: quality
priority: p1
summary: E2E 设置持久化与跨模块用户旅程测试
blocked_by:
  - q-16-e2e-infra-migration
  - q-17-e2e-auth-kb-specs
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

基于 q-16 和 q-17 的成果，编写设置持久化和跨模块用户旅程的端到端测试。

包含：
- `specs/05-settings-persist.spec.ts` — 设置保存与页面刷新恢复测试
- `specs/06-onboarding-journey.spec.ts` — 新用户首次使用完整旅程
- `specs/07-rag-workflow.spec.ts` — RAG 检索增强完整工作流

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 设置测试需验证保存后刷新页面数据恢复
- 用户旅程测试覆盖从注册到首次对话的完整路径
- RAG 工作流测试覆盖创建 KB → 上传文档 → 聊天引用 → 验证检索上下文
- 所有测试必须走真实后端 API
