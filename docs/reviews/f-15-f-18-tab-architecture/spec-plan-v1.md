---
scope: f-15-f-18-tab-architecture
type: spec
date: 2026-05-18
issues: [f-15-global-tab-bar, f-16-unified-tab-types, f-17-route-singleton-tabs, f-18-cleanup-chatpage]
status: completed
---

# Tab 架构重构 — Spec & Plan 审查

## 审查摘要

- **审查类型**：Spec 对齐 + Plan 审查
- **审查对象**：4 个 issue 的 spec（feature-spec + behavior-spec）和 plan（v1）
- **总体结论**：有条件通过
- **问题统计**：Critical 1 | Major 3 | Minor 2 | Info 1

---

## 发现的问题

### 🔴 Critical

1. **f-17 plan: `useRouter()` 在函数体内调用**
   - 位置：`docs/issues/f-17-route-singleton-tabs/plans/v1.md:105`
   - 详情：`addTabByRoute` 函数内部调用 `const router = useRouter()`。Vue 3 组合式 API 要求 `useRouter()` 必须在 `setup()` 顶层或 composable 顶层同步调用，不能在普通函数内部调用。运行时会抛出 `[Vue warn]: inject() can only be used inside setup()`。
   - 建议：在 Store setup 顶层调用 `useRouter()` 并赋值给闭包变量，或直接 import router 实例（`@/router`）。
   - 依据：Vue 3 Composition API 规范

```typescript
// ❌ 错误
function addTabByRoute(routeName: string) {
  const router = useRouter()  // 运行时错误
  // ...
}

// ✅ 正确
import router from '@/router'

function addTabByRoute(routeName: string) {
  const route = router.getRoutes().find(r => r.name === routeName)
  // ...
}
```

### 🟠 Major

2. **f-15 plan: `+` 新建标签缺少 session 创建逻辑**
   - 位置：`docs/issues/f-15-global-tab-bar/plans/v1.md` — 任务 3 AuthenticatedLayout
   - 详情：`onNewChat` 只调 `tabsStore.addTab('chat')`，不创建 session。而原 ChatView 的 `onNewChat` 会先调 `sessionStore.createSession()` 再将 sessionId 传给 `addTab`。新行为下点击"+"创建的是无 session 的空 chat 标签，且 ChatView 的 `handleSend` 仍用 `updateHomeTabSession` 只更新 home 标签——意味着非 home 的 chat 标签发消息后不会关联新 session。
   - 建议：全局标签栏的"+"应创建空标签（无 session），但 ChatView `handleSend` 中的 `onNewSession` 回调需改为更新当前激活标签而非写死 home。
   - 依据：behavior-spec.md — "自动创建一个无对话标签(首页)"

3. **f-15 plan: 路由同步可能冗余导航**
   - 位置：`docs/issues/f-15-global-tab-bar/plans/v1.md` — 任务 3 `watch(() => tabsStore.activeTab, ...)`
   - 详情：`handleNavigate` 已调用 `router.push`，然后 Store 的 `addTab` 改变 `activeTab` 又触发 watch 再次 `router.push`。虽然 `route.name !== targetRoute` 守卫可能阻止第二次，但依赖 Vue Router 内部去重而非显式控制流，容易引入边界 bug。
   - 建议：拆分为两个方向：侧边栏 → Tab（handleNavigate 负责），Tab 切换 → URL（watch 负责）。`handleNavigate` 不直接 push，由 watch 统一处理 URL 同步。

4. **f-17 plan: Store 直接 import router 存在循环依赖风险**
   - 位置：`docs/issues/f-17-route-singleton-tabs/plans/v1.md` — 任务 2
   - 详情：`tabs.ts` import `@/router` 时，router 文件 lazy-load 组件，组件可能 import Store。虽然 Pinia + Vue Router 通常能处理（Pinia 在 app.use 之后创建），但依赖方向 `Store → Router → Layout → Store` 是脆弱的。
   - 建议：将 singleton 配置从路由 meta 提取为独立的路由配置表 `TAB_ROUTE_CONFIG`，Store 引用配置表而非 router 实例。或保持 f-16 的硬编码 `SINGLETON_TYPES` 方式——代码量更少，且新增页面的频率极低。

### 🟡 Minor

