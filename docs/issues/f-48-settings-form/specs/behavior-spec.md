---
issue: f-48
type: behavior-spec
status: draft
---

# f-48 Settings 配置表单 行为规格

## 入口

- **路由**：`/app/settings`（文件系统路由 `packages/web/src/routes/app/settings.tsx`）
- **触发**：用户点击侧栏/导航中的"设置"入口
- **鉴权**：由父路由 `/app/route.tsx` 的 `beforeLoad` 统一拦截

## 页面布局

```
┌─────────────────────────────────────────────────┐
│ 设置                                             │
│                                                 │
│ ┌─ 用户信息 ──────────────────────────────────┐ │
│ │ 用户名：xxx  邮箱：xxx                       │ │
│ └──────────────────────────────────────────────┘ │
│                                                 │
│ ┌─ Tab: [通用设置] [模型配置] ─────────────────┐ │
│ │                                               │ │
│ │  (Tab 内容区)                                  │ │
│ │                                               │ │
│ └───────────────────────────────────────────────┘ │
│                                                 │
│ ┌─ 操作区 ─────────────────────────────────────┐ │
│ │ [重置]  [保存更改]    "已保存" / "保存失败"    │ │
│ └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## 通用偏好 Tab 结构

```
┌─ 通用设置 ──────────────────────────────────────┐
│                                                 │
│  语言                                           │
│  ┌─────────────────────────────┐               │
│  │ 简体中文              ▾     │  <select>      │
│  └─────────────────────────────┘               │
│                                                 │
│  主题                                           │
│  ◉ 浅色  ○ 深色  ○ 自动        <RadioGroup>    │
│                                                 │
│  通知                                           │
│  启用通知                     [═══]  <Switch>   │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 模型配置 Tab 结构

