---
id: f-03-sidebar-navigation
type: issue
status: closed
track: frontend
priority: p0
summary: 实现全局左侧边栏导航，64px 固定宽度，包含上下两个区域，点击切换主功能页面。完整的全局边栏导航，所有交互细节到位。
blocked_by: [f-01-auth-pages, f-02-route-guard]
blocks: []
spec: docs/03-specs/f-03-sidebar-navigation/
plan: docs/04-plans/f-03-sidebar-navigation/v1.md
tests: docs/08-test-cases/f-03-sidebar-navigation/
token_estimate: 1200
---

状态: in-progress
分类: enhancement

## 要构建的内容

实现全局左侧边栏导航，64px 固定宽度，包含上下两个区域，点击切换主功能页面。

## 背景

本 issue **部分已完成**。架构改革中：
- `SideBar.vue` 组件已存在，且已适配 `vue-router`（通过事件触发路由跳转）
- `App.vue` 已改用 `<RouterView />`，Sidebar 作为全局布局的一部分
- 但当前实现缺少 Tooltip、移动端适配，且组件位置可能需要调整到 `components/layout/`

## 规格引用

- 功能规格: docs/03-specs/f-03-sidebar-navigation/feature-spec.md
- 行为规格: docs/03-specs/f-03-sidebar-navigation/behavior-spec.md
- API 规格: 无（纯 UI）

## 已完成

- [x] `packages/webui/src/components/SideBar.vue` 实现 64px 固定宽度边栏
- [x] 上区（常用）：消息图标（问答首页）、文件夹图标（知识库管理）
- [x] 下区（低频）：时钟图标（对话历史）、齿轮图标（设置）
- [x] 当前激活项高亮显示（使用 Pencil tokens）
- [x] 点击图标切换对应页面（通过事件 → `App.vue` → `router.push`）
- [x] 使用 lucide-vue-next 图标
- [x] 全局始终显示，不受页面滚动影响
- [x] 已适配 vue-router（`activeType` 从 `TabType` 改为 `string`，接收 route name）

## 待完成

- [ ] 鼠标悬停显示 Tooltip（功能名称）
- [ ] 响应式：移动端适配（可选折叠为底部导航）
- [ ] 组件迁移到 `packages/webui/src/components/layout/AppSidebar.vue`（统一布局组件目录）
- [ ] 登录页/注册页不应显示 Sidebar（路由元信息控制）

## 阻塞于

- f-01-auth-pages（需要登录页完成后，才能做"登录页不显示 Sidebar"的逻辑）
- f-02-route-guard（需要路由守卫确定哪些路由需要 Sidebar）

## 范围外

- 可拖拽排序图标
- 自定义图标上传
- 侧边栏宽度调整

## Agent 简报

**分类：** enhancement
**摘要：** 全局左侧边栏导航，64px 固定宽度，上下分区（部分完成）

**当前行为：**
SideBar 组件已实现基础功能，但缺少 Tooltip、移动端适配、布局目录规范化。

**期望行为：**
完整的全局边栏导航，所有交互细节到位。

**关键接口：**
- `packages/webui/src/components/SideBar.vue`（当前）→ `packages/webui/src/components/layout/AppSidebar.vue`（目标）
- Vue Router — 页面切换
- lucide-vue-next — 图标

**验收标准：**
- [x] 64px 固定宽度边栏
- [x] 上区：消息、文件夹图标
- [x] 下区：时钟、齿轮图标
- [x] 当前激活项高亮
- [x] 点击切换页面
- [ ] 悬停显示 Tooltip
- [x] 使用 lucide 图标
- [x] 全局始终显示
- [ ] 移动端适配
- [ ] 登录页不显示 Sidebar

**范围外：**
- 可拖拽排序
- 自定义图标
- 宽度调整
