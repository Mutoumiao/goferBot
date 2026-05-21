---
id: f-08-folder-management
type: issue
status: closed
track: frontend
priority: p0
summary: 实现虚拟文件夹管理功能，支持创建、重命名、删除、移动文件夹和文件。用户可创建虚拟文件夹组织文档，支持拖拽移动和层级调整。
blocked_by: [b-02-knowledge-base-crud-api, f-06-knowledge-base-file-manager]
blocks: []
spec: docs/03-specs/f-08-folder-management/
plan: docs/04-plans/f-08-folder-management/v1.md
tests: docs/08-test-cases/f-08-folder-management/
token_estimate: 1000
---

状态: needs-triage
分类: enhancement

## 要构建的内容

实现虚拟文件夹管理功能，支持创建、重命名、删除、移动文件夹和文件。

## 规格引用

- 功能规格: docs/03-specs/f-08-folder-management/feature-spec.md
- 行为规格: docs/03-specs/f-08-folder-management/behavior-spec.md
- API 规格: docs/03-specs/b-02-knowledge-base-crud-api/api-spec.md

## 验收标准

- [ ] 文件管理器中支持创建新文件夹（右键菜单或工具栏按钮）
- [ ] 创建文件夹弹出对话框输入名称
- [ ] 支持重命名文件夹（右键菜单或双击名称）
- [ ] 支持删除文件夹（确认对话框，级联删除子内容）
- [ ] 支持移动文件到不同文件夹（拖拽或右键菜单选择目标文件夹）
- [ ] 支持移动文件夹（拖拽调整层级）
- [ ] 文件夹空状态：提示"空文件夹"
- [ ] 操作后自动刷新文件列表
- [ ] 操作成功/失败 Toast 提示
- [ ] 使用 Pinia Store 管理文件夹状态

## 阻塞于

- b-02-knowledge-base-crud-api（需要文件夹 CRUD API）
- f-06-knowledge-base-file-manager（需要文件管理器）

## 范围外

- 文件夹权限控制
- 文件夹共享
- 文件夹模板

## Agent 简报

**分类：** enhancement
**摘要：** 虚拟文件夹管理：创建、重命名、删除、移动

**当前行为：**
前端无文件夹管理功能。

**期望行为：**
用户可创建虚拟文件夹组织文档，支持拖拽移动和层级调整。

**关键接口：**
- API: `POST/PATCH/DELETE /api/knowledge-bases/:id/folders/*`
- API: `PATCH /api/knowledge-bases/:id/documents/:docId` — 移动文档
- Pinia Store — 文件夹状态管理

**验收标准：**
- [ ] 创建新文件夹
- [ ] 创建对话框输入名称
- [ ] 重命名文件夹
- [ ] 删除文件夹（确认对话框）
- [ ] 移动文件到不同文件夹
- [ ] 移动文件夹（拖拽层级）
- [ ] 空文件夹提示
- [ ] 操作后自动刷新
- [ ] Toast 提示
- [ ] Pinia Store 管理状态

**范围外：**
- 文件夹权限
- 文件夹共享
- 文件夹模板
