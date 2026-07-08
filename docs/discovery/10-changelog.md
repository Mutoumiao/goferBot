# GoferBot Discovery Report

## Changelog

### v22 (2026-07-08) — auth-module-refactor + 07-05~07-08 多项变更合并

**来源**:
- `openspec/changes/auth-module-refactor`: Auth 模块彻底重构（数据模型+路径+App隔离+邀请码+管理端）
- `.trellis/tasks/archive/2026-07/07-05-auth-consolidation`: Auth 路径重构 `/api/auth/web/*` → `/api/web/auth/*`
- `.trellis/tasks/archive/2026-07/07-06-captcha-whitelist-skip`: CAPTCHA_WHITELIST_ORIGINS 环境变量
- `.trellis/tasks/archive/2026-07/07-06-provider-model-redesign`: ModelProvider.model→models 数组、预设模板 12 种
- `.trellis/tasks/archive/2026-07/07-07-auth-login-refactor`: fetchMe single-flight、refreshedMethods 防循环
- `.trellis/tasks/archive/2026-07/07-08-admin-users-optimize`: Admin 用户/角色管理 UI 优化
- `.trellis/tasks/archive/2026-07/07-08-no-auth-token`: NO_AUTH_TOKEN 错误码、Cookie 名 fallback 修复
- `.trellis/tasks/07-08-provider-model-fetch-fix`: Provider 基类体系 + ProviderRegistry 缓存层

**修正**:
- §7.4 RBAC: 删除 `User.role` 字段（String 枚举），新增 `Role` 表正规化 RBAC；超级管理员判定从 `permissions.length >= 20` 改为 `roles.includes('super_admin')`；新增 App 隔离四层 Guard 链（JWT→App→Roles→Permission）；Cookie 按 app 命名隔离；PermissionService/Repository 从 Auth 移入 Admin；PermissionSeeder 启动自动初始化
- §7.9 Auth: Cookie 名称按 app 隔离（`goferbot_web_*` / `goferbot_admin_*`）；认证端点全部按 app 分路径；新增邀请码注册机制（TEST_INVITATION_CODES + 数据库 InvitationCode 表）；Legacy 端点已删除；头像/资料从 Auth 迁至 User 模块；新增 APP_MISMATCH/INVITATION_CODE_*/SYSTEM_ROLE_DELETE_DENIED/SUPER_ADMIN_PROTECTED/NO_AUTH_TOKEN 等 9 个错误码
- §7.10 Companion LangChain: LlmConfigService 迁移至 ProviderRegistry（替代直接 `new ChatOpenAI`）
- §7.13 Admin 后端: 用户管理扩展（创建用户+角色分配+重置管理员密码+邀请码关联）；PermissionService/Repository 移入；新增 InvitationController；新增 PermissionSeeder + AdminAuditLog；移除 sessions/RAG observability
- §7.18 Admin 前端: `isAuthenticated` 移除 localStorage 持久化，`waitForAuthInit` 改为 `/auth/me` single-flight 验证；user.role→roles 数组模型；403 不再触发 refresh；新增 NO_AUTH_TOKEN 跳过 refresh；路由表移除 sessions/rag/mustChangePassword；权限常量扩展至 21 个（迁入 @goferbot/data）
- §2 技术栈: 无版本变更
- §3.3 请求生命周期: 新增 AppGuard（token.app 匹配），JwtAuthGuard 标注路径感知 Cookie
- §5.1 实体关系: 新增 Role/InvitationCode/AdminAuditLog 表，Role↔UserRole↔User 关联链
- §5.3 依赖顺序: AdminModule 依赖 PermissionSeeder 启动初始化，Chat/Companion/RAG 依赖 ProviderRegistry
- §6 核心模块: Auth 复杂度从"高"提升（新增 AppGuard + 路径感知 Cookie）

