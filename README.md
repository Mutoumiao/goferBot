# GoferBot

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-24C8D8?logo=tauri" alt="Tauri v2">
  <img src="https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs" alt="Vue 3">
  <img src="https://img.shields.io/badge/Rust-1.7+-000000?logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
</p>

**GoferBot** 是一款基于 **Tauri v2 + Vue 3 + Node.js Hono Sidecar** 的本地知识库桌面应用。支持导入 Markdown、TXT 等文档进行管理，通过多 LLM 提供商进行智能问答，并基于 **RAG 检索增强**（向量搜索 + 全文搜索混合排序）提供上下文感知的精准回答。所有数据存储在本地，无需联网即可使用。

> **本项目是个人代表项目，从零到一完整实践 Harness Engineering 开发方法论。** 基于 `mu-*` 系列 Skills（`mu-grill-docs`、`mu-prd`、`mu-issues`、`mu-plan`、`mu-dev`、`mu-verify`）驱动全流程交付，涵盖领域建模、架构决策、任务拆分、子代理并行实现与交付验证。

***

## 项目亮点

### 1. 完整的 RAG 检索增强系统

- **混合搜索策略**：`sqlite-vec` HNSW 向量索引（语义相似度）+ **FTS5 全文索引**（关键词匹配），通过 RRF 融合排序提升召回率
- **细粒度检索控制**：支持 `@知识库名称` 提及触发 RAG，每条消息独立选择检索范围，非全局开关
- **后台索引队列**：批量导入文件时自动排队处理，前端实时显示索引进度，避免卡死 UI

### 2. 分层架构与职责边界

采用 Monorepo 组织的多层架构，UI、适配层、服务层各自独立：

| 层 | 职责 | 技术选型 | 路径 |
| -- | ---- | -------- | ---- |
| **Tauri Rust** | 桌面壳：窗口管理、Sidecar 生命周期监控、高性能文件 I/O 中转 | Rust | `src-tauri/` |
| **Hono Sidecar** | 全部业务逻辑：LLM 问答、RAG、LangChain、SQLite、Embedding API | TypeScript + Hono | `packages/server/` |
| **Vue 3 前端** | UI 渲染、状态管理 | Vue 3 + Pinia + Tailwind CSS v4 | `packages/webui/` |
| **Shell 适配层** | 前端与宿主环境解耦（Tauri / Browser / Memory）| TypeScript | `packages/shellAdapters/` |
| **Backend 适配层** | 前端与 Sidecar 通信统一（HTTP 请求、SSE、重试）| TypeScript | `packages/webui/src/backend/` |

**文件导入链路设计**：前端通过 `Shell.importFiles()` → Tauri 模式下 Rust 打开对话框并读取文件 → HTTP POST 到 Sidecar；浏览器模式下使用标准 HTML 文件选择 → 批量 POST 到 Sidecar。该设计解决了 Tauri v2 中前端临时文件权限与 Sidecar 独立进程之间的访问隔离问题，同时支持浏览器模式独立运行。

### 3. 多 LLM 提供商与每会话模型切换

- 支持 **OpenAI、Claude、DeepSeek、Ollama** 等多个提供商同时配置
- 每会话可独立切换模型，不影响全局默认配置
- 会话表记录 `provider` + `model` 快照，恢复历史会话时保持当时使用的模型信息

### 4. 完整的知识库文件管理

- 知识库 = 物理子目录（`docs/<知识库名>/`），用户可直接在文件系统查看
- 支持文件夹层级浏览、面包屑导航、文件名搜索
- 右键菜单操作：置顶、修改资料（名称/图标）、删除（回收站恢复）
- 文件操作：新建文件夹、行内重命名、跨库移动/复制、物理删除（差异化二次确认）

***

## 功能特性

| 模块           | 功能                                            |
| ------------ | --------------------------------------------- |
| **智能问答**     | 流式 SSE 对话、Markdown 渲染、代码语法高亮 + 复制按钮、首页占位符自动升格 |
| **RAG 检索**   | `@提及` 触发知识库检索、多知识库同时检索、混合搜索（向量+全文）、检索来源引用     |
| **知识库管理**    | 新建/删除/置顶/修改资料、文件夹层级浏览、文件导入、回收站恢复              |
| **文件操作**     | 新建文件夹、行内重命名、跨库移动/复制、物理删除、命名冲突自动处理             |
| **多 LLM 支持** | OpenAI / Claude / DeepSeek / Ollama，每会话独立切换   |
| **问答历史**     | 会话列表、历史恢复、重命名、删除                              |
| **设置**       | 多提供商 API Key 配置、Embedding API 配置、温度参数滑块       |

***

## 架构决策（ADR）

本项目所有重大架构决策均通过 **ADR（Architecture Decision Records）** 形式记录，确保设计意图可追踪、可复盘。

## Harness Engineering 实践

本项目完整实践了 Harness Engineering 开发方法论，使用 `mu-*` 系列 Skills 覆盖软件交付全生命周期：

```
需求澄清 → 规划拆分 → 依赖检查 → 并行实现 → 代码审查 → 验收验证 → 架构优化 → 分支收尾
```

<br />

**工程纪律体现：**

- **事务驱动**：所有功能以 Markdown Issue 形式跟踪，含明确的 `Acceptance criteria` 和 `Blocked by` 依赖声明
- **设计先行的文档化**：每个功能开发前通过 `mu-grill-docs` 确认领域术语和架构决策，避免返工
- **状态机管理**：Issue 遵循 7 状态生命周期（`needs-triage` → `ready-for-agent` → `in-progress` → `ready-for-review` → `verified` → `completed`）
- **验证即完成**：禁止在未经验证的情况下声明完成，`mu-verify` 强制运行测试与类型检查

