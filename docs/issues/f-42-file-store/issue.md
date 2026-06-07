---
id: f-42
status: open
track: frontend
priority: p0
summary: 迁移 Pinia file.ts → Zustand file store — 文件上传队列、进度追踪、并发控制
blocked_by:
  - f-33
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.6 阶段二补全
---

## 要构建的内容

将 `packages/webui/src/stores/file.ts`（Pinia file store）迁移到 `packages/web/src/stores/file.ts`（Zustand store）。管理文件上传队列、单文件/批量进度追踪、上传成功/失败状态，为 KB 文件上传功能提供数据层。

## 规格引用

- 功能规格: specs/feature-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.6 阶段二补全
- **核心目标**: 补齐阶段二缺失的 file store，为 KB 文件上传提供状态基础设施
- **验收标准**: Zustand store 覆盖 Pinia file.ts 的上传队列管理功能

## 验收标准

- [ ] `stores/file.ts` 定义 `UploadTask` 类型（id/fileName/progress/status/error/kbId）
- [ ] `addTask` / `updateProgress` / `markComplete` / `markFailed` / `removeTask` actions
- [ ] 支持并发上传数控制（`maxConcurrent: 3`）
- [ ] 与 `api/kb.ts` 的 `uploadFile` 方法对接
- [ ] 单元测试覆盖：队列操作、进度更新、并发控制、错误隔离

## 阻塞于

f-33（auth 系统）

## 范围外

- 不在此 issue 实现 UI 上传组件（由 f-46 负责）
- 不涉及后端文件处理逻辑
