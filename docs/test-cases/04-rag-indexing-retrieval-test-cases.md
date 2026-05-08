# Issue #04 — RAG 索引检索 测试用例

**对应 Issue**: `.scratch/knowledge-base/issues/04-rag-indexing-retrieval.md`  
**状态**: ready-for-agent  
**测试框架**: Vitest（前端 Unit + 组件）、Node 环境 Vitest（Sidecar API）

---

## 4.1 Sidecar API — 数据库 Schema 与扩展加载

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04-001 | `document_chunks` 表存在 | Sidecar 启动 | 查询 `SELECT name FROM sqlite_master WHERE name = 'document_chunks'` | 返回一行 |
| TC-04-002 | `document_chunks` 包含预期列 | 表已创建 | `PRAGMA table_info(document_chunks)` | 包含 id/knowledge_base_id/file_path/content/embedding/chunk_index/created_at |
| TC-04-003 | `idx_chunks_kb` 索引存在 | 表已创建 | 查询 sqlite_master | 存在名为 `idx_chunks_kb` 的索引 |
| TC-04-004 | `vec_document_chunks` 虚拟表存在 | sqlite-vec 扩展加载成功 | 查询 sqlite_master | 存在 `vec_document_chunks` 且 type = 'vtable' |
| TC-04-005 | `fts_document_chunks` 虚拟表存在 | FTS5 可用 | 查询 sqlite_master | 存在 `fts_document_chunks` 且 type = 'vtable' |
| TC-04-006 | `messages` 表增加 `knowledge_base_ids` 列 | 启动后 | `PRAGMA table_info(messages)` | 包含 `knowledge_base_ids` 列 |
| TC-04-007 | sqlite-vec 扩展加载失败不崩溃 | 删除/损坏 sqlite-vec 扩展文件 | 启动 Sidecar | 控制台输出警告，Sidecar 继续运行（降级模式） |

**已有/待补充自动化测试**: `tests/unit/server/dbSchema.test.ts`（待创建）  
**覆盖范围**: TC-04-001 ~ TC-04-007

---

## 4.2 Sidecar API — Embedding 服务

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04-008 | `getEmbedding` 返回向量数组 | mock Embedding API 返回 2 条 | 调用 `getEmbedding(['a','b'], config)` | 返回 `number[][]`，长度为 2，每个子数组长度一致 |
| TC-04-009 | `getEmbedding` 按 index 排序 | mock 返回 index 乱序 | 调用函数 | 结果按输入文本顺序排列 |
| TC-04-010 | `getEmbedding` 未知 provider 无 baseUrl 时抛出 | config.provider = 'unknown', baseUrl = '' | 调用函数 | 抛出 `Error: Unknown embedding provider` |
| TC-04-011 | `getEmbedding` API 错误抛出 | mock 返回 401 | 调用函数 | 抛出包含 `Embedding API error: 401` 的错误 |
| TC-04-012 | `getEmbedding` 支持 OpenAI 默认 baseUrl | provider = 'openai', baseUrl = '' | 调用函数 | 请求发送到 `https://api.openai.com/v1/embeddings` |
| TC-04-013 | `getEmbedding` 支持硅基流动默认 baseUrl | provider = 'siliconflow', baseUrl = '' | 调用函数 | 请求发送到 `https://api.siliconflow.cn/v1/embeddings` |

**已有/待补充自动化测试**: `tests/unit/server/embedding.test.ts`（计划中）  
**覆盖范围**: TC-04-008 ~ TC-04-013

---

