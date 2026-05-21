---
scope: f-19
type: code
date: 2026-05-18
issues: [f-19]
status: completed
summary: 代码+行为审查。无问题发现。Tab 切换、登出流程实现正确。
---

# f-19 设置页 Tabs + 账户设置 — 审查报告 v1

> **审查类型**：代码审查 + 行为对齐
> **审查对象**：`packages/webui/src/components/SettingsPage.vue`

---

## 审查摘要

- **总体结论**：✅ 通过
- **问题统计**：Critical 0 | Major 0 | Minor 0 | Info 0

## 检查项

| 检查项 | 状态 | 备注 |
|--------|------|------|
| Tabs 组件使用正确（reka-ui） | ✅ | v-model 绑定 activeTab |
| 登出调用 authStore.logout() | ✅ | try-finally 保证 token 清除 |
| 登出后跳转登录页 | ✅ | router.push({ name: 'login' }) |
| 账户信息展示 | ✅ | 空值显示 "—" |
| 保存按钮仅在模型设置 Tab | ✅ | 位于 TabsContent value="models" 内 |
| 未保存离开拦截保留 | ✅ | onBeforeRouteLeave 逻辑不变 |
| type-check 通过 | ✅ | 零错误 |

## 行为对齐

| 交互 | 状态 |
|------|------|
| 默认显示模型设置 Tab | ✅ |
| Tab 切换不改变路由 | ✅ |
| 登出清除 token 并跳转 | ✅ |
