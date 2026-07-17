# Chat 工作台 UI 开发指南

> **REFERENCE_ONLY**：业务规则权威源为 [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md)、[openspec/specs/settings/spec.md](../../../../openspec/specs/settings/spec.md)（WHAT）。本文件记录 HOW：壳层布局、会话交互、输入组件、引用 UI、模型选择与 Keep-Alive 约定。

---

## Purpose

指导 Web 端 `/chats` 及认证壳层相关 UI 的实现与扩展，避免再次引入占位假功能、双套输入框、错误的模型选择交互。

## Primary OpenSpec

- [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md) — 会话、SSE、Web 工作台交互、引用展示
- [openspec/specs/settings/spec.md](../../../../openspec/specs/settings/spec.md) — `GET /settings/chat/providers`

## Related OpenSpec

- [openspec/specs/session/spec.md](../../../../openspec/specs/session/spec.md) — Session/Message 契约
- [openspec/specs/knowledge-base/spec.md](../../../../openspec/specs/knowledge-base/spec.md) — KB 绑定

## Module Dependencies

- `packages/web/src/components/layout/WorkspaceStage.tsx` — 右侧舞台（灰底 padding + 业务白卡）
- `packages/web/src/components/layout/SettingsSurface.tsx` — 设置类居中透明
- `packages/web/src/components/sidebar/Sidebar.tsx` — 70px Icon Rail
- `packages/web/src/lib/route-keepalive*.tsx` — 一级页 Keep-Alive
- `packages/web/src/features/chat/components/*` — 会话业务 UI
- `packages/web/src/globals.css` — `.gofer-workspace-card` / 设计 token

## Development Entry

| 场景 | 入口 |
|------|------|
| 认证壳 | `routes/_authenticated.tsx` → `IconSidebar` + `WorkspaceStage` + `KeepAliveOutlet` |
| 会话页 | `features/chat/components/ChatsPage.tsx` |
| 空态 | `ChatEmptyHome.tsx` |
| 会话消息 | `ChatSessionPanel.tsx` → `ChatSessionView.tsx` |
| 统一输入 | `ChatComposer.tsx` |
| 引用 | `SourceCitations.tsx` + `SourceDocsFloatingPanel` |
| 模型列表 | `services.fetchProviders` + `ProviderSelector.tsx` |
| 会话列表 | `SessionListPanel.tsx` |

---

## Implementation Notes

### 1. 应用壳：Icon Rail + 舞台 + 白卡

```
[Icon Rail 70px #F0F2F7] | [workspace-stage #F0F2F7 padding 10/10/10/5]
                           └─ main.gofer-workspace-card  (业务路由)
                           └─ main 透明                 (settings / profile / recycle)
```

**约定**：

- 业务一级页（chats / knowledgeBase / companions 等）由 `WorkspaceStage` 统一挂白卡（圆角 12 + **内阴影**）；页面根节点 **不要再套一层** `gofer-workspace-card`。二级业务（表单/配置/管理）用命令式弹层，**禁止**再挂会离开一级精确 path 的 file route。
- 设置类页使用 `SettingsSurface`：透明底、`max-w-[925px]` 居中；item 卡片自带白底即可。
- 白卡内二级侧栏与内容区均为白底，分隔线用 `border-border-panel`（`#E6E8EB`）。

**判定 plain surface**：

```ts
// WorkspaceStage
const PLAIN = settings | profile | recycle
```

### 2. Icon Rail 导航

- **主区**：`chats` / `knowledgeBase` / `companion`（`router-register` `navSection: 'primary'`）
- **次区**：`settings` / `recycle`
- **个人资料**：仅顶栏头像进入；`profile.navSection = null`，禁止再挂「用户」icon
- **禁止**：无业务动作的「菜单」占位按钮

### 3. 会话创建与选中态

| 规则 | 说明 |
|------|------|
| 选中态 | `useChatStore.selectedSessionId`，不写 URL |
| 智能对话 | `onNewChat` → `selectedSessionId = null` → `ChatEmptyHome` |
| 新建会话 | 空态 `submitTempChat` 创建 Session → `setSelectedSessionId` → 列表 reload |
| 禁止 | 列表顶栏「+ 新会话」按钮作为主入口 |

列表刷新边沿（空态→有选中且列表无该项）见 `ChatsPage` 中 `prevSelectedIdRef` effect。

### 4. ChatComposer（统一输入）

空态与会话内 **必须** 使用 `ChatComposer`，禁止再分叉 Ant Design `Sender` 与自建胶囊两套 UI。

**仅保留已实现能力**：

- 知识库 chip（必选 ≥1）
- 模型 chip
- 多行文本 + 字数 + 发送 / 流式中止

**禁止再加未实现主路径**：编辑/图片/麦克风/附件/拖入文件、场景营销卡、假「智能体更新」计数。

### 5. SourceCitations（引用）

```
默认：SourceCitations 紧凑触发器「引用 N 篇资料作为参考」
点击：ChatSessionView 右上角 SourceDocsFloatingPanel
列表：uniqueSourceDocuments(document_id) — 无 content 段落
```

- `onOpenPanel` 由会话视图托管浮层；无托管时组件内可就近 popover。
- 文档名：后端暂无 `document_name` 时用 `文档 {shortId}` 占位。

### 6. ProviderSelector 与 fetchProviders

**交互契约**（防「点不中」）：

```tsx
// 受控 open；项用 button；mousedown preventDefault；选中后 close
onMouseDown={(e) => e.preventDefault()}
onClick={() => handlePick(key)}
```

