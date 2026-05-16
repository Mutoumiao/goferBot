状态: needs-triage
分类: enhancement

## 要构建的内容

实现多知识库选择 UI，支持在对话时选择多个知识库触发 RAG。

## 规格引用

- 功能规格: docs/03-specs/features/kb-selector/feature-spec.md
- 行为规格: docs/03-specs/features/kb-selector/behavior-spec.md
- API 规格: docs/03-specs/features/chat-sse/api-spec.md

## 验收标准

- [ ] `packages/webui/src/components/chat/KbSelector.vue` 实现知识库选择组件
- [ ] 输入框中输入 `@` 触发知识库选择下拉
- [ ] 下拉显示用户所有知识库列表（名称 + 文档数量）
- [ ] 支持键盘导航（上下箭头选择，Enter 确认，Esc 关闭）
- [ ] 支持多选（复选框形式）
- [ ] 已选知识库在输入框上方以标签形式显示（可点击删除）
- [ ] 未选择知识库时，对话使用默认模式（无 RAG）
- [ ] 选择知识库后，发送消息时携带 knowledgeBaseIds
- [ ] 空状态：无知识库时提示"请先创建知识库"
- [ ] 加载状态：知识库列表加载中显示骨架屏
- [ ] 使用 Pinia Store 管理已选知识库状态

## 阻塞于

- b-02-knowledge-base-crud-api（需要知识库列表 API）
- f-09-chat-page（需要对话页输入框）

## 范围外

- 知识库权重调整
- 知识库搜索过滤（列表内）
- 知识库实时索引状态显示

## Agent 简报

**分类：** enhancement
**摘要：** 多知识库选择 UI，`@` 触发下拉，支持多选

**当前行为：**
前端无知识库选择功能。

**期望行为：**
用户可在对话时通过 `@` 提及选择知识库，支持多选，触发 RAG 检索。

**关键接口：**
- `packages/webui/src/components/chat/KbSelector.vue` — 选择组件
- API: `GET /api/knowledge-bases` — 知识库列表
- Pinia Store — 已选知识库状态

**验收标准：**
- [ ] `@` 触发知识库选择下拉
- [ ] 下拉显示知识库列表
- [ ] 键盘导航支持
- [ ] 支持多选（复选框）
- [ ] 已选知识库标签显示（可删除）
- [ ] 未选择时使用默认模式
- [ ] 发送消息携带 knowledgeBaseIds
- [ ] 无知识库时提示
- [ ] 加载骨架屏
- [ ] Pinia Store 管理状态

**范围外：**
- 知识库权重
- 列表内搜索
- 实时索引状态
