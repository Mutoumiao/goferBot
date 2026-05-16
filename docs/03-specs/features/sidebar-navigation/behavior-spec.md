# 行为规格：Sidebar 导航

> 对应 issue: `f-03-sidebar-navigation`
> 依赖: `f-01-auth-pages`, `f-02-route-guard`

---

## 入口

- 触发：应用启动后全局挂载于 `App.vue`，所有非隐藏路由默认可见
- 路由：Sidebar 本身无独立路由，作为布局组件随页面加载

---

## 初始状态

- 桌面端（>= 768px）：左侧 64px 固定宽度边栏，背景 `bg-surface-nav`
- 上区：Logo 图标 + 消息图标（问答首页）+ 文件夹图标（知识库管理）
- 下区：时钟图标（对话历史）+ 齿轮图标（设置）
- 默认激活项：`chat`（问答首页）
- 移动端（< 768px）：底部 48px 固定高度导航栏，4 个功能图标等分宽度，Logo 不显示

---

## 交互状态

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| default | 图标 `text-text-tertiary`，背景透明 | 悬停/点击 | 悬停触发 Tooltip，点击跳转路由 |
| active | 图标 `text-text-primary`，背景 `bg-nav-active` | 点击 | 当前路由已激活，无额外响应 |
| hover | 图标 `text-text-secondary`，背景 `bg-surface-3/70` | 移出 | 恢复 default/active 状态 |
| loading（启动时） | Sidebar 正常显示，内容区显示加载动画 | 无 | 登录态检查完成后内容区渲染页面 |

---

## 正常流程

### 桌面端页面切换

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 鼠标悬停未激活图标 | 延迟 300ms 后显示 Tooltip | Tooltip 出现：right 位置，背景 `bg-surface-2`，文字 `text-primary` |
| 2 | 鼠标移出 | Tooltip 消失 | 恢复图标默认状态 |
| 3 | 点击图标 | `router.push({ name })` | 目标页面加载，对应图标变为 active 高亮 |

### 移动端页面切换

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击底部图标 | `router.push({ name })` | 目标页面加载，对应图标变为 active 高亮 |
| 2 | 滑动页面 | 底部栏固定不动 | 无变化 |

---

## Tooltip 行为

### 触发条件
- 鼠标悬停在非激活图标上 300ms 后显示
- 鼠标移出或点击后立即消失

### 视觉规范
- 位置：`side="right"`，`sideOffset: 8`
- 背景：`bg-surface-2`
- 文字：`text-primary`，`text-xs`
- 圆角：`rounded-md`
- 箭头：不显示（侧边栏空间紧凑）
- 动画：`fade-in-0` + `zoom-in-95`，使用 shadcn-vue Tooltip 默认动画

### 内容映射

| 图标 | Tooltip 内容 |
|------|--------------|
| 消息图标 | 问答首页 |
| 文件夹图标 | 知识库 |
| 时钟图标 | 历史记录 |
| 齿轮图标 | 设置 |

---

## 移动端适配行为

### 断点
- 触发条件：屏幕宽度 < 768px（Tailwind `md:` 断点）

### 布局变化
- 侧边栏从左侧移除
- 底部出现 48px 高度固定导航栏
- 背景：`bg-surface-nav`
- 上边框：`border-t border-border-default`
- 4 个功能图标等分宽度（`flex-1`），水平排列
- Logo 和下区概念消失，所有图标平铺于底部
- 激活态样式与桌面端一致（`bg-nav-active` / `text-text-primary`）

### 安全区域
- 底部导航栏需避让系统手势区域（`pb-safe` 或 `env(safe-area-inset-bottom)`）

---

## 路由元信息控制

### meta 字段定义

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `requiresAuth` | `boolean` | `false` | 是否需登录（由 `f-02-route-guard` 消费） |
| `hideSidebar` | `boolean` | `false` | 是否显式隐藏 Sidebar |

### 路由配置示例

```typescript
const routes = [
  { path: '/', name: 'chat', component: ChatPage, meta: { requiresAuth: true } },
  { path: '/knowledge-base', name: 'knowledgeBase', component: KnowledgeBasePage, meta: { requiresAuth: true } },
  { path: '/history', name: 'history', component: HistoryPage, meta: { requiresAuth: true } },
  { path: '/settings', name: 'settings', component: SettingsPage, meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: LoginView, meta: { hideSidebar: true } },
  { path: '/register', name: 'register', component: RegisterView, meta: { hideSidebar: true } },
]
```

