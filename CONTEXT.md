# 领域上下文（Domain Context）

本文档定义知识库应用的核心领域概念和术语。所有问题描述、架构决策和代码中的命名应遵循本词汇表。

## 核心概念

### 知识库（Knowledge Base）

用户在本应用中创建和维护的本地文档集合。知识库的数据存储在系统用户数据目录下的 `knowledge-base/` 文件夹中。

### 文档（Document）

用户导入的文本文件，支持 Markdown（`.md`）和纯文本（`.txt`）格式。文档原文件保存在 `knowledge-base/docs/` 目录下。

### 问答历史（QA History）

用户与系统交互的问答记录，以 JSON 格式持久化到 `knowledge-base/qa-history.json`。

### 导入（Import）

将外部文档文件复制到应用数据目录 `knowledge-base/docs/` 的过程。由主进程（Rust）执行，渲染进程（Vue）通过 IPC 触发。

### 主进程（Main Process）

Tauri 的 Rust 后端进程，负责文件系统 I/O、数据目录初始化和系统级 API 调用。对应 `src-tauri/src/`。

### 渲染进程（Renderer Process）

Tauri 的 WebView 前端进程，运行 Vue 3 应用。禁止直接访问文件系统；所有 I/O 需求通过 IPC 委托给主进程。对应 `src/`。

## 命名约定

- 前端 Pinia store 使用 `useStore`（通过 `unplugin-auto-import` 自动导入）
- Rust 命令使用 `snake_case`
- TypeScript/Vue 使用 `camelCase`
- 组件文件使用 `PascalCase.vue`
