---
id: q-23
status: closed
track: quality
priority: p0
summary: 修复集成测试层 4 个 broken 文件，验证 q-22 真实链路
blocked_by:
  - b-13
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

修复集成测试层所有无法运行的文件，使集成测试层全部可用。

包含：
- `infra.spec.ts` / `kb-lifecycle.spec.ts`：Playwright → vitest 语法转换
- `rag-e2e.spec.ts`：诊断并修复实际错误（非"模块缺失"）
- 验证 `rag-real.spec.ts` 在 Docker 环境下通过（非跳过）
- 可选：删除 `tests/integration/sidecar/` 遗留文件

**注意**：`auth-flow.spec.ts` 实际是 E2E 测试（使用 Playwright AuthPage POM），不在集成测试层修复

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 验收标准

- [ ] `infra.spec.ts` 可在 vitest 下运行（不使用 `test.describe()`）
- [ ] `kb-lifecycle.spec.ts` 可在 vitest 下运行
- [ ] `rag-e2e.spec.ts` 可在 vitest 下运行（诊断并修复实际错误）
- [ ] `rag-real.spec.ts` 在 Docker 环境下 3 个 AC 全部通过（非跳过）
- [ ] `npx vitest run --config vitest.integration.config.ts` 全部通过
- [ ] 可选：sidecar/ 遗留文件已删除

**排除**：`auth-flow.spec.ts` 是 E2E 测试（使用 AuthPage POM），不在本 issue 修复范围

## 阻塞于

- b-13：需要 Indexer 正确工作，q-22 才能验证索引链路

## 范围外

- q-17 的 5 个 pending AC（q-17-rev 处理）
- 新增集成测试用例
- E2E 测试修改

## Agent 简报

**分类：** bugfix
**摘要：** 修复集成测试层语法冲突和模块缺失，使所有文件可运行

**当前行为：**
- `infra.spec.ts` / `kb-lifecycle.spec.ts` 使用 Playwright `test.describe()`，在 vitest 下报错
- `rag-e2e.spec.ts` 有运行时错误（待诊断，非简单的"模块缺失"）
- `rag-real.spec.ts` 代码已适配 pgvector，但未在 Docker 环境下验证
- `auth-flow.spec.ts` 实际是 E2E 测试（使用 AuthPage POM），不应在集成测试层运行
- 集成测试层实际上只有 1/4 文件能运行（排除 auth-flow）

**期望行为：**
- `infra.spec.ts` / `kb-lifecycle.spec.ts` 转换为 vitest 语法
- `rag-e2e.spec.ts` 运行时错误修复
- `rag-real.spec.ts` 在 Docker 环境下通过
- `npx vitest run --config vitest.integration.config.ts` 全部通过

**关键接口：**
- vitest `describe()` / `it()` / `expect()`
- Playwright `test` → vitest 全局函数

**验收标准：**
- [ ] infra.spec.ts / kb-lifecycle.spec.ts 修复
- [ ] rag-e2e.spec.ts 运行时错误修复
- [ ] rag-real.spec.ts Docker 验证通过
- [ ] 全部集成测试通过

**范围外：**
- auth-flow.spec.ts（E2E 测试，不在集成层修复）
- q-17 pending AC
- 新增测试用例
- E2E 测试
