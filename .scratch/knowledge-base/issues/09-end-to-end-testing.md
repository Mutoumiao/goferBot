Status: in-progress
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
- [ ] `pnpm test:integration` 命令可运行 Sidecar 集成测试（独立 Vitest 配置）
- [x] `.gitignore` 已排除 `tests/e2e/report/`、`test-results/`、`playwright-report/`
- [ ] GitHub Actions CI 新增 `e2e` job，在 push/PR 时自动运行阶1和阶2

### 阶1：前端 E2E（Playwright + mock IPC）
- [x] `tests/e2e/mocks/tauri-ipc.ts` 支持 mock `invoke` 和 `event.listen`，可注入到任意 page
- [ ] `tests/e2e/mocks/http-routes.ts` 统一拦截 sidecar HTTP 请求，返回预设 mock 数据（当前分散在各 spec 的 `page.route` 中）
- [ ] Page Object Model 完整：`ChatPage` ✅、`KnowledgeBasePage` ✅、`HistoryPage` ❌、`SettingsPage` ❌
- [x] `tests/e2e/specs/kb-context-menu.spec.ts` —— 已覆盖 3 个核心场景（右键弹出菜单/点击外部关闭/新建知识库后出现在列表），剩余 9 个场景待补充
  - E2E-01~04：知识库列表右键（置顶/修改资料/移入回收站/弹窗文案）—— 仅覆盖 E2E-04（弹窗文案隐含验证）
  - E2E-05~10：文件区域右键（新建文件夹/重命名/移动/复制/冲突处理/永久删除）—— 待补充
  - E2E-11~12：回收站（入口可见/恢复/同名重命名）—— 待补充
- [ ] `tests/e2e/specs/settings.spec.ts` —— 覆盖 #05 配置页交互：设置页导航/tab 单例/表单保存/错误提示
- [ ] `tests/e2e/specs/chat-history.spec.ts` —— 覆盖 #06 历史页交互：打开历史页/列表渲染/恢复会话/删除/重命名/标签同步
- [x] `tests/e2e/specs/chat-mention.spec.ts` —— 覆盖 #04 @提及交互：输入 `@` 弹出/选择/pill 渲染/发送携带 kbIds（3 条用例全部通过）
- [x] 前端关键组件已添加 `data-testid` 属性，确保 Playwright 选择器稳定

### 阶2：Sidecar 集成测试（真实进程 + 临时目录）
- [ ] `tests/integration/setup.ts` 提供 `startSidecar(tmpDir)` 和 `stopSidecar()`，自动管理 sidecar 进程生命周期
- [ ] `tests/integration/mocks/embedding-server.ts` 提供 mock Embedding API（OpenAI 兼容格式），返回固定维度向量
- [ ] `tests/integration/mocks/llm-server.ts` 提供 mock LLM API（SSE 流式响应）
- [ ] `vitest.integration.config.ts` 独立配置，使用 `pool: 'forks'` 确保进程隔离
- [ ] `tests/integration/sidecar/rag-flow.spec.ts` —— 覆盖 #04 的 5 个端到端场景：
  - TC-04-066：文件导入 → 自动索引 → 可检索
  - TC-04-067：`@提及` → 选择知识库 → 发送 → 检索生效
  - TC-04-068：重建索引后旧数据不残留
  - TC-04-069：跨知识库检索
  - TC-04-070：未提及知识库时不触发 RAG
- [ ] `tests/integration/sidecar/index-sync.spec.ts` —— 覆盖 #04b 的 20 个场景：
  - TC-04b-001~004：跨库移动后索引同步
  - TC-04b-005~008：跨库复制后索引同步
  - TC-04b-009~012：知识库重命名后索引同步
  - TC-04b-013~016：文件重命名后索引同步
  - TC-04b-017~020：边界与异常（vec 无需更新/队列入队参数/无索引不报错/批量一致性）
- [ ] `tests/integration/sidecar/sessions.spec.ts` —— 覆盖 #06 的会话 API：列表/重命名/删除级联
- [ ] `tests/integration/sidecar/settings-api.spec.ts` —— 覆盖 #05 的配置读写：默认结构/脱敏/加密存储/验证
- [ ] `tests/integration/sidecar/sidecar-lifecycle.spec.ts` —— 覆盖 #01 的 6 个场景：端口发现/健康检查/自动重启/退避/优雅关闭

