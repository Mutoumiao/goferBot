# 功能规格：知识库文件管理器

> 对应 issue: `f-06-knowledge-base-file-manager`
> 依赖: `b-02-knowledge-base-crud-api`（已完成）, `f-05-knowledge-base-list`（已完成）

---

## 用户故事

作为知识库用户，我希望在选中知识库后浏览其中的文件和文件夹，以便查看文档处理状态并进行管理操作。

## 边界

- 范围内：
  - 文件和文件夹的图标视图浏览
  - 面包屑导航
  - 搜索（按文件名）
  - 排序（名称/日期/类型）
  - 右键菜单操作（删除、重命名）
  - 多选（Ctrl/Cmd + 点击）
  - 文档状态标签显示
  - 空状态提示
- 范围外：
  - 文件预览（PDF/图片/Markdown，Phase 6）
  - 文件夹树形侧边栏
  - 拖拽上传（f-07 负责）
  - 文件夹创建/移动（f-08 负责）

## 涉及页面/组件

- `KnowledgeBasePage.vue` — 知识库页面（添加右侧文件管理器区域）
- `FileManager.vue` — 文件管理器主组件
- `FileGridItem.vue` — 文件/文件夹项组件
- `BreadcrumbNav.vue` — 面包屑导航
- `useFileStore` — Pinia Store

## 相关功能

- `f-05-knowledge-base-list` — 提供选中知识库
- `f-07-file-upload-component` — 提供文件上传入口
- `f-08-folder-management` — 提供文件夹 CRUD
- `b-02-knowledge-base-crud-api` — 提供文档/文件夹 API

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 图标视图而非列表视图 | 更直观展示文件类型图标，符合现代网盘体验 | 是 |
| 虚拟文件夹 | 文档组织需要，不绑定物理文件系统 | 否 |
| 文档状态由后端维护 | 上传后异步处理流水线更新状态 | 否 |
