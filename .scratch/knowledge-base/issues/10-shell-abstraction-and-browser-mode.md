Status: open
Category: enhancement

## What to build

提取 **Shell** 模块将前端与 Tauri 宿主环境解耦，使 Web 应用可在不启动 Tauri 的情况下独立运行（浏览器直连 Sidecar）。

端到端行为：
- **浏览器模式**：开发者运行 `pnpm dev` → Vite dev server 启动 → 前端检测到非 Tauri 环境 → `BrowserShell` 使用固定端口（`VITE_SIDECAR_PORT` 或默认 11451）连接本地 Sidecar → 应用完整运行，无需 Tauri
- **Tauri 模式**：应用打包后启动 → `TauriShell` 通过 IPC 获取端口、监听进程事件、调用原生文件对话框 → 行为与当前完全一致
- **测试改善**：单元测试注入 `MemoryShell` 适配器，无需 mock `@tauri-apps/api/core`；E2E 测试在浏览器模式中自动使用 `BrowserShell`，无需 `page.addInitScript` 注入 `__TAURI_INTERNALS__` 伪造

## Acceptance criteria

- [ ] 定义 `Shell` 接口，涵盖全部前端与宿主环境的交互点：
  - `getSidecarPort(): Promise<number | null>` — 获取 Sidecar HTTP 端口
  - `onSidecarReady(handler): Promise<Unlisten>` — 监听 sidecar-ready 事件
  - `onSidecarRestarted(handler): Promise<Unlisten>` — 监听 sidecar-restarted 事件
  - `restartSidecar(): Promise<void>` — 请求重启 Sidecar
  - `importFiles(knowledgeBaseId, targetPath): Promise<void>` — 打开文件对话框并导入
- [ ] 实现 `TauriShell` 适配器：使用 `@tauri-apps/api/core` 的 `invoke` 和 `@tauri-apps/api/event` 的 `listen`
- [ ] 实现 `BrowserShell` 适配器：固定端口（从 `import.meta.env.VITE_SIDECAR_PORT` 读取，默认 11451），`importFiles` 使用 HTML `<input type="file">` 读取并通过 `sidecarFetch` POST 到 Sidecar
- [ ] 实现 `MemoryShell` 适配器（测试专用）：所有方法返回可控值，支持测试注入
- [ ] 运行时自动检测环境：通过 `typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window` 判断，或使用 `import.meta.env.DEV` + 显式标志
- [ ] 替换所有直接调用 Tauri API 的源码位置：
  - `src/composables/useSidecar.ts` — 改用 `Shell.getSidecarPort` / `Shell.onSidecarReady` / `Shell.onSidecarRestarted` / `Shell.restartSidecar`
  - `src/stores/knowledgeBase.ts` — `importFiles` 改用 `Shell.importFiles`
- [ ] 更新单元测试：
  - `tests/unit/composables/useSidecar.test.ts` — 注入 `MemoryShell` 替代 mock `@tauri-apps/api/core`
  - `tests/unit/components/SplashScreen.test.ts` — 同上
  - `tests/unit/stores/knowledgeBase*.test.ts` — `importFiles` 测试改用 `MemoryShell`
- [ ] 更新 E2E 测试：
  - `tests/e2e/mocks/tauri-ipc.ts` — 改为提供 `MemoryShell` 实例，或完全移除（浏览器模式自动生效）
  - 所有 `tests/e2e/specs/*.spec.ts` — 移除 `injectMockTauri(page)` 调用
- [ ] 浏览器模式验证：运行 `pnpm dev`（不启动 Tauri）→ 前端自动以 `BrowserShell` 运行 → 可连接本地 Sidecar（端口 11451）→ 所有核心功能可用（对话、知识库浏览、历史记录）
- [ ] 文件导入在浏览器模式下使用标准 HTML 文件选择 → 读取 FileList → 批量 POST JSON 到 Sidecar `/knowledge-bases/:id/files`

## Blocked by

- [09-end-to-end-testing](../09-end-to-end-testing.md) — E2E 测试基础设施是验证本重构的基线

## Related

- [#11-backend-transport-unification](../11-backend-transport-unification.md) — 候选 2，依赖本 Issue 完成后执行

## Comments

> 本 issue 是架构重构的第一阶段，不引入新功能。目标是提升 testability 和 AI-navigability，使 Tauri 真正成为"壳"而非应用逻辑的一部分。
>
> 与 ADR-0001 的关系：ADR-0001 已规定"Tauri Rust 层仅负责窗口管理和进程生命周期"，本 issue 是在前端代码层面落实该决策——前端不再直接感知 Tauri 存在。
>
> 与 ADR-0005 的关系：ADR-0005 的三阶 E2E 模型中，阶1当前需要 mock Tauri IPC。本重构完成后，阶1在浏览器模式下运行时将不再需要 mock，因为 `BrowserShell` 本身就是真实适配器。

## Agent Brief

**Category:** enhancement
**Summary:** 提取 Shell 模块将前端与 Tauri 解耦，使 Web 应用可在浏览器中独立运行。消除前端代码中对 `@tauri-apps/api` 的直接依赖，所有宿主交互通过 `Shell` 接口进行。

**Current behavior:**
- 前端 3 个文件直接导入 `@tauri-apps/api/core`、`@tauri-apps/api/event`
- `useSidecar.ts` 直接调用 `invoke('get_sidecar_port')` 和 `listen('sidecar-ready')`
- `knowledgeBase.ts` 直接调用 `invoke('import_files')`
- E2E 测试必须注入 `window.__TAURI_INTERNALS__` 伪造脚本（依赖 Tauri 内部结构，脆弱）
- 无浏览器模式检测，前端无法在 Tauri 外运行

**Desired behavior:**
- 前端零文件直接导入 `@tauri-apps/api/*`——所有 Tauri 交互通过 `Shell` 接口
- 运行 `pnpm dev` 可在纯浏览器环境运行，自动连接本地 Sidecar
- 单元测试通过 `MemoryShell` 注入控制所有宿主交互，无需模块级 mock
- E2E 测试在浏览器模式下自动使用 `BrowserShell`，无需 `injectMockTauri`

**Key interfaces:**
- `Shell` — 前端与宿主环境的唯一 seam。适配器：`TauriShell`、`BrowserShell`、`MemoryShell`
- `Unlisten` — `( ) => void`，事件取消订阅函数
- 环境检测：`isTauri() => boolean` — 运行时检测当前宿主

**Acceptance criteria:**
- [ ] `Shell` 接口定义完成，3 个适配器实现（TauriShell、BrowserShell、MemoryShell）
- [ ] 所有直接 Tauri API 调用替换为 Shell 方法（useSidecar、knowledgeBase store）
- [ ] 浏览器模式可运行：`pnpm dev` → 前端自动连接 localhost:11451 Sidecar
- [ ] 单元测试更新：useSidecar、SplashScreen、knowledgeBase 测试使用 MemoryShell
- [ ] E2E 测试更新：移除 tauri-ipc.ts mock，浏览器模式自动生效
- [ ] `pnpm test` 全部通过，`pnpm test:e2e` 全部通过

**Out of scope:**
- 替换 Tauri 为 Electron 或其他壳层（本重构使未来替换成为可能，但不在本 issue 执行）
- Sidecar 本身的业务逻辑变更
- Rust 层代码变更（`src-tauri/` 不变）
- 新的 UI 功能或页面
- BackendTransport 统一（由 #11 负责）
