# 架构说明（Architecture）

## 总体架构

本应用采用 Tauri v2 的经典 WebView + Rust 后端架构：

```
┌─────────────────────────────────────────┐
│           渲染进程（Renderer）            │
│         Vue 3 + Pinia + Tailwind        │
│              src/                       │
├─────────────────────────────────────────┤
│           IPC（invoke / emit）           │
├─────────────────────────────────────────┤
│           主进程（Main Process）          │
│              Rust                       │
│           src-tauri/src/                │
└─────────────────────────────────────────┘
```

## 前端（`src/`）

| 文件/目录 | 职责 |
|-----------|------|
| `main.ts` | Vue 应用入口。创建应用实例、挂载 Pinia、连接 Vue Devtools（开发模式） |
| `App.vue` | 根组件。当前为模板页面，承载 `GreetComponent` |
| `components/GreetComponent.vue` | 示例组件，演示 IPC 调用和 Pinia 状态绑定 |
| `store.ts` | Pinia 全局 store。管理 `isInitialized`、`version`、`name` 等应用级状态 |
| `assets/main.css` | Tailwind CSS 入口和全局样式 |

## 后端（`src-tauri/src/`）

| 文件 | 职责 |
|------|------|
| `lib.rs` | 应用逻辑核心。包含所有 Tauri 命令、插件初始化、Builder 配置 |
| `main.rs` | 薄透传层。仅调用 `tauri_app_lib::run()`，满足移动端构建要求 |

## 当前命令（Commands）

| 命令名 | 位置 | 功能 | 状态 |
|--------|------|------|------|
| `greet` | `lib.rs` | 接收 `name` 参数，返回问候语 | 示例代码，待替换为业务命令 |

## 数据目录

应用启动时由主进程初始化：

```
<userData>/knowledge-base/
├── docs/              # 导入的文档
├── qa-history.json    # 问答历史
└── config.json        # 用户配置
```

## 依赖关系

- 前端 → 后端：通过 `@tauri-apps/api/core` 的 `invoke` 调用命令
- 后端 → 前端：通过 `Emitter` 发送事件（当前未使用）
- 状态同步：前端使用 Pinia；后端使用 `tauri::State`（当前未使用）

## 未来扩展点

- 文档导入命令（`import_document`）
- 问答历史 CRUD 命令
- 配置读写命令
- 后端状态管理（`tauri::State<AppState>`）
