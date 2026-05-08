# Issue #06 — 对话历史页面 测试用例

**对应 Issue**: `.scratch/knowledge-base/issues/06-chat-history.md`
**状态**: ready-for-agent
**测试框架**: Vitest（前端 Unit + 组件）、Node 环境 Vitest（Sidecar API）

---

## 6.1 Sidecar API — 会话列表查询

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-06-001 | `GET /sessions` 返回会话列表 | 数据库中有 3 条 sessions 记录 | 发送 GET 请求 | 返回 200，数组长度为 3，每条包含 `id`、`title`、`lastMessageAt`、`summary` |
| TC-06-002 | `GET /sessions` 按时间倒序排列 | 会话 A 创建于今天，会话 B 创建于昨天 | 发送 GET 请求 | 返回数组第一项为 A，第二项为 B |
| TC-06-003 | `GET /sessions` 包含最后消息时间 | 会话有 2 条 messages，最后一条创建于 10:00 | 发送 GET 请求 | `lastMessageAt` 为 10:00 对应的时间戳/ISO 字符串 |
| TC-06-004 | `GET /sessions` 内容摘要取自首条用户消息 | 会话首条用户消息为 "你好，请问如何使用 RAG？" | 发送 GET 请求 | `summary` = "你好，请问如何使用 RAG？"（截取前 100 字） |
| TC-06-005 | `GET /sessions` 摘要长度限制 100 字 | 首条用户消息长度为 200 字 | 发送 GET 请求 | `summary` 长度 ≤ 100，以 "..." 结尾或不截断中文字符 |
| TC-06-006 | `GET /sessions` 空列表返回空数组 | 数据库无 sessions 记录 | 发送 GET 请求 | 返回 200，`[]` |
| TC-06-007 | `GET /sessions` 无 messages 时摘要为空 | session 存在但无关联 messages | 发送 GET 请求 | `summary` = "" 或 `null`，不报错 |
| TC-06-008 | `GET /sessions` 返回总结标题 | session 的 `title` = "RAG 使用讨论" | 发送 GET 请求 | `title` = "RAG 使用讨论" |

**已有/待补充自动化测试**: `tests/unit/server/sessions.test.ts`（扩展）
**覆盖范围**: TC-06-001 ~ TC-06-008

---

## 6.2 Sidecar API — 会话重命名

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-06-009 | `POST /sessions/:id/rename` 成功 | session 存在 | 发送 POST，body `{ "title": "新标题" }` | 返回 200，`{ success: true }`，数据库中 `title` 更新为 "新标题" |
| TC-06-010 | `POST /sessions/:id/rename` 空标题拒绝 | session 存在 | 发送 POST，body `{ "title": "" }` | 返回 400，错误提示标题不能为空 |
| TC-06-011 | `POST /sessions/:id/rename` 标题过长截断或拒绝 | body `title` 长度 > 200 | 发送 POST | 返回 400 或成功但截断至 200 字（依实现而定） |
| TC-06-012 | `POST /sessions/:id/rename` 404 会话不存在 | id 无效 | 发送 POST | 返回 404 |
| TC-06-013 | `POST /sessions/:id/rename` 只修改 title 字段 | session 原有 provider/model 等字段 | 发送 POST | 仅 `title` 变化，其他字段不受影响 |

**已有/待补充自动化测试**: `tests/unit/server/sessions.test.ts`（扩展）
**覆盖范围**: TC-06-009 ~ TC-06-013

---

## 6.3 Sidecar API — 会话删除

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-06-014 | `DELETE /sessions/:id` 成功 | session 存在且有 3 条 messages | 发送 DELETE | 返回 200，`{ success: true }`，`sessions` 表中该记录删除 |
| TC-06-015 | `DELETE /sessions/:id` 级联删除消息 | session 有 3 条 messages | 删除后查询 `messages` 表 | 该 session 关联的 messages 全部删除 |
| TC-06-016 | `DELETE /sessions/:id` 404 会话不存在 | id 无效 | 发送 DELETE | 返回 404 |
| TC-06-017 | `DELETE /sessions/:id` 删除无消息会话不报错 | session 无 messages | 发送 DELETE | 返回 200，session 记录删除 |
| TC-06-018 | `DELETE /sessions/:id` 不影响其他会话 | 数据库有 session A 和 B | 删除 A | B 的 session 和 messages 完整保留 |

