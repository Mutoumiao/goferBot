---
id: f-40
status: open
track: frontend
priority: p0
summary: 迁移 Pinia session.ts → Zustand chat store 扩展 — 会话列表、活跃会话管理、CRUD 操作状态
blocked_by:
  - f-33
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.6 阶段二补全
---

## 要构建的内容

将 `packages/webui/src/stores/session.ts`（Pinia session store）迁移到 `packages/web/src/stores/chat.ts`（Zustand chat store 扩展）。当前 chat store 仅有 `activeSession` + `messages` + streaming 状态，缺失会话列表管理（CRUD）。

## 规格引用

- 功能规格: specs/feature-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.6 阶段二补全
- **核心目标**: 补齐阶段二缺失的 session store，为 ChatView 会话管理提供状态基础设施
- **验收标准**: Zustand store 完整覆盖 Pinia session.ts 的功能

## 验收标准

- [ ] `stores/chat.ts` 扩展 `sessions: Session[]` + `isLoadingSessions` 状态
- [ ] `setSessions` / `addSession` / `removeSession` / `updateSession` actions
- [ ] 与 `api/chat.ts` 的 `getSessions` / `createSession` / `deleteSession` 方法对接
- [ ] 单元测试覆盖：CRUD 操作、乐观更新边界、错误恢复

## 阻塞于

f-33（auth 系统）

## 范围外

- 不涉及 UI 页面改动（仅 store 层）
- 不涉及后端 API 修改
