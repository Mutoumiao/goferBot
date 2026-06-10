# 测试体系总览

## 1. 测试金字塔与分层

```
        /\
       /  \     E2E — 用户旅程（最少）
      /----\
     /      \   集成 — API + 真实 DB（中等）
    /--------\
   /          \ 单元 — 函数/组件/Service（最多）
  /------------\
```

| 层级 | 位置 | 命令 | 配置 | 指南 |
|------|------|------|------|------|
| **单元** | `packages/*/tests/` | `pnpm test` | `vitest.config.ts` | [unit](./unit-testing-guide.md) |
| **集成** | `tests/integration/` | `pnpm test:integration` | `vitest.integration.config.ts` | [integration](./integration-testing-guide.md) |
| **E2E** | `tests/e2e/` | `pnpm test:e2e` | `playwright.config.ts` | [e2e](./e2e-testing-guide.md) |

## 2. 为什么 Unit 放 package 内、Integration/E2E 放根目录

**核心判断：测试边界决定存放位置。**

| 测试类型 | 边界 | 位置 | 原因 |
|----------|------|------|------|
| Unit | 单个函数/Service/组件 | `packages/*/tests/` | 跟随源码，IDE 重构随动，无需相对路径地狱 |
| Integration | Controller + DB | `tests/integration/` | 跨模块联调，不属于单一 package |
| E2E | web → server → db | `tests/e2e/` | 系统级行为，跨整个应用栈 |

## 3. 目录结构

```
packages/{web,server,rag-sdk}/tests/
  └── **/*.{spec,test}.{ts,tsx}    ← 单元测试按分类目录存放

tests/
├── integration/              # API 集成测试
│   ├── *.spec.ts              # 按 Controller 分文件
│   └── helpers/               # TestAppFactory / AuthFixtures / DB Manager
├── e2e/                      # Playwright E2E 测试
│   ├── specs/                 # 单页面功能
│   ├── flows/                 # 跨模块用户旅程
│   ├── pages/                 # Page Object
│   ├── fixtures/              # auth / database
│   └── mocks/                 # Mock 路由
└── setup/                    # 全局配置（testglobals / integration-env）
```

## 4. Issue 前缀 → 测试位置

| 前缀 | 轨道 | 测试位置 | 层级 |
|------|------|----------|------|
| `f-XX` | 前端 | `packages/web/src/features/` 对应目录 | 单元 |
| `b-XX` | 后端 | `packages/server/src/` 或 `tests/integration/` | 单元/集成 |
| `i-XX` | 基础设施 | `tests/integration/` | 集成 |
| `q-XX` | 质量 | `tests/e2e/` 或 `tests/integration/` | E2E/集成 |
| `d-XX` | 设计 | — | — |

## 5. 路径别名

> 消除 `../../../packages/...` 相对路径地狱。

| 别名 | 指向 | 配置位置 |
|------|------|----------|
| `@` | `./src` | `packages/{web,server,rag-sdk}/vitest.config.ts`（包内自引用） |
| `@server` | `packages/server/src` | 根 `vitest.config.ts`（跨包引用） |
| `@web` | `packages/web/src` | 根 `vitest.config.ts`（跨包引用） |
| `@rag-sdk` | `packages/rag-sdk/src` | 根 `vitest.config.ts`（跨包引用） |

```ts
// ❌ 旧
import { AuthService } from '../../../packages/server/src/auth/auth.service.js'
// ✅ 同目录（单元测试跟随源码时最佳）
import { AuthService } from './auth.service'
// ✅ 别名（跨包引用）
import { AuthService } from '@server/auth/auth.service'
```

## 6. 文件命名

| 后缀 | 用途 | 用例命名 |
|------|------|----------|
| `.spec.ts` / `.spec.tsx` | Issue 验收测试（TDD） | 必须以 `AC-XX:` 开头 |
| `.test.ts` / `.test.tsx` | 通用单元测试 | 描述式，无 AC-XX 要求 |

## 7. 快速命令

```bash
pnpm test                 # 全部单元测试
pnpm test:integration     # 全部集成测试
pnpm test:e2e             # 全部 E2E 测试
pnpm test:all             # 全量回归
pnpm vitest run -t "AC-01"   # 按验收标准过滤
pnpm vitest --ui              # UI 模式
```

## 8. 覆盖率门槛

| 层级 | 行 | 函数 | 分支 | 语句 |
|------|-----|------|------|------|
| 前端单元 | 70% | 60% | 55% | 70% |
| 后端单元 | 60% | 50% | 40% | 60% |
| 集成 | — | — | — | — |
| E2E | — | — | — | — |

> 当前处于**阶段 1**：仅报告，不阻断 CI。后续阶段逐步收紧。

## 9. Mock 决策矩阵

| 依赖 | 单元 | 集成 | E2E |
|------|------|------|-----|
| PostgreSQL | ❌ Mock | ✅ 真实（每 it 独立 DB） | ✅ 共享测试 DB |
| Redis/BullMQ/MinIO | ❌ Mock | ❌ Mock | ✅ 真实（如需要） |
| 外部 API（OpenAI 等） | ❌ Mock | ❌ Mock | ❌ Mock |
| NestJS Service | ✅ 直接 new | ✅ 模块加载 | ✅ 黑盒 |

---

> 完整编写示例和模板见各层级指南。
