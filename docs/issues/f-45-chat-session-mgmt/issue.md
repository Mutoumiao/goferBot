---
id: f-45
status: closed
track: frontend
priority: p1
summary: ChatView 会话管理 — 新建/切换/删除/重命名会话、KbSelector 集成
blocked_by:
  - f-40
  - f-44
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.7 阶段三深化
---

## 要构建的内容

在 ChatView 中实现完整的会话管理交互：会话列表切换、新建会话、删除会话、重命名会话、关联知识库选择器（KbSelector）。对接 `stores/chat.ts`（session 扩展，f-40）和 `api/chat.ts`。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.7 阶段三深化
- **核心目标**: ChatView 获得完整的会话生命周期管理能力
- **验收标准**: 用户可新建/切换/删除会话，消息按会话隔离

## 验收标准

- [x] 会话列表渲染在 Sidebar 或 ChatView 顶部
- [x] "+ 新建会话" 按钮 → `createSession` → 自动激活
- [x] 点击会话项 → `setActiveSession` → 加载对应历史消息
- [x] 删除会话（二次确认弹窗） → `deleteSession` → 从列表移除
- [x] 重命名会话（inline 编辑或 dialog）
- [x] KbSelector 组件：选择/切换关联知识库
- [ ] 空会话状态：无会话时显示引导提示
- [ ] 单元测试：会话 CRUD 交互、乐观更新、错误恢复

## 阻塞于

f-40（session store）、f-44（SSE 流式）

## 范围外

- 不涉及后端会话 API 修改
