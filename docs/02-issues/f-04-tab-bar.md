状态: needs-triage
分类: enhancement

## 要构建的内容

实现顶部标签栏，38px 固定高度，浏览器式多标签管理，支持问答会话多开。

## 规格引用

- 功能规格: docs/03-specs/features/tab-bar/feature-spec.md
- 行为规格: docs/03-specs/features/tab-bar/behavior-spec.md
- API 规格: 无（纯 UI）

## 验收标准

- [ ] `packages/webui/src/components/layout/TabBar.vue` 实现 38px 固定高度标签栏
- [ ] 标签类型：问答会话（可多开）、知识库管理（单例）、设置（单例）、对话历史（单例）
- [ ] "首页"标签始终保留，无法关闭
- [ ] 最右侧 `+` 按钮新建问答会话标签
- [ ] 标签可横向滚动（标签过多时）
- [ ] 点击标签切换到对应页面/会话
- [ ] 标签悬停显示关闭按钮（首页除外）
- [ ] 关闭标签时自动切换到左侧相邻标签
- [ ] 标签标题可编辑（双击或点击标题）
- [ ] 单例标签重复点击不创建新标签，而是切换到已有标签
- [ ] 使用 Pinia Store 管理标签状态（`packages/webui/src/stores/tabs.ts`）

## 阻塞于

- f-03-sidebar-navigation（需要边栏触发页面切换）

## 范围外

- 标签拖拽排序
- 标签分组
- 标签右键菜单

## Agent 简报

**分类：** enhancement
**摘要：** 顶部多标签栏，38px 固定高度，支持会话多开

**当前行为：**
前端无标签系统，页面间切换会丢失状态。

**期望行为：**
用户可同时打开多个问答会话，在标签间快速切换，单例页面不重复打开。

**关键接口：**
- `packages/webui/src/components/layout/TabBar.vue` — 标签栏组件
- `packages/webui/src/stores/tabs.ts` — 标签状态管理
- Pinia — 状态管理

**验收标准：**
- [ ] 38px 固定高度标签栏
- [ ] 问答会话可多开，其他单例
- [ ] "首页"标签不可关闭
- [ ] `+` 按钮新建会话
- [ ] 标签可横向滚动
- [ ] 点击切换页面
- [ ] 悬停显示关闭按钮
- [ ] 关闭后切换到左侧标签
- [ ] 标签标题可编辑
- [ ] 单例标签不重复创建
- [ ] Pinia Store 管理标签状态

**范围外：**
- 标签拖拽排序
- 标签分组
- 右键菜单
