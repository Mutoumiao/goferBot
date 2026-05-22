---
id: b-03
status: open
track: backend
priority: p1
summary: DocumentController 模块级集成测试 + 文件上传链路 E2E
blocked_by: ["i-01"]
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

为 DocumentController 编写模块级集成测试和 HTTP E2E 测试，覆盖 upload / create / update / delete / list 全部端点。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- multipart/form-data 上传需用 Fastify `inject()` 的 payload 模拟
- 50MB 限制、MIME 类型校验需覆盖
- MinIO 使用真实 test bucket，测试后清理
- 所有请求路径需包含 `/api` 前缀
