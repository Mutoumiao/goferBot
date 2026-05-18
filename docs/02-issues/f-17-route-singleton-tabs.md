---
id: f-17-route-singleton-tabs
type: issue
status: needs-triage
track: frontend
priority: p2
summary: 为非 Chat 页面路由添加 singleton 元数据标记，Tab Store 据此阻止重复打开同一类型标签。侧边栏点击已打开的 singleton 页面 → 激活已有标签而非新建。
blocked_by: [f-15-global-tab-bar, f-16-unified-tab-types]
blocks: []
spec: docs/03-specs/f-17-route-singleton-tabs/
plan: docs/04-plans/f-17-route-singleton-tabs/v1.md
tests: docs/08-test-cases/f-17-route-singleton-tabs/
token_estimate: 700
---

状态: needs-triage
分类: refactor

## 要构建的内容

利用 Vue Router `meta` 字段标记非 Chat 路由为 singleton，Tab Store 在 addTab 时检查：若同类型 singleton 标签已存在 → 激活已有标签，不新建。

## 规格引用

- 功能规格: docs/03-specs/f-17-route-singleton-tabs/feature-spec.md
- 行为规格: docs/03-specs/f-17-route-singleton-tabs/behavior-spec.md
- API 规格: 无

## 验收标准

- [ ] 路由配置中 knowledgeBase / history / settings / recycleBin 路由 `meta.singleton: true`
- [ ] chat 路由 `meta.singleton: false`（允许多开）
- [ ] Tab Store `addTab` 检查 singleton 标记，拒绝重复创建
- [ ] 侧边栏点击已打开的 singleton 页面 → 激活已有标签，不新建
- [ ] 侧边栏点击 chat → 始终新建标签（home 标签除外）
- [ ] `pnpm type-check` 通过

## 阻塞于

- f-15-global-tab-bar（需要全局 TabBar 架构）
- f-16-unified-tab-types（需要统一 Tab Store）

## 范围外

- 标签拖拽排序
- 标签持久化

## Agent 简报

**分类：** refactor
**摘要：** 路由 meta.singleton 驱动标签去重，非 Chat 页面不重复打开

**当前行为：**
无标签系统在路由层面。侧边栏直接调用 `router.push()` 切换页面，无去重逻辑。

**期望行为：**
侧边栏点击 → Tab Store 检查 singleton 标记 → 已有则激活，无则新建。Chat 始终新建，其他页面复用在标签。

**关键接口：**
- `packages/webui/src/router/index.ts` — 路由 meta 扩展
- `packages/webui/src/stores/tabs.ts` — addTab singleton 检查
- `packages/webui/src/components/layout/AppSidebar.vue` — 导航逻辑适配

**验收标准：**
- [ ] 路由 meta.singleton 正确配置
- [ ] addTab 去重逻辑
- [ ] 侧边栏 singleton 页面激活已有标签
- [ ] chat 始终新建
- [ ] type-check 通过

**范围外：**
- 拖拽
- 持久化
