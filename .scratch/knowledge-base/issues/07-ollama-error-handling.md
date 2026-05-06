Status: needs-triage

## What to build

实现 Ollama 本地模型支持，以及全局错误处理、Loading 状态和空状态引导。

端到端行为：用户在设置页启用 Ollama → 配置本地地址（默认 `http://localhost:11434`）和模型名 → 保存后 Ollama 出现在对话页模型切换下拉中 → 用户选择 Ollama 模型 → 发送消息 → sidecar 调用 Ollama API（兼容 OpenAI 格式的 chat completion）→ SSE 流式返回 → 前端正常渲染。当 API Key 无效、网络断开、Ollama 服务未启动时，前端显示友好的错误提示（非 alert，而是消息流中的错误卡片或 toast）。AI 思考时显示 Loading 指示器。空知识库、空历史、空会话时显示引导性空状态。

## Acceptance criteria

- [ ] Sidecar 支持 Ollama 调用：配置地址和模型，通过 OpenAI 兼容 API 格式请求
- [ ] Ollama SSE 流式响应与现有消息渲染兼容
- [ ] 设置页 Ollama 配置：启用开关、地址输入、模型输入
- [ ] 全局错误处理：API 错误（401/429/500）、网络错误、sidecar 不可达
- [ ] 错误展示：对话消息流中的错误卡片（可重试）或全局 toast
- [ ] AI 思考 Loading 状态：消息流底部显示闪烁光标或"思考中..."
- [ ] 空状态引导：
  - 空知识库："点击添加文件导入文档"
  - 空历史："开始一次新对话，历史将显示在这里"
  - 空会话首页：快捷提问胶囊
- [ ] 输入框禁用状态：sidecar 未就绪或 LLM 未配置时禁用发送

## Blocked by

- [02-basic-chat](../02-basic-chat.md) — 必须先有基础对话能力
- [05-settings-multi-provider](../05-settings-multi-provider.md) — 必须先有设置页和配置系统

## Comments
