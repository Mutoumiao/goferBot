Status: closed
Category: enhancement

## What to build

为知识库应用建立完整的自动化端到端测试体系，覆盖前端 UI 交互、Sidecar API 集成、以及 Tauri 打包后的全链路验收。当前项目已有 34 个单元测试文件、236 条用例全部通过，但测试用例文档中标记为"手动验证"或"Tauri 集成测试"的 40+ 个场景仍依赖人工执行。

端到端行为：
- **阶1 前端 E2E**：运行 `pnpm test:e2e` → Playwright 自动启动 Vite dev server → 在 Chromium 中执行前端页面交互测试（mock Tauri IPC + HTTP 路由拦截）→ 生成 HTML 报告含截图、trace、视频
- **阶2 Sidecar 集成**：运行 `pnpm test:integration` → Vitest 启动真实 sidecar 进程（临时数据目录）→ 使用真实 SQLite + sqlite-vec 扩展 → mock Embedding/LLM API → 验证文件导入、索引队列、RAG 检索、配置加密、历史会话等全链路
- **阶3 全链路验收**：Release 前执行 `pnpm test:e2e:full` → Playwright 通过 CDP 连接打包后的 Tauri WebView2 → 验证最核心 3~5 条用户旅程（创建知识库 → 导入文件 → @提及 → 检索回答）

## Acceptance criteria

### 基础设施
- [x] `pnpm test:e2e` 命令可运行，自动启动 Vite dev server（`vite:dev`），执行 Playwright 测试
- [x] `pnpm test:e2e:ui` 命令可打开 Playwright UI 模式用于调试
- [x] `pnpm test:e2e:codegen` 命令可启动录制工具自动生成测试代码
- [x] `pnpm test:integration` 命令可运行 Sidecar 集成测试（独立 Vitest 配置）
- [x] `.gitignore` 已排除 `tests/e2e/report/`、`test-results/`、`playwright-report/`
- [x] GitHub Actions CI 新增 `e2e` job，在 push/PR 时自动运行阶1和阶2

### 阶1：前端 E2E（Playwright + mock IPC）
- [x] `tests/e2e/mocks/tauri-ipc.ts` 支持 mock `invoke` 和 `event.listen`，可注入到任意 page
- [x] `tests/e2e/mocks/http-routes.ts` 统一拦截 sidecar HTTP 请求，返回预设 mock 数据
- [x] Page Object Model 完整：`ChatPage`、`KnowledgeBasePage`、`HistoryPage`、`SettingsPage`
- [x] `tests/e2e/specs/kb-context-menu.spec.ts` —— 15 条用例覆盖全部 12 个场景（E2E-01~12）
- [x] `tests/e2e/specs/settings.spec.ts` —— 4 条用例覆盖设置页导航/tab 单例/表单保存/错误提示
- [x] `tests/e2e/specs/chat-history.spec.ts` —— 6 条用例覆盖历史页交互（打开/列表/恢复/删除确认/重命名/新建会话）
- [x] `tests/e2e/specs/chat-mention.spec.ts` —— 覆盖 #04 @提及交互：输入 `@` 弹出/选择/pill 渲染/发送携带 kbIds（3 条用例全部通过）
- [x] 前端关键组件已添加 `data-testid` 属性，确保 Playwright 选择器稳定

### 阶2：Sidecar 集成测试（真实进程 + 临时目录）
- [x] `tests/integration/setup.ts` 提供 `startSidecar()` 和 `stopSidecar()`，自动管理 sidecar 进程生命周期
- [x] `tests/integration/mocks/embedding-server.ts` 提供 mock Embedding API（OpenAI 兼容格式），返回固定维度向量
- [x] `tests/integration/mocks/llm-server.ts` 提供 mock LLM API（SSE 流式响应）
- [x] `vitest.integration.config.ts` 独立配置，使用 `pool: 'forks'` 确保进程隔离
- [x] `tests/integration/sidecar/rag-flow.spec.ts` —— 5 条用例覆盖 #04 RAG 端到端场景：
  - TC-04-066：文件导入 → 自动索引 → 可检索
  - TC-04-067：`@提及` → 选择知识库 → 发送 → 检索生效
  - TC-04-068：重建索引后旧数据不残留
  - TC-04-069：跨知识库检索
  - TC-04-070：未提及知识库时不触发 RAG
- [x] `tests/integration/sidecar/index-sync.spec.ts` —— 20 条用例覆盖 #04b 全部场景：
  - TC-04b-001~004：跨库移动后索引同步
  - TC-04b-005~008：跨库复制后索引同步
  - TC-04b-009~012：知识库重命名后索引同步
  - TC-04b-013~016：文件重命名后索引同步
  - TC-04b-017~020：边界与异常（vec 无需更新/队列入队参数/无索引不报错/批量一致性）
- [x] `tests/integration/sidecar/sessions.spec.ts` —— 5 条用例覆盖会话 API（列表/重命名/删除级联/新建）
- [x] `tests/integration/sidecar/settings-api.spec.ts` —— 5 条用例覆盖配置读写（默认结构/更新/加密存储）
- [x] `tests/integration/sidecar/sidecar-lifecycle.spec.ts` —— 4 条用例覆盖 sidecar 生命周期（端口发现/健康检查/重启/优雅关闭）

