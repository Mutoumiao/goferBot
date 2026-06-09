---
id: f-47
status: closed
track: frontend
priority: p1
summary: KB CRUD 完整交互 — 创建知识库 dialog、编辑/删除操作、详情页
blocked_by:
  - f-46
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.7 阶段三深化
---

## 要构建的内容

在 KnowledgeBase 页面中实现知识库的创建、编辑、删除完整 CRUD 交互。对接 `api/kb.ts` 已有的 `createKb` / `deleteKb` / `getKbDetail` 方法。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.7 阶段三深化
- **核心目标**: KB 页面获得完整 CRUD 能力
- **验收标准**: 用户可创建/编辑/删除知识库

## 验收标准

- [ ] "创建知识库" 按钮 + Dialog（名称 + 描述 + Zod 验证）
- [ ] KB 卡片点击进入详情（文件列表）
- [ ] KB 编辑 Dialog（复用创建 Dialog，预填数据）
- [ ] KB 删除（二次确认弹窗，对接 `deleteKb`）
- [ ] 创建/编辑/删除后的列表自动刷新
- [ ] 错误态处理（名称重复、权限不足等）
- [ ] 单元测试：Dialog 交互、CRUD 状态流转

## 阻塞于

f-46（文件上传）

## 范围外

- 不涉及后端 KB API 修改