**新增**:
- §7.4 RBAC: Role 表正规化模型、四层 Guard 链、App 隔离路径分类表、Cookie App 隔离、PermissionSeeder 启动初始化、前后端联动图
- §7.9 Auth: 邀请码注册机制（双轨制：环境变量万能码 + 数据库 InvitationCode）、认证端点路径重构表、NO_AUTH_TOKEN 错误码
- §7.10b Provider 基类架构（全新章节）: BaseProvider 抽象类体系、ProviderRegistry 懒加载缓存、消费端统一化（Chat/RAG/Companion 三端迁移）、PROVIDER_REGISTRY 注册表
- §4.1 更新 Admin/User/Settings 模块描述（Role 表、ProviderRegistry、邀请码、User 独立 controller）
- §4.4 Admin 前端: 新增 Invitations 功能、移除 Sessions/RAG Observability
- §4.5 Data Schema: 新增 invitation.schema.ts、settings.schema 含 FetchedModel/ProviderPreset

**已解决**:
- [RESOLVED] auth-module-refactor: RBAC 模型彻底重构（Role 表、超管判定修复、App 隔离、邀请码）
- [RESOLVED] 07-08-provider-model-fetch-fix: Provider 基类体系 + fetch-models 响应格式修复 + Schema 迁移

**破坏性变更**:
- 数据库需重置（User.role 删除、Role 表新增、InvitationCode 表新增）
- 前端 localStorage 旧 auth 数据失效，需重新登录
- Cookie 名称变更，旧 Cookie 自动失效
- API 路径变更：`/auth/register` → `/auth/web/register`、`/auth/login` → `/auth/{app}/login` 等
- 旧前端代码引用旧路径会得 404

***

### v2 (2026-07-02) — Round 1 Discovery Consolidation

**修正**:
- Round 1: 修正 §7.1 — Companion 11 节点中仅 7 个调用 LLM，RouteNode / PolicyNode / QualityGuardNode 为纯规则引擎（非 LLM）。策略路由在原 ai-partner-agent 中为 LLM 生成，GoferBot 重写为 15 条硬编码 ROUTE_RULES + 10 个 POLICY_PACKS 查表

**新增**:
- Round 1: 新增 §7.1 — LangGraph 完整图结构（11 节点执行顺序 + 3 条件分支）、Prompt 注入链、SharedNodeFactory 统一 LLM 调用模式、记忆关键词兜底机制、来源背景（ai-partner-agent 迁移）

**已解决**:
- Round 1: [RESOLVED] #4 LangGraph 工作流全貌 — 全部 5 个子问题已回答（StateGraph 条件路由、执行顺序、节点实现、类型定义、stream 机制）

### v3 (2026-07-02) — Round 2 Discovery Consolidation

**修正**:
- Round 2: 修正 §7.2 — BGE 重排非硬编码单模型，而是配置化 cross-encoder 推理(admin panel 配置 + 白名单校验 + @xenova/transformers 本地推理 + 降级策略)
- Round 2: 修正 §7.2 — RRF 为应用层实现(非 ES 原生)，公式 Σ(weight_i / (k + rank_i + 1))

**新增**:
- Round 2: 新增 §7.2 — RAG 检索全链路(QueryUnderstanding → Router → Vector/BM25/Hybrid → RRF → Rerank → Parent Resolution → Cache) + 权限模型 + 关键参数
- Round 2: 新增 §7.1 Companion pipeline service — prepareContext / execute / assertFinalState / persist 外部编排层

**已解决**:
- Round 2: [RESOLVED] #1 Elasticsearch 检索侧实现 — 全部 5 个子问题已回答
- Round 2: [RESOLVED] #7 @xenova/transformers 用途 — 全部子问题已回答

### v5 (2026-07-02) — Cycle 2 Discovery Consolidation

**修正**:
- Cycle 2: 修正 §4.2 Queue — 从"BullMQ 队列管理、IndexingWorker"扩展为完整的 3 队列架构（document-processing / embedding / chat-finalize）+ Redis 降级 + 动态模块
- Cycle 2: 修正 §4.2 Parser — 从"PDF解析器+文本解析器"扩展为策略模式调度中心 + PDF 三引擎后备链 + StructureExtractor
- Cycle 2: 修正 §4.1 Session — Repository 模式为导出给其他模块使用（SessionService 本身直接使用 PrismaService）
- Cycle 2: 修正 §4.1 User — 密码变更事务（撤销所有 Session+RefreshToken）+ 超管引导分布式锁