**已有/待补充自动化测试**: `tests/unit/server/sessions.test.ts`（扩展）
**覆盖范围**: TC-06-014 ~ TC-06-018

---

## 6.4 前端 — 对话历史页面与导航

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-06-019 | 点击时钟图标打开历史页 | 主界面已挂载 | 点击左侧时钟图标 | 路由跳转到 `/history` 或打开 HistoryPage，为单例标签 |
| TC-06-020 | 历史页为单例标签 | 已打开历史页 | 再次点击时钟图标 | 不新建标签，聚焦到已有历史页 |
| TC-06-021 | 历史页显示 "问答历史" Tab | 历史页已打开 | 观察页面 | 默认显示 "问答历史" Tab（为后续其他历史类型预留） |
| TC-06-022 | 历史页加载时请求 `GET /sessions` | mock `sidecarFetch` | 挂载 HistoryPage | 组件挂载后调用 `sidecarFetch('GET', '/sessions')` |
| TC-06-023 | 历史页加载中显示骨架屏或 Loading | mock `sidecarFetch` 延迟 1s | 挂载组件 | 列表区域显示 Loading 状态 |
| TC-06-024 | 加载失败显示错误提示 | mock `sidecarFetch` 返回 500 | 挂载组件 | 显示错误提示，可重试 |

**已有/待补充自动化测试**: `tests/unit/views/HistoryPage.test.ts`（待创建）
**覆盖范围**: TC-06-019 ~ TC-06-024

---

## 6.5 前端 — 历史列表项渲染

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-06-025 | 列表项显示总结标题 | mock 返回 sessions 列表，第一项 title = "RAG 讨论" | 挂载 HistoryPage | 第一项显示 "RAG 讨论" |
| TC-06-026 | 列表项显示最后消息时间 | mock 返回 `lastMessageAt = "2026-05-08T10:00:00Z"` | 挂载组件 | 显示格式化后的时间（如 "2026-05-08 10:00" 或相对时间） |
| TC-06-027 | 列表项显示内容摘要 | mock 返回 `summary = "你好，请问如何使用..."` | 挂载组件 | 摘要文本正确渲染 |
| TC-06-028 | 摘要超长截断显示 | mock 返回 150 字摘要 | 挂载组件 | 显示截断后文本，不超过 100 字显示区域 |
| TC-06-029 | 多条历史按时间倒序排列 | mock 返回 3 条不同时间 | 挂载组件 | 列表顺序与 API 返回一致（最新在前） |
| TC-06-030 | 列表项可点击 | 列表已渲染 | 点击第一项 | 触发恢复会话逻辑 |
| TC-06-031 | 列表项悬浮显示操作按钮 | 列表已渲染 | 鼠标悬浮第一项 | 显示删除和重命名按钮（或更多操作菜单） |

**已有/待补充自动化测试**: `tests/unit/components/HistoryList.test.ts`（待创建）
**覆盖范围**: TC-06-025 ~ TC-06-031

---

## 6.6 前端 — 恢复会话逻辑

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-06-032 | 点击未打开的 session → 复用首页占位符 | 当前有首页空标签（placeholder），session A 未打开 | 点击 session A | 首页占位符被替换为 session A 的对话页，`tabStore` 中该 tab 的 sessionId 更新 |
| TC-06-033 | 点击未打开的 session → 无占位符则新建标签 | 当前无首页占位符，session B 未打开 | 点击 session B | 新建标签加载 session B，路由跳转到对话页 |
| TC-06-034 | 点击已打开的 session → 激活已有标签 | session C 已在标签 2 中打开 | 点击 session C | 不新建标签，直接激活标签 2 |
| TC-06-035 | 恢复 session 时加载历史消息 | mock `GET /sessions/:id/messages` 返回 5 条 | 点击恢复 | 对话页渲染 5 条历史消息 |
| TC-06-036 | 恢复后顶部显示 session 模型信息 | session provider = "openai"，model = "gpt-4o" | 点击恢复 | 对话页顶部模型选择器显示 "gpt-4o" |
| TC-06-037 | 恢复 session 后发送消息续接对话 | 已恢复 session，有历史消息 | 输入新消息发送 | 新消息追加到历史消息末尾，API 调用包含完整上下文 |

**已有/待补充自动化测试**: `tests/unit/stores/tabHistory.test.ts`、`tests/unit/views/HistoryPage.test.ts`（扩展）
**覆盖范围**: TC-06-032 ~ TC-06-037

---

