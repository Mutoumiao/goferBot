# Issue #03b 测试用例 — 知识库右键菜单与文件操作

> **对应 Issue**: `.scratch/knowledge-base/issues/03b-kb-context-menus-and-file-operations.md`
> **状态**: closed
> **更新日期**: 2026-05-08

---

## 测试范围

本文件覆盖 Issue #03b 的全部验收标准，包括：

- 数据库 Schema 变更（`is_pinned`、`sort_order`、`icon`）
- Sidecar API 扩展（PATCH /:id、POST /:id/folders、PATCH /:id/files/:path、POST /move、POST /copy、GET /deleted）
- 前端自定义右键菜单组件
- 行内重命名组件
- 知识库列表排序与置顶交互
- 移动/复制命名冲突处理
- 删除弹窗差异化文案

---

## 1. Sidecar API 测试

### 1.1 PATCH /knowledge-bases/:id

| 编号 | 场景 | 前置条件 | 操作 | 预期结果 | 自动化测试 |
|------|------|----------|------|----------|------------|
| API-01 | 重命名知识库并同步物理目录 | 存在名为 `OldName` 的知识库 | PATCH body `{ name: "NewName" }` | 返回 200，name 为 `NewName`，物理路径同步变更，旧目录不存在 | `knowledgeBasesExtended.test.ts` |
| API-02 | 更新知识库图标 | 存在知识库 | PATCH body `{ icon: "mdi-books" }` | 返回 200，icon 为 `mdi-books` | `knowledgeBasesExtended.test.ts` |
| API-03 | 置顶知识库 | 存在知识库 | PATCH body `{ is_pinned: 1 }` | 返回 200，`is_pinned` 为 `1` | `knowledgeBasesExtended.test.ts` |

### 1.2 POST /knowledge-bases/:id/folders

| 编号 | 场景 | 前置条件 | 操作 | 预期结果 | 自动化测试 |
|------|------|----------|------|----------|------------|
| API-04 | 在知识库根目录新建文件夹 | 存在知识库 | POST body `{ name: "NewFolder", path: "" }` | 返回 201，name 为 `NewFolder` | `knowledgeBasesExtended.test.ts` |
| API-05 | 拒绝空文件夹名 | 存在知识库 | POST body `{ name: "", path: "" }` | 返回 400 | `knowledgeBasesExtended.test.ts` |

### 1.3 PATCH /knowledge-bases/:id/files/:path

| 编号 | 场景 | 前置条件 | 操作 | 预期结果 | 自动化测试 |
|------|------|----------|------|----------|------------|
| API-06 | 重命名文件 | 知识库中存在 `old.md` | PATCH body `{ newName: "new" }` | 返回 200，name 为 `new.md` | `knowledgeBasesExtended.test.ts` |
| API-07 | 保留原扩展名 | 知识库中存在 `test.txt` | PATCH body `{ newName: "renamed" }` | 返回 200，name 为 `renamed.txt` | `knowledgeBasesExtended.test.ts` |

### 1.4 POST /files/move

| 编号 | 场景 | 前置条件 | 操作 | 预期结果 | 自动化测试 |
|------|------|----------|------|----------|------------|
| API-08 | 跨库移动文件 | 源库有 `move-me.md`，目标库为空 | POST body `{ sourceKbId, sourcePath, targetKbId, targetPath }` | 返回 200，源库不再包含该文件，目标库包含该文件 | `knowledgeBasesExtended.test.ts` |

### 1.5 POST /files/copy

| 编号 | 场景 | 前置条件 | 操作 | 预期结果 | 自动化测试 |
|------|------|----------|------|----------|------------|
| API-09 | 跨库复制并自动处理命名冲突 | 源库和目标库均存在 `dup.md` | POST body 复制到目标库根目录 | 返回 200，目标库出现 `dup(1).md` | `knowledgeBasesExtended.test.ts` |

### 1.6 GET /knowledge-bases/deleted

| 编号 | 场景 | 前置条件 | 操作 | 预期结果 | 自动化测试 |
|------|------|----------|------|----------|------------|
| API-10 | 列出已删除知识库 | 存在已删除的知识库 `DeletedKB` | GET `/deleted` | 返回 200，列表中包含 `DeletedKB` | `knowledgeBasesExtended.test.ts` |

---

## 2. 前端组件测试

### 2.1 ContextMenu.vue

