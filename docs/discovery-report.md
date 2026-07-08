# GoferBot Discovery Report

> 生成日期：2026-07-02 | 最后更新：2026-07-08
> 分析方式：静态代码扫描（未运行任何代码）
> 原则：所有结论必须来自代码或文档，不能确认的标记为 Unknown

原始内容已拆分到 `discovery/` 目录下，按章节独立存放。以下是完整索引：

---

## 基础概览

| 章节 | 文件 | 说明 |
|------|------|------|
| 1. 项目目标 | [discovery/01-1-项目目标.md](discovery/01-1-项目目标.md) | 核心能力矩阵（智能问答/RAG/知识库/伴侣/多租户） |
| 2. 技术栈 | [discovery/02-2-技术栈.md](discovery/02-2-技术栈.md) | 全栈技术选型（React+NestJS+Prisma+LlamaIndex 等） |
| 3. 总体架构 | [discovery/03-3-总体架构.md](discovery/03-3-总体架构.md) | 部署架构、Monorepo 包结构、请求生命周期、模块注册 |
| 4. 所有业务模块 | [discovery/04-4-所有业务模块.md](discovery/04-4-所有业务模块.md) | 后端 9 模块 + 前端 feature + Admin + Data Schema |
| 5. 模块依赖关系 | [discovery/05-5-模块依赖关系.md](discovery/05-5-模块依赖关系.md) | 实体关系图、包间依赖、启动顺序 |
| 6. 核心模块 | [discovery/06-6-核心模块.md](discovery/06-6-核心模块.md) | Auth/Chat/RAG/KB/Queue 核心模块速查 |

---

## 7. 复杂模块详解