## 6.7 前端 — 删除会话交互

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-06-038 | 点击删除按钮弹出确认对话框 | 列表第一项悬浮显示删除按钮 | 点击删除 | 弹出确认对话框（如 "确定删除该会话？"） |
| TC-06-039 | 确认删除后请求 `DELETE /sessions/:id` | mock `sidecarFetch` | 点击确认 | 发送 `DELETE /sessions/id`，列表中该项移除 |
| TC-06-040 | 删除后关闭对应标签 | session A 在标签 2 打开 | 删除 session A | 标签 2 被关闭，界面切换到其他标签 |
| TC-06-041 | 取消删除不发送请求 | 确认对话框已弹出 | 点击取消 | 不发送 DELETE 请求，列表不变 |
| TC-06-042 | 删除未打开的 session 不触发标签操作 | session B 未在任何标签打开 | 删除 session B | 仅发送 DELETE 请求，无标签关闭 |
| TC-06-043 | 删除最后一条历史显示空状态 | 列表仅剩 1 条 | 删除该项 | 列表区域显示空状态引导 |

**已有/待补充自动化测试**: `tests/unit/components/HistoryList.test.ts`（扩展）
**覆盖范围**: TC-06-038 ~ TC-06-043

---

## 6.8 前端 — 重命名会话交互

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-06-044 | 点击重命名按钮进入编辑模式 | 列表第一项悬浮显示重命名按钮 | 点击重命名 | 标题变为输入框，原标题内容被选中 |
| TC-06-045 | 编辑模式下按 Enter 保存 | 输入框中内容改为 "新标题" | 按 Enter | 发送 `POST /sessions/id/rename`，列表项显示 "新标题" |
| TC-06-046 | 编辑模式下按 Escape 取消 | 输入框中内容已修改 | 按 Escape | 不发送请求，标题恢复为原文本 |
| TC-06-047 | 重命名后对应标签标题同步更新 | session A 在标签 2 打开，标题原为 "旧" | 重命名为 "新" | 标签 2 的标题从 "旧" 变为 "新" |
| TC-06-048 | 重命名空标题提示错误 | 编辑模式下清空输入框 | 按 Enter | 不发送请求，显示错误提示（如 "标题不能为空"） |
| TC-06-049 | 重命名请求失败恢复原标题 | mock POST 返回 500 | 按 Enter | 列表项标题恢复为修改前，显示错误提示 |
| TC-06-050 | 输入框失焦自动保存 | 输入框中内容改为 "新标题"，点击外部 | 触发 blur | 行为同按 Enter，发送 rename 请求 |

**已有/待补充自动化测试**: `tests/unit/components/HistoryList.test.ts`（扩展）
**覆盖范围**: TC-06-044 ~ TC-06-050

---

## 6.9 前端 — 空状态与边界

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-06-051 | 无历史时显示空状态引导 | mock `GET /sessions` 返回 `[]` | 挂载 HistoryPage | 显示 "暂无历史记录" 及引导提示（如 "开始一次新的对话吧"） |
| TC-06-052 | 空状态引导可跳转新建对话 | 空状态已显示 | 点击 "开始对话" 按钮 | 打开新的对话标签 |
| TC-06-053 | 网络错误后重试成功 | 首次请求 500，重试返回数据 | 点击重试 | 列表正常渲染 |
| TC-06-054 | 长列表可滚动 | mock 返回 50 条记录 | 挂载组件 | 列表区域可垂直滚动，不溢出页面 |
| TC-06-055 | 列表项悬浮态不互相影响 | 鼠标悬浮第一项 | 观察第二项 | 第二项不显示操作按钮 |

**已有/待补充自动化测试**: `tests/unit/views/HistoryPage.test.ts`（扩展）
**覆盖范围**: TC-06-051 ~ TC-06-055

---

