# 行为规格：全局标签栏

## 入口
- 路由：所有 `/app/*` 路由（AuthenticatedLayout 包裹）
- 触发：登录后始终可见

## 初始状态
- 1 个 home 标签：`{ id: 'home', type: 'chat', title: '首页', sessionId: null, closable: false }`
- home 标签激活
- 内容区渲染 EmptySession（ChatView 空状态）

## 交互状态

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| loading | 标签正常显示 | 可切换/关闭/新建 | 正常响应 |
| empty | 仅 home 标签 | 无法关闭 home；可新建 chat 或点击侧边栏 | home 保留 |
| error | N/A | N/A | N/A |
| success | 标签栏正常渲染 | 全部操作可用 | 行为正确 |
| partial | 多个标签存在 | 可操作任意标签 | 依规则响应 |

## 正常流程

### 侧边栏 → 标签激活

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击侧边栏"对话" | `addTab({ type: 'chat' })` → 新建 chat 标签并激活 | 新标签出现，内容区显示 ChatView（空会话） |
| 2 | 点击侧边栏"知识库" | 检查 singleton → 不存在则新建标签 → 激活 | 知识库标签出现，内容区显示 KnowledgeBasePage |
| 3 | 再次点击"知识库" | 检查 singleton → 已存在则 `switchTab` | 已有知识库标签激活，不新建 |
| 4 | 点击"对话" | chat 非 singleton → 始终新建标签 | 新 chat 标签出现 |

### 标签关闭逻辑（核心）

| 场景 | 标签列表 | 关闭操作 | 结果 |
|------|---------|----------|------|
| 仅 home | `[home]` | 点击关闭 icon（不显示） | 无法关闭 |
| 全部 chat | `[chat1, chat2, chat3]` | 关闭 chat2 | chat2 移除，激活左邻 |
| 全部非 chat | `[kb, settings]` | 关闭 settings | settings 移除，激活 kb → 只剩 kb → kb 可关 → 关闭后自动创建 home |
| 混合（多个非 chat） | `[chat1, kb, settings]` | 关闭 settings | settings 移除，激活 kb（非最后非 chat） |
| 混合（仅剩1个非 chat） | `[chat1, chat2, kb]` | 关闭 kb | **拒绝** — kb 是最后一个非 chat 标签 |
| 全部关闭 | `[chat1]`（最后一个） | 关闭 chat1 | chat1 移除 → 自动创建 home 标签并激活 |
| 非 chat 关闭到只剩 home | `[kb]`（仅一个非 chat） | 关闭 kb | kb 移除 → 自动创建 home 标签并激活 |

### 标签关闭决策树

```
canClose(tab):
  if tab.id === 'home' → false
  // 排除 home 标签后的可关闭标签数 ≤ 1 时可关（之后自动创建 home）
  closableCount = tabs.filter(t => t.id !== 'home').length
  if closableCount <= 1 → true
  if tab.type !== 'chat':
    nonChatCount = tabs.filter(t => t.type !== 'chat' && t.id !== 'home').length
    if nonChatCount === 1:
      chatExists = tabs.some(t => t.type === 'chat')
      if chatExists → false  // 最后一个非 chat 标签在有 chat 时不可关
  → true
```

### 标签标题编辑

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 双击标签标题 | 标题变为可编辑 input | input 获取焦点 |
| 2 | 输入新标题，回车 | 调用 `renameTab(id, title)` → 关联 session 则调 API | 标题更新 |
| 3 | 按 Esc | 取消编辑 | 恢复原标题 |

## 错误场景

| 场景 | 触发 | 视觉 | 恢复 |
|------|------|------|------|
| 关闭 home 标签 | 代码逻辑错误尝试 closeTab('home') | 无变化 | 操作被静默拒绝 |
| 关闭不存在的标签 | closeTab 传入无效 id | 无变化 | 操作被静默跳过 |
| 重命名时 API 失败 | renameTab → sessionStore.renameSession 失败 | 标题回滚到旧值 | 显示原标题 + toast 错误 |

## 动画与过渡

| 过渡 | 持续时间 | 缓动 | 备注 |
|------|----------|------|------|
| 标签新建出现 | 150ms | ease-out | 从左侧滑入 |
| 标签关闭消失 | 150ms | ease-in | 向左侧收缩 |
| 标签切换（内容区） | 0ms | — | 即时切换（无过渡，保持性能） |
| 删除 icon hover 出现 | 100ms | ease-out | 透明度 0→1 |

## 无障碍
- 键盘导航：Tab 键在标签间移动，Enter 激活，Ctrl+W 关闭当前标签
- 屏幕阅读器：标签角色 `role="tab"`，选中状态 `aria-selected`
- 触摸目标：标签最小 36px 高度（满足 44px 建议时取 38px）

## 响应式行为

| 断点 | 布局变化 |
|------|----------|
| 375px | 标签栏横向滚动，可见 2-3 个标签 |
| 768px | 标签栏横向滚动，可见 4-6 个标签 |
| 1440px | 标签栏可容纳 8-12 个标签后滚动 |
