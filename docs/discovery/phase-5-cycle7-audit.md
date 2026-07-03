# Cycle 7: Second-Pass Audit 进度报告

> 执行时间：2026-07-03
> 触发原因：用户要求"重新审查一遍，看看有没有遗漏的、疏忽的"
> Cycle 1-6 背景：已完成全部原始 7 Unknown 的探索，发现报告 v12
> 状态：**P0+P1 完成，P2+P3 延迟**

***

## 一、Second-Pass Discovery Assessment（重新评分）

对 Discovery Report 8 维度重新评分，与第一遍对比：

| # | 维度 | 第一遍 (Cycle 1) | 第二遍 (Cycle 7) | 降幅原因 |
|---|------|-----------------|-----------------|---------|
| 1 | Business Understanding | 4 | 4 | 稳定 |
| 2 | Architecture Understanding | 5 | **4** | ADR 揭示 Vue→React 架构演进、双 Redis 模式、SSRF 白名单未文档化 |
| 3 | Module Understanding | 5 | **4** | Auth(38文件)、Chat LLM、Companion LangChain 层、Common 17文件均未深入 |
| 4 | Runtime Understanding | 4 | **3.5** | StreamFinalize 双模式、BullMQ 3队列拓扑、LoggingInterceptor 采样未覆盖 |
| 5 | Dependency Understanding | 5 | **4.5** | 双 Redis 连接模式未文档化 |
| 6 | Data Flow Understanding | 5 | **4** | Chat finalize 流、SSE 生命周期、SSRF URL 校验链未覆盖 |
| 7 | AI Workflow Understanding | 5 | **4.5** | StructuredOutput 降级链未捕获 |
| 8 | Unknown Coverage | 5 | **4** | 第二轮审查发现 8 个新 Unknown |
| **平均** | | **4.75** | **4.13** | 仍 ≥ 4.0，但认知盲区比预期大 |

> **结论**：第一遍"主干优先"策略遗漏了三类内容 — Auth 安全机制、基础设施中间件、LLM 适配层。

***

## 二、新发现的 8 个 Unknown

| # | Unknown | 分类 | 优先级 | 理解提升 | 状态 |
|---|---------|------|--------|---------|------|
| c7-1 | Auth Token Rotation + 安全机制 | Explorable | P0 | 高 | ✅ RESOLVED (Round 12) |
| c7-2 | Chat LLM Provider 工厂 | Explorable | P2 | 中 | ⏸ DEFERRED |
| c7-3 | Companion LangChain StructuredOutput | Explorable | P0 | 高 | ✅ RESOLVED (Round 12) |
| c7-4 | Common 安全/可观测性中间件 | Explorable | P1 | 中 | ✅ RESOLVED (Round 13) |
| c7-5 | StreamFinalize + BullMQ 拓扑 | Explorable | P1 | 中 | ✅ RESOLVED (Round 13) |
| c7-6 | KB Document 生命周期 | Explorable | P2 | 低 | ⏸ DEFERRED |
| c7-7 | Prisma 迁移历史 | Explorable | P3 | 低 | ⏸ DEFERRED |
| c7-8 | 架构演进文档 (ADR) | Explorable | P3 | 低 | ⏸ DEFERRED |

***

## 三、Round 12: Auth + Companion LangChain（P0）

### 文件清单（13 个）

```
packages/server/src/auth/
├── auth.service.ts              — Token Rotation 核心逻辑
├── auth-redis.service.ts        — Redis 黑名单 + 用户/权限缓存
├── repositories/auth.repository.ts — RefreshToken 原子操作
├── strategies/jwt.strategy.ts   — JWT 验证 + 用户缓存
├── captcha.service.ts           — SVG CAPTCHA 生成
├── services/permission.service.ts — RBAC 权限服务
├── guards/jwt.guard.ts          — 黑名单检查
├── guards/roles.guard.ts        — 角色校验
├── guards/permission.guard.ts   — 细粒度权限
├── cookie.helper.ts             — Cookie 安全策略
└── errors.ts                    — 11 个认证错误码

packages/server/src/modules/companion/
├── langchain/langchain-llm.service.ts    — LangChain LLM 服务
├── langchain/structured-output.service.ts — 三方法降级链
├── langchain/types.ts                     — 类型定义
├── langchain/constants.ts                 — 上下文限制常量
├── config/llm-config.service.ts          — LLM 配置热更新
└── langgraph/nodes/_shared.ts            — SharedNodeFactory 连接
```