| 编号 | 场景 | 操作 | 预期结果 | 自动化测试 |
|------|------|------|----------|------------|
| UI-01 | 可见时渲染插槽内容 | `visible=true`，传入 slot | 插槽内容渲染到 DOM，菜单容器存在 | `ContextMenu.test.ts` |
| UI-02 | 不可见时隐藏内容 | `visible=false` | 插槽内容不存在于 DOM | `ContextMenu.test.ts` |
| UI-03 | 点击外部关闭 | 菜单可见时点击外部元素 | 触发 `close` 事件 | `ContextMenu.test.ts` |
| UI-04 | 按 Escape 关闭 | 菜单可见时按 Escape 键 | 触发 `close` 事件 | `ContextMenu.test.ts` |

### 2.2 InlineRename.vue

| 编号 | 场景 | 操作 | 预期结果 | 自动化测试 |
|------|------|------|----------|------------|
| UI-05 | 挂载时显示输入框且基础名已填入 | `name="document.md"`，`editing=true` | input 存在，value 为 `document` | `InlineRename.test.ts` |
| UI-06 | 按 Enter 保存新名称 | 输入 `newname`，按 Enter | 触发 `save` 事件，参数为 `newname` | `InlineRename.test.ts` |
| UI-07 | 按 Escape 取消编辑 | 按 Escape 键 | 触发 `cancel` 事件 | `InlineRename.test.ts` |
| UI-08 | 失焦时保存新名称 | 输入 `newname`，触发 blur | 触发 `save` 事件，参数为 `newname` | `InlineRename.test.ts` |

### 2.3 EditKbDialog.vue

| 编号 | 场景 | 操作 | 预期结果 | 自动化测试 |
|------|------|------|----------|------------|
| UI-09 | 弹窗正确显示当前名称和图标 | 打开修改资料弹窗 | 输入框预填原名称，图标网格中高亮当前图标 | `EditKbDialog.test.ts` |
| UI-10 | 保存时触发 save 事件 | 修改名称并选择新图标，点击保存 | 触发 `save` 事件，携带新名称和新图标 | `EditKbDialog.test.ts` |
| UI-11 | 点击关闭或遮罩取消 | 点击关闭按钮或遮罩层 | 触发 `close` 事件，不触发 `save` | `EditKbDialog.test.ts` |

### 2.4 MoveCopyDialog.vue（手动验证）

| 编号 | 场景 | 操作 | 预期结果 |
|------|------|------|----------|
| UI-12 | 左栏显示知识库列表 | 打开移动/复制弹窗 | 左栏展示所有未删除知识库，当前源库高亮 |
| UI-13 | 右栏仅显示文件夹 | 选择目标知识库 | 右栏仅列出该库中的文件夹（不含文件） |
| UI-14 | 面包屑导航可点击 | 双击进入子文件夹，点击面包屑 | 面包屑正确显示路径，点击可回退到对应层级 |
| UI-15 | 点击确认触发移动/复制 | 选择目标库和路径，点击"移动至此" | 触发对应 sidecar API，弹窗关闭 |

### 2.5 RecycleBinPage.vue

| 编号 | 场景 | 操作 | 预期结果 | 自动化测试 |
|------|------|------|----------|------------|
| UI-16 | 显示已删除知识库列表 | 进入回收站页面 | 列表展示已删除知识库名称和删除时间 | `RecycleBinPage.test.ts` |
| UI-17 | 恢复知识库 | 点击恢复按钮 | 该知识库从回收站消失，回到知识库列表；若同名则重命名为"原名-副本" | `RecycleBinPage.test.ts` |

---

## 3. 前端 Store 测试

### 3.1 useKnowledgeBaseStore 扩展

| 编号 | 场景 | 操作 | 预期结果 | 自动化测试 |
|------|------|------|----------|------------|
| STORE-01 | togglePin 将置顶项排序到顶部 | 列表中有置顶和非置顶知识库，toggle 非置顶项 | 调用 sidecar PATCH，本地列表中该项移到顶部，`is_pinned=1` | `knowledgeBaseExtended.test.ts` |
| STORE-02 | renameFile 调用 PATCH 并刷新文件列表 | `selectedKbId` 已设置，调用 `renameFile('old.md', 'new')` | 调用 `/knowledge-bases/kb1/files/old.md` PATCH 请求 | `knowledgeBaseExtended.test.ts` |
| STORE-03 | createFolder 调用 POST folders | `selectedKbId` 已设置，调用 `createFolder('newfolder')` | 调用 `/knowledge-bases/kb1/folders` POST 请求 | `knowledgeBaseExtended.test.ts` |

---

## 4. 端到端交互测试（手动验证）

