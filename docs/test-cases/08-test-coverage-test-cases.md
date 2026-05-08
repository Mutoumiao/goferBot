# Issue #08 — 测试覆盖补全 测试用例

> **对应 Issue**: `.scratch/knowledge-base/issues/08-test-coverage.md`
> **状态**: in-progress
> **更新日期**: 2026-05-08

---

## 测试范围

本文件覆盖 Issue #08 的全部验收标准，重点补充当前自动化测试缺口，同时汇总已有测试覆盖情况。

- 测试稳定性修复（knowledgeBasesExtended teardown 错误）
- Sidecar API 缺口补全（sessions 路由）
- 工具函数测试（markdown.ts、confirm.ts）
- 前端组件测试缺口（KbMentionPill、MoveCopyDialog）
- 废弃代码清理（GreetComponent.vue）
- 覆盖率验证（lines ≥ 10%, branches ≥ 10%, statements ≥ 10%, functions ≥ 0%）

---

## 1. 测试稳定性

### 1.1 knowledgeBasesExtended.test.ts teardown

| 编号 | 场景 | 前置条件 | 操作 | 预期结果 | 自动化测试 |
|------|------|----------|------|----------|------------|
| STAB-01 | 测试结束后关闭数据库并清理临时目录 | Vitest 运行全部测试 | `pnpm test` | 无 "EnvironmentTeardownError"，无 "Unhandled Rejection" | `knowledgeBasesExtended.test.ts` |
| STAB-02 | 多次运行测试无端口/文件占用冲突 | 连续运行两次 `pnpm test` | 第二次运行 | 全部通过，无 EADDRINUSE 或文件锁错误 | `knowledgeBasesExtended.test.ts` |

**相关文件**: `tests/unit/server/knowledgeBasesExtended.test.ts`（修改）

---

## 2. Sidecar API 测试

### 2.1 Sessions 路由（新增）

| 编号 | 场景 | 前置条件 | 操作 | 预期结果 | 自动化测试 |
|------|------|----------|------|----------|------------|
| API-01 | `GET /sessions` 返回空列表 | 数据库无 sessions | 发送 GET 请求 | 返回 `[]`，状态码 200 | `sessions.test.ts` |
| API-02 | `GET /sessions` 按 updated_at DESC 排序 | 插入 s1(updated_at=1000)、s2(updated_at=2000) | 发送 GET 请求 | 返回数组，s2 在 s1 之前 | `sessions.test.ts` |
| API-03 | `GET /sessions/:id` 404 不存在 | 数据库无该 id | GET `/nonexistent` | 返回 404，`{ error: 'Session not found' }` | `sessions.test.ts` |
| API-04 | `GET /sessions/:id` 返回会话和消息 | session s1 存在，关联消息 m1(role=user, content=hello) | GET `/s1` | 返回 200，包含 `title`、`messages` 数组，messages[0].content 为 `hello` | `sessions.test.ts` |
| API-05 | 消息按 created_at ASC 排序 | s1 关联 m1(created_at=100) 和 m2(created_at=200) | GET `/s1` | messages 数组中 m1 在 m2 之前 | `sessions.test.ts` |

**相关文件**: `tests/unit/server/sessions.test.ts`（新建）

### 2.2 已有 Sidecar API 测试汇总

以下测试已存在，Issue #08 不再重复编写，但纳入覆盖统计：

| 编号 | 场景 | 自动化测试文件 |
|------|------|----------------|
| API-06 | `POST /chat` SSE 流式响应 | `chatRag.test.ts` |
| API-07 | `POST /chat` 携带 knowledgeBaseIds | `chatRag.test.ts` |
| API-08 | `GET /knowledge-bases` CRUD | `knowledgeBases.test.ts` |
| API-09 | `POST /knowledge-bases/:id/folders` | `knowledgeBasesExtended.test.ts` |
| API-10 | `PATCH /knowledge-bases/:id/files/:path` 重命名 | `knowledgeBasesExtended.test.ts` |
| API-11 | `POST /files/move` 跨库移动 | `knowledgeBasesExtended.test.ts` |
| API-12 | `POST /files/copy` 跨库复制 | `knowledgeBasesExtended.test.ts` |
| API-13 | `GET /knowledge-bases/deleted` | `knowledgeBasesExtended.test.ts` |
| API-14 | Embedding 服务 getEmbedding | `embedding.test.ts` |
| API-15 | 索引队列 enqueueKnowledgeBase | `indexer.test.ts` |
| API-16 | 混合搜索 hybridSearch | `rag.test.ts` |
| API-17 | 数据库 Schema 与扩展加载 | `dbSchema.test.ts` |

