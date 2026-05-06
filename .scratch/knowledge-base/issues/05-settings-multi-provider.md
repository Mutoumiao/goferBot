Status: needs-triage

## What to build

实现设置页和多提供商 LLM 配置。用户可以在设置页保存多个 LLM 提供商的 API Key、模型和 Base URL，并在对话页顶部快速切换当前会话使用的模型。

端到端行为：用户点击左侧齿轮图标 → 打开设置页（单例标签）→ 显示三个卡片区域：LLM 提供商配置（多 tab/列表：OpenAI、Claude、DeepSeek、自定义、Ollama，每个有 API Key 密码框、模型输入、Base URL）→ Embedding API 配置（提供商、Key、模型、Base URL）→ 通用设置（温度滑块 0-2，默认 0.7）→ 用户填写多个提供商的配置 → 点击保存 → sidecar 写入 `config.json` → 用户回到对话页 → 顶部显示当前模型名称（如"GPT-4o"）→ 点击下拉可切换为其他已配置模型 → 切换仅影响当前会话 → 新建会话继承全局默认提供商 → 每个会话在 SQLite `sessions` 表中记录 `provider` + `model` 快照。

## Acceptance criteria

- [ ] `config.json` 多提供商结构：`providers` 对象（含 openai/claude/deepseek/custom/ollama）+ `embeddingProvider` + `temperature` + `defaultChatProvider`
- [ ] Sidecar 配置 API：`GET /settings` 读取，`POST /settings` 保存（密码字段安全存储）
- [ ] 前端设置页 UI：三个卡片区域（LLM 提供商 / Embedding / 通用）
- [ ] LLM 提供商配置：多提供商列表，每个可独立配置 Key、模型、Base URL；Ollama 额外有启用开关和地址
- [ ] 对话页顶部显示当前会话使用的模型名称，点击下拉切换
- [ ] 模型切换仅影响当前会话，不改变全局默认
- [ ] 新建会话使用全局 `defaultChatProvider`
- [ ] `sessions` 表增加 `provider` + `model` 字段，记录会话创建时的配置快照
- [ ] 历史会话恢复时，显示当时使用的模型信息

## Blocked by

- [02-basic-chat](../02-basic-chat.md) — 必须先有基础对话和会话管理

## Comments
