---
id: f-43
status: closed
track: frontend
priority: p0
summary: 迁移 Pinia tabs.ts → Zustand tabs store — 标签页列表、切换、关闭、持久化
blocked_by:
  - f-33
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.6 阶段二补全
---

## 要构建的内容

将 `packages/webui/src/stores/tabs.ts`（Pinia tabs store）迁移到 `packages/web/src/stores/tabs.ts`（Zustand store）。管理顶部标签页列表、激活标签切换、关闭标签（含未保存确认），为 TabBar 组件提供数据层。

## 规格引用

- 功能规格: specs/feature-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.6 阶段二补全
- **核心目标**: 补齐阶段二缺失的 tabs store，为 TabBar 组件提供状态基础设施
- **验收标准**: Zustand store 覆盖 Pinia tabs.ts 的标签页管理功能

## 验收标准

- [ ] `stores/tabs.ts` 定义 `Tab` 类型（id/title/route/icon/isDirty）
- [ ] `addTab` / `removeTab` / `activateTab` / `closeAllTabs` / `closeOtherTabs` actions
- [ ] `activeTabId` + `tabs[]` 状态，自动去重（相同 route 不重复打开）
- [ ] Zustand `persist` middleware 恢复上次标签状态
- [ ] 单元测试覆盖：增删切换、去重逻辑、持久化恢复

## 阻塞于

f-33（auth 系统）

## 范围外

- 不在此 issue 实现 TabBar UI 组件（已存在占位组件，需后续对接）
- 不涉及页面路由切换逻辑
