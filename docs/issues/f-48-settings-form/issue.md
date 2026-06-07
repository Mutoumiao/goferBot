---
id: f-48
status: open
track: frontend
priority: p1
summary: Settings 配置表单 — 语言/主题/通知等配置项、Zod 验证、未保存提示（beforeunload + 路由守卫）
blocked_by:
  - f-41
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.7 阶段三深化
---

## 要构建的内容

在 Settings 页面中实现配置表单：语言选择、主题切换（亮色/暗色/自动）、通知偏好等。对接 `stores/settings.ts`（f-41）的 dirty 追踪，实现离开未保存提示。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.7 阶段三深化
- **核心目标**: Settings 页面从骨架升级为完整的配置管理功能
- **验收标准**: 用户可修改配置、收到未保存提示

## 验收标准

- [ ] 配置表单：语言 select、主题 radio group、通知 toggle
- [ ] Zod 验证（每项配置的合法范围）
- [ ] 保存按钮 + 重置按钮（对接 settings store `save` / `resetToSaved`）
- [ ] 未保存提示：`beforeunload` 事件 + 路由切换时 `useBlocker`
- [ ] 保存成功/失败 toast 提示
- [ ] loading 态（保存中按钮禁用）
- [ ] 单元测试：表单交互、dirty 追踪、离开拦截

## 阻塞于

f-41（settings store）

## 范围外

- 不涉及后端 /api/settings 端点（如有需要会新建）
