---
id: f-15-global-tab-bar
type: issue
status: closed
track: frontend
priority: p1
summary: TabBar 从 ChatView 内部提升至 AuthenticatedLayout，成为全局跨路由持久标签栏。在 Layout 插入 header 区域承载 TabBar，RouterView 内容由激活标签驱动切换。
blocked_by: [f-16-unified-tab-types]
blocks: [f-17-route-singleton-tabs]
spec: docs/03-specs/f-15-global-tab-bar/
plan: docs/04-plans/f-15-global-tab-bar/v1.md
tests: docs/08-test-cases/f-15-global-tab-bar/
token_estimate: 1500
---

状态: needs-triage
分类: refactor

## 要构建的内容

将 TabBar 从 ChatView.vue 内部提升至 AuthenticatedLayout.vue header 区域。标签栏成为全局导航 UI，跨路由持久显示。`<RouterView>` 的内容不再由侧边栏路由直接驱动，而是由当前激活标签的 type + sessionId 决定。

## 规格引用

- 功能规格: docs/03-specs/f-15-global-tab-bar/feature-spec.md
- 行为规格: docs/03-specs/f-15-global-tab-bar/behavior-spec.md
- API 规格: 无（纯 UI 架构重构）

## 验收标准

- [ ] `AuthenticatedLayout.vue` 插入 header 区域（38px 高度），承载 TabBar
- [ ] TabBar 从 ChatView.vue 移除，迁入 Layout header
- [ ] 点击侧边栏导航 → 打开/激活对应类型标签（而非直接切换路由）
- [ ] Chat 类型标签可多开，其他类型标签单例
- [ ] 标签悬停显示关闭按钮（home 标签除外）
- [ ] 关闭标签自动切换到左侧相邻标签
- [ ] 所有标签关闭后自动创建 home 标签（无对话、不可关闭）
- [ ] 多标签横向滚动（溢出时）
- [ ] 切换标签时 RouterView 内容正确更新
- [ ] 刷新页面后标签状态丢失（后续扩展持久化）
- [ ] `pnpm type-check` 通过

## 阻塞于

- f-16-unified-tab-types（需要统一类型/Store）

## 范围外

- 标签拖拽排序
- 标签右键菜单
- 标签持久化存储
- 路由元数据 singleton 标记（f-17 负责）

## Agent 简报

**分类：** refactor
**摘要：** TabBar 从 ChatView 提升至 AuthenticatedLayout，成为全局跨路由标签栏

**当前行为：**
TabBar 仅在 ChatView.vue 内部，仅管理聊天会话标签。切换到其他页面（知识库/历史/设置）时标签栏消失。路由由侧边栏直接驱动。

**期望行为：**
TabBar 位于 Layout header，全局可见。所有页面以标签形式打开。Chat 可多开，其他页面单例。侧边栏点击 → 激活/创建标签 → RouterView 响应。

**关键接口：**
- `packages/webui/src/layouts/AuthenticatedLayout.vue` — 插入 header + TabBar
- `packages/webui/src/views/ChatView.vue` — 移除内部 TabBar
- `packages/webui/src/components/TabBar.vue` — 迁入 layout/ 目录
- `packages/webui/src/stores/tabs.ts` — 统一标签 Store（f-16 产出）

**验收标准：**
- [ ] Layout header 承载 TabBar
- [ ] TabBar 从 ChatView 移除
- [ ] 侧边栏 → 标签激活
- [ ] Chat 多开 / 其他单例
- [ ] 关闭逻辑（hover icon / 左邻切换 / home 不可关）
- [ ] 全部关闭 → 自动 home
- [ ] 横向滚动
- [ ] RouterView 联动
- [ ] type-check 通过

**范围外：**
- 拖拽排序
- 右键菜单
- 持久化
- 路由元数据
