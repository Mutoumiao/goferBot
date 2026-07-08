# GoferBot Discovery Report

## 9. Knowledge Gap Roadmap

### 分类汇总

| Unknown # | 问题                         | 分类                           |
|-----------|------------------------------|--------------------------------|
| 1         | Elasticsearch 状态           | [RESOLVED] (Round 2)           |
| 2         | CI/CD 流水线                 | D — Business（已确认：未实施） |
| 3         | 生产部署配置                 | E — True Unknown               |
| 4         | LangGraph 工作流全貌         | [RESOLVED] (Round 1)           |
| 5         | GroupChat 实现状态           | D — Business                   |
| 6         | modules/ vs processors/ 边界 | [RESOLVED] (Round 3)           |
| 7         | @xenova/transformers 用途    | [RESOLVED] (Round 2)           |

### 补全路线图（按优先级排序）

| 优先级 | 目标                                        | 耗时     | 状态                      |
|--------|---------------------------------------------|----------|---------------------------|
| **P0** | 理解 RAG 检索全链路（ES ↔ pgvector 双存储） | 60 min   | DONE (Round 2)            |
| **P0** | 理解 Companion LangGraph 工作流             | 45 min   | DONE (Round 1)            |
| **P1** | 理解 modules/ vs processors/ 分工           | 20 min   | DONE (Round 3)            |
| **P1** | 理解 BGE 重排实现                           | 15 min   | DONE (Round 2)            |
| **P2** | 评估 CI/CD 实施时机                         | 10 min   | Business — 待 PM 决策     |
| **P3** | 确认 GroupChat 产品计划                     | 需 PM    | Business — 待 PM 决策     |
| **P3** | 确认生产部署方案                            | 需 Infra | True Unknown — 无仓库信息 |

### Explorer 速查索引

以下文件列表覆盖所有 A 类 Unknown 的阅读需求，可直接依次阅读：

```
packages/server/src/processors/rag/
├── rag.module.ts                  ← ES 服务注册
├── rag-retrieval.service.ts       ← 检索入口（ES 驱动）
├── elasticsearch.service.ts       ← ES 客户端
├── es-vector.service.ts           ← 向量检索
├── es-keyword.service.ts          ← 关键词检索
├── es-filter.builder.ts           ← 过滤器
├── bge-rerank.service.ts          ← 本地 BGE 重排（@xenova/transformers）

packages/server/src/modules/companion/langgraph/
├── graph.ts                       ← StateGraph 定义 + 条件路由
├── interfaces.ts                  ← CompanionState 类型
├── nodes/*.ts                     ← 11 个节点

packages/server/src/modules/companion/
├── companion-chat-pipeline.service.ts ← Pipeline 编排

docs/prd/
├── ci-pipeline.md                 ← CI 设计文档
```
