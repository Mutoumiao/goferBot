---
id: f-04-tab-bar
type: issue
status: closed
track: frontend
priority: p0
summary: 实现聊天页面内部的顶部标签栏，浏览器式多标签管理，支持问答会话多开。用户可在 Chat 页面内同时打开多个问答会话，在标签间快速切换。
blocked_by: [f-09-chat-page, b-03-session-api]
blocks: []
spec: docs/03-specs/f-04-tab-bar/
plan: docs/04-plans/f-04-tab-bar/v1.md
tests: docs/08-test-cases/f-04-tab-bar/
token_estimate: 1100
---

状态: closed
分类: enhancement

## 要构建的内容

实现聊天页面内部的顶部标签栏，浏览器式多标签管理，支持问答会话多开。

## 规格引用

- 功能规格: docs/03-specs/f-04-tab-bar/feature-spec.md
- 行为规格: docs/03-specs/f-04-tab-bar/behavior-spec.md
- API 规格: 无（纯 UI）

## 背景说明

全局导航已通过 `vue-router` + `SideBar` 实现（见 f-03-sidebar-navigation）。本 issue 的标签栏**仅作用于 Chat 页面内部**，用于管理多个并发的问答会话。用户从 Sidebar 点击"消息"图标进入 `/`（Chat 路由），在 Chat 页面内通过标签栏多开会话。

## 验收标准

- [ ] `packages/webui/src/components/chat/ChatTabBar.vue` 实现 38px 固定高度标签栏
- [ ] 标签类型：仅问答会话（每个标签对应一个独立会话）
- [ ] "首页"标签始终保留，无法关闭（作为新会话的默认入口）
- [ ] 最右侧 `+` 按钮新建问答会话标签
- [ ] 标签可横向滚动（标签过多时）
- [ ] 点击标签切换到对应会话
- [ ] 标签悬停显示关闭按钮（首页除外）
- [ ] 关闭标签时自动切换到左侧相邻标签
- [ ] 标签标题可编辑（双击或点击标题），编辑后调用 API 保存
- [ ] 使用 Pinia Store 管理标签状态（`packages/webui/src/stores/chatTabs.ts`）
- [ ] 标签状态与会话数据分离：标签只保存 `sessionId` 引用，消息数据在 `session store` 中管理
- [ ] 刷新页面后标签状态丢失（后续可扩展持久化）

## 阻塞于

- f-09-chat-page（需要对话页容器）
- b-03-session-api（需要会话创建/查询 API）

## 范围外

- 标签拖拽排序
- 标签分组
- 标签右键菜单
- 全局页面标签（已由 vue-router 处理）

## Agent 简报

**分类：** enhancement
**摘要：** Chat 页面内部多标签栏，支持会话多开

**当前行为：**
前端无标签系统，页面间切换会丢失状态。

**期望行为：**
用户可在 Chat 页面内同时打开多个问答会话，在标签间快速切换。

**关键接口：**
- `packages/webui/src/components/chat/ChatTabBar.vue` — 标签栏组件
- `packages/webui/src/stores/chatTabs.ts` — 标签状态管理
- Pinia — 状态管理

**验收标准：**
- [ ] 38px 固定高度标签栏
- [ ] 问答会话可多开
- [ ] "首页"标签不可关闭
- [ ] `+` 按钮新建会话
- [ ] 标签可横向滚动
- [ ] 点击切换会话
- [ ] 悬停显示关闭按钮
- [ ] 关闭后切换到左侧标签
- [ ] 标签标题可编辑
- [ ] Pinia Store 管理标签状态
- [ ] 标签与会话数据分离

**范围外：**
- 标签拖拽排序
- 标签分组
- 右键菜单
- 全局页面标签
