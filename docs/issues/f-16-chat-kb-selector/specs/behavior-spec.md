# 行为规格：聊天知识库选择器

## 入口

- 路由：`/chat`（或应用内默认打开的标签页）
- 触发：用户进入聊天视图，页面加载后自动拉取知识库列表

## 初始状态

- 输入区（`ChatInput.vue`）底部工具栏左侧显示「知识库」按钮（`DatabaseIcon` + 文字）
- 未点击前，选择器浮层隐藏，输入区无已选知识库 pills
- 若当前会话此前已选过知识库且未发送消息，选中状态保持（组件级 `selectedKbs`）

## 交互状态

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| loading | 「知识库」按钮可用；点击后下拉浮层显示 3 条 `Skeleton` 占位条 | 按钮可点击，列表项不可交互 | 等待 `kbStore.loadKnowledgeBases()` 完成 |
| empty | 下拉浮层显示文字「请先创建知识库」，居中对齐，文字颜色 `text-text-secondary` | 用户可关闭浮层或点击「知识库」按钮重新打开 | 关闭浮层，无数据变更 |
| error | 下拉浮层显示文字「加载失败」，下方显示「重试」文字按钮（颜色 `text-accent-500`） | 点击「重试」重新拉取列表；点击浮层外关闭 | 调用 `kbStore.loadKnowledgeBases()`，进入 loading 状态 |
| success | 下拉浮层显示知识库列表，每项左侧为 checkbox，中间为 `DatabaseIcon` + 名称，右侧为文档数量 | 点击列表项 toggle 选中；点击浮层外或按 ESC 关闭 | 选中项以 `KbMentionPill` 形式显示在 textarea 上方；`selectedKbs` 数组更新 |
| partial | 列表加载成功，但部分知识库名称过长被截断（`truncate`）；或列表高度超过 192px 出现纵向滚动条 | 滚动浏览；键盘 ArrowUp/ArrowDown 移动高亮；Enter toggle 选中 | 高亮项跟随键盘移动；Enter 触发 toggle；滚动条自动跟随高亮项 |

## 正常流程

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击输入区底部「知识库」按钮 | 打开 `KbSelector.vue` 浮层；若 `kbStore.knowledgeBases` 为空则触发 `loadKnowledgeBases()` | 浮层出现，状态为 loading / empty / success |
| 2 | 在浮层中点击某知识库项 | toggle 该项 checkbox；若选中则向上发射 `select` 事件，若取消则发射 `unselect` | 该项 checkbox 状态翻转；选中项以 pill 形式出现在 textarea 上方 |
| 3 | 重复步骤 2 选择多个知识库 | `selectedKbs` 数组追加/移除 | textarea 上方 pills 行动态增减 |
| 4 | 点击 pill 上的 `XIcon` | 发射 `remove`，`ChatInput` 从 `selectedKbs` 过滤该项 | pill 消失，浮层内对应 checkbox 取消勾选（若浮层仍打开） |
| 5 | 输入消息内容，点击发送或按 Enter | `handleSend` 提取 `selectedKbs.map(k => k.id)`，通过 `send` 事件传出 | 输入区清空，`selectedKbs` 重置为空数组，pills 消失 |
| 6 | 后端返回 SSE 流式响应 | `sessionStore` 接收 chunk 并渲染到消息列表 | 消息列表逐字输出 AI 回答 |

## 错误场景

| 场景 | 触发 | 视觉 | 恢复 |
|------|------|------|------|
| 知识库列表加载失败 | `kbStore.loadKnowledgeBases()` 抛出异常（网络错误 / 401 / 500） | 浮层内显示「加载失败」+「重试」按钮 | 用户点击「重试」重新拉取；或关闭浮层继续普通对话 |
| 发送时 kbIds 包含已删除知识库 | 用户选择后，知识库被其他会话/用户删除 | 无前端感知；后端 `ChatService` 检索时该 kbId 无数据，正常降级为无 RAG 上下文 | 后端行为，前端无需处理 |
| 空选时发送 | 用户未选择任何知识库 | 与现有行为完全一致：前端不传 `knowledgeBaseIds`，后端不注入 system context | 无需恢复 |

## 边界与约束

- **最大选中数**：不做前端限制，后端 `ChatDto` 的 `knowledgeBaseIds` 为数组，长度由后端校验（当前 schema 未设上限）
- **会话切换**：用户切换左侧会话标签时，`ChatView` 重新挂载 `ChatInput`（通过 `:key="activeSessionId"` 绑定），`selectedKbs` 自动清空。`activeSessionId` 变化时 Vue 销毁并重建 `ChatInput`，组件级 `selectedKbs` 状态自然重置
- **空会话页**：`EmptySession.vue` 的「知识库」按钮点击后，若输入区有内容则创建会话并进入 `ChatInput`；空选时发送不携带 `knowledgeBaseIds`。`EmptySession` 的选中状态不跨会话保持（与 `ChatInput` 一致：组件级状态，切换即清空）
- **键盘无障碍**：浮层打开时，Tab/ArrowUp/ArrowDown/Enter/Escape 行为由 `KbSelector.vue` 处理，不穿透到 textarea

## 测试映射

| 交互状态 | 测试文件 | 测试用例 |
|----------|----------|----------|
| loading | `tests/unit/webui/KbSelector.spec.ts` | `AC-02: displays skeleton while loading knowledge bases` |
| empty | `tests/unit/webui/KbSelector.spec.ts` | `AC-03: shows empty hint when no knowledge bases exist` |
| error | `tests/unit/webui/KbSelector.spec.ts` | `AC-04: shows error and retry button on load failure` |
| success | `tests/unit/webui/ChatInput.spec.ts` | `AC-01: renders KbSelector and toggles selection` |
| partial | `tests/unit/webui/KbSelector.spec.ts` | `AC-05: keyboard navigation works in dropdown` |
| 正常流程 | `tests/unit/webui/ChatInput.spec.ts` | `AC-06: sends message with selected knowledgeBaseIds` |
| 空选回归 | `tests/unit/webui/ChatInput.spec.ts` | `AC-07: sends message without knowledgeBaseIds when none selected` |
| 会话切换清空 | `tests/unit/webui/ChatView.spec.ts` | `AC-05: clears selected KBs on session switch` |