```
┌─ 模型配置 ──────────────────────────────────────┐
│                                                 │
│  [OpenAI] [Claude] [DeepSeek] [自定义] [Ollama] │
│                                                 │
│  ┌─ OpenAI 配置 ─────────────────────────────┐  │
│  │ API Key    [••••••••••••        ] [👁]    │  │
│  │ Model      [gpt-4o              ]         │  │
│  │ Base URL   [https://api.openai. ]         │  │
│  └────────────────────────────────────────────┘  │
│                                                 │
│  ── 嵌入模型 ──────────────────────────────────  │
│  启用 Embedding              [   ]  <Switch>    │
│  (enabled=false 时以下字段隐藏，不参与校验)       │
│  提供商  [OpenAI ▾]  模型 [text-embedding-3]    │
│  API Key [••••••••        ] Base URL [...]      │
│                                                 │
│  ── 通用参数 ──────────────────────────────────  │
│  Temperature  [══════●══════] 1.0               │
│  默认提供商   [OpenAI ▾]                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 初始状态

1. 页面挂载后，调用 `useSettingsStore().loadConfig()` 加载已保存的模型配置
2. 通用偏好从 localStorage 读取默认值（无则使用 `DEFAULT_PREFERENCES`）
3. 加载中显示 skeleton / spinner，表单禁用
4. 加载完成后，表单填充数据，`isDirty = false`
5. Embedding 配置默认 `enabled = false`，配置区折叠/置灰

## 交互状态

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| **loading** | 表单区域显示 skeleton placeholder；保存/重置按钮禁用 | 不可操作 | `loadConfig()` 请求中 |
| **empty** | 首次使用场景，所有配置为默认值；模型配置 Tab 中各提供商 API Key 为空，Ollama 未启用 | 可自由编辑，填入 API Key 等信息 | `isDirty = false`，用户需填入配置后才能正常使用 LLM 功能 |
| **disabled** | Embedding 配置区整体折叠或置灰；仅显示 `enabled` Switch（关闭态）；API Key / Base URL / Provider / Model 字段隐藏；标签提示"启用 Embedding 以配置嵌入模型" | 可切换 `enabled` Switch 以启用配置区 | `embeddingProvider.enabled = false`；嵌入模型配置字段不参与 Zod 校验，不包含在 `saveConfig()` 提交体中 |
| **idle (clean)** | 表单正常显示，保存按钮为次要样式（outline/secondary）；Embedding 配置区若 `enabled=true` 则完整展开 | 可自由编辑 | `isDirty = false`，无未保存提示 |
| **partial** | 部分字段已修改（如只改了 OpenAI 配置，其他 Tab 保持不变）；保存按钮高亮；切换 Embedding `enabled` 开关也标记 dirty | 可继续编辑、保存或重置 | `isDirty = true`，`updateConfig(partial)` 仅更新修改过的字段；`useBlocker` + `enableBeforeUnload` 已激活 |
| **saving** | 保存按钮禁用 + spinner；表单仍可编辑（不锁定） | 可继续编辑（但新改动不会覆盖正在进行的保存） | `saveConfig()` 请求中，`isLoading = true` |
| **save-success** | Toast "配置已保存"（3 秒自动消失）；保存按钮回到次要样式 | 继续编辑 | `isDirty = false`，savedConfig 更新 |
| **save-error** | 表单底部显示红色错误文字 + Toast "保存失败"；保存按钮恢复可用 | 修改后重试或点重置 | `error` 字段设置，config 保留用户修改 |
| **validation-error** | 对应字段红框 + 下方错误文字；保存按钮可点击但提交被拦截 | 修正字段内容直到合法 | Zod 验证失败，阻止提交，不调用 `saveConfig` |

## 正常流程

### 流程 1：编辑并保存模型配置

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 进入 Settings 页面 | 加载配置，表单填充 | loading → idle (clean) |
| 2 | 切换到"模型配置" Tab | 显示提供商子 Tab | idle (clean) |
| 3 | 在 OpenAI Tab 修改 API Key 和 Model | `updateConfig(partial)` 更新内存 | partial (dirty)，保存按钮高亮 |
| 4 | 点击"保存更改" | Zod 验证通过 → `saveConfig()` | saving |
| 5 | — | API 返回成功 → savedConfig 更新 | save-success，Toast "配置已保存" |
| 6 | — | Toast 3 秒后自动消失 | idle (clean) |

### 流程 2：编辑后放弃修改

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 修改了通用偏好（主题改为 dark） | 本地 dirty 状态更新 | partial (dirty) |
| 2 | 点击"重置" | 通用偏好重置为上次保存值；模型配置调用 `resetToSaved()` | idle (clean) |

### 流程 3：编辑后离开页面（被拦截）

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 修改任意配置 | dirty = true | partial (dirty) |
| 2 | 点击侧栏"对话"导航 | `useBlocker.shouldBlockFn` 触发 | blocker-active，弹出 confirm |
| 3 | 点击"取消" | 留在 Settings 页面 | partial (dirty) |
| 4 | 再次点击"对话"导航 | blocker 再次触发 | blocker-active |
| 5 | 点击"确定" | 放行导航到 /app/chat | — |

### 流程 4：修改通知偏好（纯前端）

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 在"通用设置" Tab 切换通知 Switch | 本地 state 更新 + localStorage 写入 | partial (dirty) |
| 2 | 点击"保存更改" | 通用偏好写入 localStorage，标记 clean | save-success |

### 流程 5：启用 Embedding 配置

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 在"模型配置" Tab 滚动到嵌入模型区域 | 显示 Embedding `enabled` Switch（关闭态）+ 折叠/置灰区域 | disabled |
| 2 | 点击 `enabled` Switch 开启 | 展开配置表单，显示 Provider / API Key / Model / Base URL 字段 | partial (dirty) |
| 3 | 填入 Provider、API Key、Model、Base URL | `updateConfig(partial)` 更新 embeddingProvider | partial (dirty) |
| 4 | 点击"保存更改" | Zod 验证（含 embedding 字段）通过 → `saveConfig()` | save-success |
| 5 | 再次点击 `enabled` Switch 关闭 | 配置区折叠/置灰，已填入的字段保留在内存中（不被清空） | partial (dirty) |

## 错误场景

| 场景 | 触发条件 | 视觉表现 | 恢复路径 |
|------|----------|----------|----------|
| **加载失败** | `loadConfig()` API 返回错误 | 表单区域显示错误卡片 + "加载配置失败，请刷新重试" | 用户点击重试按钮或刷新页面 |
| **保存失败（网络）** | `saveConfig()` 网络超时/断网 | Toast "保存失败：网络错误" + 底部错误文字 | 检查网络后重试保存 |
| **保存失败（服务端）** | 后端返回 400/500 | Toast "保存失败：{错误信息}" | 根据错误信息修正或重试 |
| **Zod 验证失败** | 字段值不合法（如 temperature > 2） | 字段红框 + 下方红色提示文字；提交被拦截 | 用户修正字段值 |
| **API Key 验证失败** | baseUrl 不是合法 URL | 字段红框 + "请输入合法的 URL 或留空" | 用户修正 URL |
| **Embedding 启用但 API Key 为空** | `enabled=true` 且 `apiKey` 为空 | apiKey 字段红框 + "启用 Embedding 时 API Key 不能为空" | 用户填入 API Key 或关闭 enabled |
| **defaultChatProvider 不一致** | 选择的默认提供商无有效 API Key | 保存时 Zod refinement 失败 + 错误提示 | 先配置该提供商的 API Key 或更换默认提供商 |
| **localStorage 不可用** | 隐私模式/存储满 | 通用偏好保存静默失败，模型配置走 API 不受影响 | 无需操作（静默降级） |

## Zod 验证规则

### 通用偏好

```typescript
const generalPreferencesSchema = z.object({
  language: z.enum(['zh-CN', 'en-US']),
  theme: z.enum(['light', 'dark', 'auto']),
  notification: z.boolean(),
})
```

### 模型配置（与后端 `SettingsDto` 对齐）

```typescript
const providerSchema = z.object({
  apiKey: z.string(),
  model: z.string(),
  baseUrl: z.string().refine(
    (v) => v === '' || z.string().url().safeParse(v).success,
    { message: '请输入合法的 URL 或留空' },
  ),
})