### 核心发现

1. **JWT 双密钥架构**：Access Token (JWT_SECRET, 2h) + Refresh Token (JWT_REFRESH_SECRET, 7d)
2. **Token Rotation 原子化**：`UPDATE...WHERE usedAt IS NULL RETURNING id` 防并发重放
3. **jti Hash 安全**：JWT payload 存明文 jti，数据库存 SHA256 hash
4. **Token 链式追踪**：parentTokenId + replacedByTokenId 形成完整旋转链
5. **Auth Redis Fail-Closed**：生产 Redis 不可用 = 所有 Token 被拒绝
6. **三层 Guard**：JwtAuthGuard(认证) → RolesGuard(角色) → PermissionGuard(细粒度权限)
7. **SUPER_ADMIN 判定**：`hasPermission('*')` 或 permissions.length >= 20
8. **CAPTCHA**：SVG+sharp 生成 → Redis TTL=120s → 一次性消费

### Companion LangChain 层

9. **LangChain vs LlamaIndex 分工**：Companion=ChatOpenAI(结构化输出)，Chat=LlamaIndexProvider(流式)
10. **StructuredOutput 三方法降级链**：functionCalling → jsonSchema → jsonMode
11. **LlmConfigService 热更新**：监听 config.changed 事件 → refreshConfig()
12. **完整调用层级**：LangGraph Node → SharedNodeFactory → StructuredOutputService → ChatOpenAI

***

## 四、Round 13: Common 中间件 + StreamFinalize（P1）

### 文件清单（7 个）

```
packages/server/src/common/
├── middleware/request-id.middleware.ts        — X-Request-Id 生成/透传
├── middleware/request-context.middleware.ts    — AsyncLocalStorage 上下文
├── request-context-storage.ts                 — AsyncLocalStorage 封装
├── interceptors/response.interceptor.ts       — 统一包装 {success, data, meta}
├── interceptors/logging.interceptor.ts        — 分层日志 + 敏感字段脱敏
├── guards/spider.guard.ts                     — 反爬虫 UA 黑/白名单
└── utils/ssrf-guard.ts                        — URL 白名单 + 内网 IP 拒绝

packages/server/src/
├── common/filters/all-exception.filter.ts     — 统一错误响应
├── common/services/stream-finalize.service.ts — 流后处理双模式
├── processors/chat/chat-finalize.processor.ts — 消息持久化 + 标题生成
├── queue/queues.ts                            — 3 队列定义
└── queue/workers.ts                           — 3 Worker 工厂
```

### 核心发现

1. **请求生命周期**：RequestId → AsyncLocalStorage → Guard 链 → Interceptor → Filter
2. **统一响应格式**：成功 `{success, data, meta}` / 错误 `{success: false, error, meta}`
3. **ResponseInterceptor bigint 处理**：递归 `serializeBigInt()` 防 JSON 序列化失败
4. **LoggingInterceptor 策略**：生产=错误/慢请求(>2s)全量 + 正常 10%采样；开发=全量 debug
5. **SpiderGuard**：UA 黑名单正则 + 搜索引擎白名单，仅生产启用
6. **SSRF Guard**：HTTPS 强制 + 内网 IP 拒绝 + 域名白名单
7. **StreamFinalize 双模式**：BullMQ 优先（持久化，重试5次）→ microtask 降级
8. **ChatFinalizeProcessor**：Step1 消息持久化（失败重试） → Step2 标题生成（失败仅 log）
9. **BullMQ 3 队列对比**：document-processing(attempts=3) / embedding(3) / chat-finalize(5)
10. **三 Redis 连接**：Queue Redis / Cache Redis / Auth Redis 独立隔离

### 关键认知修正

