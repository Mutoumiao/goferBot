# ADR 0001: 引入 Node.js Hono Sidecar 作为业务层

## 状态

已接受 (Accepted)

## 上下文

本项目是基于 Tauri v2 的桌面应用，需要实现：
- LLM 问答（流式 SSE 对话）
- RAG 检索增强（Embedding、向量相似度搜索）
- LangChain 文档处理（分块、索引）
- SQLite 数据持久化
- 多提供商 LLM API 集成（OpenAI、Claude、DeepSeek、Ollama）

Tauri 提供了两种主要方式来连接前端与后端能力：

1. **Tauri IPC（Rust 后端暴露命令）**
   - 前端通过 `invoke()` 调用 Rust 函数
   - Rust 直接处理业务逻辑，或调用外部进程
   - 前端与后端是紧密耦合的 IPC 调用关系

2. **独立 Sidecar 进程**
   - Tauri Rust 层仅负责窗口管理和进程生命周期
   - 业务逻辑运行在独立的 Node.js HTTP 服务中
   - 前端通过标准 HTTP `fetch()` 与 sidecar 通信

## 决策

采用 **Node.js Hono Sidecar** 作为全部业务逻辑的承载层。Tauri Rust 层仅负责：
- 窗口管理
- Sidecar 进程的启动、监控和自动重启
- 文件系统 I/O 中转（前端选择文件 → Rust 读取 → HTTP POST 到 sidecar）
- 提供 `appData` 路径

前端 Vue 应用直接通过 `fetch()` 调用 sidecar 的 HTTP API。

## 权衡

### 优势

1. **LangChain/Node 生态可用**：RAG 核心依赖 LangChain（文档加载器、文本分割器、向量存储抽象），这些库在 Node.js 生态最成熟。在 Rust 中重新实现等价功能成本极高。
2. **团队技能栈匹配**：团队主力是 Node.js 开发工程师，使用 TypeScript 实现业务逻辑效率更高，维护成本更低。
3. **HTTP 接口的标准化**：sidecar 提供标准 REST/SSE API，前后端通过 OpenAPI/类型定义协作，调试和测试更直观（可用 curl、Postman）。
4. **Rust 代码量最小化**：避免在 Rust 中编写复杂的 HTTP client、LLM 流式处理、Embedding 调用逻辑。

### 劣势

1. **多进程复杂度**：多了一个 Node.js 进程需要管理（启动、端口分配、崩溃重启、生命周期监控）。
2. **端口管理**：sidecar 需要监听 localhost 端口（默认 11451，冲突时递增），需要 `.sidecar-port` 文件和端口变更通知机制。
3. **启动时序**：应用启动时需要等待 sidecar ready，前端需要 Loading/Splash 状态。
4. **包体积**：需要打包 Node.js 二进制和 sidecar 代码，增加安装包体积。
5. **Tauri CSP 配置**：需要允许 `http://localhost:*`，放宽了默认安全策略。

### 被拒绝的替代方案

- **Rust 直接实现业务逻辑**：使用 `candle`、`ort` 等 Rust ML 生态。拒绝原因：生态不成熟，RAG 相关的文档处理、Embedding、向量检索缺乏开箱即用的库，开发周期不可控。
- **前端直连 LLM API**：Vue 前端直接调用 OpenAI/Claude API，无需 sidecar。拒绝原因：RAG 需要本地向量存储和检索，API Key 需要安全存储（不能纯前端暴露），无法做本地文件索引。
- **Tauri IPC + Rust HTTP client**：Rust 后端封装所有 LLM/RAG 调用。拒绝原因：Rust 异步 HTTP + SSE 流式处理代码复杂度高，LangChain 无 Rust 版本，团队维护成本高。

## 后果

1. 项目需要维护 `server/` 目录（Hono 服务代码）和 `src-tauri/` 目录（Rust 进程管理代码）。
2. 前端与 sidecar 的通信契约需要明确定义（OpenAPI / TypeScript 共享类型）。
3. 需要建立 sidecar 健康检查、崩溃重启、端口发现的完整机制（详见启动时序设计）。
4. 第一版 sidecar 为本地单用户服务，不做认证和请求限流。
