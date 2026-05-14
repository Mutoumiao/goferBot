# #12 Monorepo 结构迁移 — 测试用例

## 覆盖范围

TC-12-001 ~ TC-12-015

---

## 一、Workspace 配置验证

### TC-12-001: pnpm-workspace.yaml 解析

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-001 |
| 测试项 | pnpm workspace 配置正确加载 |
| 前置条件 | `pnpm-workspace.yaml` 已创建，包含 `packages/*` |
| 测试步骤 | 1. 运行 `pnpm install` <br> 2. 运行 `pnpm ls -r` |
| 预期结果 | 1. 安装成功，无报错 <br> 2. 列出所有 workspace 包：`@goferbot/webui`、`@goferbot/shell-adapters`、`@goferbot/backend-adapters`、`@goferbot/server`、`@goferbot/rag-sdk` |
| 优先级 | P0 |

### TC-12-002: 根 package.json 聚合脚本

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-002 |
| 测试项 | 根目录脚本正确代理到 workspace 包 |
| 前置条件 | 根 `package.json` 已更新为 workspace 配置 |
| 测试步骤 | 1. 运行 `pnpm dev` <br> 2. 运行 `pnpm build` <br> 3. 运行 `pnpm test` |
| 预期结果 | 1. `pnpm dev` 启动 webui Vite dev server <br> 2. `pnpm build` 构建所有包 <br> 3. `pnpm test` 运行所有测试 |
| 优先级 | P0 |

---

## 二、包迁移验证

### TC-12-003: server 包构建

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-003 |
| 测试项 | `@goferbot/server` 编译成功 |
| 前置条件 | `packages/server/` 已迁移，含 `src/`、`package.json`、`tsconfig.json` |
| 测试步骤 | 1. 运行 `pnpm --filter @goferbot/server build` |
| 预期结果 | `tsc` 编译成功，`packages/server/dist/` 生成 `.js` 文件 |
| 优先级 | P0 |

### TC-12-004: shell-adapters 包构建

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-004 |
| 测试项 | `@goferbot/shell-adapters` 编译成功 |
| 前置条件 | `packages/shellAdapters/` 已创建，含 `src/`、`package.json`、`tsconfig.json` |
| 测试步骤 | 1. 运行 `pnpm --filter @goferbot/shell-adapters build` |
| 预期结果 | `tsc` 编译成功，`packages/shellAdapters/dist/` 生成 `.js` + `.d.ts` 文件 |
| 优先级 | P0 |

### TC-12-005: backend-adapters 包构建

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-005 |
| 测试项 | `@goferbot/backend-adapters` 编译成功 |
| 前置条件 | `packages/backendAdapters/` 已创建，含 `src/`、`package.json`、`tsconfig.json` |
| 测试步骤 | 1. 运行 `pnpm --filter @goferbot/backend-adapters build` |
| 预期结果 | `tsc` 编译成功，`packages/backendAdapters/dist/` 生成 `.js` + `.d.ts` 文件 |
| 优先级 | P0 |

### TC-12-006: webui 包构建

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-006 |
| 测试项 | `@goferbot/webui` 编译和构建成功 |
| 前置条件 | `packages/webui/` 已迁移，含 `src/`、`vite.config.ts`、`vitest.config.ts` |
| 测试步骤 | 1. 运行 `pnpm --filter @goferbot/webui type-check` <br> 2. 运行 `pnpm --filter @goferbot/webui build` |
| 预期结果 | 1. `vue-tsc` 无类型错误 <br> 2. Vite 构建成功，`packages/webui/dist/` 生成 |
| 优先级 | P0 |

---

## 三、导入路径验证

### TC-12-007: webui 对 shell-adapters 的导入

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-007 |
| 测试项 | webui 源码正确导入 `@goferbot/shell-adapters` |
| 前置条件 | webui 和 shell-adapters 包已就位 |
| 测试步骤 | 1. 检查 `packages/webui/src/` 中无 `from '@/shell'` 导入 <br> 2. 检查存在 `from '@goferbot/shell-adapters'` 导入 <br> 3. 运行 `pnpm --filter @goferbot/webui type-check` |
| 预期结果 | 1. `@/shell` 导入已清零 <br> 2. workspace 导入存在 <br> 3. 类型检查通过 |
| 优先级 | P0 |

### TC-12-008: webui 对 backend-adapters 的导入

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-008 |
| 测试项 | webui 源码正确导入 `@goferbot/backend-adapters` |
| 前置条件 | webui 和 backend-adapters 包已就位 |
| 测试步骤 | 1. 检查 `packages/webui/src/` 中无 `from '@/backend'` 导入 <br> 2. 检查存在 `from '@goferbot/backend-adapters'` 导入 <br> 3. 运行 `pnpm --filter @goferbot/webui type-check` |
| 预期结果 | 1. `@/backend` 导入已清零 <br> 2. workspace 导入存在 <br> 3. 类型检查通过 |
| 优先级 | P0 |

