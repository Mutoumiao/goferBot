---
id: f-18-cleanup-chatpage
type: issue
status: needs-triage
track: frontend
priority: p2
summary: 删除未使用的 ChatPage.vue 遗留组件。该组件未被任何文件引用，属于 v1 遗留替代实现。
blocked_by: []
blocks: []
spec: docs/03-specs/f-18-cleanup-chatpage/
plan: docs/04-plans/f-18-cleanup-chatpage/v1.md
tests: docs/08-test-cases/f-18-cleanup-chatpage/
token_estimate: 300
---

状态: needs-triage
分类: refactor

## 要构建的内容

删除 `packages/webui/src/components/ChatPage.vue`，确认零引用后移除文件。

## 规格引用

- 功能规格: docs/03-specs/f-18-cleanup-chatpage/feature-spec.md
- 行为规格: 无（纯删除）
- API 规格: 无

## 验收标准

- [ ] `grep -r "ChatPage" packages/webui/src/` 无引用（除文件自身）
- [ ] `pnpm type-check` 通过
- [ ] `pnpm dev:web` 启动无错误
- [ ] 删除 `packages/webui/src/components/ChatPage.vue`

## 阻塞于

- 无

## 范围外

- 其他遗留组件清理
- 类型定义清理（f-16 负责）

## Agent 简报

**分类：** refactor
**摘要：** 删除未使用的 ChatPage.vue 遗留组件

**当前行为：**
`packages/webui/src/components/ChatPage.vue` 存在但未被任何路由/组件/Store 引用。引用了不存在的 store 属性（`store.tabs`、`store.activeTab`）。

**期望行为：**
文件被删除，项目零引用，构建无影响。

**关键接口：**
- `packages/webui/src/components/ChatPage.vue` — 待删除

**验收标准：**
- [ ] 零引用确认
- [ ] type-check 通过
- [ ] dev 启动正常
- [ ] 文件已删除

**范围外：**
- 其他遗留清理
