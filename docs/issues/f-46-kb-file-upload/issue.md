---
id: f-46
status: open
track: frontend
priority: p1
summary: KB 文件上传功能 — 拖拽/点击上传、FileManager 组件、FileGridItem 组件、BreadcrumbNav 导航
blocked_by:
  - f-42
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.7 阶段三深化
---

## 要构建的内容

在 KnowledgeBase 页面中实现文件上传完整功能：拖拽上传区域、文件列表（FileGridItem）、文件管理（FileManager）、面包屑导航（BreadcrumbNav）。对接 `stores/file.ts`（f-42）和 `api/kb.ts`。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.7 阶段三深化
- **核心目标**: KB 页面从骨架升级为完整的文档管理功能
- **验收标准**: 用户可上传文件、查看文件列表、按目录导航

## 验收标准

- [ ] 拖拽上传区域（drag & drop + 点击选择文件）
- [ ] `FileManager` 组件：文件列表、排序、筛选
- [ ] `FileGridItem` 组件：缩略图/图标、文件名、大小、日期
- [ ] `BreadcrumbNav` 组件：目录层级导航
- [ ] 上传进度条（对接 file store 的 progress 状态）
- [ ] 上传失败错误提示 + 重试按钮
- [ ] 空目录状态 + loading 状态
- [ ] 单元测试：上传交互、进度更新、错误恢复

## 阻塞于

f-42（file store）

## 范围外

- 不在此 issue 实现 KB CRUD（由 f-47 负责）
