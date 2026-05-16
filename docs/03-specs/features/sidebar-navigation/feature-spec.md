# 功能规格：Sidebar 导航

> 对应 issue: `f-03-sidebar-navigation`
> 依赖: `f-01-auth-pages`, `f-02-route-guard`

---

## 用户故事

作为用户，我希望通过左侧边栏快速切换功能页面，并获得良好的交互反馈（悬停提示、移动端适配），以便在任何设备上都能高效使用应用。

---

## 边界

### 范围内
- Tooltip 悬停提示（功能名称）
- 移动端响应式适配（< 768px 折叠为底部导航栏）
- 组件目录规范化（迁移到 `components/layout/`）
- 路由元信息控制 Sidebar 显示/隐藏
- 登录页/注册页不显示 Sidebar
- 应用启动登录态检查期间的 Sidebar 行为

### 范围外
- 可拖拽排序图标
- 自定义图标上传
- 侧边栏宽度调整
- 侧边栏展开/收起（抽屉模式）

---

## 已完成 vs 待完成

| 项目 | 状态 | 说明 |
|------|------|------|
| 64px 固定宽度边栏 | 已完成 | `SideBar.vue` 已实现 |
| 上区图标（消息、文件夹） | 已完成 | 问答首页、知识库管理 |
| 下区图标（时钟、齿轮） | 已完成 | 对话历史、设置 |
| 激活项高亮 | 已完成 | 使用 Pencil tokens（`bg-nav-active` / `text-text-primary`） |
| vue-router 适配 | 已完成 | `activeType` 接收 route name，点击 emit 事件 |
| lucide-vue-next 图标 | 已完成 | `MessageSquareTextIcon`, `DatabaseIcon`, `HistoryIcon`, `SettingsIcon` |
| Tooltip 悬停提示 | 待完成 | 需引入 shadcn-vue Tooltip 组件 |
| 移动端底部导航 | 待完成 | < 768px 时切换为 48px 底部栏 |
| 组件迁移到 `layout/` | 待完成 | 重命名为 `AppSidebar.vue` |
| 路由元信息控制显示 | 待完成 | `meta.hideSidebar` / `meta.requiresAuth` |
| 登录/注册页隐藏 Sidebar | 待完成 | 依赖 `f-01-auth-pages` 完成 |

---

## 涉及组件

- `packages/webui/src/components/layout/AppSidebar.vue`（新增，从 `SideBar.vue` 迁移并重命名）
- `packages/webui/src/App.vue`（修改：引入新组件名、绑定路由元信息控制显示逻辑）
- `packages/webui/src/router/index.ts`（修改：为各路由添加 `meta` 字段）

---

## 相关功能

- `f-01-auth-pages` — 提供登录页/注册页，Sidebar 需在这些页面隐藏
- `f-02-route-guard` — 提供路由守卫和登录态检查，Sidebar 需在检查期间正常显示
- `b-01-auth-api` — 提供会话查询 API，支撑登录态判断

---

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 shadcn-vue Tooltip（reka-ui） | 项目已统一使用 shadcn-vue，无需额外依赖 | 是 |
| 移动端 < 768px 切换为底部导航 | 平板/手机自然交互模式，不采用抽屉展开 | 是 |
| 组件命名为 `AppSidebar.vue` 并置于 `layout/` | 与布局组件（如 `AppHeader`、`AppLayout`）统一目录规范 | 否（已确定） |
| 路由元信息使用 `meta.hideSidebar` 显式隐藏 | 默认显示，显式声明隐藏更符合"白名单"思维 | 是 |
