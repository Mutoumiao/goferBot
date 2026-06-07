# 功能规格：KB CRUD 完整交互

## 用户故事
作为 GoferBot 用户，我希望在知识库页面中创建、编辑和删除知识库，以便管理我的文档集合。

## 边界

### 范围内
- "创建知识库" 按钮 + Dialog（名称 + 描述，Zod 客户端校验）
- KB 卡片点击导航至详情页（`/app/kb/$kbId`，由 f-46 提供内容）
- KB 编辑 Dialog（复用创建 Dialog 组件，预填已有数据）
- KB 删除（二次确认弹窗，调用 `deleteKb` API）
- 创建/编辑/删除操作后列表自动刷新（通过重新请求列表或乐观更新）
- 错误态处理：名称重复（409）、权限不足（403）、网络错误
- 前端 API 层补充 `updateKb` 方法（后端已有 PATCH 端点，仅补充前端调用）
- `packages/data` KB Schema 与后端 DTO 对齐（修复 `title` → `name` 不一致）

### 范围外
- 不修改后端 KB API（后端 PATCH/POST/DELETE/GET 端点已完备）
- 不实现知识库详情页内容（文件列表、面包屑导航、上传区域属 f-46）
- 不实现 KB 置顶（pin）功能（后续 issue）
- 不实现图标选择器（保持简单，后续迭代）
- 不实现 ContextMenu 右键菜单（保持最小可用）

## 涉及页面/组件

| 组件 | 路径 | 类型 |
|------|------|------|
| KB 列表页 | `packages/web/src/routes/app/kb.tsx` | 存量改造 |
| KB Store | `packages/web/src/stores/kb.ts` | 存量扩展 |
| KB API 层 | `packages/web/src/api/kb.ts` | 存量扩展 |
| CreateKbDialog | `packages/web/src/overlays/dialogs/CreateKbDialog.tsx` | 新建 |
| EditKbDialog | `packages/web/src/overlays/dialogs/EditKbDialog.tsx` | 新建 |
| DeleteKbDialog | `packages/web/src/overlays/dialogs/DeleteKbDialog.tsx` | 新建 |
| KB 数据 Schema | `packages/data/src/schemas/kb.schema.ts` | 修复对齐 |

## 相关功能

| 方向 | 功能 | 关系 |
|------|------|------|
| 上游 | f-42 file store | 无直接依赖 |
| 阻塞者 | f-46 KB 文件上传 | 提供 KB 详情页内容，f-47 在此基础上添加 CRUD overlay 和导航 |
| 下游 | — | 无 |

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| Edit Dialog 复用 CreateKbDialog 组件，通过 `initialData` props 区分模式 | 减少代码重复，Vue 版本已验证可行 | 是 |
| 删除使用独立 `DeleteKbDialog` 而非通用 ConfirmDialog | 业务语义更清晰，可展示被删除 KB 名称 | 是 |
| CRUD 后通过 `send()` 重新请求列表（非乐观更新） | 数据一致性优先，避免 store 层与后端不同步 | 是 |
| KB 详情页路由为 `/app/kb/$kbId`，由 f-46 实现具体内容 | 关注点分离，CRUD 交互与文件管理解耦 | 是 |
| `packages/data` 的 KB Schema 字段名修正为 `name`（对齐后端） | 前后端契约必须一致，当前不一致会导致运行时错误 | 否（必须修正） |
| 创建/编辑 Dialog 不使用 shadcn/ui Dialog 组件壳，由 OverlayHost 统一管理 backdrop+定位 | 符合项目 Overlay 架构，减少层级嵌套 | 是 |
| 不包含图标选择器 | 验收标准未要求，优先交付核心 CRUD | 是（后续可加） |
| 错误状态在页面组件中以本地 `useState` 管理，不放入 Zustand Store | Store 保持纯数据层（entries/isLoading/selectedId），UI 错误（loadError/serverError）由各组件内部 state 管理，职责更清晰 | 是 |

## PRD 偏差

| 偏差 | 说明 |
|------|------|
| BreadcrumbNav 归属调整至 f-46 | PRD §5.7 中 f-47 定义包含"BreadcrumbNav"，但实际 BreadcrumbNav 属于 KB 详情页（f-46 文件上传页面）的内部导航组件。f-47 只负责从列表页点击卡片通过 TanStack Router 跳转至 `/app/kb/$kbId` 详情页。此调整为关注点分离：BreadcrumbNav 的渲染、面包屑路径计算由 f-46 负责，避免跨 issue 职责重叠。 |
