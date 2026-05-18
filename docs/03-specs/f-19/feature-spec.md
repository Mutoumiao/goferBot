---
issue: f-19
type: feature-spec
status: completed
summary: 设置页双 Tab 重构，账户设置 Tab 展示用户信息并提供登出入口
---

# f-19 功能规格：设置页 Tabs + 账户设置

## 功能边界

### 包含

- 设置页拆分为两个 Tab：模型设置、账户设置
- 账户设置 Tab 展示当前登录用户的邮箱和昵称
- 账户设置 Tab 提供登出按钮，调用 auth store logout + 路由跳转登录页
- 模型设置 Tab 保留所有现有配置功能（LLM、Embedding、通用）

### 不包含

- 修改密码
- 头像上传
- 账户删除

## 技术方案

- 使用 reka-ui Tabs 组件（项目已有 shadcn-vue tabs 封装）
- authStore 已有 logout() 方法和 user 状态
- SettingsPage.vue 重组 template 结构，script 逻辑基本不变
