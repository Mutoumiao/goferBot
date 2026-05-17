---
issue_id: f-05-knowledge-base-list
type: behavior-spec
status: approved
summary: KbList 组件定义 loading/empty/error/normal 四种交互状态，支持列表项选中高亮、置顶、右键菜单（重命名/删除/置顶）、名称编辑内联保存与滚动分页。
---
# Behavior Spec: 知识库列表 (Knowledge Base List)

> 对应 issue: `f-05-knowledge-base-list`
> 依赖: `b-02-knowledge-base-crud-api`（已完成）

---

## 组件

`KbList.vue` — 左侧知识库列表组件

---

## 交互状态

| 状态 | 视觉 |
|------|------|
| loading | 骨架屏（3-5 行） |
| empty | "暂无知识库，点击新建" + 新建按钮 |
| error | 错误提示 + 重试按钮 |
| normal | 列表项（图标 + 名称 + 操作） |

---

## 列表项

- 图标（emoji 或默认）+ 知识库名称
- 置顶项排在最前，带置顶图标
- 当前选中项高亮（bg-accent/10）
- 右键菜单：重命名、删除、置顶/取消置顶

---

## 操作

- **新建**：对话框输入名称，确认后创建
- **置顶/取消置顶**：PATCH `isPinned` + `sortOrder`
- **重命名**：行内编辑或对话框
- **删除**：确认对话框，然后 DELETE

---

## Store

`useKnowledgeBaseStore` — 复用现有 store，但清理 V1 遗留代码，只保留：
- `knowledgeBases` — 列表
- `selectedKbId` — 当前选中
- `isLoading` / `error` — 状态
- `loadKnowledgeBases()` — GET /api/knowledge-bases
- `createKnowledgeBase(name)` — POST
- `deleteKnowledgeBase(id)` — DELETE
- `renameKnowledgeBase(id, name)` — PATCH
- `togglePin(id)` — PATCH `isPinned`
- `selectKb(id)` — 切换选中