---

## 3. 工具函数测试

### 3.1 markdown.ts（新增）

| 编号 | 场景 | 操作 | 预期结果 | 自动化测试 |
|------|------|------|----------|------------|
| UTIL-01 | 纯文本渲染为段落 | `renderMarkdown('hello world')` | 返回 `<p>hello world</p>` | `markdown.test.ts` |
| UTIL-02 | 加粗文本渲染 | `renderMarkdown('**bold**')` | 包含 `<strong>bold</strong>` | `markdown.test.ts` |
| UTIL-03 | 代码块渲染含高亮 | ``renderMarkdown('\`\`\`js\nconst x = 1;\n\`\`\`')`` | 包含 `<pre>`、`<code>`、`const x = 1` | `markdown.test.ts` |
| UTIL-04 | 行内代码渲染 | ``renderMarkdown('use \`renderMarkdown\`')`` | 包含 `<code>renderMarkdown</code>` | `markdown.test.ts` |
| UTIL-05 | 无序列表渲染 | `renderMarkdown('- item 1\n- item 2')` | 包含 `<ul>`、`<li>item 1</li>` | `markdown.test.ts` |
| UTIL-06 | 有序列表渲染 | `renderMarkdown('1. first\n2. second')` | 包含 `<ol>`、`<li>first</li>` | `markdown.test.ts` |
| UTIL-07 | 链接渲染为锚点 | `renderMarkdown('[link](https://example.com)')` | 包含 `<a href="https://example.com">link</a>` | `markdown.test.ts` |
| UTIL-08 | 标题渲染 | `renderMarkdown('# Title')` | 包含 `<h1>Title</h1>` | `markdown.test.ts` |

**相关文件**: `tests/unit/utils/markdown.test.ts`（新建）

### 3.2 confirm.ts（新增）

| 编号 | 场景 | 前置条件 | 操作 | 预期结果 | 自动化测试 |
|------|------|----------|------|----------|------------|
| UTIL-09 | Tauri confirm 可用时直接返回 | mock `tauriConfirm` 返回 `true` | `confirmDialog('Are you sure?')` | 返回 `true`，调用参数为 `'Are you sure?'` | `confirm.test.ts` |
| UTIL-10 | Tauri confirm 不可用时 fallback 到 window.confirm | mock `tauriConfirm` 抛出 Error | `confirmDialog('Fallback?')` | 调用 `window.confirm('Fallback?')` 并返回其结果 | `confirm.test.ts` |

**相关文件**: `tests/unit/utils/confirm.test.ts`（新建）

### 3.3 已有工具函数测试汇总

| 编号 | 场景 | 自动化测试文件 |
|------|------|----------------|
| UTIL-11 | `sidecarClient` 端口变更处理 | `sidecarClient.test.ts` |
| UTIL-12 | `sidecarClient` 请求重试逻辑 | `sidecarClient.test.ts` |

---

## 4. 前端组件测试

### 4.1 KbMentionPill（新增）

| 编号 | 场景 | 操作 | 预期结果 | 自动化测试 |
|------|------|------|----------|------------|
| UI-01 | 渲染知识库名称 | 挂载组件，prop `kb = { name: 'Docs' }` | DOM 中包含文本 `Docs` | `KbMentionPill.test.ts` |
| UI-02 | 渲染自定义图标 | prop `kb.icon = 'mdi-books'` | DOM 中包含 `span.i-mdi-books` | `KbMentionPill.test.ts` |
| UI-03 | 无图标时使用默认数据库图标 | prop `kb` 不含 `icon` 字段 | DOM 中包含 `span.i-mdi-database` | `KbMentionPill.test.ts` |
| UI-04 | 点击关闭按钮触发 remove 事件 | 点击 pill 右侧 × 按钮 | 触发 `remove` 事件一次 | `KbMentionPill.test.ts` |

