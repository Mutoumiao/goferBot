---
id: f-37
status: open
track: frontend
priority: p1
summary: 迁移 History/Settings/RecycleBin 辅助页面 + 剩余 Zustand Stores（session/settings/knowledgeBase/tabs/file）+ sidebar 业务逻辑（会话列表/Tab 切换），完成非核心页面的 React 化
blocked_by:
  - f-34
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.3 阶段三 P1-P2
---

## 要构建的内容

迁移三个辅助页面（HistoryPage、SettingsPage、RecycleBinPage）+ 完成 Sidebar 中的业务逻辑（会话列表加载/切换/Tab 管理）+ 创建剩余 4 个 Zustand Stores（session、settings、knowledgeBase、tabs、file）。同时将对应域 Zod schema 提取到 `packages/data/`（common.schema.ts 分页/通用类型、settings 等）。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md
- API 规格: specs/api-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.3 阶段三 P1-P2 辅助页面 + §6.5 状态管理映射
- **核心目标**: 先保证功能可用，再细化样式对齐；每完成一个页面在本地验证与后端的接口连通性
- **验收标准**: History/Settings/RecycleBin 页面可用；Settings 配置保存与提示；Sidebar 会话列表可交互

## 验收标准

- [ ] HistoryPage — 会话历史列表、搜索/筛选
- [ ] SettingsPage — 配置项表单、未保存提示（`onBeforeRouteLeave` 等效实现）
- [ ] RecycleBinPage — 已删除文档列表、恢复/永久删除操作
- [ ] Sidebar 业务逻辑 — 会话列表加载（分页）、当前会话高亮、Tab 切换
- [ ] Zustand session Store — 会话列表/当前会话/CRUD 操作
- [ ] Zustand settings Store — 用户配置读写
- [ ] Zustand tabs Store — Tab 管理（打开/关闭/切换/持久化）
- [ ] Zustand file Store — 文件上传状态管理（如 f-36 未覆盖）
- [ ] `packages/data/src/schemas/common.schema.ts` — 分页/通用类型提取
- [ ] 所有页面/组件 loading/data/error 三态完整

## 阻塞于

- f-34: App Shell 布局与 Overlay 系统迁移（需要 Sidebar 骨架 + Overlay 系统就绪）

## 范围外

- 不包含 ChatView（f-35）和 KB（f-36）的业务逻辑
- 不修改后端 API