| 原有认知 | 修正后 |
|---------|--------|
| 只有一个 Redis 连接 | **3 个独立连接**：Queue/Cache/Auth |
| Companion LLM 调用 = LangGraph | 实际底层是 **ChatOpenAI**，StateGraph 仅做编排 |
| 不存在 chat-finalize 队列 | 实际是 **第 3 个 BullMQ 队列**，异步持久化+标题生成 |
| Auth 模块在 modules/auth/ | 实际在 **src/auth/**（顶层），导致第一遍模块扫描完全遗漏 |

***

## 五、全旅程统计（Cycle 1-7）

| 指标 | 数值 |
|------|------|
| 总轮次 | 13 rounds |
| 总读取文件 | ~120 files |
| 总新增知识 | ~175 items |
| Discovery Report 版本 | v14 |
| 原始 Unknown 解决率 | 7/7 (100%) |
| 第二轮新 Unknown 解决率 | 4/8 (50%, P2+P3 延迟) |
| OpenSpec 新建 | 1 (RAG) |
| OpenSpec 更新 | 2 (Settings + Companion) |
| Trellis 指南填充 | 18 (Web 6 + Admin 6 + Data 6) |

### 模块认知深度矩阵

| 模块 | 第一遍 | 第二遍 | 深度 |
|------|--------|--------|------|
| RAG 检索管线 | ★★★★★ | — | 完整：QueryUnderstanding→ES→RRF→BGE→Grounding |
| Companion LangGraph | ★★★★☆ | ★★★★★ | 完整：11节点+3分支+StructuredOutput降级链 |
| Auth | ★★☆☆☆ | ★★★★★ | 完整：Token Rotation+Redis黑名单+三级Guard+CAPTCHA |
| Common 基础设施 | ★☆☆☆☆ | ★★★★☆ | 完整：中间件链+Interceptor+Filter+Guard+SSRF |
| Queue/BullMQ | ★★★★☆ | ★★★★★ | 完整：3队列拓扑+StreamFinalize双模式 |
| Chat 模块 | ★★★☆☆ | ★★★★☆ | 了解：LlamaIndexProvider+chat-finalize+ConversationService |
| KnowledgeBase | ★★★☆☆ | ★★★☆☆ | 了解：DocumentService+FolderTree+Upload |
| Settings | ★★★★★ | — | 完整：3层配置+Provider池+Crypto |
| User/Bootstrap | ★★★★★ | — | 完整：密码事务+超管引导锁 |
| Parser | ★★★★★ | — | 完整：策略模式+PDF三引擎链+StructureExtractor |
| Session | ★★★★★ | — | 完整：Repository模式 |
| Admin 后端 | ★★☆☆☆ | ★★☆☆☆ | 基础：用户管理+角色权限 |
| Frontend (Web/Admin) | ★★★★☆ | — | 完整：FSA+Zustand+alova+shadcn/AntDesign |
| Data Schema | ★★★★★ | — | 完整：16 Schema+Zod验证 |

### 延迟项目（边际收益低）

| # | 内容 | 跳过理由 |
|---|------|---------|
| c7-2 | Chat LLM Provider 工厂 | 仅1个实现（LlamaIndex），工厂模式 trivial |
| c7-6 | KB Document 生命周期 | CRUD 变体，架构已明确 |
| c7-7 | Prisma 迁移历史 | 历史 SQL 文件 |
| c7-8 | 架构演进文档 (ADR) | 历史背景，不影响当前代码理解 |

***

## 六、产出文件索引

| 文件 | 路径 | 说明 |
|------|------|------|
| Discovery Report | `docs/discovery-report.md` | 项目全局认知基线（v14） |
| Gap Backlog | `.trae/documents/spec-discovery/gap-backlog.md` | 原始 7 Unknown（全 Resolved） |
| Cycle 7 Gap Backlog | `.trae/documents/spec-discovery/gap-backlog-cycle7.md` | 第二轮 8 新 Unknown |
| Cycle 4 Backlog | `.trae/documents/spec-discovery/gap-backlog-cycle4.md` | RAG 深入（全 Resolved） |
| Cycle 6 Backlog | `.trae/documents/spec-discovery/gap-backlog-cycle6.md` | LangGraph+BGE（全 Resolved） |
| Harvest Round 12 | `.trae/documents/spec-discovery/harvest-round12.md` | Auth + LangChain 层 |
| Harvest Round 13 | `.trae/documents/spec-discovery/harvest-round13.md` | Common 中间件 + StreamFinalize |
| State File | `.trae/documents/spec-discovery/state.json` | 当前进度（Cycle 7, v14） |
