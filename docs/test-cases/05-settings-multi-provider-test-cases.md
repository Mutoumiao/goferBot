# Issue #05 — 设置页与多提供商 LLM 配置 测试用例

**对应 Issue**: `.scratch/knowledge-base/issues/05-settings-multi-provider.md`
**状态**: ready-for-agent
**测试框架**: Vitest（前端 Unit + 组件）、Node 环境 Vitest（Sidecar API）

---

## 5.1 Sidecar API — 配置读取与保存

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-05-001 | `GET /settings` 返回默认结构 | `config.json` 不存在 | 发送 GET 请求 | 返回 200，包含 `providers`、`embeddingProvider`、`temperature`、`defaultChatProvider` 字段，默认 `temperature = 0.7` |
| TC-05-002 | `GET /settings` 读取已有配置 | `config.json` 存在且内容完整 | 发送 GET 请求 | 返回 200，内容与磁盘文件一致 |
| TC-05-003 | `GET /settings` 密码字段脱敏 | `config.json` 中 providers.openai.apiKey = "sk-xxx" | 发送 GET 请求 | 返回的 apiKey 为掩码形式（如 `"sk-...xxx"` 或 `""`），不包含完整密钥 |
| TC-05-004 | `POST /settings` 保存配置成功 | 发送合法配置 body | 发送 POST 请求 | 返回 200，`config.json` 内容更新为请求 body |
| TC-05-005 | `POST /settings` 密码字段加密存储 | body 中包含明文 apiKey | 保存后读取 `config.json` | 磁盘文件中 apiKey 为加密或安全存储形式，非明文 |
| TC-05-006 | `POST /settings` 验证 providers 结构 | body 中 `providers` 为数组而非对象 | 发送 POST 请求 | 返回 400，错误提示 providers 必须为对象 |
| TC-05-007 | `POST /settings` 验证 temperature 范围 | `temperature = 3.0` | 发送 POST 请求 | 返回 400，错误提示 temperature 范围为 0-2 |
| TC-05-008 | `POST /settings` 空 providers 允许 | `providers = {}` | 发送 POST 请求 | 返回 200，配置保存成功 |
| TC-05-009 | `GET /settings` 后 `POST /settings` 数据一致 | 先 GET，再 POST 修改，再 GET | 连续请求 | 第二次 GET 返回最新保存的数据（密码字段脱敏不影响） |

**已有/待补充自动化测试**: `tests/unit/server/settings.test.ts`（待创建）
**覆盖范围**: TC-05-001 ~ TC-05-009

---

## 5.2 Sidecar API — 数据库 Schema 与会话模型快照

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-05-010 | `sessions` 表包含 `provider` 列 | Sidecar 启动后 | `PRAGMA table_info(sessions)` | 包含 `provider` 列（TEXT 类型） |
| TC-05-011 | `sessions` 表包含 `model` 列 | Sidecar 启动后 | `PRAGMA table_info(sessions)` | 包含 `model` 列（TEXT 类型） |
| TC-05-012 | 新建会话写入 provider/model 快照 | `defaultChatProvider = "openai"` | `POST /sessions` 创建会话 | `sessions` 表中该记录的 `provider` = "openai"，`model` 为对应模型 |
| TC-05-013 | 指定 provider 创建会话 | body 包含 `provider = "claude"` | `POST /sessions` | 新会话的 `provider` = "claude" |
| TC-05-014 | `GET /sessions/:id` 返回 provider/model | 会话已创建且带有 provider/model | 发送 GET 请求 | 响应体包含 `provider` 和 `model` 字段 |
| TC-05-015 | 旧会话无 provider/model 时兼容 | 数据库中旧记录的 `provider = null` | `GET /sessions/:id` | 返回 200，`provider` 和 `model` 为 `null` 或默认值，不报错 |
| TC-05-016 | `PATCH /sessions/:id` 可更新 provider/model | 会话已存在 | 发送 PATCH，body 含 `provider = "deepseek"` | 记录更新，`provider` = "deepseek" |

**已有/待补充自动化测试**: `tests/unit/server/dbSchema.test.ts`（扩展）、`tests/unit/server/sessions.test.ts`（扩展）
**覆盖范围**: TC-05-010 ~ TC-05-016

---

