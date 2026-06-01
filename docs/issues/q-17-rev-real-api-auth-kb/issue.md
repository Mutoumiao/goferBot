---
id: q-17-rev
status: closed
track: quality
priority: p1
summary: q-17 真实 API 版本 — 实现 5 个 pending AC（AC-06/08/12/15/16）
blocked_by:
  - q-23
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

基于 q-23 修复后的集成测试基础设施，实现 q-17 的 5 个 pending AC，使用真实后端 API。

包含：
- AC-06：未登录访问保护路由重定向到登录页
- AC-08：重复注册相同邮箱返回错误
- AC-12：上传文档到知识库
- AC-15：用户 B 无法看到/操作用户 A 的知识库
- AC-16：上传 txt/md/pdf 三种类型文档

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 验收标准

- [x] AC-06：未登录访问 `/chat` 等保护路由，重定向到 `/login`
- [x] AC-08：重复注册相同邮箱，后端返回 409，前端显示错误
- [x] AC-12：上传文档到知识库，状态流转 uploaded → ready
- [x] AC-15：用户 B 的 token 无法访问用户 A 的知识库（返回 403）
- [x] AC-16：上传 txt/md/pdf 三种类型文档，均成功索引
- [x] 全部测试使用真实后端 API，非 mock
- [x] `pnpm type-check` 通过
- [x] q-17 原 issue 可关闭（16/16 AC 通过）

## 阻塞于

- q-23：需要集成测试基础设施完整（TestAppFactory、真实数据库、索引流水线）

## 范围外

- q-17 已通过的 11 个 AC（保持现状）
- mock API 测试的修改
- E2E 层 UI 测试新增

## Agent 简报

**分类：** enhancement
**摘要：** 实现 q-17 剩余 5 个 pending AC，使用真实后端 API 验证

**当前行为：**
- q-17 有 11/16 AC 已通过（mock API）
- 5 个 AC pending：AC-06, AC-08, AC-12, AC-15, AC-16
- 原 spec 要求"真实后端 API"，但实现使用 mock

**期望行为：**
- 5 个 pending AC 全部通过
- 使用真实后端 API（TestAppFactory + 真实数据库）
- q-17 原 issue 关闭（16/16 AC）

**关键接口：**
- `TestAppFactory.create(dbUrl, { realMode: true })`
- `POST /api/auth/register`
- `POST /api/knowledge-bases/:kbId/documents/upload`
- `GET /api/knowledge-bases`

**验收标准：**
- [x] AC-06 通过
- [x] AC-08 通过
- [x] AC-12 通过
- [x] AC-15 通过
- [x] AC-16 通过
- [x] q-17 关闭

**范围外：**
- 已通过的 11 个 AC
- mock 测试修改
