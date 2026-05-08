# Issue #03 — 知识库 CRUD 管理与文件导入 测试用例

**对应 Issue**: `.scratch/knowledge-base/issues/03-knowledge-base-management.md`  
**状态**: closed  
**测试框架**: Vitest（前端 Unit + 组件）、Node 环境 Vitest（Sidecar API）

---

## 3.1 Sidecar API — 知识库 CRUD

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-03-001 | `GET /knowledge-bases` 初始为空 | 数据库刚清空 | 请求 `/knowledge-bases` | 返回 200，`[]` |
| TC-03-002 | `POST /knowledge-bases` 创建知识库 | 提供 name = "Test KB" | POST 请求 | 返回 201，body 包含 id/name/path，物理目录 `docs/Test KB/` 被创建 |
| TC-03-003 | 创建重复名称知识库 | 已存在 "Duplicate" | POST 同名 | 返回 409，错误信息提示已存在 |
| TC-03-004 | 创建时名称空值校验 | name = "" 或纯空格 | POST 请求 | 返回 400，错误信息提示 Name is required |
| TC-03-005 | `DELETE /knowledge-bases/:id` 移入回收站 | 知识库存在 | DELETE 请求 | 返回 200，list 中不再包含该知识库，物理目录移动到 `.trash/<name>-<timestamp>/` |
| TC-03-006 | 删除不存在的知识库 | id 无效 | DELETE 请求 | 返回 404 |
| TC-03-007 | 删除已删除的知识库 | deleted_at 不为 NULL | DELETE 请求 | 返回 404 |
| TC-03-008 | `POST /knowledge-bases/:id/restore` 恢复 | 知识库在回收站中 | POST restore | 返回 200，知识库重新出现在 list 中，物理目录移回 `docs/` |
| TC-03-009 | 恢复时同名冲突自动重命名 | `docs/<name>/` 已存在 | POST restore | 返回 200，name 变为 `"<name>-副本"`，路径同步更新 |
| TC-03-010 | 恢复不存在的知识库 | id 无效 | POST restore | 返回 404 |
| TC-03-011 | 恢复未删除的知识库 | deleted_at 为 NULL | POST restore | 返回 404 |

**已有自动化测试**: `tests/unit/server/knowledgeBases.test.ts`  
**覆盖范围**: TC-03-001 ~ TC-03-011（全部覆盖）

## 3.2 Sidecar API — 文件操作

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-03-012 | `GET /knowledge-bases/:id/files` 空目录 | 新建知识库 | GET 请求 | 返回 200，`{ path: '', items: [] }` |
| TC-03-013 | `GET /knowledge-bases/:id/files` 列出文件 | 已导入若干文件和子目录 | GET 请求 | 返回 items 数组，包含 name/type/size/updatedAt，type 为 file 或 directory |
| TC-03-014 | `GET .../files?path=subdir` 子目录浏览 | 存在子目录 | GET 带 path 参数 | 返回子目录内容，path 为相对路径 |
| TC-03-015 | 路径越界安全检查 | path = `../etc` | GET 请求 | 返回 400，`{ error: 'Invalid path' }` |
| TC-03-016 | `POST /knowledge-bases/:id/files` 导入文件 | 提供 files 数组 [{ name, content }] | POST 请求 | 返回 200，`{ imported: N }`，文件被写入物理目录 |
| TC-03-017 | 导入文件到子目录 | path = "notes/" | POST 请求 | 文件写入 `docs/<kb>/notes/` 下 |
| TC-03-018 | 导入文件路径越界 | file.name = `../outside.txt` | POST 请求 | 返回 400，无文件被写入 |
| TC-03-019 | `GET /knowledge-bases/:id/search` 搜索文件名 | 已导入 notes.md、todo.txt | GET `?q=notes` | 返回 results 包含 notes.md |
| TC-03-020 | 搜索空查询 | q = "" | GET 请求 | 返回 200，`{ results: [] }` |
| TC-03-021 | 搜索不存在的文件 | q = "nonexistent" | GET 请求 | 返回 200，`results` 为空数组 |
| TC-03-022 | 搜索跨目录匹配 | 子目录中也有匹配项 | GET 请求 | results 包含所有层级中匹配的文件和目录，带 relativePath |

**已有自动化测试**: `tests/unit/server/knowledgeBases.test.ts`  
**覆盖范围**: TC-03-012 ~ TC-03-022（全部覆盖）

