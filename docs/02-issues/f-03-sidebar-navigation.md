状态: needs-triage
分类: enhancement

## 要构建的内容

实现全局左侧边栏导航，64px 固定宽度，包含上下两个区域，点击切换主功能页面。

## 规格引用

- 功能规格: docs/03-specs/features/sidebar-navigation/feature-spec.md
- 行为规格: docs/03-specs/features/sidebar-navigation/behavior-spec.md
- API 规格: 无（纯 UI）

## 验收标准

- [ ] `packages/webui/src/components/layout/AppSidebar.vue` 实现 64px 固定宽度边栏
- [ ] 上区（常用）：消息图标（问答首页）、文件夹图标（知识库管理）
- [ ] 下区（低频）：时钟图标（对话历史）、齿轮图标（设置）
- [ ] 当前激活项高亮显示（使用 Pencil tokens：`bg-surface-2`、`text-text-primary`）
- [ ] 点击图标切换对应页面（通过路由跳转）
- [ ] 鼠标悬停显示 Tooltip（功能名称）
- [ ] 使用 lucide-vue-next 图标
- [ ] 全局始终显示，不受页面滚动影响
- [ ] 响应式：移动端适配（可选折叠为底部导航）

## 阻塞于

- f-01-auth-pages（需要登录后才能看到边栏）
- f-02-route-guard（需要路由系统就绪）

## 范围外

- 可拖拽排序图标
- 自定义图标上传
- 侧边栏宽度调整

## Agent 简报

**分类：** enhancement
**摘要：** 全局左侧边栏导航，64px 固定宽度，上下分区

**当前行为：**
前端无边栏导航，页面间无法切换。

**期望行为：**
用户通过左侧边栏在不同功能模块间快速切换，当前位置清晰可辨。

**关键接口：**
- `packages/webui/src/components/layout/AppSidebar.vue` — 边栏组件
- Vue Router — 页面切换
- lucide-vue-next — 图标（MessageSquare、Folder、Clock、Settings）

**验收标准：**
- [ ] 64px 固定宽度边栏
- [ ] 上区：消息、文件夹图标
- [ ] 下区：时钟、齿轮图标
- [ ] 当前激活项高亮
- [ ] 点击切换页面
- [ ] 悬停显示 Tooltip
- [ ] 使用 lucide 图标
- [ ] 全局始终显示
- [ ] 移动端适配

**范围外：**
- 可拖拽排序
- 自定义图标
- 宽度调整