### TC-12-009: backend-adapters 对 shell-adapters 的导入

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-009 |
| 测试项 | backend-adapters 正确导入 `@goferbot/shell-adapters` |
| 前置条件 | backend-adapters 和 shell-adapters 包已就位 |
| 测试步骤 | 1. 检查 `packages/backendAdapters/src/` 中无 `from '@/shell'` 导入 <br> 2. 检查存在 `from '@goferbot/shell-adapters'` 导入 <br> 3. 运行 `pnpm --filter @goferbot/backend-adapters build` |
| 预期结果 | 1. `@/shell` 导入已清零 <br> 2. workspace 导入存在 <br> 3. 构建成功 |
| 优先级 | P0 |

---

## 四、测试迁移验证（混合方案）

### TC-12-010: 单元测试运行

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-010 |
| 测试项 | 所有单元测试在 monorepo 结构下通过 |
| 前置条件 | `tests/unit/` 保留根目录，`vitest.config.ts` 已更新 |
| 测试步骤 | 1. 运行 `pnpm test`（根目录 vitest） |
| 预期结果 | 301 个测试全部通过，无失败 |
| 优先级 | P0 |

### TC-12-011: E2E 测试运行

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-011 |
| 测试项 | E2E 测试在 monorepo 结构下通过 |
| 前置条件 | `tests/e2e/` 保留根目录，playwright 配置已更新 |
| 测试步骤 | 1. 运行 `pnpm test:e2e` |
| 预期结果 | 21 个 E2E 测试全部通过 |
| 优先级 | P0 |

### TC-12-011b: 集成测试运行

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-011b |
| 测试项 | 集成测试在 monorepo 结构下通过 |
| 前置条件 | `tests/integration/` 已创建（原 `tests/unit/server/`），vitest 配置已更新 |
| 测试步骤 | 1. 运行 `pnpm test:integration` |
| 预期结果 | 34 个集成测试全部通过 |
| 优先级 | P0 |

---

## 五、Tauri 配置验证

### TC-12-012: Tauri 开发模式

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-012 |
| 测试项 | Tauri dev 模式正常启动 |
| 前置条件 | `src-tauri/tauri.conf.json` 已更新 `frontendDist` 路径 |
| 测试步骤 | 1. 运行 `pnpm tauri dev` |
| 预期结果 | Tauri 窗口打开，前端页面正常加载，无白屏或 404 |
| 优先级 | P0 |

### TC-12-013: Tauri 生产构建

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-013 |
| 测试项 | Tauri build 成功打包 |
| 前置条件 | webui 构建产物在 `packages/webui/dist/` 中 |
| 测试步骤 | 1. 运行 `pnpm tauri build` |
| 预期结果 | 构建成功，生成安装包（`.msi` / `.dmg` / `.AppImage`） |
| 优先级 | P1 |

---

## 六、全量构建链验证

### TC-12-014: 全量构建

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-014 |
| 测试项 | 所有包同时构建成功 |
| 前置条件 | 所有包已迁移并配置完成 |
| 测试步骤 | 1. 运行 `pnpm -r build` |
| 预期结果 | 所有包构建成功，无错误 |
| 优先级 | P0 |

### TC-12-015: 全量类型检查

| 字段 | 内容 |
|------|------|
| TC-ID | TC-12-015 |
| 测试项 | 所有包类型检查通过 |
| 前置条件 | 所有包已迁移并配置完成 |
| 测试步骤 | 1. 运行 `pnpm -r type-check` |
| 预期结果 | 所有包类型检查通过，无错误 |
| 优先级 | P0 |

---

## 自动化测试覆盖

| 测试类型 | 文件路径 | 覆盖 TC-ID |
|----------|----------|-----------|
| 单元测试 | `tests/unit/**/*.test.ts` | TC-12-010 |
| 集成测试 | `tests/integration/**/*.test.ts` | TC-12-011b |
| E2E 测试 | `tests/e2e/specs/*.spec.ts` | TC-12-011 |
| 构建验证 | 命令 `pnpm -r build` | TC-12-003 ~ TC-12-006, TC-12-014 |
| 类型检查 | 命令 `pnpm -r type-check` | TC-12-015 |
| Tauri 验证 | 命令 `pnpm tauri dev` / `pnpm tauri build` | TC-12-012 ~ TC-12-013 |

---

*创建日期：2026-05-14*  
*对应 Issue：[#12 Monorepo 结构迁移](../.scratch/knowledge-base/issues/12-monorepo-migration.md)*