**新增**:
- Cycle 2: 新增 §7.6 Queue 处理器详解 — 3 队列架构、IndexingWorker 管线、重试策略、Redis 生命周期
- Cycle 2: 新增 §7.7 Parser 详解 — 策略模式、PDF 三引擎链、StructureExtractor 算法、Zod 校验
- Cycle 2: 新增 §7.8 User 详解 — 密码安全事务、SuperAdminBootstrap 分布式引导锁、事件驱动通知

**已解决**:
- Cycle 2: [RESOLVED] c2-1 Queue 处理器 — 全部 4 个子问题已回答
- Cycle 2: [RESOLVED] c2-2 Session 模块 — 全部 3 个子问题已回答
- Cycle 2: [RESOLVED] c2-3 Parser — 全部 3 个子问题已回答
- Cycle 2: [RESOLVED] c2-4 User+Bootstrap — 全部 3 个子问题已回答

### v4 (2026-07-02) — Round 3 Discovery Consolidation

**修正**:
- Round 3: 修正 #6 — modules/ vs processors/ 并非单向分层，而是双向依赖的 pragmatic 二层架构（纯基础设施 + 编排处理器）

**新增**:
- Round 3: 新增 §7.5 — processors/ 基础设施层详解（DatabaseModule Prisma 扩展 + StorageModule 工厂降级 + 跨层依赖量化分析 32:30）

**已解决**:
- Round 3: [RESOLVED] #6 modules/ vs processors/ 边界 — 全部 3 个子问题已回答

### v6 (2026-07-02) — Cycle 4 Discovery Consolidation

**修正**:
- Cycle 4: 修正 §7.2 RRF 算法 — 补充精确公式 `score = weight / (rrfK + rank + 1)`，默认 rrfK=60，应用层实现而非 ES 原生
- Cycle 4: 修正 §7.2 BGE 重排 — 补充模型白名单（BAAI/Xorbits/sentence-transformers）、batchSize=16、fallback 降级策略（词法匹配 50% + 原始分数 50%）
- Cycle 4: 修正 §7.2 路由服务 — 补充 6 种意图（code_search/fact_qa/time_range/relation_qa/chitchat/general）的完整分类规则和 Pipeline 映射表

**新增**:
- Cycle 4: 新增 §7.2 RAG 检索全链路细节 — QueryUnderstanding 三步管线（语言检测→短查询改写→同义词扩展）、ES knn 查询 ACL 物理隔离、Grounding 混合词汇蕴含判定算法、Guardrail 输出安全护栏（PII 脱敏+敏感关键词+领域免责）、Redis 缓存策略（TTL=60s）
- Cycle 4: 新增 §7.2 ES 索引 mapping 详解 — ik_max_word/ik_smart 分词配置、dense_vector cosine 相似度、allowed_user_ids/allowed_team_ids 权限字段设计
- Cycle 4: 新增 §7.2 检索权限模型 — kbIds 必填 + Prisma 所有权验证 + ES 层 ACL（命中 OR 字段不存在=公开）三层校验

**已解决**:
- Cycle 4: [RESOLVED] #1 ES 检索侧实现 — 全部子问题已回答（RRF 融合、ES 查询 DSL、护栏介入、查询理解、Grounding）
- Cycle 4: [RESOLVED] #7 @xenova/transformers 用途 — 全部子问题已回答（BGE 模型加载方式、@xenova/transformers 本地推理）

### v7 (2026-07-02) — Cycle 4 Round 2 Discovery Consolidation

**修正**:
- Cycle 4 Round 2: 修正 §7.2 RAG 模块描述 — 从"仅检索管线"扩展为完整的"检索→生成→索引"三侧架构