## 3.3 前端 — useKnowledgeBaseStore（Pinia）

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-03-023 | 初始状态 | 新 store 实例 | 创建 store | `knowledgeBases = []`，`selectedKbId = null`，`files = []`，`history = [{ type: 'browse', path: '' }]` |
| TC-03-024 | `loadKnowledgeBases` 加载列表 | mock API 返回 2 条 KB | 调用 action | `knowledgeBases` 更新为 2 条，`isLoading` 先 true 后 false |
| TC-03-025 | `loadKnowledgeBases` 失败 | mock API 返回 500 | 调用 action | `error` 被设置，`isLoading = false` |
| TC-03-026 | `createKnowledgeBase` 成功 | mock API 返回新 KB | 调用 action | 新 KB 被 unshift 到列表头部，自动 `selectKb`，返回新 KB |
| TC-03-027 | `createKnowledgeBase` 失败（重复名） | mock API 返回 409 | 调用 action | 抛出 Error，`error` 被设置，列表不变 |
| TC-03-028 | `selectKb` 切换知识库 | 已加载多个 KB | `selectKb(id)` | `selectedKbId` 更新，history 重置为根目录，自动调用 `loadFiles('')` |
| TC-03-029 | `deleteKnowledgeBase` 成功 | 选中某个 KB | 调用 action | 列表过滤掉该 KB，若当前选中则 `selectedKbId = null`，`files = []` |
| TC-03-030 | `restoreKnowledgeBase` 成功 | mock API 返回恢复的 KB | 调用 action | KB 被 unshift 到列表头部 |
| TC-03-031 | `navigateToPath` 浏览子目录 | 当前在根目录 | `navigateToPath('docs')` | history 追加 browse 项，`historyIndex` 递增，调用 `loadFiles('docs')` |
| TC-03-032 | `goBack` 回退 | historyIndex > 0 | `goBack()` | `historyIndex--`，加载对应目录 |
| TC-03-033 | `goForward` 前进 | historyIndex < length - 1 | `goForward()` | `historyIndex++`，加载对应目录 |
| TC-03-034 | `searchFiles` 成功 | mock API 返回搜索结果 | `searchFiles('query')` | `searchResults` 更新，history 追加 search 项，`searchQuery` 更新 |
| TC-03-035 | `searchFiles` 空查询清空结果 | searchResults 已有数据 | `searchFiles('')` 或直接 navigateToPath('') | `searchResults = []` |
| TC-03-036 | `importFiles` 调用 Rust IPC | `selectedKbId` 已设置 | `importFiles()` | 调用 `invoke('import_files', { knowledgeBaseId, targetPath })`，成功后刷新当前目录 |
| TC-03-037 | 面包屑计算 | 当前 path = "a/b/c" | 读取 `breadcrumb` | 返回 `['a', 'b', 'c']` |
| TC-03-038 | 根目录面包屑为空 | 当前 path = "" | 读取 `breadcrumb` | 返回 `[]` |
| TC-03-039 | 搜索态面包屑为空 | history 当前项为 search | 读取 `breadcrumb` | 返回 `[]` |
| TC-03-040 | 前进截断历史 | historyIndex 不在末尾，再 push 新路径 | `navigateToPath('new')` | history 中被截断，只保留到当前 index 为止，再追加新项 |

**已有自动化测试**: `src/stores/knowledgeBase.spec.ts` + `tests/unit/stores/knowledgeBaseRemaining.test.ts` + `tests/unit/stores/knowledgeBaseExtended.test.ts`  
**覆盖范围**: TC-03-023 ~ TC-03-040（全部覆盖，分散在 3 个 store 测试文件中）

## 3.4 前端 — KnowledgeBasePage 组件

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-03-041 | 左侧知识库列表渲染 | store 中有 2 个 KB | 挂载组件 | 左侧渲染 2 个 KB 项，显示名称和图标 |
| TC-03-042 | 选中状态高亮 | 选中第一个 KB | 挂载组件 | 第一个 KB 项有选中样式（bg-accent 相关 class） |
| TC-03-043 | 空列表提示 | `knowledgeBases = []` 且 `!isLoading` | 挂载组件 | 左侧显示"暂无知识库，点击 + 创建" |
| TC-03-044 | 未选中知识库时右侧占位 | `selectedKbId = null` | 挂载组件 | 右侧显示图标和"选择一个知识库或创建新库" |
| TC-03-045 | 新建知识库弹窗 | 点击 + 按钮 | 模拟点击 | 弹出对话框，包含输入框、取消、创建按钮 |
| TC-03-046 | 新建知识库验证空名称 | 输入框为空，点击创建 | 模拟点击 | 显示错误"请输入知识库名称"，不调用 API |
| TC-03-047 | 新建知识库成功关闭弹窗 | 输入有效名称，mock 成功 | 点击创建 | 调用 `store.createKnowledgeBase`，弹窗关闭 |
| TC-03-048 | 选中知识库渲染 FileExplorer | `selectedKb` 存在 | 挂载组件 | 右侧渲染 `FileExplorer` 组件，传入正确 props |
| TC-03-049 | 错误 Toast 显示 | `store.error` 有值 | 挂载组件 | 底部显示红色错误条，含关闭按钮 |
| TC-03-050 | 点击错误关闭按钮 | 错误 Toast 显示中 | 点击关闭按钮 | `store.error` 被设为 `null`，Toast 消失 |
| TC-03-051 | 生命周期 onMounted 加载列表 | 无 | 挂载组件 | 自动调用 `store.loadKnowledgeBases()` |