const ollamaSchema = z.object({
  enabled: z.boolean(),
  url: z.string(),
  model: z.string(),
}).refine(
  (data) => !data.enabled || z.string().url().safeParse(data.url).success,
  { message: '请输入合法的 URL', path: ['url'] },
)

const embeddingProviderSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.string(),
  apiKey: z.string(),
  model: z.string(),
  baseUrl: z.string().refine(
    (v) => v === '' || z.string().url().safeParse(v).success,
    { message: '请输入合法的 URL 或留空' },
  ),
}).refine(
  (data) => !data.enabled || data.apiKey.length > 0,
  { message: '启用 Embedding 时 API Key 不能为空', path: ['apiKey'] },
)

const configSchema = z.object({
  providers: z.object({
    openai: providerSchema,
    claude: providerSchema,
    deepseek: providerSchema,
    custom: providerSchema,
    ollama: ollamaSchema,
  }),
  embeddingProvider: embeddingProviderSchema,
  temperature: z.number().min(0, '最小值为 0').max(2, '最大值为 2'),
  defaultChatProvider: z.string().min(1, '请选择默认提供商'),
}).refine(
  (data) => Object.keys(data.providers).includes(data.defaultChatProvider),
  { message: '默认提供商必须在已配置的提供商中选择' },
)
```

## 未保存提示机制

### 实现方案

```typescript
// 在 SettingsPage 组件中
const isDirty = useSettingsStore((s) => s.isDirty)
const [prefsDirty, setPrefsDirty] = useState(false)

const hasUnsavedChanges = isDirty() || prefsDirty

useBlocker({
  shouldBlockFn: () => {
    if (!hasUnsavedChanges) return false
    const shouldLeave = window.confirm('有未保存的更改，确定要离开吗？')
    return !shouldLeave
  },
  enableBeforeUnload: hasUnsavedChanges,
})
```

### 触发条件

| 操作 | beforeunload 是否触发 | useBlocker 是否拦截 |
|------|----------------------|---------------------|
| 点击侧栏导航到其他页面 | — | 是（confirm 弹窗） |
| 浏览器刷新 (F5 / Ctrl+R) | 是（浏览器原生弹窗） | — |
| 关闭标签页 | 是（浏览器原生弹窗） | — |
| 浏览器前进/后退 | — | 是（confirm 弹窗） |
| 点击"保存更改"后 | 否 | 否（hasUnsavedChanges = false） |

## 测试映射

| 交互状态 | 测试文件 | 测试用例 |
|----------|----------|----------|
| loading | `tests/unit/web/settings-form.spec.tsx` | `AC-01: 初始加载时显示骨架屏，表单禁用` |
| empty | `tests/unit/web/settings-form.spec.tsx` | `AC-02: 首次使用显示默认值，API Key 为空` |
| disabled | `tests/unit/web/settings-form.spec.tsx` | `AC-02a: Embedding enabled=false 时配置区折叠/置灰，字段不参与校验` |
| idle (clean) | `tests/unit/web/settings-form.spec.tsx` | `AC-03: 加载完成后表单填充数据，保存按钮为次要样式` |
| partial (dirty) | `tests/unit/web/settings-form.spec.tsx` | `AC-04: 修改字段后保存按钮高亮，dirty 状态为 true` |
| saving | `tests/unit/web/settings-form.spec.tsx` | `AC-05: 保存中按钮禁用并显示 spinner` |
| save-success | `tests/unit/web/settings-form.spec.tsx` | `AC-06: 保存成功后显示 Toast "配置已保存"，3秒后消失` |
| save-error | `tests/unit/web/settings-form.spec.tsx` | `AC-07: 保存失败后显示错误提示，表单内容不丢失` |
| validation-error | `tests/unit/web/settings-form.spec.tsx` | `AC-08: 输入非法 temperature（>2）时显示验证错误` |
| blocker-active | `tests/unit/web/settings-form.spec.tsx` | `AC-09: 有未保存更改时导航离开触发 confirm` |
| reset | `tests/unit/web/settings-form.spec.tsx` | `AC-10: 点击重置后表单回退到上次保存值，dirty = false` |
| provider tab switch | `tests/unit/web/settings-form.spec.tsx` | `AC-11: 切换提供商 Tab 显示对应配置表单` |
| api key visibility toggle | `tests/unit/web/settings-form.spec.tsx` | `AC-12: 点击眼睛图标切换 API Key 显隐` |
| general preference persistence | `tests/unit/web/settings-form.spec.tsx` | `AC-13: 修改通知偏好后保存，localStorage 正确写入` |
| embedding enable toggle | `tests/unit/web/settings-form.spec.tsx` | `AC-14: 切换 Embedding enabled Switch 展开/折叠配置区` |
| embedding apiKey required when enabled | `tests/unit/web/settings-form.spec.tsx` | `AC-15: 启用 Embedding 但 API Key 为空时校验失败` |

> 测试文件路径遵循 `_shared/references/test-paths.md` 规范：React 新项目前端单元测试位于 `tests/unit/web/`。
