---
id: q-17
status: open
track: quality
priority: p1
summary: E2E 认证流程与知识库生命周期测试
blocked_by: []  # q-16 已关闭，解除阻塞
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

### 状态说明（2026-05-29）

**当前测试覆盖情况**：
- `tests/e2e/specs/auth.spec.ts` — 覆盖 AC-01~AC-05、AC-07（UI 行为层面，使用 mock API）
- `tests/e2e/specs/knowledge-base.spec.ts` — 覆盖 AC-09~AC-11、AC-13~AC-14（UI 行为层面，使用 mock API）

**缺口（5 项 pending）**：
- AC-06：未登录访问保护路由重定向
- AC-08：重复注册相同邮箱返回错误
- AC-12：上传文档到知识库
- AC-15：用户 B 无法看到/操作用户 A 的知识库
- AC-16：上传 txt/md/pdf 三种类型文档

**技术债务**：当前测试使用 mock API（`page.route`），与 spec 要求的"真实后端 API"冲突。后续需重写为真实 API 版本或调整 spec。
