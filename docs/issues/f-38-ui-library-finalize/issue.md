---
id: f-38
status: open
track: frontend
priority: p2
summary: 批量替换剩余 shadcn-vue 组件为 shadcn/ui React 版 + 样式对齐（`:deep()` 替代方案）+ 主题验证（Tailwind 变量对照）+ packages/data/ 剩余业务域 schema 补全
blocked_by:
  - f-35
  - f-36
  - f-37
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.4 阶段四：UI 组件库收尾 + §6.6 前后端类型共享
---

## 要构建的内容

在所有业务页面迁移完成后，进行 UI 组件库收尾工作：对比 `components/ui/` 目录，批量使用 shadcn/ui CLI 安装未替换的 React 版组件；检查并替换 Vue `:deep()` 样式穿透的等效方案（CSS Modules 或 Tailwind `[&_child]` 选择器）；验证 Tailwind 主题变量与现有 Pencil tokens 设计一致；补全 `packages/data/` 中剩余业务域的 Zod schema 提取。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.4 阶段四：UI 组件库收尾 + §6.6 前后端类型共享（迁移策略：每迁移一个业务页面时顺带将对应域 Schema 迁移到共享包）
- **核心目标**: 替换剩余 shadcn-vue 组件，统一样式；验证 Tailwind 变量与现有设计一致
- **验收标准**: 所有 shadcn-vue 组件已替换为 shadcn/ui React 版；样式对齐现有设计；`packages/data/` 各业务域 schema 完整

## 验收标准

- [ ] 所有 `components/ui/` 下的 shadcn-vue 组件已替换为对应的 shadcn/ui React 组件（通过 `npx shadcn@latest add` 批量安装）
- [ ] `:deep()` 样式穿透已找到等效替代方案（CSS Modules 或 Tailwind 自定义选择器），全局检查无残留
- [ ] Tailwind v4 主题变量对照验证：色板、间距、圆角、阴影等 token 与现有 Pencil 设计系统一致
- [ ] `packages/data/src/schemas/` 下所有业务域 schema 已提取（auth/kb/chat/common/settings）
- [ ] `packages/data/src/types/index.ts` 统一导出所有 TS 类型
- [ ] 视觉走查：主要页面（登录/Chat/KB/Settings）样式无异常
- [ ] 参考资源：`docs/reference/shadcn-ui-patterns.md`

## 阻塞于

- f-35: ChatView 页面迁移（需要 Chat 页面的 shadcn 组件先被具体使用，才能识别待替换项）
- f-36: 知识库页面迁移（同上）
- f-37: 辅助页面迁移（同上，Settings 的未保存提示涉及 `:deep()` 迁移）

## 范围外

- 不修改 Tailwind v4 的主题配置（仅验证对齐，不重新设计）
- 不新增 UI 组件
- 不修改后端
