# RAG 检索管线开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为 [openspec/specs/rag/spec.md](../../../../openspec/specs/rag/spec.md)（WHAT）。ES 过滤器结构 / ACL 逻辑 / BGE 配置 / knn 与 BM25 查询编排 / 双层处理器架构 / 降级策略 应以 OpenSpec 为准。

---

## Purpose

帮助开发者在 RAG 检索管线（检索侧、生成侧、索引侧）中高效工作：定位代码入口、调试检索结果、调优性能、避免常见陷阱。本指南不重复业务规则，仅记录"如何工作"。

## Primary OpenSpec

- [openspec/specs/rag/spec.md](../../../../openspec/specs/rag/spec.md) — RAG 检索管线系统级规范（检索全链路、权限模型、向量/关键词检索、BGE 重排、缓存）

## Related OpenSpec

- [openspec/specs/knowledge-base/spec.md](../../../../openspec/specs/knowledge-base/spec.md) — 知识库所有权（kbIds 必填校验的上游）
- [openspec/specs/document/spec.md](../../../../openspec/specs/document/spec.md) — 文档分块（Parent-Child 索引侧上游）

## Module Dependencies

- **Elasticsearch**：向量检索（knn）+ 关键词检索（BM25），通过 `@nestjs/elasticsearch` 客户端
- **@xenova/transformers**：BGE Reranker 本地推理（cross-encoder 模型）
- **ioredis**：检索结果缓存（60s TTL）、Grounding 缓存
- **Zod**：检索请求/响应 DTO 校验
- **NestJS EventEmitter**：跨模块松耦合通信

## Development Entry

- `packages/server/src/processors/rag/` — RAG 管线全部文件
- `packages/server/src/processors/rag/rag-retrieval.service.ts` — 检索主管线编排（QueryUnderstanding → Router → 检索 → RRF → Rerank）
- `packages/server/src/processors/rag/es-filter.builder.ts` — ES 过滤器构建（kbId 隔离 + ACL）
- `packages/server/src/processors/rag/es-vector.service.ts` — 向量检索（knn）
- `packages/server/src/processors/rag/es-keyword.service.ts` — 关键词检索（BM25）
- `packages/server/src/processors/rag/bge-rerank.service.ts` — BGE 重排序
- `packages/server/src/processors/rag/elasticsearch.service.ts` — ES 客户端封装
- `packages/server/src/processors/rag/listeners/` — 事件监听器（document-uploaded 等）

## Implementation Notes

### ES 客户端配置

- ES 客户端超时需显式设置（默认 30s 在大索引场景可能不够）；检索请求建议 `requestTimeout: 60s`
- 索引创建/映射更新走 `elasticsearch.service.ts` 封装，禁止在业务代码直接调用 `esClient.indices`
- knn 查询的 `num_candidates` 调大可提升召回率但增加延迟，默认 `topK * 5` 是经验值

### ACL 过滤器调试

- ACL 过滤器通过 `knn.filter` 应用，**在 ANN 遍历之前** 执行——这意味着未授权文档不会进入候选集，比检索后过滤更安全
- 调试 ACL 排除问题：在 `es-filter.builder.ts` 打印最终 filter 结构，确认 `allowed_user_ids` / `allowed_team_ids` 子句正确
- 向后兼容：没有 ACL 字段的文档对所有用户可见（字段不存在 = 公开）

### 分词器切换

- 中文检测：中文字符比例 > 0.2 时切换 `ik_smart`（搜索）/ `ik_max_word`（索引）
- 英文使用 `standard` 分析器
- 切换错误症状：BM25 score 全为 0 或检索结果不符预期——首先检查 analyzer 配置

### BGE Reranker 模型管理

- 模型通过 `ModelProviderService` 解析（非硬编码），配置项 `rag.rerankerProvider`
- 预加载由 `RERANK_EAGER_LOAD` 环境变量控制；关闭可加快启动但首次检索延迟增加
- 热重载：监听 `config.changed` 事件，配置变更时重新加载模型
- 内存管理：模型加载失败时降级到词法匹配 + 原始分数，管道不中断（具体权重见 OpenSpec）

