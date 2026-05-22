---
id: i-01
status: closed
track: infrastructure
priority: p0
summary: 搭建 API 测试共享基础设施
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

搭建 PRD 中定义的两层 API 测试体系的共享基础设施，包括五个核心工具、vitest 配置、`.env.test` 环境变量。所有后续 API 测试 issue 均依赖此基础设施。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 测试配置统一放在项目根目录，使用根目录 vitest v4
- 需配置 `vite-tsconfig-paths` 同时解析根目录和 `packages/server/tsconfig.json` 的路径别名
- `.env.test` 需区分 `DATABASE_URL`（E2E 共享库）和 `TEST_DATABASE_ADMIN_URL`（CREATE/DROP 管理连接）