## 4.3 Sidecar API — 索引队列与文件索引

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04-014 | 导入文件后自动触发索引队列 | 知识库已创建 | `POST /:id/files` 导入 `test.txt` | 响应 200，索引队列中包含该文件任务（通过日志或队列长度验证） |
| TC-04-015 | `POST /:id/index` 重建索引 | 知识库存在且已有索引数据 | 发送 POST 请求 | 返回 `{ success: true, queued: true }`，旧 `document_chunks` 被清空，新队列启动 |
| TC-04-016 | `POST /:id/index` 404 知识库不存在 | id 无效 | POST 请求 | 返回 404 |
| TC-04-017 | `GET /:id/index-status` 返回统计 | 知识库存在，有 3 个文件，已索引 1 个 | GET 请求 | 返回 `{ totalFiles: 3, indexedFiles: 1, pendingFiles: N }` |
| TC-04-018 | `GET /:id/index-status` 404 知识库不存在 | id 无效 | GET 请求 | 返回 404 |
| TC-04-019 | 索引任务删除旧 chunks 再写入 | 同一文件已索引过 | 再次导入同一文件 | `document_chunks` 中该文件路径的 chunk 数量与最新内容一致，无重复 |
| TC-04-020 | 索引空文件不报错 | 导入内容为空的 `empty.txt` | 等待索引处理 | 不写入任何 chunk，不抛出错误 |
| TC-04-021 | 索引队列顺序处理多个文件 | 同时导入 3 个文件 | 观察队列和处理日志 | 按顺序逐个处理，无并发冲突 |
| TC-04-022 | `enqueueKnowledgeBase` 递归遍历子目录 | 知识库根目录下有子目录和文件 | 调用 `enqueueKnowledgeBase` | 队列中包含所有层级中的文件任务 |
| TC-04-023 | 无 Embedding 配置时跳过向量写入 | config.json 中无 embeddingProvider | 触发索引 | `document_chunks` 中 embedding 列为 null，`vec_document_chunks` 中写入空向量或跳过 |
| TC-04-024 | LangChain 分块参数正确 | 导入一个 1500 字符的文件 | 索引处理 | chunkSize=500, overlap=50，产生约 3-4 个 chunk，chunk_index 从 0 递增 |

**已有/待补充自动化测试**: `tests/unit/server/indexer.test.ts`（计划中）  
**覆盖范围**: TC-04-014 ~ TC-04-024

---

## 4.4 Sidecar API — RAG 混合搜索

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04-025 | `hybridSearch` 空知识库列表返回空 | `knowledgeBaseIds = []` | 调用函数 | 返回 `[]` |
| TC-04-026 | `hybridSearch` 向量搜索失败降级 | sqlite-vec 不可用 | 调用函数 | 返回 FTS 结果或空数组，不抛出 |
| TC-04-027 | `hybridSearch` FTS 搜索失败降级 | FTS5 表损坏 | 调用函数 | 返回向量结果或空数组，不抛出 |
| TC-04-028 | RRF 融合去重 | 同一 chunk 同时出现在向量和 FTS Top-5 中 | 调用 `hybridSearch` | 结果中该 chunk 只出现一次，RRF 分数为两者之和 |
| TC-04-029 | `buildRagPrompt` 无 chunks 返回原查询 | `chunks = []` | 调用函数 | 返回 `userQuery` 原字符串 |
| TC-04-030 | `buildRagPrompt` 拼接上下文和来源 | chunks 有 2 条 | 调用函数 | 输出包含 `[1] chunk内容\n（来源：filePath）` 格式，最后附用户问题 |
| TC-04-031 | 向量搜索限制每库 Top-K | 知识库 A 有 100 个 chunk | 对 A 执行向量搜索，topK=5 | 最多返回 5 条，按 distance 升序 |
| TC-04-032 | FTS5 查询关键词含引号安全 | query = `say "hello"` | 执行搜索 | 引号被转义或处理，不导致 SQL 语法错误 |
| TC-04-033 | 混合搜索跨多个知识库 | knowledgeBaseIds = ['kb1', 'kb2'] | 调用搜索 | 结果包含来自两个知识库的 chunk |

**已有/待补充自动化测试**: `tests/unit/server/rag.test.ts`（计划中）  
**覆盖范围**: TC-04-025 ~ TC-04-033

---

## 4.5 Sidecar API — Chat 集成 RAG

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04-034 | `POST /chat` 接收 `knowledgeBaseIds` | body 包含 `knowledgeBaseIds: ['kb1']` | 发送请求 | 返回 200，SSE 流正常 |
| TC-04-035 | 用户消息保存 `knowledge_base_ids` | 发送带 `knowledgeBaseIds` 的 chat 请求 | 查询 messages 表 | 该用户消息的 `knowledge_base_ids` 为 JSON 字符串 `["kb1"]` |
| TC-04-036 | 不带 `knowledgeBaseIds` 时 `knowledge_base_ids` 为 null | body 无该字段 | 发送请求 | 用户消息的 `knowledge_base_ids` 为 null |
| TC-04-037 | RAG 检索失败时不阻断对话 | mock Embedding API 500 | 发送带 kbIds 的请求 | 对话正常进行，system prompt 不附加上下文 |
| TC-04-038 | system prompt 拼入检索结果 | mock 返回 2 个 chunk | 发送请求 | 调用 `streamChatCompletion` 时 history 最后一条 user content 包含 RAG prompt 格式 |
| TC-04-039 | `streamChatCompletion` 支持 systemPrompt 参数 | 传入 systemPrompt = '你是助手' | 调用函数 | API 请求 body.messages 第一项为 `{ role: 'system', content: '你是助手' }` |
| TC-04-040 | 多 knowledgeBaseIds 全部参与检索 | `knowledgeBaseIds: ['kb1', 'kb2']` | 发送请求 | `hybridSearch` 被调用，参数为两个 ID |