## 6.10 前端 — Tab Store 历史相关逻辑

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-06-056 | `restoreSession` 复用首页占位符 | tabs = `[{ isPlaceholder: true, id: 'home' }]` | 调用 `restoreSession('session-1')` | 首页占位符被替换，`tabs[0].sessionId = 'session-1'`，`isPlaceholder = false` |
| TC-06-057 | `restoreSession` 无占位符则新建 | tabs = `[{ sessionId: 'a' }]`，无 placeholder | 调用 `restoreSession('session-2')` | `tabs` 新增一项，`sessionId = 'session-2'`，激活新 tab |
| TC-06-058 | `restoreSession` 已打开则激活 | tabs = `[{ id: 't1', sessionId: 's1' }, { id: 't2', sessionId: 's2' }]` | 调用 `restoreSession('s2')` | 不新增 tab，`activeTabId = 't2'` |
| TC-06-059 | `closeSessionTab` 关闭指定 session 的标签 | tabs 中有 session A 的标签 | 调用 `closeSessionTab('session-a')` | 对应 tab 被移除，激活其他 tab |
| TC-06-060 | `closeSessionTab` 不存在的 session 无操作 | tabs 中无 session C | 调用 `closeSessionTab('session-c')` | tabs 不变 |
| TC-06-061 | `updateTabTitle` 同步更新标签标题 | tab 的 sessionId = "s1"，标题原为 "旧" | 调用 `updateTabTitle('s1', '新')` | 对应 tab 的标题变为 "新" |

**已有/待补充自动化测试**: `tests/unit/stores/tabHistory.test.ts`（待创建）
**覆盖范围**: TC-06-056 ~ TC-06-061

---

## 6.11 集成 — 端到端历史链路

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-06-062 | 新建对话 → 发送消息 → 历史页可见 | 用户发送多条消息 | 打开历史页 | 列表显示该会话，标题/时间/摘要正确 |
| TC-06-063 | 从历史页恢复 → 续接对话 | 历史页有可恢复会话 | 点击恢复，发送新消息 | 新消息追加，上下文完整保留 |
| TC-06-064 | 删除历史 → 数据清理彻底 | 会话有 10 条消息 | 删除该会话 | SQLite 中 sessions 和 messages 记录均消失 |
| TC-06-065 | 重命名 → 标签标题实时同步 | 会话在标签中打开 | 在历史页重命名 | 对应标签标题同步更新 |
| TC-06-066 | 多标签场景下恢复已有会话只激活 | session A 在标签 2 已打开 | 从历史页点击 session A | 仅激活标签 2，不新建 |
| TC-06-067 | 首页占位符被替换后发送消息正常 | 从首页占位符恢复 session | 在替换后的标签中发送消息 | 消息正确关联到恢复的 session |

**测试层**: 手动集成测试 / Tauri 集成测试（核心逻辑由单元测试覆盖）
**覆盖范围**: TC-06-062 ~ TC-06-067

---

## 待补充的自动化测试

| TC-ID 范围 | 测试层 | 建议方案 |
|---|---|---|
| TC-06-001 ~ TC-06-008 | Sidecar Sessions API（列表） | 扩展 `tests/unit/server/sessions.test.ts`，插入 mock session/message 数据后查询 |
| TC-06-009 ~ TC-06-013 | Sidecar Sessions API（重命名） | 扩展 `tests/unit/server/sessions.test.ts`，验证 PATCH/update 逻辑 |
| TC-06-014 ~ TC-06-018 | Sidecar Sessions API（删除） | 扩展 `tests/unit/server/sessions.test.ts`，验证 DELETE 和级联清理 |
| TC-06-019 ~ TC-06-024 | History 页面结构 | 创建 `tests/unit/views/HistoryPage.test.ts`，mock `sidecarFetch` 和路由 |
| TC-06-025 ~ TC-06-031 | 历史列表组件 | 创建 `tests/unit/components/HistoryList.test.ts`，mock sessions 数据 |
| TC-06-032 ~ TC-06-037 | 恢复会话逻辑 | 创建 `tests/unit/stores/tabHistory.test.ts`，mock tabStore 和 sessionStore |
| TC-06-038 ~ TC-06-043 | 删除交互 | 扩展 `tests/unit/components/HistoryList.test.ts`，模拟点击和确认对话框 |
| TC-06-044 ~ TC-06-050 | 重命名交互 | 扩展 `tests/unit/components/HistoryList.test.ts`，模拟编辑模式和键盘事件 |
| TC-06-051 ~ TC-06-055 | 空状态与边界 | 扩展 `tests/unit/views/HistoryPage.test.ts` |
| TC-06-056 ~ TC-06-061 | Tab Store 历史逻辑 | 创建 `tests/unit/stores/tabHistory.test.ts`，覆盖 restore/close/updateTitle |
| TC-06-062 ~ TC-06-067 | E2E 集成 | 建议用 Tauri 集成测试环境或 Playwright 验证（留待 #08） |

---

*文档生成日期：2026-05-08*
*对应 Issue：#06-chat-history*