5. **f-16 spec: 决策表标记"可逆"但未描述逆条件**
   - 位置：`docs/issues/f-16-unified-tab-types/specs/feature-spec.md` — 决策"单例逻辑内置于 Store 的 addTab 中"
   - 详情：标记为"可逆（可迁至路由 meta 驱动）"，但实际上 f-17 就是做这个迁移。决策表应该能独立理解，读者从 f-16 看不出 f-17 即将发生。
   - 建议：在决策理由中加注"后续由 f-17 迁移至路由 meta 驱动"。

6. **f-15 behavior-spec: 决策树 `tabCount <= 2` 逻辑不精确**
   - 位置：`docs/issues/f-15-global-tab-bar/specs/behavior-spec.md:49`
   - 详情：`if tabCount <= 2 → true` — 这里 `tabCount` 包含 home 标签。实际意图是：**只剩 1 个非 home 标签时可关闭**（关闭后自动 home）。写成 `tabCount <= 2` 等价，但依赖"home 始终存在"的隐含假设。如果未来 home 标签行为变化，这个条件会出错。
   - 建议：改为 `closableTabsCount <= 1`（排除 home），语义更清晰。

### 🔵 Info

7. **跨 issue 依赖链可简化**
   - f-16 在 Store 内硬编码 `SINGLETON_TYPES`，f-17 又把它迁移到路由 meta。如果 f-16 一开始就用路由配置表（不走 router 实例），f-17 就变成纯粹的"将配置表移动到路由 meta"——少一轮 Store 内部重构。
   - 但当前拆分方式让 f-16 可独立交付（不依赖路由变更），降低耦合，也是合理的权衡。

---

## Spec-Plan 对齐检查

### f-16: 统一 Tab 类型

| Spec 要求 | Plan 覆盖 | 证据 |
|-----------|----------|------|
| 删除 ChatTab | ✅ | 任务 2 - 删除 chatTabs.ts |
| Tab 接口成唯一类型 | ✅ | 任务 1 - 验证 Tab 完整性 |
| Store 重命名为 tabs.ts | ✅ | 任务 2 - 创建 tabs.ts |
| 单例/多重逻辑 | ✅ | 任务 2 - SINGLETON_TYPES |
| ChatView 消费者迁移 | ✅ | 任务 3 - 适配 ChatView |
| TabBar Props 适配 | ✅ | 任务 4 - 适配 TabBar |
| type-check 通过 | ✅ | 任务 5 |

### f-18: 清理 ChatPage

| Spec 要求 | Plan 覆盖 | 证据 |
|-----------|----------|------|
| 零引用验证 | ✅ | 任务 1 步骤 1 - grep |
| 删除文件 | ✅ | 任务 1 步骤 3 - rm |
| 构建通过 | ✅ | 任务 2 - vue-tsc + vite build |

### f-15: 全局标签栏

| Spec 要求 | Plan 覆盖 | 证据 |
|-----------|----------|------|
| Layout 插入 header | ✅ | 任务 3 |
| TabBar 从 ChatView 移除 | ✅ | 任务 4 |
| 关闭决策树 | ✅ | 任务 1 - canClose |
| 自动创建 home | ✅ | 任务 1 - createHomeTab |
| 侧边栏 → 标签激活 | ✅ | 任务 3 - handleNavigate |
| Chat 多开 / 其他单例 | ✅ | 任务 3（依赖 f-16 Store） |
| 标签横向滚动 | ⚠️ | 未在 plan 中显式处理（TabBar 已有此功能） |
| 动画过渡 | ⚠️ | 未在 plan 中显式处理（TabBar 已有 CSS） |
| 无障碍 | ❌ | 未在 plan 中包含 ARIA/键盘导航任务 |
| type-check 通过 | ✅ | 任务 6 |

### f-17: 路由单例

| Spec 要求 | Plan 覆盖 | 证据 |
|-----------|----------|------|
| 路由 meta.singleton | ✅ | 任务 1 |
| 路由 meta.tabType | ✅ | 任务 1 |
| addTabByRoute | ✅ | 任务 2（但有 Critical bug） |
| AppSidebar 适配 | ✅ | 任务 3 |
| type-check 通过 | ✅ | 任务 4 |

---

## 安全审查

纯前端重构，无认证/授权/后端变更。无安全问题。

---

## 修复确认

待用户修复后复查。