## 5.3 前端 — Settings 页面结构与导航

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-05-017 | 点击齿轮图标打开设置页 | 主界面已挂载 | 点击左侧齿轮图标 | 路由跳转到 `/settings`，设置页渲染 |
| TC-05-018 | 设置页为单例标签 | 已打开设置页 | 再次点击齿轮图标 | 不新建标签，聚焦到已有设置页 |
| TC-05-019 | 设置页渲染三个卡片区域 | 设置页已打开 | 观察 DOM | 存在 "LLM 提供商配置"、"Embedding API 配置"、"通用设置" 三个区域 |
| TC-05-020 | 设置页加载时请求 `GET /settings` | mock `sidecarFetch` | 挂载 SettingsPage | 组件挂载后调用 `sidecarFetch('GET', '/settings')` |
| TC-05-021 | 设置页保存时请求 `POST /settings` | 表单已填写，mock `sidecarFetch` | 点击保存按钮 | 调用 `sidecarFetch('POST', '/settings', body)`，body 包含当前表单值 |
| TC-05-022 | 保存成功显示提示 | mock POST 返回 200 | 点击保存 | 显示成功提示（如 toast 或文本） |
| TC-05-023 | 保存失败显示错误 | mock POST 返回 400 | 点击保存 | 显示错误提示，表单数据保留 |

**已有/待补充自动化测试**: `tests/unit/views/SettingsPage.test.ts`（待创建）
**覆盖范围**: TC-05-017 ~ TC-05-023

---

## 5.4 前端 — LLM 提供商配置卡片

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-05-024 | 显示所有提供商 tab/列表 | 设置页已挂载 | 观察 LLM 配置区域 | 显示 OpenAI、Claude、DeepSeek、自定义、Ollama 五个选项 |
| TC-05-025 | 每个提供商可独立配置 Key | 切换到 OpenAI tab | 输入 API Key | 表单值更新，仅影响 OpenAI 配置 |
| TC-05-026 | 每个提供商可独立配置模型 | 切换到 Claude tab | 输入模型名称 "claude-3-opus" | 表单值更新，仅影响 Claude 配置 |
| TC-05-027 | 每个提供商可独立配置 Base URL | 切换到 DeepSeek tab | 输入 Base URL | 表单值更新，仅影响 DeepSeek 配置 |
| TC-05-028 | API Key 输入框为密码类型 | 设置页已挂载 | 观察输入框 | `type="password"`，内容不可见 |
| TC-05-029 | Ollama 有额外启用开关 | 切换到 Ollama tab | 观察表单 | 存在启用/禁用开关（toggle 或 checkbox） |
| TC-05-030 | Ollama 未启用时禁用其他字段 | Ollama 开关为 off | 尝试输入模型和地址 | 模型和地址输入框 disabled |
| TC-05-031 | 切换 tab 保留各提供商数据 | OpenAI 已填 Key，切换到 Claude 再切回 | 切换 tab | OpenAI 的 Key 仍显示已填写内容 |
| TC-05-032 | 自定义提供商名称可编辑 | 切换到自定义 tab | 输入提供商名称 | 表单值更新，保存时纳入 `providers.custom` |

**已有/待补充自动化测试**: `tests/unit/components/LlmProviderConfig.test.ts`（待创建）
**覆盖范围**: TC-05-024 ~ TC-05-032

---

## 5.5 前端 — Embedding 配置与通用设置卡片

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-05-033 | Embedding 区域显示提供商选择 | 设置页已挂载 | 观察 Embedding 区域 | 存在提供商下拉框或输入框 |
| TC-05-034 | Embedding 区域可配置 API Key | 设置页已挂载 | 输入 Key | 表单值更新 |
| TC-05-035 | Embedding 区域可配置模型 | 设置页已挂载 | 输入模型名称 | 表单值更新 |
| TC-05-036 | Embedding 区域可配置 Base URL | 设置页已挂载 | 输入 Base URL | 表单值更新 |
| TC-05-037 | 温度滑块范围 0-2 | 通用设置区域已挂载 | 观察滑块 | `min = 0`，`max = 2`，默认 `value = 0.7` |
| TC-05-038 | 温度滑块数值实时显示 | 拖动滑块到 1.5 | 操作滑块 | 旁边显示当前数值 "1.5" |
| TC-05-039 | 默认提供商选择下拉 | 通用设置区域已挂载 | 观察下拉框 | 显示 "默认对话提供商"，选项为已配置的提供商列表 |

**已有/待补充自动化测试**: `tests/unit/components/EmbeddingConfig.test.ts`、`tests/unit/components/GeneralSettings.test.ts`（待创建）
**覆盖范围**: TC-05-033 ~ TC-05-039

---

