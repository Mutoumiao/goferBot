---
id: f-49
status: open
track: frontend
priority: p1
summary: BlockNote 富文本编辑器集成 — 替换 EditorPlaceholder 占位组件，实现富文本消息输入
blocked_by:
  - f-44
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.7 阶段三深化
---

## 要构建的内容

将 `components/chat/EditorPlaceholder.tsx` 替换为 BlockNote 富文本编辑器。支持格式化文本（粗体/斜体/标题/列表）、代码块、图片拖入。BlockNote 是 React 生态，这也是本次 Vue → React 迁移的关键驱动力之一（PRD §1.1）。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.7 阶段三深化 + §1.1 背景
- **核心目标**: 用 BlockNote 替换纯文本输入，实现富文本编辑
- **验收标准**: 用户可用富文本格式编写消息，内容通过 ChatInput 发送

## 验收标准

- [ ] 安装 `@blocknote/core` + `@blocknote/react` + `@blocknote/mantine`（或 shadcn 主题）
- [ ] `EditorPlaceholder.tsx` → `BlockNoteEditor.tsx`（完整编辑器组件）
- [ ] 工具栏：粗体、斜体、标题、列表、代码块、引用
- [ ] 图片拖入/粘贴支持
- [ ] 编辑器内容提取为纯文本/Markdown 用于发送
- [ ] 与 ChatInput 的 `onSend` 回调对接（内容 + 文件）
- [ ] 响应式：移动端工具栏折叠
- [ ] 单元测试：内容提取、格式转换

## 阻塞于

f-44（SSE 流式 — 确保消息发送链路完整）

## 范围外

- 不涉及后端消息格式修改
- 不涉及 BlockNote 的协同编辑功能
