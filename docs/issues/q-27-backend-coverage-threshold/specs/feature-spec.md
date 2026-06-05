---
name: q-27-feature-spec
description: 后端测试覆盖率门槛定义与核心模块测试补齐功能规格
metadata:
  type: spec
  issue: q-27
---

# 功能规格：后端测试覆盖率门槛定义与核心模块测试补齐

## 背景

项目测试体系总览（`docs/guide/testing/README.md`）当前状态：

| 层级 | 行覆盖率 | 函数覆盖率 | 分支覆盖率 | 语句覆盖率 |
|------|----------|------------|------------|------------|
| 前端单元 | 70% | 60% | 55% | 70% |
| **后端单元** | **—** | **—** | **—** | **—** |
| 集成测试 | — | — | — | — |
| E2E 测试 | — | — | — | — |

后端单元测试覆盖率门槛**待定义**，且核心业务模块完全无测试覆盖。

## 目标

1. 定义后端单元测试覆盖率门槛（渐进式实施）
2. 将后端源码纳入覆盖率报告
3. 为最核心的两个模块（Auth、KnowledgeBase）建立单元测试骨架
4. 更新测试文档，填补规范空白

## 范围

### 包含
- `vitest.config.ts` coverage 配置扩展
- 后端覆盖率门槛定义（报告模式）
- `tests/unit/server/auth.service.spec.ts` 骨架
- `tests/unit/server/knowledge-base.service.spec.ts` 骨架
- `docs/guide/testing/README.md` 更新

### 不包含
- 所有 Controller 测试（可在后续 issue 中补齐）
- 所有 Processor 模块测试（Vector、Queue、Storage 等）
- 集成测试覆盖率门槛（后续 issue）

## 验收标准

| ID | 标准 | 验证方式 |
|----|------|----------|
| AC-01 | vitest.config.ts 包含 packages/server/src/**/*.ts | 代码审查 |
| AC-02 | 运行 pnpm test --coverage，报告包含后端覆盖率数据 | 观察覆盖率输出 |
| AC-03 | auth.service.spec.ts 覆盖：正常登录、密码错误、用户不存在、JWT 生成 | 运行测试通过 |
| AC-04 | knowledge-base.service.spec.ts 覆盖：创建 KB、查询 KB、删除 KB、权限校验 | 运行测试通过 |
| AC-05 | 全部单元测试通过 | pnpm test |
| AC-06 | 测试体系总览文档已更新后端门槛 | 代码审查 |

## 渐进式实施计划

| 阶段 | 时间 | 行为 |
|------|------|------|
| 阶段 1 | 本月 | 仅报告覆盖率，不阻断 CI |
| 阶段 2 | 下月 | 低于门槛时 CI 警告（黄色） |
| 阶段 3 | 再下月 | 低于门槛时 CI 阻断（红色） |
