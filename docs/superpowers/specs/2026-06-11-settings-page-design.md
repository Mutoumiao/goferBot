# 设置页面设计文档

## 1. 概述

重构设置页面，支持通用设置（外观、字体大小）、模型设置（首选模型、多自定义模型管理）和关于信息展示。

## 2. 数据模型

### 2.1 ProviderConfig（前后端统一）

```ts
interface ProviderConfig {
  name: string   // 显示名称
  apiKey: string
  model: string
  baseUrl: string
}
```

### 2.2 AppConfig

```ts
interface AppConfig {
  providers: Record<string, ProviderConfig>
  defaultChatProvider: string
  appearance: 'light' | 'dark' | 'system'
  fontSizeLevel: 1 | 2 | 3 | 4 | 5
}
```

- 内置模型 key：`openai`、`claude`、`deepseek`
- 自定义模型 key：`custom_{uuid}`
- 默认 `appearance: 'light'`，`fontSizeLevel: 3`

## 3. 页面结构

按设计稿三段式布局：

### 3.1 通用设置
- **界面显示**：light / dark / system 三选一（Select）
- **字体大小**：1-5 级滑条（Slider），默认 3（标准）

### 3.2 模型设置
- **首选模型**：下拉选择所有已配置模型（apiKey 非空才可选）
- **自定义模型列表**：名称 + 编辑/删除按钮
- **+添加自定义模型**：点击打开弹窗

### 3.3 关于
- **版本号**：静态展示 `1.0.0`

## 4. 组件拆分（features/settings/）

```
features/settings/
├── components/
│   ├── SettingsSection.tsx      // 区块标题 + 卡片容器
│   ├── SettingsRow.tsx          // 单行：标签 + 控件
│   ├── AppearanceSelect.tsx     // 外观三选一
│   ├── FontSizeSlider.tsx       // 字体大小滑条
│   ├── ProviderSelect.tsx       // 首选模型下拉
│   ├── CustomProviderList.tsx   // 自定义模型列表
│   └── ProviderDialog.tsx       // 添加/编辑模型弹窗
├── services.ts                  // 加载/保存、增删改模型
└── types.ts                     // 设置相关类型
```

## 5. 状态管理

复用 `useSettingsStore`，扩展 `AppConfig` 类型。

变更流程：
1. `updateConfig()` 即时更新本地状态
2. `saveConfig()` 异步同步到后端
3. 外观/字体大小变更即时应用到 DOM

## 6. 后端变更

### 6.1 settings.dto.ts
- `providers` 改为 `Record<string, providerSchema>`
- 新增 `appearance` 和 `fontSizeLevel` 字段
- 移除 `defaultChatProvider` 必须在固定 key 中的约束

### 6.2 settings.service.ts
- 加密逻辑遍历所有 provider 的 `apiKey`，不硬编码 key 名
- 数据迁移：现有单条 `custom` 自动迁移为 `custom_default`

## 7. 交互细节

- 添加/编辑模型：弹窗表单（名称、接口地址、API密钥、模型名称）
- 删除模型：二次确认
- 若删除的是当前首选模型，自动回退到第一个可用内置模型
- 外观切换即时生效（通过 data-attribute 或 class）
- 字体大小切换即时生效（调整根元素 font-size）

## 8. 测试要点

- 添加自定义模型后列表即时刷新
- 编辑模型时 apiKey 为掩码（`***`）时不覆盖原值
- 删除当前首选模型后自动回退
- 外观/字体大小切换后页面即时响应

## 9. 边界情况

- 用户未配置任何模型 API Key 时，首选模型下拉置空并提示
- 自定义模型名称重复时前端校验
- 后端返回加密后的 apiKey（`***`）时，编辑弹窗保留原值不覆盖