| 子章节 | 文件 | 说明 |
|--------|------|------|
| 7.1 Companion | [discovery/07-01-71-companionai-伴侣-最复杂的模块.md](discovery/07-01-71-companionai-伴侣-最复杂的模块.md) | AI 伴侣 LangGraph 工作流（11 节点、7 LLM） |
| 7.2 RAG 检索 | [discovery/07-02-72-rag-检索管线.md](discovery/07-02-72-rag-检索管线.md) | 混合检索全链路（Query→向量/BM25→RRF→BGE 重排） |
| 7.3 前端 Overlay | [discovery/07-03-73-前端-overlay-弹窗系统.md](discovery/07-03-73-前端-overlay-弹窗系统.md) | 前端 Overlay 弹窗（11 个预置弹窗） |
| 7.4 RBAC | [discovery/07-04-74-rbac-权限系统.md](discovery/07-04-74-rbac-权限系统.md) | 四层 Guard 链、Role 表正规化、App 隔离、PermissionSeeder |
| 7.5 基础设施 | [discovery/07-05-75-processors-基础设施层-database-storage.md](discovery/07-05-75-processors-基础设施层-database-storage.md) | Database + Storage 基础设施、跨层依赖分析 |
| 7.9 Auth 安全 | [discovery/07-06-79-auth-安全架构详解.md](discovery/07-06-79-auth-安全架构详解.md) | JWT 双密钥、Token Rotation、邀请码、CAPTCHA、18 错误码 |
| 7.10 LangChain 层 | [discovery/07-07-710-companion-langchain-层-llm-适配基础设施.md](discovery/07-07-710-companion-langchain-层-llm-适配基础设施.md) | StructuredOutput 三方法降级、LlmConfigService |
| 7.10b Provider | [discovery/07-08-710b-provider-基类架构-统一-llm-客户端工厂.md](discovery/07-08-710b-provider-基类架构-统一-llm-客户端工厂.md) | BaseProvider 体系、ProviderRegistry 缓存、三端统一 |
| 7.11 Common 中间件 | [discovery/07-09-711-common-安全与可观测性中间件.md](discovery/07-09-711-common-安全与可观测性中间件.md) | 请求链路、AsyncLocalStorage、SpiderGuard、SSRF |
| 7.12 流后处理 | [discovery/07-10-712-streamfinalize-chatfinalize-三-redis-连接.md](discovery/07-10-712-streamfinalize-chatfinalize-三-redis-连接.md) | SSE 后处理双模式、BullMQ 3 队列、三 Redis 连接 |
| 7.13 Admin 后端 | [discovery/07-11-713-admin-后端-api-auth-rbac-管理端消费者.md](discovery/07-11-713-admin-后端-api-auth-rbac-管理端消费者.md) | 用户管理、角色权限、邀请码、审计日志 |
| 7.14 Storage | [discovery/07-12-714-storage-存储层-minio-4-层抽象架构.md](discovery/07-12-714-storage-存储层-minio-4-层抽象架构.md) | MinIO 4 层抽象（IStorageProvider→Service→Factory→MinIO） |
| 7.15 Health | [discovery/07-13-715-health-健康检查-livenessreadiness-双端点.md](discovery/07-13-715-health-健康检查-livenessreadiness-双端点.md) | Liveness/Readiness 双端点、三探针并行 |
| 7.16 Database | [discovery/07-14-716-database-数据库层-prisma-extended-client.md](discovery/07-14-716-database-数据库层-prisma-extended-client.md) | Prisma $extends 分页+存在性、24 模型代理 |
| 7.17 SSE 客户端 | [discovery/07-15-717-web-sse-流式客户端-chat-companion-双轨-sse-架构.md](discovery/07-15-717-web-sse-流式客户端-chat-companion-双轨-sse-架构.md) | Chat XRequest vs Companion 原生 fetch 双轨对比 |
| 7.18 Admin 前端 | [discovery/07-16-718-admin-rbac-前端守卫-三层权限控制-token-自动刷新.md](discovery/07-16-718-admin-rbac-前端守卫-三层权限控制-token-自动刷新.md) | 三层权限守卫、Token 订阅者队列刷新 |
| 7.19 Overlay 架构 | [discovery/07-17-719-overlay-弹窗系统-命令式-portal-架构.md](discovery/07-17-719-overlay-弹窗系统-命令式-portal-架构.md) | 命令式 Portal 4 层架构、11 个预置弹窗 |
| 7.20 测试架构 | [discovery/07-18-720-测试架构-4-层测试金字塔.md](discovery/07-18-720-测试架构-4-层测试金字塔.md) | Unit → Integration → E2E API → E2E Browser 4 层 |
| 7.21 Companion 前端 | [discovery/07-19-721-web-companion-前端-ui-渲染.md](discovery/07-19-721-web-companion-前端-ui-渲染.md) | 打字机动画、消息气泡、10 组件树 |

---

## 缺口分析

| 章节 | 文件 | 说明 |
|------|------|------|
| 8. Unknown 分类 | [discovery/08-8-unknown-分类与解决方案.md](discovery/08-8-unknown-分类与解决方案.md) | 7 个 Unknown 项分类（4 已解决、2 待业务确认、1 未知） |
| 9. Knowledge Gap | [discovery/09-9-knowledge-gap-roadmap.md](discovery/09-9-knowledge-gap-roadmap.md) | 补全路线图、Explorer 速查索引 |

---

## 变更记录

完整变更历史见 [discovery/10-changelog.md](discovery/10-changelog.md)，包含 v2～v22 所有版本变更。

最新版本 **v22 (2026-07-08)**：auth-module-refactor RBAC 重构 + Provider 基类体系 + Admin 功能扩展。

---

## 阅读建议

1. **新人入门** → 顺序阅读 §1→§2→§3→§4→§6
2. **后端开发** → 重点看 §7.4（RBAC）→ §7.9（Auth）→ §7.10b（Provider）
3. **前端开发** → 重点看 §7.17（SSE）→ §7.18（Admin 守卫）→ §7.19（Overlay）
4. **架构审查** → 重点看 §5→§7.5→§7.11→§7.12
