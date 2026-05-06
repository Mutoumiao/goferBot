# 项目约束（CONSTRAINTS）

本文档包含以 MUST/MUST NOT 语言书写的不可协商规则。所有贡献者在编写或修改代码前必须阅读并遵守。

## Tauri v2 核心约束

### 命令注册

- **MUST** 将每个 `#[tauri::command]` 函数显式注册到 `tauri::generate_handler![cmd1, cmd2, ...]` 宏中。未注册的命令会在前端调用时静默失败。
- **MUST** 从命令函数返回 `Result<T, E>`，以支持正确的跨 IPC 边界错误传播。
- **MUST NOT** 在异步命令（`async fn`）的参数中使用借用类型（如 `&str`）。异步命令必须使用 owned types（如 `String`），因为数据无法跨 await 点借用。

### 项目结构

- **MUST** 将所有应用逻辑、命令定义、状态管理和 Builder 配置放在 `src-tauri/src/lib.rs` 的 `run()` 函数中。
- **MUST** 保持 `src-tauri/src/main.rs` 为 thin passthrough，仅调用 `app_lib::run()`。此拆分是移动端构建的硬性要求，Tauri 在移动目标上会替换 `main()`。
- **MUST** 在 `lib.rs` 的 `pub fn run()` 上标注 `#[cfg_attr(mobile, tauri::mobile_entry_point)]`。

### 权限与能力（Capabilities）

- **MUST** 在使用任何 Tauri 核心功能或插件功能前，先在 `src-tauri/capabilities/default.json`（或相应能力文件）中声明权限。Tauri v2 默认拒绝所有操作。
- **MUST NOT** 安装插件后跳过权限配置。缺少插件权限字符串会导致静默运行时失败，表现为功能无响应而非显式报错。
- **MUST** 确保 `src-tauri/capabilities/default.json` 中至少包含 `"core:default"`。

### 状态管理

- **MUST** 对需要从多个命令访问的可变共享状态使用 `std::sync::Mutex<T>`（或 `tokio::sync::Mutex<T>`）。
- **MUST NOT** 在 `State<T>` 的类型签名中使用与 `.manage()` 注册时不完全一致的类型，否则会导致 panic。

### 路径与 I/O

- **MUST NOT** 在任何命令中硬编码文件系统路径（如 `"C:\\Users\\..."` 或 `"/home/..."`）。
- **MUST** 使用 Tauri 路径 API（`tauri::path::BaseDirectory` 或 `tauri::Manager::path()`）获取系统级目录。
- **MUST NOT** 在主线程中执行阻塞性 I/O 操作。所有文件读写、网络请求必须通过异步命令或独立线程完成。

### IPC 边界规则

- **MUST** 确保所有命令参数实现 `serde::Deserialize`，所有返回类型实现 `serde::Serialize`。
- **MUST** 确保自定义错误类型实现 `serde::Serialize`，否则错误无法正确序列化传递到前端。
- **MUST** 在前端使用 `@tauri-apps/api/core` 中的 `invoke`（v1 的 `@tauri-apps/api/tauri` 在 v2 中已移除）。

### Cargo.toml 配置

- **MUST** 在 `src-tauri/Cargo.toml` 中保留 `[lib]` 节，且 `crate-type` 必须同时包含 `["staticlib", "cdylib", "rlib"]`，这是跨平台构建的硬性要求。

## 前端约束

### 框架与依赖

- **MUST** 使用 Vue 3 Composition API 编写组件。
- **MUST** 使用 `pnpm` 作为包管理器。
- **MUST NOT** 在渲染进程中直接调用 Node.js API 或进行文件系统 I/O；所有文件操作必须通过 Tauri IPC 命令委托给 Rust 后端。

### 样式

- **MUST** 使用 Tailwind CSS v4 管理样式。禁止直接编写内联 `<style>` 块（除非覆盖第三方组件样式）。

## 构建与部署

- **MUST** 在发布构建前运行 `pnpm type-check` 和 `pnpm check`（`cargo check`），确保 TypeScript 和 Rust 侧均无编译错误。
- **MUST NOT** 使用未签名的更新包或 HTTP 端点分发更新。生产环境更新必须使用 `cargo tauri signer generate` 生成的密钥签名，并通过 HTTPS 端点提供。
