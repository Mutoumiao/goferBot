---
id: q-24
status: open
track: quality
priority: p0
summary: 单元测试数据库隔离治理 — 阻断开发库污染
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

修复单元测试直接连接真实数据库的问题，强制所有单元测试使用 Mock 模式，阻断对开发/生产数据库的污染。

## 规格引用

- 功能规格: specs/feature-spec.md

## 补充说明

- 当前违规文件：`tests/unit/server/prisma-pagination.spec.ts`、`tests/unit/server/session.service.spec.ts`
- 这两份测试直接 `new PrismaService()` 连接开发数据库，在 `beforeAll` 中批量创建用户数据，但 `afterAll` 清理不可靠
- 改造后：使用 `mockPrisma` 模式，与 `indexing-worker.spec.ts` 等合规测试保持一致
- 需在 `tests/setup/testglobals.ts` 增加数据库连接保护机制，防止未来新增测试再次违规