### 4.1 知识库列表右键菜单

| 编号 | 场景 | 操作 | 预期结果 |
|------|------|------|----------|
| E2E-01 | 右键知识库弹出菜单 | 在知识库列表项上右键 | 显示自定义菜单：置顶/取消置顶、修改资料、移入回收站 |
| E2E-02 | 置顶后知识库排在最前 | 右键非置顶知识库，点击置顶 | 该知识库立即排到列表最上方，显示 pin 图标 |
| E2E-03 | 修改资料弹窗提交 | 右键知识库 → 修改资料 → 修改名称和图标 → 保存 | 列表中该知识库名称和图标实时更新 |
| E2E-04 | 删除知识库二次确认 | 右键知识库 → 移入回收站 | 弹窗提示可恢复，按钮文案为"移入回收站"（非永久删除） |

### 4.2 文件区域右键菜单

| 编号 | 场景 | 操作 | 预期结果 |
|------|------|------|----------|
| E2E-05 | 空白处右键新建文件夹 | 在文件区域空白处右键 → 新建文件夹 | 文件夹立即出现在列表中，并进入行内重命名编辑状态 |
| E2E-06 | 文件右键重命名 | 在文件上右键 → 重命名 | 文件名变为输入框，基础名（不含扩展名）被选中 |
| E2E-07 | 重命名时保留扩展名 | 重命名 `test.txt` 为 `renamed`，按 Enter | 文件显示为 `renamed.txt` |
| E2E-08 | 文件右键移动到另一知识库 | 在文件上右键 → 移动到... → 选择目标库和路径 → 移动至此 | 文件从当前库消失，出现在目标库中 |
| E2E-09 | 文件右键复制并处理冲突 | 复制同名文件到已有同名文件的目标库 | 目标库中出现加后缀文件，如 `file(1).md` |
| E2E-10 | 文件删除为永久删除 | 在文件上右键 → 永久删除 | 弹窗按钮为红色"永久删除"，强调不可撤销 |

### 4.3 回收站

| 编号 | 场景 | 操作 | 预期结果 |
|------|------|------|----------|
| E2E-11 | 回收站入口可见 | 查看左侧知识库列表底部 | 有"回收站"固定入口，带删除图标 |
| E2E-12 | 恢复已删除知识库 | 进入回收站 → 点击恢复 | 知识库回到列表，若同名冲突则自动重命名 |

---

## 5. 测试统计

| 类别 | 自动化测试数 | 手动验证数 | 总计 |
|------|-------------|-----------|------|
| Sidecar API | 10 | 0 | 10 |
| 前端组件 | 38 | 2 | 40 |
| Store | 14 | 0 | 14 |
| 端到端交互 | 0 | 12 | 12 |
| **合计** | **62** | **14** | **76** |

---

## 6. 相关测试文件

| 文件路径 | 说明 |
|----------|------|
| `tests/unit/server/knowledgeBasesExtended.test.ts` | Sidecar API 扩展测试（10 例） |
| `tests/unit/components/ContextMenu.test.ts` | 右键菜单组件测试（4 例） |
| `tests/unit/components/InlineRename.test.ts` | 行内重命名组件测试（4 例） |
| `tests/unit/components/FileExplorer.test.ts` | 文件资源管理器测试（20 例） |
| `tests/unit/components/EditKbDialog.test.ts` | 修改资料弹窗测试（7 例） |
| `tests/unit/components/RecycleBinPage.test.ts` | 回收站页面测试（5 例） |
| `tests/unit/stores/knowledgeBaseExtended.test.ts` | Store 扩展测试（3 例） |
| `tests/unit/stores/knowledgeBaseRemaining.test.ts` | Store 剩余方法测试（8 例） |
| `tests/unit/components/EditKbDialog.test.ts` | 修改资料弹窗自动化测试（7 例，覆盖 UI-09 ~ UI-11） |
| `tests/unit/components/RecycleBinPage.test.ts` | 回收站页面自动化测试（5 例，覆盖 UI-16 ~ UI-17） |

> **补充说明**：以下测试文件虽未在本 Issue 测试用例中逐条列出，但已作为独立组件/模块的自动化测试存在：
> - `tests/unit/stores/settings.test.ts` — Settings Store（4 例）
> - `tests/unit/components/TabBar.test.ts` — TabBar 组件（6 例）
> - `tests/unit/components/SideBar.test.ts` — SideBar 组件（7 例）
> - `tests/unit/components/SplashScreen.test.ts` — SplashScreen 组件（4 例）
