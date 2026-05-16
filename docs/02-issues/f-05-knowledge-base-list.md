状态: needs-triage
分类: enhancement

## 要构建的内容

实现知识库管理页左侧知识库列表，支持新建、置顶、排序。

## 规格引用

- 功能规格: docs/03-specs/features/knowledge-base-list/feature-spec.md
- 行为规格: docs/03-specs/features/knowledge-base-list/behavior-spec.md
- API 规格: docs/03-specs/features/knowledge-base-crud/api-spec.md

## 验收标准

- [ ] `packages/webui/src/components/knowledge-base/KbList.vue` 实现左侧知识库列表
- [ ] 每项显示：图标 + 知识库名称 + 状态指示（文档数量或索引状态）
- [ ] 支持新建知识库（弹出对话框输入名称）
- [ ] 支持置顶/取消置顶（置顶项排在最前）
- [ ] 支持拖拽排序（置顶区内、非置顶区内）
- [ ] 当前选中知识库高亮显示
- [ ] 右键菜单：重命名、删除、置顶/取消置顶
- [ ] 空状态：提示"暂无知识库，点击新建"
- [ ] 加载状态：骨架屏
- [ ] 错误状态：加载失败提示 + 重试按钮
- [ ] 使用 Pinia Store 管理知识库列表状态（`packages/webui/src/stores/knowledgeBases.ts`）

## 阻塞于

- b-02-knowledge-base-crud-api（需要知识库 API）
- f-03-sidebar-navigation（需要从边栏进入知识库页面）

## 范围外

- 知识库图标自定义上传
- 知识库描述展开查看
- 知识库搜索过滤

## Agent 简报

**分类：** enhancement
**摘要：** 知识库列表组件，支持新建、置顶、排序

**当前行为：**
前端无知识库列表界面。

**期望行为：**
用户可查看、创建、管理知识库，置顶和排序个性化配置。

**关键接口：**
- `packages/webui/src/components/knowledge-base/KbList.vue` — 列表组件
- `packages/webui/src/stores/knowledgeBases.ts` — 状态管理
- API: `GET/POST/PATCH/DELETE /api/knowledge-bases`

**验收标准：**
- [ ] 左侧知识库列表
- [ ] 显示图标、名称、状态
- [ ] 支持新建知识库
- [ ] 支持置顶/取消置顶
- [ ] 支持拖拽排序
- [ ] 当前选中高亮
- [ ] 右键菜单操作
- [ ] 空状态提示
- [ ] 加载骨架屏
- [ ] 错误状态 + 重试
- [ ] Pinia Store 管理状态

**范围外：**
- 图标自定义上传
- 描述展开
- 搜索过滤
