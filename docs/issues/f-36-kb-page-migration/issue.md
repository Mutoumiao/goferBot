---
id: f-36
status: open
track: frontend
priority: p1
summary: 迁移 KnowledgeBasePage — KB API（alova）+ 文档列表/创建/删除 + 文件上传（useUploader）+ packages/data/ kb Zod schema，完成后文档管理功能完整可用
blocked_by:
  - f-34
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.3 阶段三 P1 KnowledgeBasePage
---

## 要构建的内容

迁移知识库管理页面：创建 KB API（`api/knowledge-base.ts` — `getKbList()`/`createKb()`/`deleteKb()`/`uploadFile()` 等）、文档列表渲染（表格/卡片视图）、文档创建（Dialog 表单 + alova `useForm`）、文档删除（确认 Dialog）、文件上传（alova `useUploader`）、知识库详情页。同时将 kb 域 Zod schema 提取到 `packages/data/`。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md
- API 规格: specs/api-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.3 阶段三 P1 KnowledgeBasePage + §6.2 数据获取与 API 管理
- **核心目标**: 每迁移一个页面同步替换涉及的 shadcn-vue 组件；先保证功能可用，再细化样式对齐
- **验收标准**: KnowledgeBase 文档管理可用

## 验收标准

- [ ] `api/knowledge-base.ts` — `getKbList()`/`getKbDetail()`/`createKb()`/`deleteKb()`/`uploadFile()` 方法
- [ ] `packages/data/src/schemas/kb.schema.ts` — kb 域 Zod schema + TS 类型导出
- [ ] KB 列表页 — 表格/卡片视图渲染，空状态处理
- [ ] KB 创建 — Dialog 表单，alova `useForm`，loading/error 状态
- [ ] KB 删除 — 确认 Dialog + `send()` 删除后列表刷新
- [ ] 文件上传 — alova `useUploader`，进度显示
- [ ] KB 详情页 — 文档列表、基本信息展示
- [ ] 所有 loading/data/error 三态完整

## 阻塞于

- f-34: App Shell 布局与 Overlay 系统迁移（需要 Sidebar 导航 + Overlay 系统就绪）

## 范围外

- 不迁移文档内容渲染（如 PDF 预览、Markdown 阅读器等）
- 不修改后端 KB API
- 不修改 RAG 检索链路