### 缓存调试

- 检索缓存：Redis，TTL 60s，key 包含查询 + kbIds + userId + mode 全参数
- 缓存命中调试：检查 `rag-retrieval.service.ts` 是否在管线入口处短路返回
- Grounding 缓存：独立于检索缓存，调试时需单独检查命中率

### 双层处理器松耦合

`processors/` 目录非纯基础设施层，具有双层结构：
- **pure_infrastructure**（`database/`, `storage/`）：只被依赖，不依赖业务模块
- **orchestration_processors**（`rag/`, `queue/`, `chat/`）：依赖 `modules/` 中的领域类型

新增处理器时先判断属于哪一层：纯基础设施层禁止反向依赖业务模块；编排层可依赖领域服务但优先用事件解耦。

### 事件驱动解耦

处理器通过 NestJS `EventEmitter` 与业务模块通信（如 `document-uploaded.listener.ts` 监听 knowledge-base 事件），避免处理器反向导入业务服务。新增处理器监听事件而非直接调用服务。

## Testing Checklist

- [ ] 向量检索返回正确 topK（k=num_candidates 关系正确）
- [ ] BM25 检索分析器按语言正确切换（中文 ik_smart / 英文 standard）
- [ ] ACL 过滤器正确排除未授权文档（knn.filter 在 ANN 前生效）
- [ ] BGE Reranker 正确重排序（topK 输入 → topN 输出）
- [ ] 降级策略在模型加载失败时正确触发（管道不中断）
- [ ] 检索缓存命中与失效（参数变更应 miss）
- [ ] kbIds 隔离生效（跨知识库结果不混淆）

## Review Checklist

- [ ] 新增/修改 ES 查询是否同步更新 OpenSpec（knn/BM25 配置）
- [ ] ACL 逻辑变更是否同步更新 OpenSpec（权限模型 Requirement）
- [ ] BGE 配置变更是否同步更新 OpenSpec（模型白名单、batchSize、降级权重）
- [ ] 检索结果是否包含 kbId 隔离（禁止跨知识库泄漏）
- [ ] 新增处理器是否正确归入双层结构（pure_infrastructure vs orchestration）
- [ ] 跨模块通信是否优先使用 EventEmitter 而非直接导入

## Common Pitfalls

- **ACL 后置过滤**：将 ACL 放在 `query.post_filter` 而非 `knn.filter` 会导致未授权文档进入候选集后被剔除，性能差且不安全
- **分词器不一致**：索引用 `ik_max_word`、搜索用 `ik_smart` 是成对配置，单边切换会导致 score 失真
- **缓存 key 遗漏参数**：缓存 key 必须包含 mode、kbIds、userId、查询文本，遗漏任一会返回错误结果
- **BGE 模型白名单**：模型名必须以 `BAAI/`、`Xorbits/` 或 `sentence-transformers/` 开头，否则加载失败触发降级
- **降级策略静默触发**：模型加载失败降级时仅记录日志，无明显错误——调试重排序异常时先确认是否处于降级模式
- **处理器反向依赖**：在 pure_infrastructure 层（database/storage）反向导入业务模块会破坏双层架构
- **跨边界循环**：modules → processors（32 处）与 processors → modules（30 处）依赖已接近平衡，新增跨边界依赖需评估必要性

## Reusable Patterns

- **ES 过滤器构建器模式**：`es-filter.builder.ts` 统一封装 kbId 隔离 + ACL 逻辑，向量与 BM25 路径共享，避免重复构建
- **BGE Reranker 本地推理模式**：`@xenova/transformers` + cross-encoder + 热重载订阅 + 降级策略，可作为其他本地模型推理的模板
- **双层处理器松耦合模式**：pure_infrastructure 不依赖业务 / orchestration 可依赖业务 / 优先 EventEmitter 解耦
- **事件驱动监听器模式**：`listeners/*.listener.ts` 监听领域事件而非直接调用服务，处理器与业务模块解耦
- **降级策略模式**：模型/外部依赖失败时返回降级结果而非中断管道，保证检索可用性