***

## 技术栈

| 层级         | 技术                                                | 说明                                 |
| ---------- | ------------------------------------------------- | ---------------------------------- |
| 前端框架       | Vue 3 + TypeScript + Vite                         | Composition API、响应式状态管理            |
| 桌面框架       | Tauri v2 (Rust)                                   | 轻量桌面壳、高性能文件 I/O、Sidecar 生命周期管理     |
| Sidecar 服务 | Node.js + Hono                                    | 全部业务逻辑、LLM API 调用、RAG 检索、SQLite 操作 |
| 状态管理       | Pinia                                             | 会话、知识库、标签页、设置等模块状态                 |
| CSS 框架     | Tailwind CSS v4                                   | 原子化样式、自定义主题                        |
| 图标方案       | @egoist/tailwindcss-icons + Material Design Icons | 统一图标体系                             |
| 测试框架       | Vitest + @vue/test-utils                          | 组件测试、Store 测试、工具函数测试               |
| 包管理器       | pnpm workspace                                    | Monorepo 依赖管理、跨包引用               |

***

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/)（建议 LTS 版本）
- [Rust](https://rustup.rs/)
- [pnpm](https://pnpm.io/)

### 安装依赖

```bash
pnpm install
```

### 构建所有包

```bash
pnpm -r build
```

### 启动开发模式

```bash
# 启动 webui Vite dev server 和 Vue Devtools
pnpm dev
```

### Tauri 开发模式

```bash
pnpm tauri dev
```

### 构建生产版本

```bash
pnpm build
```

### 检查与测试

```bash
# Rust 代码检查
pnpm check

# 运行单元测试
pnpm test

# 运行集成测试
pnpm test:integration

# 运行 E2E 测试
pnpm test:e2e

# 运行全部测试（单元 + 集成 + E2E）
pnpm test:all

# TypeScript 类型检查（所有 workspace 包）
pnpm type-check
```

### 常用脚本说明

| 脚本 | 作用 |
|------|------|
| `pnpm dev` | **同时启动前后端**（Sidecar + Vite dev server） |
| `pnpm dev:web` | 只启动前端（Vite dev server，浏览器模式下使用浏览器扩展调试 Vue） |
| `pnpm dev:server` | 只启动后端 Sidecar（tsx watch 模式，直接运行 TS 源码） |
| `pnpm dev:tauri` | Tauri 开发模式（启动 Vite + 独立 Vue Devtools 进程，用于桌面端调试） |
| `pnpm build` | 构建 webui 生产版本 |
| `pnpm preview` | 预览 webui 生产构建 |
| `pnpm -r build` | 构建所有 workspace 包（server、shell-adapters、backend-adapters、rag-sdk、webui） |
| `pnpm test` | 运行根目录单元测试（Vitest，含组件、store、composable 测试） |
| `pnpm test:integration` | 运行集成测试（启动真实 Sidecar 进程，测试 API 端点） |
| `pnpm test:e2e` | 运行 E2E 测试（Playwright，浏览器级交互测试） |
| `pnpm test:all` | 顺序运行单元 + 集成 + E2E 全部测试 |
| `pnpm type-check` | 对所有 workspace 包运行 TypeScript 类型检查 |
| `pnpm check` | 运行 `cargo check` 检查 Rust 代码 |
| `pnpm tauri <cmd>` | 运行 Tauri CLI 命令（如 `pnpm tauri dev`、`pnpm tauri build`） |

***

## 数据目录结构

应用启动时在系统用户目录下创建 `knowledge-base/` 子目录：

```
knowledge-base/
  docs/                  # 用户导入的文档（按知识库分子目录）
  .trash/                # 回收站（被删除的知识库物理移动至此）
  sidecar.db             # SQLite（会话、消息、知识库、文档块、向量索引、全文索引）
  config.json            # 用户配置（LLM provider、API Key、温度等）
  .sidecar-port          # Sidecar 实际监听端口
```

***

## 开发规范

本项目遵循严格的 Tauri v2 开发约束，详见 [`CONSTRAINTS.md`](./CONSTRAINTS.md)。核心规则：

- 所有 Rust 命令必须注册到 `generate_handler!` 宏中
- 异步命令参数禁止使用借用类型（`&str`）
- 渲染进程禁止直接访问文件系统，所有 I/O 通过 IPC 委托给 Rust 后端
- 所有插件功能使用前必须在 `capabilities/default.json` 中声明权限

***

## 相关文档

| 文档                                                                     | 说明                                          |
| ---------------------------------------------------------------------- | ------------------------------------------- |
| [`CLAUDE.md`](./CLAUDE.md)                                             | 项目全局指南（编码规范、注意事项、Worktree 开发规范）             |
| [`CONSTRAINTS.md`](./CONSTRAINTS.md)                                   | Tauri v2 不可协商规则                             |
| [`CONTEXT.md`](./CONTEXT.md)                                           | 领域术语表与关键设计决策                                |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                                 | 架构说明与模块职责                                   |
| [`docs/prd-v1.md`](./docs/prd-v1.md)                                   | 产品需求文档（PRD）v1                               |
| [`docs/adr/`](./docs/adr/)                                             | 架构决策记录（ADR）                                 |
| [`docs/test-cases/`](./docs/test-cases/)                               | 测试用例（按 Issue 编号独立文件，如 `01-*.md`、`03b-*.md`） |
| [`.scratch/knowledge-base/issues/`](./.scratch/knowledge-base/issues/) | Issue 跟踪（含验收标准与依赖声明）                        |
| [`PROGRESS.md`](./PROGRESS.md)                                         | 项目进度追踪（Issue 执行状态与后续开发计划）                   |

***

## 许可证

[MIT](./LICENSE)
