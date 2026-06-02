---
id: b-02
status: closed
track: backend
priority: p1
summary: AuthController 模块级集成测试 + Auth 核心链路 E2E
blocked_by: ["i-01"]
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

为 AuthController 编写模块级集成测试和 HTTP E2E 测试，覆盖 register / login / logout / refresh / me / public-key 全部端点。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 项目使用 RSA-OAEP 前端密码加密，`loginAs` helper 需先获取公钥再加密
- 需覆盖 error cases：400（Zod 验证失败）、401（无效 token）、409（邮箱已存在）
- 所有请求路径需包含 `/api` 前缀
