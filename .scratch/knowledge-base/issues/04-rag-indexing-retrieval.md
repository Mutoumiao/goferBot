Status: needs-triage

## What to build

实现完整的 RAG 索引和检索功能，包括后台索引队列、sqlite-vec 向量索引、FTS5 全文索引、混合搜索（RRF 融合），以及前端 `@提及` 知识库的交互。

端到端行为：用户导入文件到知识库 → 文件保存后自动加入索引队列 → sidecar 后台逐个处理：LangChain `TextLoader` 读取文档 → `RecursiveCharacterTextSplitter` 分块（chunkSize=500, overlap=50）→ 调用 Embedding API 获取向量 → 同时写入 `document_chunks` 表（BLOB）、`vec_document_chunks` 虚拟表（sqlite-vec HNSW）、`fts_document_chunks` 虚拟表（FTS5）→ 前端显示索引进度条 → 用户在对话输入框输入 `@` → 弹出知识库下拉列表（模糊搜索）→ 选择后渲染为 pill/tag（支持多选、可删除）→ 用户发送消息 → 前端解析出 `knowledgeBaseIds` → `POST /chat` 携带 `knowledgeBaseIds` → sidecar 对各知识库执行混合搜索：向量搜索（`vec_distance_cosine` 获取语义相似 Top-5）+ 全文搜索（FTS5 关键词匹配 Top-5）→ RRF 融合去重得到最终 Top-5 → 文档块内容拼入 system prompt → LLM 生成带引用来源的回答。

## Acceptance criteria

- [ ] SQLite Schema：`document_chunks` 表 + `vec_document_chunks`（`vec0` HNSW，维度可配置）+ `fts_document_chunks`（FTS5，`content` + `file_path`）
- [ ] Sidecar 启动时加载 `sqlite-vec` 扩展（跨平台 `.dll`/`.dylib`/`.so`）
- [ ] 索引队列：文件导入后自动加入队列，sidecar 后台按顺序处理
- [ ] LangChain `TextLoader` + `RecursiveCharacterTextSplitter`（chunkSize=500, overlap=50）
- [ ] 调用 Embedding API 获取向量，同步写入三张表/虚拟表
- [ ] 前端索引进度条显示当前索引状态
- [ ] 知识库管理页显示文件索引状态（已索引/排队中/失败）
- [ ] 支持手动触发"重建索引"API：`POST /knowledge-bases/:id/index`
- [ ] 前端 `@提及` 交互：输入 `@` 弹出下拉列表，选择后渲染 pill/tag，支持多选和删除
- [ ] `POST /chat` body 支持 `knowledgeBaseIds?: string[]`
- [ ] 混合搜索：向量搜索（语义相似）+ 全文搜索（关键词匹配）+ RRF 融合排序
- [ ] 消息表 `knowledge_base_ids` 字段记录每条消息检索的知识库
- [ ] `messages` 表增加 `knowledge_base_ids` 字段（JSON 数组格式）

## Blocked by

- [02-basic-chat](../02-basic-chat.md) — 必须先有基础对话能力
- [03-knowledge-base-management](../03-knowledge-base-management.md) — 必须先有知识库和文件导入

## Comments