**新增**:
- Cycle 4 Round 2: 新增 §7.2 RAG 生成侧管线 — 上下文构建（去重→排序→token预算3000截取→编号格式化）、同步生成（generateAnswer）+ 流式生成（streamQuery）、后处理（Guardrail→Grounding）、SSE心跳60s机制
- Cycle 4 Round 2: 新增 §7.2 RAG API 端点 — 6个端点定义（retrieve/query/stream/index/removeDocument/health）、权限解析（resolveKbIds自动解析用户知识库）、SSE事件格式（sources/grounding/message/message_end）
- Cycle 4 Round 2: 新增 §7.2 RAG Embedding 服务 — 基于 @llamaindex/openai 的 OpenAIEmbedding 适配器、配置化 provider（apiKey/model/baseURL/dimensions）、config.changed 事件动态刷新
- Cycle 4 Round 2: 新增 §7.2 RAG 索引侧 — Parent-Child 分块架构（parent=800/overlap=100，child=150/overlap=20）、上下文嵌入（contextualWindow=1）、ES 双写（chunk + parent_content）、权限验证（Prisma 所有权 + ES ACL）

**已解决**:
- Cycle 4 Round 2: [RESOLVED] RAG 生成侧实现 — 全部子问题已回答（上下文构建、生成编排、流式SSE、后处理管线、API端点）
- Cycle 4 Round 2: [RESOLVED] RAG 索引侧实现 — 全部子问题已回答（分块策略、Embedding构建、ES写入、权限验证）
- Cycle 4 Round 2: [RESOLVED] RAG Metadata 安全校验 — 黑名单前缀防止 NoSQL 注入、白名单 keys 环境变量扩展、键名格式校验
- Cycle 4 Round 2: [RESOLVED] RAG 事件驱动索引 — DocumentUploadedListener 监听上传事件、队列健康检查后自动入队

### v8 (2026-07-02) — Cycle 5 P1 Trellis Web Frontend 指南填充

**新增**:
- Cycle 5 P1: 新增 Trellis Web Frontend 6个指南文档 — directory-structure.md（FSA目录组织）、component-guidelines.md（shadcn/ui组件模式）、hook-guidelines.md（alova数据获取+自定义Hook）、state-management.md（Zustand分层状态管理）、quality-guidelines.md（Biome代码规范+禁止模式）、type-safety.md（TypeScript类型安全+Zod校验）
- Cycle 5 P1: 新增 Web 前端架构发现 — Feature-Sliced Architecture 模块组织、Zustand 全局/模块状态分层、alova HTTP客户端封装、Portal命令式弹窗系统、TanStack Router 路由配置

**已解决**:
- Cycle 5 P1: [RESOLVED] Trellis Web Frontend 指南 — 6个模板全部填充完成

### v9 (2026-07-02) — Cycle 5 P1 Trellis Admin Frontend 指南填充

**修正**:
- Cycle 5 P1: 修正 §4.4 Admin 模块列表 — 从 7 个扩展为 10 个功能模块（新增 Model Providers、Module Settings、RAG Observability）

**新增**:
- Cycle 5 P1: 新增 §4.4 Admin 技术栈描述 — Ant Design 6.x + Pro Components + Tailwind CSS v4 + Zustand + alova
- Cycle 5 P1: 新增 Trellis Admin Frontend 6个指南文档 — directory-structure.md（FSA目录组织）、component-guidelines.md（Ant Design组件模式）、hook-guidelines.md（alova数据获取+useQueryWithRetry）、state-management.md（Zustand全局状态）、quality-guidelines.md（Biome代码规范）、type-safety.md（TypeScript类型安全）
- Cycle 5 P1: 新增 Admin 前端架构发现 — RBAC权限守卫（auth-guard.ts）、自动Token刷新（alova responded）、ProLayout动态菜单、services.ts业务逻辑封装

**已解决**:
- Cycle 5 P1: [RESOLVED] c5-2 Trellis Admin Frontend 指南 — 6个模板全部填充完成

### v10 (2026-07-02) — Cycle 5 P2 Trellis Data Schema 指南填充

**新增**:
- Cycle 5 P2: 新增 Trellis Data Schema 6个指南文档 — directory-structure.md（纯TypeScript Schema包目录组织）、component-guidelines.md（Zod Schema定义模式和最佳实践）、hook-guidelines.md（工具函数和组合模式）、state-management.md（配置状态/业务流程状态/文档生命周期状态设计模式）、quality-guidelines.md（代码标准和禁止模式）、type-safety.md（Zod验证和TypeScript类型安全）
- Cycle 5 P2: 新增 Data Schema 包架构发现 — 16个Schema文件分类（auth/chat/kb/companion/admin/rag/settings等）、共享契约层设计（server/web/admin三方依赖）、`z.infer<>`类型派生模式、分页响应工厂函数、fallback值安全回退机制

