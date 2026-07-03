# Phase 2: Knowledge Gap Analysis

> 执行时间：2026-07-02
> 来源文件：docs/discovery-report.md §8-§9
> Phase 1 背景：经 2 轮 Targeted Supplementary Discovery（11 文件），评分 4.0 达标
> 状态：**完成** — 7 个 Unknown 已按 6 类系统重新分类，Knowledge Gap Backlog 已生成

***

## 分类结果

对 Discovery Report 中的 7 个 Unknown 按 Phase 2 规范重新分类：

| # | Unknown | 原始分类 | 重新分类 | Phase 1 状态 | 理解提升价值 |
|---|---------|---------|---------|-------------|------------|
| 1 | Elasticsearch 检索侧实现 | A (Explorable) | **Explorable** | 部分解决（索引侧 D1-D5 已覆盖） | 高 |
| 2 | CI/CD 流水线 | A (Explorable) | **Business** | 已确认：仅设计文档，未实施 | 低 |
| 3 | 生产部署配置 | E (True Unknown) | **True Unknown** | 未变化 | — |
| 4 | LangGraph 工作流全貌 | A (Explorable) | **Explorable** | 部分解决（A1-A8：prompts / quality-guard / generate / memory-extraction） | 很高 |
| 5 | GroupChat 实现状态 | D (Business) | **Business** | 未变化 | 低 |
| 6 | modules/ vs processors/ 边界 | A (Explorable) | **Explorable** | 大量解决 | 低 |
| 7 | @xenova/transformers 用途 | A (Explorable) | **Explorable** | 未读 bge-rerank.service.ts | 低 |

### 分类统计

```
Explorable:     4  (57%)  — #1, #4, #6, #7
Runtime:        0  (0%)
Infrastructure: 0  (0%)
Business:       2  (29%)  — #2, #5
External:       0  (0%)
True Unknown:   1  (14%)  — #3
```

***

## 关键变化 vs Discovery Report §9

| 维度 | Discovery Report §9 | Phase 2 重新分类 | 原因 |
|------|--------------------|----------------|------|
| #2 (CI/CD) | Explorable | **Business** | 设计文档可读但已确认未实施，进一步阅读对代码理解无帮助。是否实施 CI/CD 是团队决策而非代码分析问题。 |
| #4 (LangGraph) | Explorable | **Explorable**（提升价值：很高） | Phase 1 大量解决了 prompts + quality-guard + generate + memory-extraction，剩余 graph.ts + 7 个 nodes 是 Companion 核心管线的最后关卡 |
| #6 (modules/processors) | Explorable | **Explorable**（提升价值：低） | Phase 1 实际阅读了跨两区文件，边界的核心规则已充分验证 |

### 状态升级的 Unknown

以下 Unknown 在 Phase 1 后状态显著改善：

| Unknown | Phase 1 前 | Phase 1 后 | 解决的子问题 |
|---------|-----------|-----------|------------|
| #1 | 仅知 ES 正在使用，不知索引细节 | 已知 parent-child chunking、contextual embedding、batch index 流程 | 索引侧 D1-D5 |
| #4 | 仅知 11 节点 + 16 字段名 | 已知 6 个 Prompt 模板、Quality Guard 是规则引擎、Generate 节点 8 段组装、记忆提取条件执行 | 4/11 节点深度理解 |
| #6 | 仅从模块列表推断 | 经 chat.service / indexing.worker / rag-indexing 实际阅读验证 | 分工规则确认 |

***

## Explorable 路线图

### P0: #4 LangGraph 工作流全貌（理解提升：很高）

**目标**：10 个文件，单轮可完成

```
graph.ts                                    ← StateGraph 定义 + 条件路由（最核心！）
interfaces.ts                               ← CompanionState 16 字段类型
nodes/safety-node.ts                        ← 安全检测
nodes/intent-node.ts                        ← 意图识别
nodes/emotion-node.ts                       ← 情感分析
nodes/route-node.ts                         ← 策略路由
nodes/policy-node.ts                        ← 回复策略
nodes/relationship-stage-node.ts            ← 关系阶段
nodes/summary-node.ts                       ← 摘要
nodes/memory-candidate-node.ts              ← 记忆候选
companion-chat-pipeline.service.ts          ← Pipeline 编排入口
```

### P1: #1 ES 检索侧实现（理解提升：高）

**目标**：5 个文件

```
rag-retrieval.service.ts                    ← 检索编排入口
es-vector.service.ts                        ← 向量检索
es-keyword.service.ts                       ← 关键词检索
es-filter.builder.ts                        ← 过滤器
bge-rerank.service.ts                       ← BGE 重排（同时覆盖 #7）
```

### P2: #7 + #6（边际补充，理解提升：低）

**#7**：`bge-rerank.service.ts`（1 文件，已被 #1 路径覆盖）
**#6**：`database.module.ts` + `storage.module.ts` + `storage.service.ts`（3 文件）

***

## 产出文件

| 产物 | 路径 |
|------|------|
| Knowledge Gap Backlog | `.trae/documents/spec-discovery/gap-backlog.md` |
| State File | `.trae/documents/spec-discovery/state.json` |

---

## 下一步

Phase 2 已完成。按用户约束 #8（"Gap Analysis 完成后停止"），此处停止。

如需继续，下一阶段为 **Phase 3: Priority Selection**——将从 P0 / P1 / P2 中选出 Top 10 分析队列，等待用户确认后进入 Deep Exploration。