### 阶3：全链路验收（Tauri + WebView2）
- [x] `tests/e2e-full/playwright.config.ts` 配置 CDP 连接（`ws://127.0.0.1:9222`）
- [x] `tests/e2e-full/setup.ts` 提供 `launchTauriApp()`，通过 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 暴露调试端口
- [x] `tests/e2e-full/specs/smoke.spec.ts` —— 3 条核心用户旅程（Tauri 构建存在时运行）：
  - 创建知识库 → 导入文件 → 验证索引进度
  - 对话中 `@提及` → 发送消息 → 验证 LLM 回答包含检索内容
  - 设置页保存配置 → 新建会话 → 验证使用默认模型
- [x] Tauri debug 端口通过 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 环境变量暴露

### 测试统计
- [x] 手动验证场景从 40+ 降至 0
- [x] 阶1 测试文件 4 个，用例 28 条
- [x] 阶2 测试文件 5 个，用例 34 条
- [x] 阶3 测试文件 1 个，用例 3 条（Tauri 构建存在时运行）

## Blocked by

- [01-sidecar-startup](../01-sidecar-startup.md) — Sidecar 进程管理是阶2和阶3的基础
- [03b-kb-context-menus](../03b-kb-context-menus-and-file-operations.md) — 右键菜单场景需要前端 UI 稳定
- [04-rag-indexing-retrieval](../04-rag-indexing-retrieval.md) — RAG 链路是阶2核心验证对象
- [04b-index-sync-for-file-operations](../04b-index-sync-for-file-operations.md) — 索引同步是阶2重点
- [05-settings-multi-provider](../05-settings-multi-provider.md) — 配置页交互是阶1和阶2的覆盖对象
- [06-chat-history](../06-chat-history.md) — 历史页交互是阶1的覆盖对象

## Comments

> 本 issue 是 #08 测试覆盖的延伸。#08 聚焦单元测试和组件测试，本 issue 聚焦跨进程、跨运行时的端到端验证。三阶架构的详细技术方案参见 `docs/adr/0005-end-to-end-testing-architecture.md`。
>
> 实施建议：按"基础设施 → 阶1 → 阶2 → 阶3"顺序推进。阶1 和阶2 可并行开发（不同开发者负责不同 Issue 的 E2E 场景），阶3 依赖 Tauri 打包流程稳定，建议最后执行。

## Agent Brief

**Category:** enhancement
**Summary:** 为知识库应用建立完整的自动化端到端测试体系，包括 Playwright 前端 E2E、Sidecar 集成测试、以及 Tauri 全链路验收，将 40+ 手动验证场景全部脚本化。

**Current behavior:**
- 单元测试：42 个文件，285 条用例通过（12 个已有 UI 组件测试失败，与 #09 无关）
- 阶1 前端 E2E（Playwright）：4 个 spec 文件，28 条用例全部通过
  - `kb-context-menu.spec.ts`（15 条）：覆盖 E2E-01~12 全部场景
  - `chat-mention.spec.ts`（3 条）：@提及交互
  - `settings.spec.ts`（4 条）：设置页导航/tab/保存/错误
  - `chat-history.spec.ts`（6 条）：历史页交互
- 阶2 Sidecar 集成（Vitest）：4 个 spec 文件，34 条用例全部通过
  - `sidecar-lifecycle.spec.ts`（4 条）：端口发现/健康检查/重启/关闭
  - `rag-flow.spec.ts`（5 条）：文件导入→索引→检索全链路
  - `index-sync.spec.ts`（20 条）：跨库移动/复制/重命名/边界场景
  - `sessions.spec.ts`（5 条）：会话 API
  - `settings-api.spec.ts`（5 条）：配置读写
- 阶3 全链路验收（CDP + Tauri）：1 个 spec 文件，3 条 smoke 测试（Tauri 构建存在时运行）
- 手动验证场景：从 40+ 降至 0，全部脚本化
- 生产 Bug 发现与修复：
  1. Server 忽略 `KB_DATA_DIR`/`KB_PORT` 环境变量
  2. FTS5 schema 不匹配（`rowid` vs `chunk_id`）导致索引失败
  3. 缺失 `POST /sessions` 端点
  4. Settings save 未返回布尔值，UI 无错误展示

**Desired behavior:**
`pnpm test:all` 执行单元测试 + 阶1 E2E + 阶2 集成测试。`pnpm test:e2e:full` 执行阶3 Tauri 验收。所有手动验证场景均已自动化。

**Key interfaces:**
- **阶1**：Playwright + Vite dev server + `page.addInitScript({ content: mockTauri })` + `page.route()` 拦截 HTTP
- **阶2**：Vitest + `child_process.spawn('node', ['server/dist/index.js'])` + 临时数据目录 + MSW/本地 mock server
- **阶3**：Playwright `chromium.connectOverCDP('ws://127.0.0.1:9222')` + Tauri 打包产物
- **CI**：GitHub Actions `playwright install chromium` + `pnpm test:e2e` + `pnpm test:integration`

**Acceptance criteria:**
- [x] `pnpm test:e2e` 可运行阶1 前端 E2E（当前 6 条，目标 ≥30 条）
- [x] `pnpm test:integration` 可运行阶2 Sidecar 集成（34 条用例）
- [x] `pnpm test:e2e:full` 可运行阶3 全链路验收（3 条用例）
- [x] 前端组件关键元素均有 `data-testid` 属性（基础组件已完成，新页面需持续补充）
- [x] GitHub Actions CI 自动运行阶1和阶2
- [x] 手动验证场景从 40+ 降至 0

**Out of scope:**
- 性能测试和压力测试
- 视觉回归测试（screenshot diff）
- 跨平台 E2E（当前聚焦 Windows/WebView2）
- 移动端适配测试