**已解决**:
- Cycle 5 P2: [RESOLVED] c5-3 Trellis Data Schema 指南 — 6个模板全部填充完成

### v11 (2026-07-02) — Cycle 5 P2 Settings OpenSpec 补充

**新增**:
- Cycle 5 P2: 补充 Settings OpenSpec — 从74行扩展到327行，新增 Architecture（配置分层架构/模块职责/配置分类）、API Endpoints（用户配置/系统配置/Provider池端点）、Data Models（完整字段定义）、Error Codes（10个错误码）、Events（配置变更事件）、Security（API Key保护/权限控制/SSRF防护）、Migration（遗留格式自动迁移）章节
- Cycle 5 P2: 新增配置分层架构发现 — DEFAULT_CONFIG → SYSTEM_CONFIG → APP_CONFIG 三层合并策略，Provider池优先级规则，深层合并逻辑
- Cycle 5 P2: 新增模块职责划分 — SettingsService（用户配置/合并/迁移）、SystemConfigService（系统配置/Provider池/事件通知）、ModelProviderService（引用验证/类型校验）、ConfigCryptoService（加密/解密/掩码）

**已解决**:
- Cycle 5 P2: [RESOLVED] c5-4 Settings OpenSpec 补充 — 从偏薄的基础版扩展为完整的配置管理规范

### v14 (2026-07-03) — Cycle 7 Discovery Consolidation（第二遍审查）

**修正**:
- Cycle 7: 修正 Redis 架构认知 — 从"单一 Redis 连接"修正为 **3 个独立连接**：Queue Redis（BullMQ）+ Cache Redis（CacheService）+ Auth Redis（AuthRedisService），各有独立的环境变量配置
- Cycle 7: 修正 Companion LLM 调用层认知 — 从"LangGraph 直接调 LLM"修正为完整的适配层：LangChain ChatOpenAI + StructuredOutputService 三方法降级链 + LlmConfigService 热更新
- Cycle 7: 修正模块注册依赖认知 — JwtStrategy 直接注入 PrismaService + AuthRepository 做用户查询，不通过 UserModule
- Cycle 7: 修正处理器层列表 — 新增 ChatFinalizeProcessor（SSE 流后处理）

**新增**:
- Cycle 7: 新增 §7.4 RBAC 权限系统详解 — 三层 Guard 链（JWT → Roles → Permission）、PermissionService 权限缓存与 SUPER_ADMIN 判定逻辑、Redis 缓存策略
- Cycle 7: 新增 §7.9 Auth 安全架构 — JWT 双密钥架构、Token Rotation 并发安全（原子 SQL `UPDATE...WHERE usedAt IS NULL RETURNING id`）、jti Hash 反推防护、Token 链式审计追踪、Auth Redis Fail-Closed 策略、Cookie 安全策略、CAPTCHA 完整实现（SVG→sharp→PNG + 一次性消费）、11 错误码体系
- Cycle 7: 新增 §7.10 Companion LangChain 层 — LangChain vs LlamaIndex 分工（Companion/Chat/RAG 三方适配层差异）、StructuredOutput 三方法降级链（functionCalling→jsonSchema→jsonMode）、LlmConfigService 热更新配置链、完整 LLM 调用层级（Node→SharedNodeFactory→StructuredOutputService→ChatOpenAI）
- Cycle 7: 新增 §7.11 Common 安全中间件 — 请求生命周期完整链路（7 步中间件链）、AsyncLocalStorage 上下文传播、统一响应格式（success+bigint 序列化）、LoggingInterceptor 生产级日志策略（分层采样+敏感脱敏）、SpiderGuard UA 反爬虫、SSRF Guard 五层防护（HTTPS→localhost→本地IP→内网前缀→白名单）
- Cycle 7: 新增 §7.12 StreamFinalize + ChatFinalize — SSE 流后处理双模式（BullMQ → queueMicrotask 降级）、ChatFinalizeProcessor 两步后处理（持久化+标题生成）、BullMQ 3 队列完整拓扑对比表、三 Redis 独立连接架构