**相关文件**: `tests/unit/components/KbMentionPill.test.ts`（新建）

### 4.2 MoveCopyDialog（新增）

| 编号 | 场景 | 操作 | 预期结果 | 自动化测试 |
|------|------|------|----------|------------|
| UI-05 | move 模式显示"移动到"标题 | `mode='move'` | 标题文本为 `移动到` | `MoveCopyDialog.test.ts` |
| UI-06 | copy 模式显示"复制到"标题 | `mode='copy'` | 标题文本为 `复制到` | `MoveCopyDialog.test.ts` |
| UI-07 | 左栏渲染所有知识库 | store 中有 2 个知识库 | 左栏同时显示 Source 和 Target | `MoveCopyDialog.test.ts` |
| UI-08 | 默认高亮源知识库 | `sourceKbId='kb1'` | kb1 对应行有选中样式类 | `MoveCopyDialog.test.ts` |
| UI-09 | 点击取消按钮触发 close 事件 | 点击取消按钮 | 触发 `close` 事件一次 | `MoveCopyDialog.test.ts` |
| UI-10 | 点击遮罩层触发 close 事件 | 点击弹窗外部遮罩 | 触发 `close` 事件一次 | `MoveCopyDialog.test.ts` |
| UI-11 | 可见时加载目标文件夹列表 | mock fetch 返回子文件夹 | 右栏渲染文件夹名称 | `MoveCopyDialog.test.ts` |
| UI-12 | 无子文件夹时显示空状态 | mock fetch 返回空数组 | 显示 `暂无子文件夹` | `MoveCopyDialog.test.ts` |
| UI-13 | move 模式下确认调用 store.moveFile | 点击"移动至此" | `store.moveFile` 被调用，参数为源库、源路径、目标库、目标路径 | `MoveCopyDialog.test.ts` |
| UI-14 | copy 模式下确认调用 store.copyFile | 点击"复制至此" | `store.copyFile` 被调用，参数正确 | `MoveCopyDialog.test.ts` |
| UI-15 | 确认后触发 close 事件 | 点击确认按钮 | 触发 `close` 事件 | `MoveCopyDialog.test.ts` |

**相关文件**: `tests/unit/components/MoveCopyDialog.test.ts`（新建）

### 4.3 已有前端组件测试汇总

以下测试已存在，Issue #08 不再重复编写：

| 编号 | 场景 | 自动化测试文件 |
|------|------|----------------|
| UI-16 | 空会话态渲染和快捷胶囊点击 | `EmptySession.test.ts` |
| UI-17 | 消息输入和发送 | `ChatInput.test.ts` |
| UI-18 | 标签栏新建/切换/关闭 | `TabBar.test.ts` |
| UI-19 | 首页占位符升格逻辑 | `session.test.ts` / `ChatPage.test.ts` |
| UI-20 | Markdown + 代码高亮渲染 | `MarkdownRender.test.ts` |
| UI-21 | `@提及` 下拉选择和 pill/tag 渲染 | `ChatInputMention.test.ts`、`KbMentionDropdown.test.ts` |
| UI-22 | 消息列表渲染 | `ChatMessageList.test.ts` |
| UI-23 | 单条消息渲染（角色、内容、复制按钮） | `ChatMessage.test.ts` |
| UI-24 | 知识库页面布局和文件资源管理器 | `KnowledgeBasePage.test.ts`、`FileExplorer.test.ts` |
| UI-25 | 右键菜单渲染和关闭 | `ContextMenu.test.ts` |
| UI-26 | 行内重命名编辑和保存 | `InlineRename.test.ts` |
| UI-27 | 修改资料弹窗 | `EditKbDialog.test.ts` |
| UI-28 | 回收站页面 | `RecycleBinPage.test.ts` |
| UI-29 | 侧边栏导航 | `SideBar.test.ts` |
| UI-30 | SplashScreen 加载和错误态 | `SplashScreen.test.ts` |
| UI-31 | 索引进度条渲染 | `FileExplorerIndexStatus.test.ts` |

---

