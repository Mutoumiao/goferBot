---
issue: f-41
type: behavior-spec
status: draft
---

# f-41 Settings Store 行为规格

## 状态转换图

```
Dirty 追踪生命周期：

  [初始: config = DEFAULT, savedConfig = DEFAULT]  (isDirty = false)
      │
      ├── updateConfig(partial) ──▶ [config 更新, savedConfig 不变]  (isDirty = true)
      │       │
      │       ├── resetToSaved() ──▶ [config = savedConfig]  (isDirty = false)
      │       │
      │       └── saveConfig() ──▶ [loading] ──成功──▶ [savedConfig = config, persist]  (isDirty = false)
      │                                     └──失败──▶ [error, config 保留修改]  (isDirty = true)
      │
      └── loadConfig() ──▶ [loading] ──成功──▶ [config = API结果+默认合并, savedConfig = config]
                              └──失败──▶ [保持原值, isLoading = false]
```

## 交互状态表

| 状态/操作 | 初始态 | loading | 成功 | 失败 |
|-----------|--------|---------|------|------|
| **updateConfig** | `isDirty=false` | — | `isDirty=true`, config 更新 | — |
| **resetToSaved** | `isDirty=true` | — | `isDirty=false`, config 回退 | — |
| **saveConfig** | `isDirty=true` | `isLoading=true`, `error=null` | `isDirty=false`, savedConfig=config, persist | `error="..."`
| **loadConfig** | `isLoading=false` | `isLoading=true` | config+savedConfig 更新, `isLoading=false`, `isDirty=false` | `isLoading=false` |
| **persist hydrate** | store 初始化 | — | config 从 localStorage 恢复，与 DEFAULT 合并 | 使用 DEFAULT |
| **getLLMConfig** | 同步 | — | 返回 LLMConfig 或 null | — |

## Dirty 追踪详解

### isDirty 判定

```
isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig)
```

使用 JSON 序列化做深度比较。简单可靠，适合本场景的纯数据对象。

### 触发 isDirty=true 的操作
- `updateConfig(partial)` — 任何时候修改 config
- `saveConfig` 失败 — config 保留用户修改，savedConfig 不变

### 触发 isDirty=false 的操作
- `saveConfig` 成功 — savedConfig 同步为 config
- `loadConfig` 成功 — 两者设为相同值
- `resetToSaved` — config 回退
- store 初始化 / hydrate — 两者均为 DEFAULT

## 持久化恢复

### Hydrate 场景

| 场景 | 行为 |
|------|------|
| localStorage 有完整配置 | 直接恢复 config |
| localStorage 有部分配置 | 与 DEFAULT_CONFIG 深度合并（缺失字段用默认值） |
| localStorage 为空 | 使用 DEFAULT_CONFIG |
| localStorage 数据损坏 | catch 异常，使用 DEFAULT_CONFIG |
| localStorage 不可用（隐私模式） | persist 内部静默降级，使用 DEFAULT_CONFIG |

## Provider 配置

### getLLMConfig 逻辑

```
输入: providerKey (可选)
1. 如果无 providerKey → 使用 config.defaultChatProvider
2. 如果 key === 'ollama' → 检查 enabled，返回 { provider:'ollama', model, baseUrl:url, apiKey:'' } 或 null
3. 否则 → 返回 { provider:key, model, baseUrl, apiKey }
```

### configuredProviders 逻辑

遍历 `config.providers`，返回已配置的 provider：
- ollama：`enabled === true` 才算已配置
- 其他：`apiKey !== ''` 才算已配置

## 边界条件

- **并发 save**：连续快速调用 saveConfig 时，以最后一次响应为准
- **loadConfig 失败**：不覆盖现有 config，仅设置 `isLoading = false`
- **updateConfig 空对象**：`updateConfig({})` → 不改变 isDirty（config 无变化）
- **默认 provider 不存在**：`getLLMConfig` 返回 null
- **Ollama enabled 但无 model**：`getLLMConfig('ollama')` 仍返回配置（model 可为空字符串）