**已解决**:
- Cycle 7: [RESOLVED] c7-1 Auth Token Rotation 与安全机制 — 全部 6 个子问题已回答
- Cycle 7: [RESOLVED] c7-3 Companion LangChain 层 — 全部 4 个子问题已回答
- Cycle 7: [RESOLVED] c7-4 Common 安全与可观测性中间件 — 全部 7 个文件已读
- Cycle 7: [RESOLVED] c7-5 StreamFinalize + BullMQ 完整拓扑 — chat-finalize 队列完整分析

**Deferred（按需执行）**:
- Cycle 7: c7-2 Chat LLM Provider 工厂 — [RESOLVED] 采用预留扩展的工厂模式（当前仅 LlamaIndex/OpenAI 兼容一种实现），包含流式防御性守卫（`isAsyncIterable` 运行时检查）、多模态内容提取前向兼容、条件参数透传等模式
- Cycle 7: c7-6 KnowledgeBase Document 生命周期 — [RESOLVED] 探索发现非平凡架构（多存储分离事务边界、跨KB移动物理重上传、递归CTE防环、文件夹复制回滚、事件驱动异步索引），已纳入 `openspec/specs/knowledge-base/document-lifecycle.md`
- Cycle 7: c7-7 Prisma 迁移历史 — Deferred（5 个命名清晰的迁移，无架构含义）
- Cycle 7: c7-8 项目架构演进文档 — Deferred（1 份 ADR 覆盖初期决策，`docs/superpowers/` 不存在）
- Cycle 7: c5-5 Companion LangGraph 工作流 — 已在 Cycle 6 完成

**统计**:
- Cycle 7 共 2 轮（Round 12-13）、探索 18 个文件、产出 26 项新知识
- 全旅程（Cycle 1-7）：13 轮探索、~120 文件、~175 知识项（含 v15 新增 document-lifecycle）
- 18 模块认知深度矩阵已完成

### v15 (2026-07-03) — Cycle 7 Deferred Items Resolution

**修正**:
- v15: 修正 c7-2 状态 — 从 "单一实现，trivial" 修正为 RESOLVED。LLM Provider 虽只有一个实现，但含预留扩展的工厂模式、`isAsyncIterable` 流式防御守卫、多模态内容提取前向兼容等模式
- v15: 修正 c7-6 状态 — 从 "CRUD 模式" 修正为 RESOLVED。探索发现非平凡的多存储协调事务边界、跨KB移动物理重上传、递归CTE防环、文件夹复制回滚等 6+ 非明显模式

**新增**:
- v15: 新增 `openspec/specs/knowledge-base/document-lifecycle.md` — 文档生命周期完整规范，涵盖上传流程、跨KB移动/复制物理约束、多存储分离事务边界、文件夹树递归CTE操作、文件夹复制回滚、文档状态机

**已解决**:
- Cycle 7: [RESOLVED] c7-2 Chat LLM Provider 工厂 — 预留扩展模式已记录
- Cycle 7: [RESOLVED] c7-6 KnowledgeBase Document 生命周期 — 非平凡架构已纳入独立 OpenSpec

**Deferred（最终确认）**:
- Cycle 7: c7-7 Prisma 迁移历史 — 5 个命名清晰的迁移，无架构含义
- Cycle 7: c7-8 项目架构演进文档 — 1 份 ADR 覆盖初期决策

### v16 (2026-07-03) — Cycle 8 末覆盖模块补全

**修正**:
- v16: 修正 §4.1 Admin 模块描述 — 从"用户管理、审计日志"修正为"管理端 API：用户分页+状态切换+角色权限 CRUD"，Prisma 模型从 AdminAuditLog/SystemFlag 修正为复用 User/UserRole/Permission/RolePermission
- v16: 修正 Admin 模块定位 — 非独立业务模块，而是 Auth RBAC 基础设施的管理端消费者