**已有/待补充自动化测试**: `tests/unit/server/chatRag.test.ts`（计划中）  
**覆盖范围**: TC-04-034 ~ TC-04-040

---

## 4.6 前端 — ChatInput `@提及` 交互

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04-041 | 输入 `@` 弹出下拉列表 | `knowledgeBases` prop 有数据，输入框聚焦 | 模拟按下 `@` 键 | `KbMentionDropdown` 可见，列出所有知识库 |
| TC-04-042 | 下拉列表按名称过滤 | 输入 `@Doc` | 输入 @ 后继续输入 Doc | 列表只显示名称包含 "Doc" 的知识库 |
| TC-04-043 | 下拉列表空查询显示全部 | 输入 `@` 后不输入任何字符 | 直接显示 | 显示全部知识库 |
| TC-04-044 | 点击列表项选择知识库 | 下拉列表可见 | 点击第一个知识库 | 选中知识库以 pill 形式出现在输入框上方，`@query` 文本被移除 |
| TC-04-045 | 键盘 Enter 选择当前高亮项 | 下拉列表可见，高亮第一项 | 按 Enter | 选中第一项，行为同点击 |
| TC-04-046 | 键盘 Escape 关闭下拉 | 下拉列表可见 | 按 Escape | `KbMentionDropdown` 隐藏，发出 `close` 事件 |
| TC-04-047 | 键盘 ArrowDown/ArrowUp 切换高亮 | 下拉列表有 3 项 | 按 ArrowDown 两次 | 高亮索引从 0 → 1 → 2 |
| TC-04-048 | 重复选择同一知识库不重复添加 | 已选中 "Docs" | 再次选择 "Docs" | `selectedKbs` 中只有一个 "Docs" pill |
| TC-04-049 | 点击 pill 的删除按钮移除 | pill 已渲染 | 点击 pill 右侧的 × 按钮 | pill 消失，`selectedKbs` 中移除该项 |
| TC-04-050 | 发送消息携带 knowledgeBaseIds | 已选中 2 个知识库，输入框有文本 | 点击发送 | `send` 事件参数为 `[content, ['id1', 'id2']]` |
| TC-04-051 | 发送后清空已选知识库 | 已选中知识库 | 发送消息 | `selectedKbs` 被清空，所有 pill 消失 |
| TC-04-052 | 无 `@` 输入时不显示下拉 | 正常输入字符 | 输入 "hello" | 下拉列表不出现 |
| TC-04-053 | `knowledgeBases` 为空时不响应 `@` | prop 为空数组 | 输入 `@` | 下拉列表不出现 |
| TC-04-054 | 光标移回 `@` 之前关闭下拉 | 输入 `@Doc` 后光标移到 `@` 前 | 模拟光标移动 | 下拉列表关闭 |
| TC-04-055 | 输入框禁用状态下不触发提及 | `loading = true` | 尝试输入 `@` | textarea disabled，无响应 |

**已有/待补充自动化测试**: `tests/unit/components/ChatInputMention.test.ts`、`tests/unit/components/KbMentionDropdown.test.ts`（计划中）  
**覆盖范围**: TC-04-041 ~ TC-04-055

---

## 4.7 前端 — Session Store

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04-056 | `sendMessage` 传递 `knowledgeBaseIds` 到 API | mock sidecarFetch 成功 | `sendMessage('hi', config, ['kb1'])` | `sidecarFetch` 的 body 字符串包含 `"knowledgeBaseIds":["kb1"]` |
| TC-04-057 | `sendMessage` 不传 `knowledgeBaseIds` 时 body 不含该字段 | mock sidecarFetch 成功 | `sendMessage('hi', config)` | body 中 `knowledgeBaseIds` 为 `undefined` 或不含该键 |
| TC-04-058 | 乐观添加的用户消息包含 `knowledge_base_ids` | 调用 `sendMessage` 带 kbIds | 检查 `store.messages` | 用户消息的 `knowledge_base_ids` 为 JSON 字符串 |
| TC-04-059 | `Message` 类型包含 `knowledge_base_ids` | TypeScript 编译 | `src/types/index.ts` 定义 | 编译通过，无类型错误 |

