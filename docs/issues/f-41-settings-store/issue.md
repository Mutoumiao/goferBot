---
id: f-41
status: closed
track: frontend
priority: p0
summary: 迁移 Pinia settings.ts → Zustand settings store — 用户配置持久化（语言/主题/通知偏好）、未保存状态追踪
blocked_by:
  - f-33
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.6 阶段二补全
---

## 要构建的内容

将 `packages/webui/src/stores/settings.ts`（Pinia settings store）迁移到 `packages/web/src/stores/settings.ts`（Zustand store）。管理用户配置的持久化读写、未保存状态追踪，为 Settings 页面表单提供数据层。

## 规格引用

- 功能规格: specs/feature-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.6 阶段二补全
- **核心目标**: 补齐阶段二缺失的 settings store，为 Settings 表单提供状态基础设施
- **验收标准**: Zustand store 覆盖 Pinia settings.ts 全部功能 + persist 持久化

## 验收标准

- [ ] `stores/settings.ts` 定义 `SettingsState` 类型（语言/主题/通知/自定义字段）
- [ ] Zustand `persist` middleware 持久化到 localStorage
- [ ] `isDirty` 追踪 + `markDirty` / `resetToSaved` 实现未保存提示逻辑
- [ ] 与 future `api/settings.ts` 对接的 action 骨架
- [ ] 单元测试覆盖：persist 恢复、dirty 追踪、reset 回退

## 阻塞于

f-33（auth 系统）

## 范围外

- 不在此 issue 实现 Settings UI 表单（由 f-48 负责）
- 不涉及后端 /api/settings 端点创建
