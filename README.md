# Knowledge Base（知识库）

基于 Tauri v2 的本地知识库桌面应用。用户可导入 Markdown、TXT 等文档进行管理，并保存问答历史记录。所有数据存储在本地系统用户目录下，无需联网即可使用。

## 功能特性

- **本地文档管理**：导入 Markdown、TXT 等文本文件，集中浏览和管理
- **问答历史**：保存与系统的问答交互记录，支持历史回溯
- **本地数据存储**：所有数据保存在系统用户目录的 `knowledge-base/` 文件夹中，隐私可控
- **跨平台**：基于 Tauri v2，支持 Windows、macOS、Linux（及未来的移动端）

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 + TypeScript + Vite |
| 桌面框架 | Tauri v2 (Rust) |
| 状态管理 | Pinia |
| CSS 框架 | Tailwind CSS v4 |
| 测试框架 | Vitest + @vue/test-utils |
| 包管理器 | pnpm |

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/)（建议 LTS 版本）
- [Rust](https://rustup.rs/)
- [pnpm](https://pnpm.io/)

### 安装依赖

```bash
pnpm install
```

### 启动开发模式

```bash
pnpm dev
```

此命令会同时启动 Vite 开发服务器和 Vue Devtools。

### 构建生产版本

```bash
pnpm build
```

### Tauri 专用命令

```bash
# Tauri 开发模式
pnpm tauri dev

# Tauri 生产构建
pnpm tauri build

# 检查 Rust 代码
pnpm check
```

## 测试

```bash
# 运行单元测试
pnpm test
```

测试配置：
- 测试文件：`tests/unit/**/*.test.ts`、`src/**/*.spec.ts`
- 覆盖率提供方：v8
- 覆盖率阈值：lines ≥ 10%, branches ≥ 10%, statements ≥ 10%

## 开发规范

本项目遵循严格的 Tauri v2 开发约束，详见 [`CONSTRAINTS.md`](./CONSTRAINTS.md)。核心规则包括：

- 所有 Rust 命令必须注册到 `generate_handler!` 宏中
- 异步命令参数禁止使用借用类型（`&str`）
- 渲染进程禁止直接访问文件系统，所有 I/O 通过 IPC 委托给 Rust 后端
- 所有插件功能使用前必须在 `capabilities/default.json` 中声明权限

## 相关文档

| 文档 | 说明 |
|------|------|
| [`CLAUDE.md`](./CLAUDE.md) | 项目全局指南（编码规范、注意事项） |
| [`CONSTRAINTS.md`](./CONSTRAINTS.md) | Tauri v2 不可协商规则 |
| [`CONTEXT.md`](./CONTEXT.md) | 领域术语表 |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | 架构说明与模块职责 |
| [`PROGRESS.md`](./PROGRESS.md) | 项目进度与待办事项 |

## 许可证

待补充
