---
id: f-16
status: open
track: frontend
priority: p1
summary: 前端对话知识库选择器（Chat 页面 KB 关联）
blocked_by:
  - b-09
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

在聊天界面增加知识库选择功能：
1. 聊天输入区上方/侧边增加知识库选择器（多选）
2. 用户选择的知识库 ID 列表随聊天请求发送到后端
3. 未选择时，对话行为与现有完全一致

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## 补充说明

### 为什么这是一个独立 issue

虽然改动量小（一个选择器组件 + API 传参），但它是一个完整的垂直切片：
- 涉及 UI 交互设计（选择器样式、多选、清空）
- 涉及前端状态管理（选中的 kbIds 随会话保持）
- 涉及 API 契约对接（`knowledgeBaseIds` 字段）
- 需要端到端验证（选择 → 发送 → 回答包含检索上下文）

按垂直切片原则，前端交互与后端 API 变更应配对交付。

### 依赖关系

**阻塞下游：**
- `q-21-rag-server-integration-e2e` — E2E 测试需要前端选择器才能验证完整用户旅程

**被阻塞于：**
- `b-09-chat-rag-retrieval` — 后端 API 必须支持 `knowledgeBaseIds` 字段，前端才有意义

### 技术要点

- 使用现有知识库列表 API 获取可选知识库
- 多选组件使用 shadcn-vue 标准组件
- 选中的 kbIds 保存在 Pinia store 或组件本地状态（需确定会话级还是全局）
- 空选时前端不传 `knowledgeBaseIds`，确保无回归
