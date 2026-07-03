# 后端开发指南索引

> **Purpose**：本索引是后端开发的导航中枢。Trellis 记录"如何开发"（HOW），OpenSpec 记录"系统是什么"（WHAT）。
> AI Agent 在此找到对应的开发指南；如需业务规则、API 契约、架构定义，请按下方映射跳转 OpenSpec 权威源。

---

## 通用开发指南

> 适用于后端所有模块的开发约定。

| 指南 | 描述 |
|------|------|
| [目录结构](./directory-structure.md) | NestJS 模块/控制器/服务目录布局 |
| [数据库指南](./database-guidelines.md) | Prisma 命名约定、BaseRepository 抽象、TransactionManager 用法 |
| [错误处理](./error-handling.md) | AppException + RepositoryError 双层错误体系实现 |
| [质量指南](./quality-guidelines.md) | Biome 配置、Lint 规则分层、架构约束 |
| [日志指南](./logging-guidelines.md) | Logger 实例化、日志级别、RequestId 链路追踪 |

---

## 模块开发指南

> 每个业务模块的开发指南（Module Development Guide），含 10 个章节：Purpose / Primary OpenSpec / Related OpenSpec / Module Dependencies / Development Entry / Implementation Notes / Testing Checklist / Review Checklist / Common Pitfalls / Reusable Patterns。
>
> **重要**：业务规则、API 契约、架构定义不在 Trellis 中。请查阅对应 OpenSpec capability spec.md。

| 模块 | Trellis 开发指南 | OpenSpec 权威源 |
|------|-----------------|----------------|
| Companion | [companion-pipeline.md](./companion-pipeline.md) | [openspec/specs/companion/spec.md](../../../openspec/specs/companion/spec.md) |
| RAG | [rag-implementation.md](./rag-implementation.md) | [openspec/specs/rag/spec.md](../../../openspec/specs/rag/spec.md) |
| Queue | [queue-implementation.md](./queue-implementation.md) | [openspec/specs/queue/spec.md](../../../openspec/specs/queue/spec.md) |
| Document Parser | [parser-implementation.md](./parser-implementation.md) | [openspec/specs/document/spec.md](../../../openspec/specs/document/spec.md) |

---

## Progressive Knowledge Loading 流程

当你要实现/调试某个后端功能时：

1. **第一步**：在上方"模块开发指南"找到对应模块 → 阅读其 Trellis Development Guide
2. **第二步**：若需业务规则（如 Route Rules、API 契约、状态机定义）→ 点击该指南顶部"Primary OpenSpec"链接跳转
3. **第三步**：若涉及跨模块依赖 → 沿"Related OpenSpec"链接跳转

**示例流程**：实现 Companion 新节点
↓
读 `companion-pipeline.md`（开发指南）
↓
读 `openspec/specs/companion/spec.md`（业务规则）
↓
若涉及 LLM 调用错误处理
↓
读 `openspec/specs/auth/spec.md` 或对应 capability

---

## OpenSpec 全部 capability 索引

后端涉及的全部 OpenSpec 业务规范（按需查阅，不要预加载）：

- [auth](../../../openspec/specs/auth/spec.md) — JWT 双密钥认证、Token Rotation、RBAC、CAPTCHA
- [chat](../../../openspec/specs/chat/spec.md) — SSE 流式聊天契约、RAG 检索、Output Guardrails
- [companion](../../../openspec/specs/companion/spec.md) — LangGraph 11 节点管线、15 Route Rules、10 Policy Packs
- [rag](../../../openspec/specs/rag/spec.md) — RAG 5 阶段管线、ES Mapping、BGE Reranker
- [queue](../../../openspec/specs/queue/spec.md) — 三队列架构、StreamFinalize、Job Data 契约
- [admin](../../../openspec/specs/admin/spec.md) — 管理后台 RBAC、19 权限码、审计日志
- [knowledge-base](../../../openspec/specs/knowledge-base/spec.md) — 知识库 CRUD、所有权验证
- [document](../../../openspec/specs/document/spec.md) — 文档解析策略、PDF 三重回退、Parent-Child 分块
- [session](../../../openspec/specs/session/spec.md) — Session CRUD、BaseRepository 契约
- [settings](../../../openspec/specs/settings/spec.md) — 三层配置合并、AES 加密
- [user](../../../openspec/specs/user/spec.md) — 用户档案、密码策略、Super Admin Bootstrap
- [knowledge-base/document-lifecycle](../../../openspec/specs/knowledge-base/document-lifecycle.md) — 文档生命周期、跨 KB 操作事务边界

---

**语言**：所有文档使用**简体中文**编写。