## 5.6 前端 — 对话页顶部模型切换

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-05-040 | 对话页顶部显示当前模型名称 | 当前会话 provider = "openai"，model = "gpt-4o" | 打开对话页 | 顶部显示 "GPT-4o" 或 "gpt-4o" |
| TC-05-041 | 点击模型名称弹出下拉列表 | 模型名称已显示 | 点击 | 下拉列表出现，列出所有已配置的提供商模型 |
| TC-05-042 | 下拉列表只显示已配置提供商 | providers 中只有 openai 和 claude | 打开下拉 | 列表只包含 openai 和 claude 的模型，不含未配置的 deepseek |
| TC-05-043 | 选择新模型后更新当前会话 | mock `PATCH /sessions/:id` | 点击下拉中的 "claude-3-opus" | 发送 PATCH 请求更新会话 provider/model，顶部显示切换后的模型 |
| TC-05-044 | 模型切换不改变全局默认 | `defaultChatProvider = "openai"` | 在会话 A 中切换到 claude | `config.json` 中 `defaultChatProvider` 仍为 "openai" |
| TC-05-045 | 下拉列表支持键盘导航 | 下拉已打开，有 3 个选项 | 按 ArrowDown 两次 | 高亮索引从 0 → 1 → 2，按 Enter 选中 |
| TC-05-046 | 按 Escape 关闭下拉 | 下拉已打开 | 按 Escape | 下拉关闭 |
| TC-05-047 | 无已配置提供商时显示占位文本 | providers 为空 | 打开对话页 | 顶部显示 "未配置模型" 或类似提示，下拉不可点击 |

**已有/待补充自动化测试**: `tests/unit/components/ChatModelSelector.test.ts`（待创建）
**覆盖范围**: TC-05-040 ~ TC-05-047

---

## 5.7 前端 — Session Store 与模型配置

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-05-048 | `createSession` 使用全局 `defaultChatProvider` | `defaultChatProvider = "openai"` | 调用 `createSession()` | `POST /sessions` 的 body 中 `provider` = "openai" |
| TC-05-049 | `createSession` 携带默认模型 | `providers.openai.model = "gpt-4o"` | 调用 `createSession()` | body 中 `model` = "gpt-4o" |
| TC-05-050 | `updateSessionModel` 发送 PATCH | mock `sidecarFetch` | 调用 `updateSessionModel('session-1', 'claude', 'claude-3-opus')` | 发送 `PATCH /sessions/session-1`，body 含 `provider` 和 `model` |
| TC-05-051 | 当前会话 model 变化后 UI 响应 | store 中 `currentSession.provider` 被修改 | 通过 action 更新 | 顶部模型选择器显示新模型名称（响应式） |
| TC-05-052 | 历史会话列表显示模型信息 | `sessions` 数组中某条 provider = "deepseek" | 渲染 SessionList | 会话项旁边显示 "DeepSeek" 或对应模型名 |
| TC-05-053 | `loadSession` 恢复时包含 provider/model | mock `GET /sessions/:id` 返回 provider/model | 调用 `loadSession('id')` | `currentSession.provider` 和 `currentSession.model` 被正确赋值 |

**已有/待补充自动化测试**: `tests/unit/stores/sessionModel.test.ts`（待创建）
**覆盖范围**: TC-05-048 ~ TC-05-053

---

## 5.8 前端 — Settings Store

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-05-054 | `fetchSettings` 调用 `GET /settings` | mock `sidecarFetch` | 调用 `fetchSettings()` | 发送 `GET /settings`，响应写入 `settings` state |
| TC-05-055 | `saveSettings` 调用 `POST /settings` | mock `sidecarFetch`，state 已更新 | 调用 `saveSettings()` | 发送 `POST /settings`，body 为当前 state |
| TC-05-056 | `settings` state 包含完整多提供商结构 | `fetchSettings` 成功返回 | 检查 state | `state.providers.openai`、`state.embeddingProvider`、`state.temperature` 等字段存在 |
| TC-05-057 | `defaultChatProvider` 从 settings 读取 | settings state 中 `defaultChatProvider = "claude"` | 读取 `defaultChatProvider` getter | 返回 "claude" |
| TC-05-058 | 更新单个提供商配置不丢失其他提供商 | 已有 openai 和 claude 配置，修改 openai.model | 调用 action 更新 | `settings.providers.claude` 保持不变 |

**已有/待补充自动化测试**: `tests/unit/stores/settings.test.ts`（待创建）
**覆盖范围**: TC-05-054 ~ TC-05-058

---

