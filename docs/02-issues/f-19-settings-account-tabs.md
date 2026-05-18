---
status: closed
track: feature
priority: p2
created: 2026-05-18
closed: 2026-05-18
summary: 设置页拆分为模型设置/账户设置两个 tab，账户设置中展示用户信息并提供登出按钮
---

# f-19 设置页 Tabs 重构 + 账户设置 + 登出

## 要构建的内容

将设置页重构为双 Tab 结构（模型设置 / 账户设置），在账户设置 Tab 中展示当前用户邮箱和昵称，并提供登出按钮。

## 规格引用

- 功能规格: docs/03-specs/f-19/feature-spec.md
- 行为规格: docs/03-specs/f-19/behavior-spec.md

## 验收标准

- [x] 设置页顶部显示"模型设置"和"账户设置"两个 Tab
- [x] 模型设置 Tab 包含 LLM 提供商配置、Embedding API、通用配置，布局与原有设置页一致
- [x] 账户设置 Tab 显示当前用户邮箱和昵称
- [x] 账户设置 Tab 提供登出按钮，点击后调用 authStore.logout() 并跳转登录页
- [x] 保存按钮仅在模型设置 Tab 内生效，账户设置 Tab 无保存按钮
- [x] pnpm type-check 通过

## 阻塞于

- 无

## 范围外

- 修改密码功能
- 头像上传功能
- 账户删除功能
