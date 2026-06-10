# tests/ — 仓库级测试目录

> 本文档是 `tests/` 目录的快速导读。完整规范见 `docs/guide/testing/README.md`。

---

## 架构原则

| 测试类型     | 存放位置                     | 理由                                                     |
|--------------|------------------------------|----------------------------------------------------------|
| **单元测试** | `packages/*/src/` — 跟随源码 | 测试与代码同目录，IDE 重构时一起移动，无需跨目录相对路径 |
| **集成测试** | `tests/integration/`         | 跨模块联调，不属于单个 package                           |
| **E2E 测试** | `tests/e2e/`                 | 系统级行为，跨 web → server → db                         |

> **核心判断**：测试边界决定存放位置。Unit Test 边界是"单个模块"，放 package 内。Integration/E2E 边界是"系统行为"，放根目录。

---

## 目录结构

```
tests/
├── integration/              # 后端 API 集成测试（真实 DB + HTTP 请求）
│   ├── *.spec.ts             # 按 Controller 分文件
│   └── helpers/              # TestAppFactory / AuthFixtures / DB Manager
├── e2e/                      # 浏览器端到端测试（Playwright）
│   ├── specs/                # 单页面功能
│   ├── flows/                # 跨模块用户旅程
│   ├── pages/                # Page Object
│   └── fixtures/             # auth / database / api-client
│   │   ├── success/          # 成功截图
│   │   └── failure/          # 失败截图
└── README.md                 # 本文件

packages/
├── web/tests/**/*.test.tsx     # 前端单元测试
├── server/tests/**/*.spec.ts   # 后端单元测试（已迁移完成）
└── rag-sdk/tests/**/*.test.ts  # SDK 单元测试（已迁移完成）
```

---

## 路径别名

| 别名            | 指向                   | 配置位置                            | 适用场景             |
|-----------------|------------------------|-------------------------------------|----------------------|
| `@server`       | `packages/server/src`  | 根 `vitest.config.ts`               | 跨包引用 server 源码 |
| `@web`          | `packages/web/src`     | 根 `vitest.config.ts`               | 跨包引用 web 源码    |
| `@rag-sdk`      | `packages/rag-sdk/src` | 根 `vitest.config.ts`               | 跨包引用 SDK 源码    |
| `@` （web）     | `packages/web/src`     | `packages/web/vitest.config.ts`     | web 包内部自引用     |
| `@` （server）  | `packages/server/src`  | `packages/server/vitest.config.ts`  | server 包内部自引用  |
| `@` （rag-sdk） | `packages/rag-sdk/src` | `packages/rag-sdk/vitest.config.ts` | SDK 包内部自引用     |

---

## 快速命令

```bash
pnpm test                    # 全部单元测试（扫描 packages 内 .spec.ts / .test.ts）
pnpm test:integration        # 全部集成测试
pnpm test:e2e                # 全部 E2E 测试
pnpm test:all                # 全量回归（unit + integration + e2e）
```

---

## 关联文档

| 文档                                              | 内容                                                     |
|---------------------------------------------------|----------------------------------------------------------|
| `docs/guide/testing/README.md`                    | 测试体系总览、金字塔、分层职责、覆盖率门槛               |
| `docs/guide/testing/unit-testing-guide.md`        | Vitest 单元测试规范（React / Zustand / NestJS / Worker） |
| `docs/guide/testing/integration-testing-guide.md` | NestJS API 集成测试规范（真实数据库 + HTTP）             |
| `docs/guide/testing/e2e-testing-guide.md`         | Playwright E2E 测试规范（Page Object / Fixtures）        |
| `docs/testing/e2e-coverage.md`                    | E2E 用例覆盖清单                                         |