**新增**:
- v16: 新增 §7.13 Admin 后端 API — 两个 Controller 权限矩阵、AdminService 事件驱动状态切换、RoleService 动态角色发现+deleteMany/create 权限更新
- v16: 新增 §7.14 Storage 存储层 — IStorageProvider → StorageService 门面 → FactoryProvider → MinIOStorageProvider 的 4 层抽象架构及优雅降级设计
- v16: 新增 §7.15 Health 健康检查 — Liveness/Readiness 双端点、三组件并行探针（2500ms 超时）、ok/degraded/down 状态分类
- v16: 新增 §7.16 Database 数据库层 — PrismaService `$extends` 通用分页+存在性扩展、24 模型 getter 代理、NestJS 生命周期钩子

**已解决**:
- Cycle 8: [RESOLVED] c8-1 Admin 后端模块 — 全部 2 个 Controller + 2 个 Service + 1 个 Repository 已读
- Cycle 8: [RESOLVED] c8-2 Storage 存储层 — IStorageProvider 接口 + MinIO + 门面 + Factory 完整链路
- Cycle 8: [RESOLVED] c8-3 Health 检查模块 — liveness/readiness + 并行探针
- Cycle 8: [RESOLVED] c8-4 Database PrismaService — $extends + paginate + exists + 24 模型代理

**统计**:
- Cycle 8 共 1 轮（Round 14）、探索 16 个文件、产出 16 项新知识
- 全旅程（Cycle 1-8）：14 轮探索、~136 文件、~191 知识项
- 22 模块认知深度矩阵已完成（全后端模块已覆盖）

### v17 (2026-07-03) — Cycle 9 Round 15 Web SSE 流式客户端探索

**修正**:
- v17: 修正 Chat 数据获取认知 — Chat 的 SSE 流式通信**不使用 alova**，实际通过 `@ant-design/x-sdk` `XRequest` + `AbstractChatProvider` 实现。alova 仅用于普通 CRUD API（getSessions/getMessages 等 `.send()` 模式）

**新增**:
- v17: 新增 §7.17 Web SSE 流式客户端 — Chat 与 Companion **双轨 SSE 架构**完整对比：Chat 使用 `@ant-design/x-sdk` 高层抽象（XRequest → GoferChatProvider → useXChat → XMarkdown streaming），Companion 使用原生 `fetch + ReadableStream` 底层实现（CompanionSseClient → Zustand store）
- v17: 新增后端 SseResponseHelper 基础设施分析 — 统一 SSE 帧格式 `event:name\ndata:JSON`、客户端断开 AbortController、Fastify CORS 透传机制
- v17: 新增 Chat 状态管理双层架构 — `useChatStore`（本地 UI 状态/缓存）+ `useConversationStore`（全局消息隔离、生命周期跨 tab）
- v17: 新增 Pending Message 模式 — 临时会话 → sessionStorage → queueMicrotask 自动发送链路
- v17: 新增 `useXChat` 6 态消息生命周期 — loading/success/error/local/updating/abort + requestFallback 错误分类（AbortError vs 网络异常）

**已解决**:
- Cycle 9: [RESOLVED] c9-1 Web SSE 流式客户端 — Chat + Companion 完整端到端 SSE 链路，10 文件已读

**统计**:
- Cycle 9 Round 15 共 1 轮、10 文件、12 项新知识
- 全旅程（Cycle 1-9）：15 轮探索、~146 文件、~203 知识项

### v18 (2026-07-03) — Cycle 9 Round 16 Admin RBAC 前端守卫探索

**新增**:
- v18: 新增 §7.18 Admin RBAC 前端守卫 — 三层权限控制架构完整透视：TanStack Router `beforeLoad` 路由守卫 → `useMenuConfig()` 菜单动态过滤 → `PermissionMatrix` 组件级权限分配
- v18: 新增 Token 自动刷新订阅者队列模式分析 — `isRefreshing` 互斥锁 + `refreshSubscribers[]` 队列 + HttpOnly Cookie 认证
- v18: 新增 Auth 状态持久化机制 — Zustand `persist` partialize 仅存 `{user, isAuthenticated}`，Token 完全由 HttpOnly Cookie 管理
- v18: 新增登录/RSA加密/会话恢复/登出完整流程
- v18: 新增 `ROUTES_REGISTER` 路由-权限映射表（14 条路由全量分析）
- v18: 新增前后端 RBAC 联动图 — 前端 `beforeLoad` guard → 后端 `JwtAuthGuard → PermissionGuard` 双层验证

