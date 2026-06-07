# 测试路径约定（共享引用）

> 本文件被所有流程 skill 共享引用。
> 修改此处 = 全局生效。

---

## Issue Track → 测试层级映射

| Issue Track | 测试层级 | 测试路径 | 运行命令 |
|-------------|---------|---------|---------|
| `f-*`（Vue 旧项目 `packages/webui`） | 前端单元（Vue） | `tests/unit/webui/{name}.spec.ts` | `npx vitest run tests/unit/webui/` |
| `f-*`（React 新项目 `apps/web`） | 前端单元（React） | `tests/unit/web/{name}.spec.tsx` | `npx vitest run tests/unit/web/` |
| `b-*`, `d-*` | 后端单元 | `tests/unit/server/{name}.spec.ts` | `npx vitest run tests/unit/server/` |
| `i-*` | 集成测试 | `tests/integration/{name}.spec.ts` | `pnpm test:integration` |
| `q-*` | E2E 测试 | `tests/e2e/specs/` 或 `tests/e2e/flows/` | `pnpm test:e2e` |

> **注意**：`q-*` 轨道历史上有部分测试放在 `tests/integration/`（如 `q-17-rev.spec.ts`）。新创建的 E2E 测试应优先放在 `tests/e2e/`，但需检查现有代码确认实际位置。

## 命名规范

- 测试文件：`{feature-name}.spec.ts`
- 测试用例名：`AC-XX: {描述}`（冒号+空格，如 `AC-01: creates knowledge base with valid data`）
- checklist.json 中的 `id`：`AC-XX`（无冒号，如 `"AC-01"`）

## Issue → 测试映射

映射关系记录在 `tests/README.md`（如存在）或 issue 的 spec 文件中。

## 测试指南引用

| 测试层级 | 指南文件 |
|---------|---------|
| 前端单元 | `docs/guide/testing/unit-testing-guide.md` 第 5-6 章 |
| 后端单元 | `docs/guide/testing/unit-testing-guide.md` 第 7 章 |
| 集成测试 | `docs/guide/testing/integration-testing-guide.md` |
| E2E 测试 | `docs/guide/testing/e2e-testing-guide.md` |