### 显示逻辑（App.vue）

```
当前路由 meta.hideSidebar === true
    ├─ 是 → 不渲染 Sidebar
    └─ 否 → 渲染 Sidebar
```

### 登录态检查期间

- 应用启动时调用 `getSession()` 检查登录态
- 检查期间 Sidebar **正常显示**（用户已处于主界面布局）
- 内容区显示加载动画（如骨架屏或 Spinner），不渲染具体页面内容
- 检查完成后：
  - 已登录 → 内容区渲染目标页面
  - 未登录 → 路由守卫跳转 `/login`，Sidebar 随 `hideSidebar` 隐藏

---

## 错误场景

| 场景 | 触发 | 视觉 | 恢复 |
|------|------|------|------|
| 路由不存在 | 用户访问未定义路径 | Sidebar 仍显示（若未命中 `hideSidebar`），内容区 404 | 返回首页 |
| 图标映射缺失 | 新增路由但未在 Sidebar 配置图标 | 图标不显示或显示占位符 | 补充 navItems 配置 |
| Tooltip 延迟累积 | 快速悬停多个图标 | 仅最后一个悬停目标显示 Tooltip | 移出鼠标后全部消失 |

---

## 动画与过渡

| 过渡 | 持续时间 | 缓动 | 备注 |
|------|----------|------|------|
| 图标 hover 背景色 | 200ms | `transition-all` | 已存在于现有代码 |
| Tooltip 出现 | 150ms | `ease-out` | shadcn-vue 默认 fade-in |
| Tooltip 消失 | 100ms | `ease-in` | shadcn-vue 默认 fade-out |
| 移动端布局切换 | 即时 | 无 | Tailwind 响应式类切换，无过渡动画 |

---

## 无障碍

- 键盘导航：每个图标按钮可通过 Tab 聚焦，Enter/Space 触发跳转
- 屏幕阅读器：图标按钮需有 `aria-label`（Tooltip 内容可作为 label）
- 触摸目标：移动端底部图标最小点击区域 48x48px（已满足）
- 焦点可见：使用 `focus-visible:ring-ring/50`（shadcn-vue Button 默认）

---

## 响应式行为

| 断点 | 布局变化 |
|------|----------|
| < 768px | Sidebar 隐藏，底部 48px 导航栏出现，4 图标等分 |
| >= 768px | 左侧 64px Sidebar，上下分区，Logo 显示 |
| >= 1024px | 与 768px 一致，无额外变化 |
| >= 1440px | 与 768px 一致，无额外变化 |

---

## 组件接口

### AppSidebar.vue Props

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `activeType` | `string` | 否 | 当前激活的 route name，默认 `'chat'` |

### AppSidebar.vue Events

| Event | 参数 | 说明 |
|-------|------|------|
| `navigate` | `name: string` | 点击图标时触发，由父组件调用 `router.push` |

### 重构建议（替代现有多个 emit）

现有 `SideBar.vue` 使用 5 个独立 emit（`openChat`、`openKnowledgeBase` 等），建议重构为单一 `navigate` emit，简化 `App.vue` 绑定：

```vue
<!-- App.vue -->
<AppSidebar
  :active-type="(route.name as string) ?? 'chat'"
  @navigate="(name) => router.push({ name })"
/>
```

---

## 验收标准

- [ ] 鼠标悬停图标 300ms 后显示 Tooltip，位置 right，样式符合规范
- [ ] 屏幕宽度 < 768px 时，Sidebar 折叠为底部 48px 导航栏，4 图标等分
- [ ] 组件文件位于 `packages/webui/src/components/layout/AppSidebar.vue`
- [ ] 登录页（`/login`）和注册页（`/register`）不显示 Sidebar
- [ ] 应用启动登录态检查期间，Sidebar 正常显示，内容区显示加载状态
- [ ] 路由配置包含 `meta.hideSidebar` 和 `meta.requiresAuth` 字段
- [ ] 所有图标继续使用 lucide-vue-next，颜色使用 Pencil tokens
- [ ] 键盘可聚焦所有导航图标，屏幕阅读器可识别功能名称