**已解决**:
- Cycle 9: [RESOLVED] c9-2 Admin RBAC 前端守卫 — 三层权限架构 + Token 刷新 + 登录流程，10 文件已读

**统计**:
- Cycle 9 Round 16 共 1 轮、10 文件、12 项新知识
- 全旅程（Cycle 1-9）：16 轮探索、~156 文件、~215 知识项

### v19 (2026-07-03) — Cycle 9 Round 17 Overlay 弹窗系统探索

**新增**:
- v19: 新增 §7.19 Overlay 弹窗系统 — 4 层架构完整透视：类型定义 → Zustand Store → 命令式 Service → React Portal 渲染层
- v19: 新增完整生命周期时序图 — `openDialog → push(entry) + Promise注入 → OverlayHost.createPortal → onClose → remove(id, result) → resolve`
- v19: 新增 OverlayEntry 数据模型分析 + 两种弹窗类型（dialog/context-menu）对比
- v19: 新增弹窗组件 onClose 约定（Alert 风格 'confirm'/'cancel' vs Form 风格 true/false）
- v19: 新增 11 个预置弹窗清单及变体分类

**已解决**:
- Cycle 9: [RESOLVED] c9-3 Overlay 弹窗系统 — 4 层架构 + 命令式 API + 生命周期，8 文件已读

**统计**:
- Cycle 9 Round 17 共 1 轮、8 文件、11 项新知识
- 全旅程（Cycle 1-9）：17 轮探索、~164 文件、~226 知识项

### v21 (2026-07-03) — Cycle 9 Round 19 Web Companion 前端 UI 渲染探索

**新增**:
- v21: 新增 §7.21 Web Companion 前端 UI 渲染 — 10 组件树完整梳理：CompanionListPage → CompanionCard → CompanionChatPage → CompanionMessageItem
- v21: 新增 Companion 打字机动画 vs Chat XMarkdown 流式渲染对比 — setInterval 18ms 逐字 + animate-pulse 光标 vs streaming.hasNextChunk
- v21: 新增 CompanionMessageItem 三态渲染 — 用户纯文本 / AI 流式中 TypingIndicator / AI 完成 XMarkdown 静态
- v21: 新增 CompanionForm 11 字段详情 + CompanionStatusTag 三态映射
- v21: 新增头像渲染模式 — CSS backgroundImage + 首字母 fallback、5 种 MemoryType 中文标签

**已解决**:
- Cycle 9: [RESOLVED] c9-4 Web Companion 前端 UI 渲染 — 打字机动画、消息气泡、列表/卡片、表单、头像、反馈、状态标签全部覆盖，10 文件已读

---

### v20 (2026-07-03) — Cycle 9 Round 18 E2E 测试架构探索

**新增**:
- v20: 新增 §7.20 测试架构 — 4 层测试金字塔完整分析：Unit → Integration → E2E API → E2E Browser
- v20: 新增 E2E Browser 架构分析 — Page Object Model（AuthPage/ChatPage）、Mock 双模式（RSA 密钥对 + 内存 users Map）、独立 `goferbot_e2e` 数据库 + globalSetup/Teardown
- v20: 新增 Integration 测试覆盖矩阵 — 22 specs 全覆盖所有 Controller + RAG + 基础设施
- v20: 新增 E2E Browser 覆盖缺口分析 — 8 cases 中 3 fixme（route-guard / no-llm-provider）
- v20: 新增 4 层测试覆盖率总结 — Integration 最强、E2E 有提升空间

**已解决**:
- Cycle 9: [RESOLVED] c9-5 E2E 测试覆盖 — 4 层架构 + 覆盖矩阵 + CI 配置，8 文件已读

**统计**:
- Cycle 9 Round 18 共 1 轮、8 文件、9 项新知识
- 全旅程（Cycle 1-9）：18 轮探索、~172 文件、~235 知识项
