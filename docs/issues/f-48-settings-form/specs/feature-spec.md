---
issue: f-48
type: feature-spec
status: draft
---

# f-48 Settings 配置表单 功能规格

## 用户故事

**作为** GoferBot 用户
**我需要** 在 Settings 页面中修改应用配置（LLM 提供商、通用偏好）
**以便** 个性化应用行为，并在未保存时收到离开提醒

## 数据模型

### 表单数据分为两层

| 层级 | 数据 | 来源 | 持久化 |
|------|------|------|--------|
| **通用偏好** | `language`、`theme`、`notification` | 本地 state | localStorage（组件自管或 store 扩展） |
| **模型配置** | LLM Provider 配置（openai/claude/deepseek/custom/ollama + embedding + temperature + defaultChatProvider） | f-41 `useSettingsStore` | `saveConfig()` → 后端 API + persist |

> **PRD 偏差说明**：f-48 issue 摘要提及"语言/主题/通知"，但阻塞依赖 f-41（settings store）的数据模型当前仅覆盖 LLM Provider 配置（`AppConfig`）。通用偏好字段（language/theme/notification）在 f-41 spec 中不存在。本 spec 将通用偏好作为**前端本地状态**管理（不依赖后端 API），若后续需要后端持久化这些字段，需扩展 f-41 数据模型。

### 通用偏好类型

```typescript
interface GeneralPreferences {
  language: 'zh-CN' | 'en-US'
  theme: 'light' | 'dark' | 'auto'
  notification: boolean
}
```

### 模型配置类型（来自 f-41）

```typescript
// 由 f-41 useSettingsStore 提供，详见 f-41 specs/feature-spec.md
// 核心字段：
// - config.providers.{openai,claude,deepseek,custom,ollama}
// - config.embeddingProvider (含 enabled 开关，默认 false)
// - config.temperature
// - config.defaultChatProvider
```

### EmbeddingConfigSection `enabled` 开关

Embedding 配置区新增 `enabled: boolean` 字段，与 Provider 配置（如 Ollama）的 `enabled` 对称：

- **默认值**：`false`（Embedding 功能默认关闭）
- **`enabled = false`** 时：Embedding 配置区折叠或置灰，仅显示 `enabled` Switch（关闭态），API Key / Base URL 字段隐藏，不参与 Zod 校验和提交
- **`enabled = true`** 时：展开配置表单，显示 Provider 选择器、API Key 输入框（含显隐切换）、Model 输入框、Base URL 输入框，API Key 和 Base URL 按需校验
- **独立性**：用户可独立启用/禁用 Embedding 功能，不影响其他 Provider 配置

## 功能边界

### 包含

- 通用偏好表单：语言 `<select>`、主题 `<RadioGroup>`、通知 `<Switch>`
- 模型配置表单：多提供商 Tab（OpenAI/Claude/DeepSeek/自定义/Ollama）+ 嵌入模型 + 温度滑块 + 默认提供商
- Zod 前端验证（每项配置的合法范围，与后端 `SettingsDto` schema 对齐）
- 保存按钮 + 重置按钮（调用 f-41 store `saveConfig` / `resetToSaved`）
- 未保存提示：`useBlocker`（路由切换拦截）+ `enableBeforeUnload`（浏览器关闭/刷新拦截）
- 保存成功/失败 toast 提示
- 保存中 loading 态（按钮禁用 + spinner）
- 表单 dirty 状态追踪（通用偏好本地 + 模型配置复用 f-41 `isDirty`）
- 密码字段（API Key）显隐切换
- API Key 脱敏显示（已保存的 key 显示 `****`）
- Embedding 配置 `enabled` 开关（`boolean`，默认 `false`）：见上方「EmbeddingConfigSection `enabled` 开关」章节

### 不包括

- 后端 `/api/settings` 端点创建（已存在于 `packages/server/src/modules/settings/`）
- Settings Store 实现（f-41 负责）
- 主题切换的实际 DOM 操作（由主题系统独立处理，本功能只负责修改配置值）
- 语言国际化实际切换（由 i18n 系统独立处理）

## 涉及页面/组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `SettingsPage` | `packages/web/src/routes/app/settings.tsx` | 路由页面，组合各区块 |
| `GeneralPreferencesSection` | `packages/web/src/components/settings/GeneralPreferencesSection.tsx` | 通用偏好表单 |
| `ProviderConfigSection` | `packages/web/src/components/settings/ProviderConfigSection.tsx` | LLM 提供商配置表单 |
| `ProviderTabForm` | `packages/web/src/components/settings/ProviderTabForm.tsx` | 单个提供商的 apiKey/model/baseUrl 表单 |
| `EmbeddingConfigSection` | `packages/web/src/components/settings/EmbeddingConfigSection.tsx` | 嵌入模型配置（含 `enabled` 开关） |
| `SettingsFormActions` | `packages/web/src/components/settings/SettingsFormActions.tsx` | 保存/重置按钮 + toast |

## 相关功能

| 功能 | 关系 | 说明 |
|------|------|------|
| f-41 settings store | **上游（阻塞）** | 提供 `config`/`updateConfig`/`saveConfig`/`resetToSaved`/`isDirty`/`loadConfig` |
| f-33 auth store | **上游** | 提供用户身份（显示用户信息） |
| 主题系统 | **下游** | 读取 `theme` 配置值执行主题切换 |
| i18n 系统 | **下游** | 读取 `language` 配置值切换语言 |

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 通用偏好（语言/主题/通知）使用前端本地状态，不依赖后端 API | f-41 数据模型未覆盖这些字段；纯前端偏好不需要后端持久化 | 是（后续可扩展 f-41） |
| 模型配置表单使用 f-41 store，复用其 dirty 追踪和持久化 | f-48 阻塞于 f-41，必须对齐其接口 | 否 |
| 未保存提示使用 TanStack Router `useBlocker` + `enableBeforeUnload` | TanStack Start 原生支持，无需自定义实现 | 否 |
| Zod schema 前端复用 `packages/data/` 或内联定义 | 对齐后端 `SettingsDto` 验证规则，保持前后端一致 | 是（若 data 包未就绪可先内联） |
| 提供商配置使用 Tab 切换（非手风琴/展开） | 与旧 Vue 版一致，减少用户学习成本 | 是 |
| API Key 输入框支持显隐切换（眼睛图标） | 安全 UX 惯例 | 否 |
| 已保存的 API Key 脱敏显示（`****`） | 安全最佳实践 | 否 |
| Embedding 配置默认 `enabled = false` | 降低首次使用门槛，仅需用户主动按需开启 | 是 |
