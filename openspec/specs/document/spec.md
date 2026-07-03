# Document - 文档处理与向量索引

## Purpose（目的）

定义 GoferBot 文档解析管线、文本分块策略、向量嵌入生成与存储、以及索引生命周期管理的系统级规范。

## Requirements（需求）

### Requirement: 文档解析管线
系统应通过策略模式（Strategy pattern）支持可插拔的文档解析器架构，根据 MIME 类型分配到特定格式的解析器。

证据来源：
- `packages/server/src/processors/parser/document.parser.ts`
- `packages/server/src/processors/parser/parser.types.ts`
- `packages/server/src/processors/parser/pdf.parser.ts`
- `packages/server/src/processors/parser/text.parser.ts`

#### Scenario: PDF 解析三重回退
- **WHEN** 上传 PDF 文档时
- **THEN** 系统按优先级顺序解析后端：(1) LlamaIndex `@llamaindex/readers` PDFReader，(2) `pdf-parse` 社区库，(3) 原始缓冲区 UTF-8 解码作为最终回退；每个后端失败时自动降级到下一个

#### Scenario: MIME 类型分派
- **WHEN** 调用 `DocumentParser.parse({ mimeType, buffer, filename })` 时
- **THEN** 系统先在 `mimeIndex` 中按精确 MIME 类型查找解析器；若未找到，则从文件名推断扩展名对应的 MIME 类型；仍未找到时回退到 UTF-8 文本提取

#### Scenario: 自定义解析器注册
- **WHEN** 通过 `DocumentParser.register()` 注册一个实现了 `IDocumentParser` 接口（包含 `name` 和 `mimeTypes`）的新解析器时
- **THEN** 系统应将其添加到 `parsers` 映射中，并按所有声明的 MIME 类型建立索引；后续的 `parse()` 调用会将匹配的类型路由到新解析器

#### Scenario: 解析器注销
- **WHEN** 调用 `DocumentParser.unregister(name)` 时
- **THEN** 系统删除该解析器并清理所有关联的 MIME 类型索引条目

#### Scenario: 输入/输出 Zod 验证
- **WHEN** 调用 `DocumentParser.parse()` 时
- **THEN** 系统应根据 `parserInputSchema` 验证输入（确保存在 buffer 或 filePath），并根据 `parseResultSchema` 验证解析器输出（确保内容非空）；ZodError 失败会导致工作器将文档标记为 `failed`

### Requirement: 结构提取
系统应通过 StructureExtractor（一个无副作用的纯函数工具）从已解析文档中提取层次结构（标题、章节、代码块）。

证据来源：
- `packages/server/src/processors/parser/structure-extractor.ts#L29-L142`

#### Scenario: Markdown 标题层级
- **WHEN** Markdown 文档包含 `# H1`、`## H2` 和 `### H3` 标题时
- **THEN** 系统提取章节及其标题文本、标题级别和内容；第一个 H1 成为文档标题；`hierarchyPath` 累积所有遇到的标题用于 Contextual Embedding

#### Scenario: 代码块保留
- **WHEN** 文档包含围栏代码块时
- **THEN** 系统按语言识别代码块，完整保留其内容（不在代码围栏内提取标题），并单独返回

#### Scenario: 空文档
- **WHEN** 处理空文档或仅含空白字符的文档时
- **THEN** 系统返回一个空结构，不含章节、层次路径和代码块

### Requirement: 扩展名到 MIME 类型解析
系统应维护一个硬编码的扩展名到 MIME 类型映射表，用于回退解析器解析，不依赖外部 MIME 类型库。

证据来源：
- `packages/server/src/processors/parser/document.parser.ts#L149-L156`

#### Scenario: 基于扩展名的分派
- **WHEN** 文档没有按 MIME 类型匹配的解析器时
- **THEN** 系统提取文件扩展名并通过硬编码表映射：pdf→application/pdf，md→text/markdown，txt→text/plain，html→text/html

#### Scenario: 未识别的扩展名
- **WHEN** MIME 类型和扩展名都不匹配任何已注册的解析器时
- **THEN** 系统回退到 UTF-8 文本提取，附带 `{ fallback: true }` 元数据

### Requirement: 文本分块
系统应将已解析的文档文本分割成语义块用于嵌入和检索，支持配置块大小和重叠度。

证据来源：
- `packages/server/src/processors/rag/rag-types.ts`
- `packages/data/src/schemas/document.schema.ts`

#### Scenario: 默认分块策略
- **WHEN** 文档解析成功时
- **THEN** 系统将文本分割成可配置大小的块（默认约 512 tokens），并具有可配置的重叠度（默认约 64 tokens）

#### Scenario: 结构感知分块
- **WHEN** 文档包含 Markdown 标题和代码块时
- **THEN** 系统应提取层次结构（`hierarchyPath`）并在分块时保留代码块边界

### Requirement: 上下文嵌入
系统应使用文档级元数据上下文生成嵌入，以提高检索相关性。

证据来源：
- `.trae/specs/enterprise-rag/spec.md` (Contextual Retrieval / buildEmbeddingTexts)

#### Scenario: 嵌入文本格式
- **WHEN** 为文档块生成嵌入时
- **THEN** 系统应使用格式 `{document_title} | {section_path} | {prefix} {current} {suffix}` 提供上下文

#### Scenario: 缺失元数据回退
- **WHEN** 文档级元数据（标题、章节路径）不可用时
- **THEN** 系统应回退到仅使用周围的块文本进行嵌入

### Requirement: 向量存储
系统应将文档块嵌入存储在带有 pgvector 扩展的 PostgreSQL 中，支持余弦相似度（cosine similarity）搜索。

证据来源：
- `packages/server/prisma/schema.prisma` (Chunk model with vector field)
- `packages/server/src/processors/rag/rag.module.ts`

#### Scenario: 向量搜索
- **WHEN** 使用查询嵌入执行相似度搜索时
- **THEN** 系统返回按余弦相似度排序的前 K 个最相似块

#### Scenario: 文档删除时的向量索引清理
- **WHEN** 文档被删除时
- **THEN** 系统应从 pgvector 中移除所有关联的向量条目

### Requirement: 索引生命周期管理
系统应支持知识库文档的增量索引（incremental indexing）、批量重建索引（bulk re-indexing）和索引删除。

#### Scenario: 增量索引
- **WHEN** 向现有知识库上传新文档时
- **THEN** 系统仅索引新文档，不重新处理现有文档

#### Scenario: 知识库重建索引
- **WHEN** 管理员触发知识库重建索引时
- **THEN** 系统清除该知识库的所有现有块/向量，并重新处理所有文档

#### Scenario: 知识库删除时的索引清理
- **WHEN** 知识库被删除时
- **THEN** 应移除所有关联的块、向量和解析数据
