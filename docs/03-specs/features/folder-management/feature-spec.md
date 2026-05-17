# 功能规格：文件夹管理

> 对应 issue: `f-08-folder-management`
> 依赖: `b-02-knowledge-base-crud-api`（已完成）, `f-06-knowledge-base-file-manager`（进行中）

---

## 用户故事

作为知识库用户，我希望创建虚拟文件夹来组织文档，以便更好地管理大量文件。

## 边界

- 范围内：
  - 创建文件夹
  - 重命名文件夹
  - 删除文件夹（级联删除子内容）
  - 移动文件到不同文件夹
  - 空文件夹提示
  - 操作后自动刷新
- 范围外：
  - 文件夹权限控制
  - 文件夹共享
  - 文件夹模板
  - 拖拽调整文件夹层级

## 涉及页面/组件

- `FileManager.vue` — 右键菜单集成
- `CreateFolderDialog.vue` — 创建文件夹对话框
- `MoveItemDialog.vue` — 移动文件/文件夹对话框
- `useFileStore` — 文件夹状态管理

## 相关功能

- `f-06-knowledge-base-file-manager` — 提供文件管理器界面
- `b-02-knowledge-base-crud-api` — 提供文件夹 CRUD API

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 右键菜单触发操作 | 符合文件管理器用户习惯 | 是 |
| 级联删除 | Prisma onDelete: Cascade 自动处理 | 否 |
| 移动通过对话框选择 | 比拖拽更精确，减少误操作 | 是 |