### 阶3：全链路验收（Tauri + WebView2）
- [ ] `tests/e2e-full/playwright.config.ts` 配置 CDP 连接（`ws://127.0.0.1:9222`）
- [ ] `tests/e2e-full/setup.ts` 提供 `launchTauriApp()`，通过 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 暴露调试端口
- [ ] `tests/e2e-full/specs/smoke.spec.ts` —— 3 条核心用户旅程：
  - 创建知识库 → 导入文件 → 验证索引进度
  - 对话中 `@提及` → 发送消息 → 验证 LLM 回答包含检索内容
  - 设置页保存配置 → 新建会话 → 验证使用默认模型
- [ ] Tauri `tauri.conf.json` 或构建脚本支持 debug 模式暴露 WebView2 CDP 端口

### 测试统计
- [ ] 手动验证场景从 40+ 降至 0
- [ ] 阶1 测试文件 ≥ 4 个，用例 ≥ 30 条
- [ ] 阶2 测试文件 ≥ 5 个，用例 ≥ 40 条
- [ ] 阶3 测试文件 ≥ 1 个，用例 ≥ 3 条

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
- 已有 34 个单元测试文件、236 条用例全部通过（Vitest）
- 阶1 前端 E2E 已搭建完成并稳定运行：
  - `tests/e2e/playwright.config.ts` 配置完成（Chromium + Vite dev server + HTML 报告）
  - `tests/e2e/mocks/tauri-ipc.ts` 完成，支持 `invoke`/`listen` mock 注入
  - `tests/e2e/fixtures/knowledge-bases.ts` 提供 mock 数据
  - `tests/e2e/pages/ChatPage.ts` 和 `KnowledgeBasePage.ts` Page Object 完成
  - `tests/e2e/specs/kb-context-menu.spec.ts` 3 条用例全部通过（右键菜单/点击外部关闭/新建知识库）
  - `tests/e2e/specs/chat-mention.spec.ts` 3 条用例全部通过（@弹出/选择/pill/发送携带 kbIds）
  - 前端关键组件已添加 `data-testid`（ChatInput、KbMentionDropdown、KbMentionPill、ContextMenu、FileExplorer、ChatMessageList、ChatMessage 等）
  - `pnpm test:e2e` / `test:e2e:ui` / `test:e2e:codegen` / `test:all` 均已配置到 package.json
- 阶2 Sidecar 集成测试完全未搭建（无 `tests/integration/` 目录、无 `vitest.integration.config.ts`）
- 阶3 全链路验收完全未搭建（无 `tests/e2e-full/` 目录）
- 40+ 手动验证场景仍有约 34 个未脚本化（#03b 文件操作 9 个、#05 设置页 4 个、#06 历史页 6 个、#01 生命周期 6 个、#04 RAG 流程 5 个、#04b 索引同步 4 个）

**Desired behavior:**
运行 `pnpm test:all` 时，依次执行单元测试、阶1 前端 E2E、阶2 Sidecar 集成测试，全部自动通过。Release 前执行 `pnpm test:e2e:full` 验证打包后的 Tauri 应用。所有手动验证场景均有对应的自动化脚本。

**Key interfaces:**
- **阶1**：Playwright + Vite dev server + `page.addInitScript({ content: mockTauri })` + `page.route()` 拦截 HTTP
- **阶2**：Vitest + `child_process.spawn('node', ['server/dist/index.js'])` + 临时数据目录 + MSW/本地 mock server
- **阶3**：Playwright `chromium.connectOverCDP('ws://127.0.0.1:9222')` + Tauri 打包产物
- **CI**：GitHub Actions `playwright install chromium` + `pnpm test:e2e` + `pnpm test:integration`

**Acceptance criteria:**
- [x] `pnpm test:e2e` 可运行阶1 前端 E2E（当前 6 条，目标 ≥30 条）
- [ ] `pnpm test:integration` 可运行阶2 Sidecar 集成（≥40 条用例）
- [ ] `pnpm test:e2e:full` 可运行阶3 全链路验收（≥3 条用例）
- [x] 前端组件关键元素均有 `data-testid` 属性（基础组件已完成，新页面需持续补充）
- [ ] GitHub Actions CI 自动运行阶1和阶2
- [ ] 手动验证场景从 40+ 降至 0（当前剩余约 34 个）

**Out of scope:**
- 性能测试和压力测试
- 视觉回归测试（screenshot diff）
- 跨平台 E2E（当前聚焦 Windows/WebView2）
- 移动端适配测试