**已有/待补充自动化测试**: `tests/unit/stores/sessionMention.test.ts`（计划中）  
**覆盖范围**: TC-04-056 ~ TC-04-059

---

## 4.8 前端 — 索引进度与文件索引状态

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04-060 | FileExplorer 渲染进度条 | `indexStatus = { totalFiles: 10, indexedFiles: 5, pendingFiles: 0 }` | 挂载组件 | 显示进度条和 "5/10" 文本 |
| TC-04-061 | 进度条宽度计算正确 | `indexedFiles = 3, totalFiles = 10` | 挂载组件 | 进度条宽度为 30% |
| TC-04-062 | 无 `indexStatus` 时不渲染进度条 | prop 未传入 | 挂载组件 | 无进度条相关 DOM |
| TC-04-063 | `totalFiles = 0` 时进度条为 0% | `indexStatus = { totalFiles: 0, indexedFiles: 0 }` | 挂载组件 | 进度条宽度为 0%，显示 "0/0" |
| TC-04-064 | KnowledgeBasePage 选中知识库时加载状态 | 用户点击知识库 A | 调用 `selectKb` | 随后调用 `loadIndexStatus(A.id)` |
| TC-04-065 | store `indexStatus` Map 更新 | `loadIndexStatus` 成功返回数据 | 调用 action | `indexStatus.value.get(kbId)` 包含最新数据 |

**已有/待补充自动化测试**: `tests/unit/components/FileExplorerIndexStatus.test.ts`（计划中）  
**覆盖范围**: TC-04-060 ~ TC-04-065

---

## 4.9 集成 — 端到端 RAG 链路

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04-066 | 文件导入 → 自动索引 → 可检索 | 知识库已创建，Embedding 配置有效 | 1. 导入 `test.md`  2. 等待索引进度完成 3. 发送带 kbId 的 chat | LLM 回答中引用了 `test.md` 的内容 |
| TC-04-067 | `@提及` → 选择知识库 → 发送 → 检索生效 | 知识库已索引 | 1. 输入 `@` 选择知识库  2. 输入问题  3. 发送 | `POST /chat` body 包含 `knowledgeBaseIds` |
| TC-04-068 | 重建索引后旧数据不残留 | 知识库已有索引，文件内容已修改 | 1. 修改文件  2. 调用 `POST /:id/index`  3. 查询 document_chunks | chunk 内容与新文件一致，无旧 chunk |
| TC-04-069 | 跨知识库检索 | kb1 和 kb2 都已索引 | chat 请求同时携带两个 kbId | 检索结果包含来自两个知识库的 chunk |
| TC-04-070 | 未提及知识库时不触发 RAG | 消息中无 `@提及` | 发送普通消息 | `POST /chat` body 无 `knowledgeBaseIds`，LLM 不接收额外 context |

**测试层**: 手动集成测试（涉及 Embedding API 调用，自动化成本较高，建议用 mock 做单元覆盖）  
**覆盖范围**: TC-04-066 ~ TC-04-070

---

## 待补充的自动化测试

| TC-ID 范围 | 测试层 | 建议方案 |
|---|---|---|
| TC-04-001 ~ TC-04-007 | Sidecar Schema | 创建 `tests/unit/server/dbSchema.test.ts` 验证表结构 |
| TC-04-014 ~ TC-04-024 | Sidecar Indexer | 扩展 `tests/unit/server/indexer.test.ts`，mock `getEmbedding` 和 `fs` |
| TC-04-025 ~ TC-04-033 | Sidecar RAG | 扩展 `tests/unit/server/rag.test.ts`，插入 mock chunk 数据后搜索 |
| TC-04-034 ~ TC-04-040 | Sidecar Chat | `tests/unit/server/chatRag.test.ts` 已覆盖核心逻辑 |
| TC-04-066 ~ TC-04-070 | E2E 集成 | 建议用 Playwright 或 Tauri 集成测试环境验证（当前项目未配置，留待 #08） |

---

*文档生成日期：2026-05-08*  
*对应 Issue：#04-rag-indexing-retrieval*
