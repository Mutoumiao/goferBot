---
id: f-06-knowledge-base-file-manager
type: issue
status: closed
track: frontend
priority: p0
summary: 实现知识库管理页右侧文件管理器视图，资源管理器式图标视图。支持面包屑导航、搜索、排序，用户可浏览知识库内的文件和文件夹。
blocked_by: [b-02-knowledge-base-crud-api, f-05-knowledge-base-list]
blocks: []
spec: docs/03-specs/f-06-knowledge-base-file-manager/
plan: docs/04-plans/f-06-knowledge-base-file-manager/v1.md
tests: docs/08-test-cases/f-06-knowledge-base-file-manager/
token_estimate: 1100
---

状态: needs-triage
分类: enhancement

## 要构建的内容

实现知识库管理页右侧文件管理器视图，资源管理器式图标视图，支持面包屑导航、搜索、排序。

## 规格引用

- 功能规格: docs/03-specs/f-06-knowledge-base-file-manager/feature-spec.md
- 行为规格: docs/03-specs/f-06-knowledge-base-file-manager/behavior-spec.md
- API 规格: docs/03-specs/b-02-knowledge-base-crud-api/api-spec.md

## 验收标准

- [ ] `packages/webui/src/components/knowledge-base/FileManager.vue` 实现右侧文件管理器
- [ ] 图标视图显示文件和文件夹（虚拟文件夹）
- [ ] 文件项显示：文件名、图标、状态标签（uploaded/parsing/chunking/indexing/ready/failed）
- [ ] 文件夹项显示：文件夹图标、名称
- [ ] 双击文件夹进入下一级
- [ ] 面包屑导航显示当前路径（可点击跳转）
- [ ] 顶部工具栏：面包屑、搜索框（按文件名）、排序下拉（名称/日期/类型）
- [ ] 空状态：提示"点击添加文件导入文档"
- [ ] 右键菜单：文件/文件夹操作（删除、重命名、移动）
- [ ] 支持多选（Ctrl/Cmd + 点击）
- [ ] 加载状态：骨架屏
- [ ] 错误状态：加载失败提示 + 重试按钮
- [ ] 状态标签颜色：uploaded 灰色、parsing/chunking/indexing 蓝色、ready 绿色、failed 红色

## 阻塞于

- b-02-knowledge-base-crud-api（需要文件夹和文档 API）
- f-05-knowledge-base-list（需要选中知识库）

## 范围外

- 文件预览（PDF/图片/Markdown，Phase 6）
- 文件夹树形侧边栏

## Agent 简报

**分类：** enhancement
**摘要：** 知识库文件管理器，图标视图，支持面包屑、搜索、排序

**当前行为：**
前端无文件管理界面。

**期望行为：**
用户可浏览知识库内的文件和文件夹，查看文档处理状态，进行基本文件操作。

**关键接口：**
- `packages/webui/src/components/knowledge-base/FileManager.vue` — 文件管理器
- API: `GET /api/knowledge-bases/:id/documents`、`GET /api/knowledge-bases/:id/folders`

**验收标准：**
- [ ] 图标视图显示文件和文件夹
- [ ] 文件显示状态标签
- [ ] 双击文件夹进入下一级
- [ ] 面包屑导航
- [ ] 顶部工具栏（搜索、排序）
- [ ] 空状态提示
- [ ] 右键菜单操作
- [ ] 支持多选
- [ ] 加载骨架屏
- [ ] 错误状态 + 重试
- [ ] 状态标签颜色正确

**范围外：**
- 文件预览
- 拖拽上传
- 树形侧边栏