**已有自动化测试**: `tests/unit/components/KnowledgeBasePage.test.ts`  
**覆盖范围**: TC-03-041 ~ TC-03-051（全部覆盖）

## 3.5 前端 — FileExplorer 组件

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-03-052 | 浏览模式渲染文件列表 | `isSearchMode = false`，files 有数据 | 挂载组件 | 渲染文件/文件夹列表，文件夹可双击 |
| TC-03-053 | 搜索模式渲染搜索结果 | `isSearchMode = true`，searchResults 有数据 | 挂载组件 | 渲染搜索结果列表，显示相对路径 |
| TC-03-054 | 面包屑导航渲染 | breadcrumb = ['docs', 'notes'] | 挂载组件 | 渲染"知识库 > docs > notes"，可点击回退 |
| TC-03-055 | 点击面包屑根目录 | 点击第一个面包屑项（知识库） | 模拟点击 | 触发 `navigate-to-breadcrumb` 事件，index = -1 |
| TC-03-056 | 点击面包屑中间项 | 点击 breadcrumb[1] | 模拟点击 | 触发事件，index = 1，对应路径切片 |
| TC-03-057 | 搜索框输入触发搜索 | 输入"query"后回车或触发 | 模拟输入 | 触发 `search` 事件，参数为输入值 |
| TC-03-058 | 搜索框空值返回根目录 | 输入清空 | 清空输入 | 触发 `search` 事件，空字符串，组件返回根目录 |
| TC-03-059 | 导入文件按钮 | 点击导入按钮 | 模拟点击 | 触发 `import-files` 事件 |
| TC-03-060 | 后退/前进按钮状态 | `canGoBack = false`，`canGoForward = false` | 挂载组件 | 后退/前进按钮 disabled 或隐藏 |

**已有自动化测试**: `tests/unit/components/FileExplorer.test.ts`  
**覆盖范围**: TC-03-052 ~ TC-03-059（TC-03-060 前进/后退按钮 disabled 状态由父组件/store 控制，未在组件层单独测试）

## 3.6 集成 — 文件导入链路（前端 → Rust → Sidecar）

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-03-061 | Rust `import_files` 命令打开系统对话框 | 前端调用 `invoke('import_files')` | Tauri 弹出文件选择对话框 | 用户可选中一个或多个文件 |
| TC-03-062 | Rust 读取选中文件内容 | 用户选择了 `hello.md` | Rust 读取文件 | 内容被正确读取为字符串 |
| TC-03-063 | Rust HTTP POST 到 sidecar | 读取到文件内容后 | Rust 发送 POST | 请求到达 `POST /knowledge-bases/:id/files`，body 包含文件名和内容 |
| TC-03-064 | Sidecar 保存文件到目标路径 | 收到 POST 请求 | sidecar 写入文件 | 文件被保存到 `docs/<kb>/<targetPath>/<filename>` |
| TC-03-065 | 导入成功后前端刷新列表 | sidecar 返回 200 | 前端调用 `loadFiles(currentPath)` | `files` 数组包含新导入的文件 |
| TC-03-066 | 导入失败前端显示错误 | sidecar 返回 500 或 Rust 读文件失败 | 错误传递 | `store.error` 被设置，Toast 显示错误信息 |

---

## 待补充的自动化测试

| TC-ID 范围 | 测试层 | 建议方案 |
|---|---|---|
| TC-03-061 ~ TC-03-066 | Tauri 集成 | 在 Tauri 测试环境中验证 `import_files` IPC 全链路 |

---

*文档生成日期：2026-05-08*  
*对应 Issue：#03-knowledge-base-management*
