---
id: b-06
status: closed
track: backend
priority: p2
summary: Folder/Session/Settings 模块级集成测试
blocked_by: ["i-01"]
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

为 FolderController、SessionController、SettingsController 编写模块级集成测试。Session 和 Settings 有旧 SQLite 路由测试，需重写为 NestJS 模块级。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- Session/Settings 旧测试 `tests/integration/sessions.test.ts`、`tests/integration/settings.test.ts` 需参考迁移
- Settings 需补充 Zod 验证失败测试
- 所有请求路径需包含 `/api` 前缀
