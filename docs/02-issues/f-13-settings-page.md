状态: needs-triage
分类: enhancement

## 要构建的内容

实现设置页，分三个卡片区域：LLM 提供商、Embedding API、通用配置。

## 规格引用

- 功能规格: docs/03-specs/features/settings/feature-spec.md
- 行为规格: docs/03-specs/features/settings/behavior-spec.md
- API 规格: docs/03-specs/features/settings/api-spec.md

## 验收标准

- [ ] `packages/webui/src/views/SettingsView.vue` 实现设置页
- [ ] **LLM 提供商配置卡片**：
  - [ ] 多提供商：OpenAI / Claude / DeepSeek / 自定义 / Ollama
  - [ ] 每个提供商：API Key（密码框，可显示/隐藏）、模型输入、Base URL 输入
  - [ ] Ollama 额外：启用开关、服务地址输入
  - [ ] 默认对话提供商选择（下拉）
- [ ] **Embedding API 卡片**：
  - [ ] 提供商选择：OpenAI / 硅基流动 / 自定义
  - [ ] API Key 输入（密码框）
  - [ ] 模型输入
  - [ ] Base URL 输入
- [ ] **通用配置卡片**：
  - [ ] 温度参数滑块（0-2，默认 0.7，步进 0.1）
  - [ ] 滑块旁显示当前数值
- [ ] 保存按钮：点击后调用 API 保存，成功显示 Toast
- [ ] 表单验证：必填项检查
- [ ] 配置变更后未保存提示（离开页面确认）
- [ ] 使用 Pinia Store 管理设置状态
- [ ] 单例标签：设置页在标签栏中只打开一个

## 阻塞于

- b-05-settings-api（需要设置 API）
- f-03-sidebar-navigation（需要从边栏进入设置页）

## 范围外

- 配置导入/导出
- 快捷键设置
- 主题/外观设置

## Agent 简报

**分类：** enhancement
**摘要：** 设置页：LLM 提供商、Embedding、通用配置

**当前行为：**
前端无设置界面。

**期望行为：**
用户可配置多个 LLM 提供商、Embedding 服务和通用参数，配置持久化保存。

**关键接口：**
- `packages/webui/src/views/SettingsView.vue` — 设置页
- API: `GET/POST /api/settings`
- Pinia Store — 设置状态

**验收标准：**
- [ ] 设置页实现
- [ ] LLM 提供商卡片（5 个提供商）
- [ ] API Key 密码框（显示/隐藏）
- [ ] Ollama 启用开关
- [ ] 默认提供商选择
- [ ] Embedding API 卡片
- [ ] 温度滑块（0-2，步进 0.1）
- [ ] 保存按钮 + Toast 提示
- [ ] 表单验证
- [ ] 未保存离开确认
- [ ] Pinia Store 管理状态
- [ ] 单例标签

**范围外：**
- 配置导入/导出
- 快捷键设置
- 主题/外观
