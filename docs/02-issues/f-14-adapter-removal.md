状态: closed
分类: enhancement

## 完成情况

本 issue 记录架构改革中 `shellAdapters` 和 `backendAdapters` 包的移除过程，作为历史归档供后续参考。

## 改革内容

### 移除的包

| 包名 | 路径 | V1 职责 | 移除原因 |
|------|------|---------|----------|
| `@goferbot/shell-adapters` | `packages/shellAdapters/` | Tauri IPC 封装：Sidecar 端口发现、文件导入、事件监听 | Tauri 冻结，Web 应用无需 IPC |
| `@goferbot/backend-adapters` | `packages/backendAdapters/` | HTTP 传输层：通过 Shell 获取端口后 fetch | Server 使用固定端口，直接 fetch 即可 |

### 影响的前端文件

| 文件 | 变更 |
|------|------|
| `packages/webui/src/App.vue` | 移除 `provideShell(createShell())`、移除 `initSidecarStatus()`、改用 `<RouterView />` |
| `packages/webui/src/stores/session.ts` | `getBackend()` → `apiRequest` / `apiSubscribe` |
| `packages/webui/src/stores/knowledgeBase.ts` | `getBackend()` / `getShell()` → `apiRequest`；`importFiles()` 签名改为接受 `FileList` |
| `packages/webui/src/stores/settings.ts` | `getBackend()` → `apiRequest` |
| `packages/webui/src/components/ChatPage.vue` | 移除 Sidecar 就绪轮询，移除 `getBackend()` |
| `packages/webui/src/components/MoveCopyDialog.vue` | `getBackend()` → `apiRequest` |
| `packages/webui/src/composables/useSidecarStatus.ts` | **已删除** |
| `packages/webui/src/components/SplashScreen.vue` | **已删除** |
| `packages/webui/src/stores/knowledgeBase.spec.ts` | **已删除**（依赖已不存在的 adapter） |

### 新增的文件

| 文件 | 职责 |
|------|------|
| `packages/webui/src/api/client.ts` | 临时 API 客户端（`apiRequest` + `apiSubscribe`） |
| `packages/webui/src/router/index.ts` | vue-router 配置 |

### 依赖变更

- `packages/webui/package.json`：移除 `@goferbot/shell-adapters`、`@goferbot/backend-adapters`
- `packages/webui/package.json`：新增 `vue-router`

## 阻塞于

- 无（已完成）

## 范围外

- `i-07-api-client`（将临时 client 升级为标准化客户端）
- `src-tauri/` 目录的删除（按冻结政策保留在 git 中）

## Agent 简报

**分类：** enhancement
**摘要：** 记录 shellAdapters/backendAdapters 移除过程和迁移映射

**当前行为：**
已完成移除，前端通过 `api/client.ts` 直接与 Server 通信。

**期望行为：**
本 issue 作为历史记录，供后续排查问题时参考。

**关键接口：**
- 已删除：`packages/shellAdapters/`、`packages/backendAdapters/`
- 替代：`packages/webui/src/api/client.ts`

**验收标准：**
- [x] shellAdapters 包删除
- [x] backendAdapters 包删除
- [x] 所有引用更新为 api/client
- [x] vue-router 引入
- [x] Sidecar 相关组件/组合式函数删除

**范围外：**
- api-client 标准化（i-07）
- src-tauri 删除