- 空列表 **不要** `disabled={providers.length===0}`；允许打开看空态 + 重试。
- `ChatComposer` 挂载时若列表空且非 loading → `fetchProviders()`。
- `ChatsPage` 二次激活且列表仍空 → `fetchProviders({ force: true })`。
- 展开逻辑：`services.fetchProviders` 将 Provider.models 过滤为 LLM（`enabled !== false`，`type` 缺省当 llm），key = `{id}#{name}`。
- 展示：触发器优先显示 **model 名**（避免同 provider 多模型看起来「没切换」）。

### 7. Keep-Alive 与请求纪律

- 一级页：`useKeepAliveSilentRefresh`（首进 `silent:false`，回访 `silent:true`）
- `companions` **不在** `PRIMARY_WARM_KEYS`；列表 API 仅在页 active 时请求
- 业务列表二次进入：有缓存则无骨架静默覆盖

---

## Testing Checklist

- [ ] `tests/chat/ProviderSelector.test.tsx` — 打开、选中、空态重试
- [ ] `tests/chat/SourceCitations.test.tsx` — 紧凑摘要、无段落、浮层
- [ ] `tests/chat/ChatEmptyHome.test.tsx` / SessionListPanel — 无 new-chat-btn / 无 quick-actions / 无 copilot
- [ ] `tests/components/sidebar.test.tsx` — 无 rail-profile / 无 rail-menu；头像进 profile
- [ ] e2e `web-route-shell`：`session-home-entry` 回空态（非 new-chat-btn）
- [ ] **无** `tabManager` / `workspace.store` / `TabBar` / `ChatHistoryPage` / `ChatPageByTab` 源码残留

## Review Checklist

- [ ] 未重新引入占位主路径 UI
- [ ] 空态与会话共用 `ChatComposer`
- [ ] 业务页未双层白卡
- [ ] Provider 选择 mousedown 防护仍在
- [ ] 设置类页 plain + 925 宽

## Dead Code Policy（强制）

路由/壳层演进后 **直接删除** 旧实现，禁止长期保留 `@deprecated` 空壳或「仅 redirect」的假路由：

| 已删除 / 应删除 | 替代 |
|-----------------|------|
| `TabBar` / `TabRouteSync` / `tabManager` / `workspace.store` | URL + `router.navigate` + `selectedSessionId` |
| `ChatHistoryPage` / `ChatHistoryList` | `SessionListPanel`（`/chats` 左栏） |
| `ChatPageByTab` / `ChatTempHome` | `ChatsPage` / `ChatEmptyHome` |
| `WorkspaceCard` / `WorkspaceSurface` | `WorkspaceStage` + `SettingsSurface` |
| `/chat`、`/chat/*`、`/history` 及任何 **redirect 兼容壳** | 唯一会话入口 `/chats`（**零 redirect**，开发期不做书签兼容） |
| Companion 二级 file route（`/companions/new`、`/$id/edit|care|memories|chat`） | 一级 `/companions` + 命令式 `openCompanion*Dialog` |

**禁止**：为迁移而长期保留 `beforeLoad → redirect` 空壳。  
**仅允许的非业务残留**：登出清理 legacy `gofer-workspace-v1` 等 storage 键（非路由）。

权威变更：`openspec/changes/web-l1-cache-l2-dialogs`、`docs/grill-sessions/2026-07-17-l1-keepalive-l2-dialog-grilling.md`。

## Common Pitfalls

| 症状 | 原因 | 修复 |
|------|------|------|
| 模型按钮灰、点不开 | `disabled={providers.length===0}` | 允许打开 + 空态重试 |
| 点模型项无反应 | Popover 抢焦点，click 丢失 | `onMouseDown preventDefault` + 受控 close |
| 选择了但看起来没变 | 触发器只显示 provider `name` | 显示 `model` |
| 永远无模型 | `enabledProviders=[]` 且旧后端不回退 | 后端空列表回退池中全部 LLM |
| 白卡无圆角 | 只在页面内挂 class、被 overflow 裁切 | 壳层 `WorkspaceStage` 挂 `.gofer-workspace-card` |
| 又出现 +新会话 | 与空态流程重复 | 删除按钮，走智能对话 + 首条发送 |
| 双份历史 UI / Tab 空壳 | 新旧并存未删 | 按 Dead Code Policy 删除旧路径 |
## Reusable Patterns

### 设置类表面

```tsx
<SettingsSurface testId="settings-page" maxWidthClassName="max-w-[925px]">
  {children}
</SettingsSurface>
```

### 业务页根节点

```tsx
// 壳层已提供白卡；页内：
<div className="relative flex h-full min-h-0 overflow-hidden bg-transparent" data-testid="chats-page">
  {/* 二级侧栏 + 内容 */}
</div>
```

---

## Design Decisions

### 白卡挂在壳层而非每页

**Context**：每页自套圆角内阴影易被 keep-alive slot / overflow 削弱，且设置页要透明。  
**Decision**：`WorkspaceStage` 按路由切换 `card | plain`；业务页只填内容。

### 无「+ 新会话」

**Context**：空态发送已创建 Session。  
**Decision**：列表只保留「智能对话」入口清选中；创建与 active 由发送链路完成。

### 引用默认不展开段落

**Context**：大段 content 占满消息区、干扰阅读。  
**Decision**：文档级摘要 + 右上角列表；与 OpenSpec「Web Chat 引用来源展示」对齐。
