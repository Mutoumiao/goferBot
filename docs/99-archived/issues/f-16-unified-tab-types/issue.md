---
id: f-16-unified-tab-types
type: issue
status: closed
track: frontend
priority: p1
summary: 统一 Tab 类型系统——将 chatTabs.ts 的 ChatTab 类型合并到 types/index.ts 已定义的 Tab/TabType 接口，重构 Pinia Store 支持多类型标签（chat/knowledgeBase/history/settings/recycleBin）。
blocked_by: []
blocks: [f-15-global-tab-bar]
spec: docs/03-specs/f-16-unified-tab-types/
plan: docs/04-plans/f-16-unified-tab-types/v1.md
tests: docs/08-test-cases/f-16-unified-tab-types/
token_estimate: 900
---

状态: needs-triage
分类: refactor

## 要构建的内容

重构 Tab 类型系统：废弃 chatTabs.ts 中的 ChatTab 接口，落地 types/index.ts 中已定义但未使用的 Tab/TabType 类型。Store 从仅管理 Chat 标签扩展为管理多类型标签。

## 规格引用

- 功能规格: docs/03-specs/f-16-unified-tab-types/feature-spec.md
- 行为规格: docs/03-specs/f-16-unified-tab-types/behavior-spec.md
- API 规格: 无（纯类型/Store 重构）

## 验收标准

- [ ] `types/index.ts` 的 `Tab` 接口成为唯一标签类型，删除 `ChatTab`
- [ ] `TabType` 联合类型覆盖 chat / knowledgeBase / history / settings / recycleBin
- [ ] `stores/chatTabs.ts` 重构为 `stores/tabs.ts`，使用 `Tab` 类型
- [ ] Store 支持单例标签（非 chat 类型只允许一个实例）和多重标签（chat 类型允许多个）
- [ ] 现有 ChatView 的 TabBar 功能不受影响（类型兼容迁移）
- [ ] 类型检查通过（`pnpm type-check`）

## 阻塞于

- 无

## 范围外

- TabBar UI 提升至 Layout（f-15 负责）
- 路由元数据集成（f-17 负责）
- 标签持久化存储

## Agent 简报

**分类：** refactor
**摘要：** 统一 Tab 类型系统，合并 ChatTab 到 Tab 接口，Store 支持多类型标签

**当前行为：**
`types/index.ts` 定义了 `Tab`/`TabType` 但未使用；`chatTabs.ts` 使用独立的 `ChatTab` 类型，仅支持 chat 类型。两套类型互不兼容。

**期望行为：**
`Tab` 接口作为唯一标签类型，Store 管理所有 TabType 的标签，支持单例/多重模式。

**关键接口：**
- `packages/webui/src/types/index.ts` — `Tab`, `TabType`
- `packages/webui/src/stores/chatTabs.ts` → `tabs.ts` — 重构后 Store
- `packages/webui/src/views/ChatView.vue` — 消费者（类型迁移）

**验收标准：**
- [ ] Tab 接口成为唯一类型
- [ ] TabType 覆盖全部 5 种页面
- [ ] Store 重命名为 tabs.ts
- [ ] 单例/多重标签模式
- [ ] ChatView 兼容
- [ ] type-check 通过

**范围外：**
- UI 提升
- 路由集成
- 持久化
