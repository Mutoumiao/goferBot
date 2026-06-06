---
id: q-27
status: closed
track: quality
priority: p1
summary: 后端测试覆盖率门槛定义与核心模块测试补齐
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

定义后端单元测试覆盖率门槛，并为当前零覆盖的核心业务模块（Auth、KnowledgeBase、Chat、Admin）建立测试骨架。

## 规格引用

- 功能规格: specs/feature-spec.md

## 补充说明

- 当前状态：`packages/server/src` 下 14 个模块、9 个 Controller、16 个 Service，但 `packages/server/` 目录内 0 个测试文件
- 测试体系总览第 7 节：后端单元/集成/E2E 覆盖率门槛**待定义**
- 改造后：
  - vitest.config.ts 增加 `packages/server/src/**/*.ts` 到 coverage.include
  - 定义后端覆盖率门槛（渐进式：本月报告不阻断 → 下月警告 → 下月强制）
  - 为 AuthModule、KnowledgeBaseModule 建立单元测试骨架（Mock 模式）
- q-24 和 q-25 完成后执行，确保测试基础设施稳定后再补齐覆盖