## 5. Store 测试

### 5.1 已有 Store 测试汇总

Issue #08 不涉及新增 Store 测试，已有测试覆盖情况如下：

| 编号 | 场景 | 自动化测试文件 |
|------|------|----------------|
| STORE-01 | `useSessionStore` 创建会话、发送消息、切换模型 | `session.test.ts`、`sessionMention.test.ts` |
| STORE-02 | `useKnowledgeBaseStore` 创建知识库、导入文件、浏览目录 | `knowledgeBaseExtended.test.ts`、`knowledgeBaseRemaining.test.ts` |
| STORE-03 | `useKnowledgeBaseStore` 置顶 toggle、重命名文件、新建文件夹 | `knowledgeBaseExtended.test.ts` |
| STORE-04 | `useSettingsStore` 加载默认配置、保存配置到 localStorage | `settings.test.ts` |
| STORE-05 | Tab 新建/关闭/切换（在 session store 中） | `session.test.ts` |

---

## 6. 代码清理

### 6.1 废弃组件删除

| 编号 | 场景 | 操作 | 预期结果 |
|------|------|------|----------|
| CLEAN-01 | GreetComponent.vue 无引用 | `grep -r "GreetComponent" src/` | 无任何引用 |
| CLEAN-02 | 删除后测试和类型检查通过 | `pnpm test && pnpm type-check` | 全部通过，无新错误 |
| CLEAN-03 | components.d.ts 同步更新 | 运行 dev server 或手动移除声明 | 文件中不再包含 `GreetComponent` |

**相关文件**: `src/components/GreetComponent.vue`（删除）

---

## 7. 覆盖率验证

### 7.1 阈值检查

| 编号 | 场景 | 操作 | 预期结果 |
|------|------|------|----------|
| COV-01 | lines 覆盖率达标 | `pnpm test -- --coverage` | `lines` ≥ 10% |
| COV-02 | branches 覆盖率达标 | `pnpm test -- --coverage` | `branches` ≥ 10% |
| COV-03 | statements 覆盖率达标 | `pnpm test -- --coverage` | `statements` ≥ 10% |
| COV-04 | functions 覆盖率达标 | `pnpm test -- --coverage` | `functions` ≥ 0% |
| COV-05 | 无未处理错误 | `pnpm test -- --coverage` | 无 "Unhandled Rejection"、无 "EnvironmentTeardownError" |
| COV-06 | 全部测试通过 | `pnpm test -- --coverage` | 0 failed，所有测试文件 passed |

---

## 8. 测试统计

| 类别 | 新增自动化测试 | 已有自动化测试 | 手动验证 | 总计 |
|------|---------------|---------------|----------|------|
| 测试稳定性 | 0 | 1 文件修复 | 0 | 1 |
| Sidecar API | 5 | 12 | 0 | 17 |
| 工具函数 | 10 | 2 | 0 | 12 |
| 前端组件 | 15 | 16 | 0 | 31 |
| Store | 0 | 5 | 0 | 5 |
| 代码清理 | 1 文件删除 | 0 | 0 | 1 |
| 覆盖率验证 | 0 | 0 | 1 命令 | 1 |
| **合计** | **30** | **36** | **1** | **67** |

---

## 9. 相关测试文件

| 文件路径 | 说明 | 动作 |
|----------|------|------|
| `tests/unit/server/sessions.test.ts` | Sessions API 测试（5 例） | 新建 |
| `tests/unit/utils/markdown.test.ts` | Markdown 渲染测试（8 例） | 新建 |
| `tests/unit/utils/confirm.test.ts` | ConfirmDialog fallback 测试（2 例） | 新建 |
| `tests/unit/components/KbMentionPill.test.ts` | KbMentionPill 组件测试（4 例） | 新建 |
| `tests/unit/components/MoveCopyDialog.test.ts` | MoveCopyDialog 组件测试（11 例） | 新建 |
| `tests/unit/server/knowledgeBasesExtended.test.ts` | 补充 afterAll teardown | 修改 |
| `src/components/GreetComponent.vue` | 废弃模板组件 | 删除 |

---

*文档生成日期：2026-05-08*
*对应 Issue：#08-test-coverage*
