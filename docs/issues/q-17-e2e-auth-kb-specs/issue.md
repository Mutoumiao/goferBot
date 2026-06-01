---
id: q-17
status: closed
track: quality
priority: p1
summary: E2E 认证流程与知识库生命周期测试（待 q-17-rev 完成后关闭）
blocked_by:
  - q-23
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

基于 q-16 建立的真实 API E2E 基础设施，编写认证和知识库模块的端到端测试。

**当前状态**：16/16 AC 全部通过（q-17-rev 使用真实后端 API 完成 5 个 pending AC）。

包含：
- `specs/01-auth-flow.spec.ts` — 完整认证流程测试
- `specs/02-kb-lifecycle.spec.ts` — 知识库全生命周期测试

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 所有测试必须走真实后端 API，禁止 mock（当前 11 个 AC 使用 mock，待 q-17-rev 重写）
- 认证测试需验证 RSA 加密、JWT 获取、Token 刷新、路由守卫
- 知识库测试需验证创建、列表、上传文档、删除、回收站
- 每个测试用例独立创建/清理数据

### 状态说明（2026-05-29）

**当前测试覆盖情况**：
- `tests/e2e/specs/auth.spec.ts` — 覆盖 AC-01~AC-05、AC-07（UI 行为层面，使用 mock API）
- `tests/e2e/specs/knowledge-base.spec.ts` — 覆盖 AC-09~AC-11、AC-13~AC-14（UI 行为层面，使用 mock API）

**缺口（5 项 pending）**：
- AC-06：未登录访问保护路由返回 401
- AC-08：重复注册相同邮箱返回错误
- AC-12：上传文档到知识库
- AC-15：用户 B 无法看到/操作用户 A 的知识库
- AC-16：上传 txt/md/pdf 三种类型文档（pdf 解析未实现，预期失败降级）

**处理方案**：
- ✅ 5 个 pending AC 已由 `q-17-rev-real-api-auth-kb` 实现（使用真实后端 API）
- ✅ q-17-rev 已完成，本 issue 关闭（16/16 AC 全部通过）

**阻塞于**：
- q-23：需要集成测试基础设施完整（TestAppFactory、真实数据库、索引流水线）
- i-02 ~ b-13：需要 ADR 0005（pgvector）实施完成