## 5.9 Sidecar API — LLM 调用使用会话级配置

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-05-059 | `streamChatCompletion` 读取会话 provider | 会话 provider = "deepseek"，config.json 中有 deepseek 配置 | 调用函数 | API 请求发送到 deepseek 的 baseUrl，使用对应 apiKey |
| TC-05-060 | `streamChatCompletion` 读取会话 model | 会话 model = "deepseek-chat" | 调用函数 | API 请求 body 中 `model = "deepseek-chat"` |
| TC-05-061 | `streamChatCompletion` 使用全局 temperature | `config.json` 中 `temperature = 1.2` | 调用函数 | API 请求参数中包含 `temperature = 1.2` |
| TC-05-062 | 会话 provider 未配置时回退到默认 | 会话 provider = null，默认 openai | 调用函数 | 使用 openai 配置发送请求 |
| TC-05-063 | 未配置任何 provider 时抛出清晰错误 | providers 为空，会话 provider = "openai" | 调用函数 | 抛出 `Error: Provider openai is not configured` |

**已有/待补充自动化测试**: `tests/unit/server/chatSettings.test.ts`（待创建）
**覆盖范围**: TC-05-059 ~ TC-05-063

---

## 5.10 集成 — 端到端配置链路

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-05-064 | 设置页保存 → config.json 更新 → 新建会话使用默认 | 设置页已打开 | 1. 填写 openai 配置 2. 设置默认提供商为 openai 3. 保存 4. 新建会话 | 新会话的 provider = "openai"，对话调用使用 openai 配置 |
| TC-05-065 | 切换模型 → 仅当前会话生效 → 新建会话仍用默认 | 已有两个会话 | 1. 在会话 A 切换到 claude 2. 新建会话 B | 会话 A provider = "claude"，会话 B provider = 全局默认 |
| TC-05-066 | 历史会话恢复显示当时模型 | 旧会话 provider = "openai"，model = "gpt-3.5" | 点击恢复该会话 | 顶部显示 "gpt-3.5"，对话调用使用 openai 配置 |
| TC-05-067 | Ollama 启用后出现在模型选项中 | Ollama 开关打开，地址填写 | 保存后打开对话页下拉 | 列表中出现 Ollama 模型选项 |
| TC-05-068 | 温度设置影响对话请求 | 温度设置为 1.5 | 发送消息 | LLM API 请求中 temperature = 1.5 |

**测试层**: 手动集成测试 / Tauri 集成测试（当前项目未配置完整 E2E，核心逻辑由单元测试覆盖）
**覆盖范围**: TC-05-064 ~ TC-05-068

---

## 待补充的自动化测试

| TC-ID 范围 | 测试层 | 建议方案 |
|---|---|---|
| TC-05-001 ~ TC-05-009 | Sidecar Settings API | 创建 `tests/unit/server/settings.test.ts`，mock `fs` 读写 `config.json` |
| TC-05-010 ~ TC-05-016 | Sidecar Schema + Sessions | 扩展 `tests/unit/server/dbSchema.test.ts` 验证 sessions 表列；扩展 sessions API 测试 |
| TC-05-017 ~ TC-05-023 | Settings 页面结构 | 创建 `tests/unit/views/SettingsPage.test.ts`，mock `sidecarFetch` 和路由 |
| TC-05-024 ~ TC-05-032 | LLM 提供商配置组件 | 创建 `tests/unit/components/LlmProviderConfig.test.ts`，测试 tab 切换和表单绑定 |
| TC-05-033 ~ TC-05-039 | Embedding + 通用设置组件 | 创建 `tests/unit/components/EmbeddingConfig.test.ts`、`tests/unit/components/GeneralSettings.test.ts` |
| TC-05-040 ~ TC-05-047 | 模型选择器组件 | 创建 `tests/unit/components/ChatModelSelector.test.ts`，mock 已配置提供商列表 |
| TC-05-048 ~ TC-05-053 | Session Store 模型逻辑 | 创建 `tests/unit/stores/sessionModel.test.ts` |
| TC-05-054 ~ TC-05-058 | Settings Store | 创建 `tests/unit/stores/settings.test.ts`，mock `sidecarFetch` |
| TC-05-059 ~ TC-05-063 | Chat 调用配置读取 | 创建 `tests/unit/server/chatSettings.test.ts`，mock 配置和会话数据 |
| TC-05-064 ~ TC-05-068 | E2E 集成 | 建议用 Tauri 集成测试环境或 Playwright 验证（留待 #08） |

---

*文档生成日期：2026-05-08*
*对应 Issue：#05-settings-multi-provider*
