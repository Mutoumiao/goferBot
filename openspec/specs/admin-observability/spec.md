# Admin Observability - 管理后台观测

## Purpose（目的）

定义 Admin 观测域业务规则：控制台 Hub 摘要、RAG/Companion 二级观测页、时间窗、KPI 就绪状态与禁止假数。编码约定见 `.trellis/spec/server/backend/admin-dashboard-observability.md` 与 `.trellis/spec/admin/frontend/dashboard-observability.md`。

**实现证据**：
- `packages/data/src/schemas/dashboard.schema.ts` — Zod 契约与聚合口径常量
- `packages/server/src/modules/admin/dashboard.controller.ts`
- `packages/server/src/modules/admin/observability.controller.ts`
- `packages/server/src/modules/admin/services/dashboard-observability.service.ts`
- `packages/admin/src/features/dashboard/`
- `packages/admin/src/features/observability/`
- `packages/admin/src/api/dashboard.ts`
- 迁移：`packages/server/prisma/migrations/20260716120000_companion_obs_event/`

## Requirements（需求）

### Requirement: 观测枢纽 Hub 摘要

系统 MUST 为具备 `dashboard:read` 的管理员提供观测枢纽摘要。默认时间窗 MUST 为近 24 小时；查询参数 `window` MUST 仅允许 `1h` | `24h` | `7d`。Hub 数据 MUST 来自聚合 API `GET /admin/dashboard/summary`（全局前缀下为 `/api/admin/dashboard/summary`），MUST NOT 依赖生产环境虚构 mock 统计。

#### Scenario: Hub 默认窗口与结构

- **WHEN** 管理员请求 Hub 摘要且未指定 window
- **THEN** 系统 MUST 使用 `window=24h`
- **AND** 响应 MUST 包含 `health`、`rag`、`companion`、`inventory`、`window`、`generatedAt`
- **AND** `generatedAt` MUST 为 ISO-8601 时间戳

#### Scenario: Hub 健康条

- **WHEN** 管理员查看 Hub 健康信息
- **THEN** 系统 MUST 返回合成状态（`ok` | `degraded` | `down`）及组件列表（至少覆盖 Postgres、Redis、MinIO；Knowledge AI 在探测范围内 MUST 纳入）
- **AND** Knowledge AI 不可达而核心依赖仍可用时，合成状态 MUST 为 `degraded` 而非静默当作 ok
- **AND** 核心依赖（非 Knowledge AI）任一下线时，合成状态 MUST 为 `down`
- **AND** MUST NOT 以虚构的 CPU/内存/磁盘百分比作为健康权威指标

#### Scenario: Hub RAG 黄金指标

- **WHEN** 管理员查看 Hub 的 RAG 区块
- **THEN** 系统 MUST 暴露 KPI 槽位：`emptyRate`（检索空结果率）、`degradedRate`（降级率）、`indexFailureCount`（索引失败数）
- **AND** 每个 KPI MUST 带 `status`：`ready` | `pending_instrumentation` | `insufficient_samples`
- **AND** 仅当 `status=ready` 时 MUST 提供可展示数值 `value`
- **AND** 达到扫描上限时 KPI MAY 带 `partial=true`（部分样本）

#### Scenario: Hub Companion 黄金指标

- **WHEN** 管理员查看 Hub 的 Companion 区块
- **THEN** 系统 MUST 暴露 KPI 槽位：`p95LatencyMs`、`qualityFailRate`、`safetyHardStopRate`、`negativeFeedbackRate`
- **AND** 每个 KPI MUST 带同上 `status` 语义
- **AND** 文案或字段说明 MUST 标明 quality 为观测型（不表示主回复被丢弃）
- **AND** safety 硬中断率在侧信道事件存储查询失败时 MUST 为 `pending_instrumentation`，MUST NOT 从「未落库的硬中断」助手消息臆造

#### Scenario: Hub 规模弱化展示

- **WHEN** 管理员查看 Hub
- **THEN** 系统 MUST 提供 inventory：`userCount`、`knowledgeBaseCount`、`documentCount`、`companionCount`
- **AND** MUST NOT 要求周环比增长百分比作为 SHALL

#### Scenario: 禁止生产假数

- **WHEN** 聚合查询失败或指标尚未埋点
- **THEN** 系统 MUST 返回错误或对应 KPI `pending_instrumentation` / `insufficient_samples`
- **AND** 生产配置下 MUST NOT 静默用虚构业务统计替换真实响应
- **AND** 前端开发 fixture 仅当显式 `VITE_USE_DASHBOARD_MOCK=1` 时允许

### Requirement: 聚合口径写死

系统 MUST 按下列口径计算比率与计数（与 `@goferbot/data` 中文档常量语义一致）：

| 指标 | 分子 | 分母 / 过滤 |
|------|------|-------------|
| 负反馈率 | `rating=negative` 的反馈数 | 时间窗内反馈总数 `feedbackCount` |
| 硬中断率 | `type=safety_hard_stop` 的侧信道事件数 | 时间窗内 Companion **用户消息**数 |
| 空结果率 | 助手消息 `metadata.retrieval_empty===true` | 时间窗内 completed 助手消息扫描样本数 |
| 降级率 | 助手消息 `metadata.degraded===true` | 同上样本数 |
| 索引失败数 | — | `Document.status=failed` 且 `updatedAt` ∈ 时间窗 |
| P95 延迟 | — | 时间窗内助手 metadata `latencyMs` 样本排序近似 P95 |

#### Scenario: 分母为零

- **WHEN** 某一比率指标分母为 0（无样本/无反馈/无用户消息）
- **THEN** 对应 KPI `status` MUST 为 `insufficient_samples`
- **AND** MUST NOT 返回虚构比率

#### Scenario: 索引失败为计数型

- **WHEN** 管理员请求索引失败数
- **THEN** KPI MUST 在可查询 Document 表时为 `ready`，`value` 为非负整数（可为 0）
- **AND** MUST NOT 因「无失败文档」标为 `insufficient_samples`

### Requirement: RAG 二级观测页

系统 MUST 为具备 `system:metrics` 的管理员提供 RAG 观测详页 API `GET /admin/observability/rag`；响应 MUST 符合稳定外壳：`window`、`generatedAt`、`kpis`、`sections`（至少含 `index`、`retrieve`、`quality_deps`）。

#### Scenario: 无权限拒绝

- **WHEN** 仅有 `dashboard:read` 而无 `system:metrics` 的主体请求 RAG 观测 API
- **THEN** 系统 MUST 拒绝（403）

#### Scenario: 分块与待接入

- **WHEN** 管理员打开 RAG 观测详页
- **THEN** 各 section MUST 带 `status`（`ready` | `pending_instrumentation` | `partial`）
- **AND** 无数源时 MUST 为 `pending_instrumentation`，MUST NOT 伪造时间序列
- **AND** 依赖健康异常时 `quality_deps` MUST 可为 `partial`，MUST NOT 标为虚假的全量 ready

### Requirement: Companion 二级观测页

系统 MUST 为具备 `system:metrics` 的管理员提供 Companion 观测详页 API `GET /admin/observability/companion`；响应 MUST 符合稳定外壳：`window`、`generatedAt`、`kpis`、`sections`（至少含 `latency`、`retrieval`、`emotion`、`cost_safety`）。

#### Scenario: 四块结构与一期检索

- **WHEN** 管理员打开 Companion 观测详页
- **THEN** 响应 MUST 能映射到延迟、检索质量、情绪、成本与安全四类 section
- **AND** 一期在 Companion 主路径未接知识检索时，`retrieval` section MUST 为 `pending_instrumentation`，MUST NOT 伪造检索质量数
- **AND** 一期无 token 成本数据时，成本相关 metric MUST 为 `pending_instrumentation`

#### Scenario: 情绪仅详页

- **WHEN** 管理员仅查看 Hub
- **THEN** Hub MUST NOT 将情绪分布作为黄金 KPI 强制展示
- **AND** 情绪分布 MUST 可在 Companion 详页 `emotion` section 提供（当 metadata 可聚合时）

### Requirement: 前端路由与入口

Admin 前端 MUST 提供 Hub 路由 `/dashboard` 与观测详页路由 `/observability/rag`、`/observability/companion`；详页路由 MUST 要求 `system:metrics`。

#### Scenario: 详情入口按权限

- **WHEN** 当前用户无 `system:metrics`
- **THEN** Hub 仍 MUST 可展示其有权查看的摘要 KPI
- **AND** 「查看详情」入口 MUST 隐藏或导航至 403

#### Scenario: 一期导航

- **WHEN** 一期交付观测详页
- **THEN** 系统 MUST 允许从 Hub 进入详页
- **AND** MUST NOT 要求必须在主导航展示观测分组
- **AND** 直链访问详页时权限守卫 MUST 仍生效

### Requirement: 聚合性能边界

系统对消息 metadata 等可能全表扫描的聚合 MUST 施加时间窗，并 MUST 支持样本上限与超时保护，避免拖垮 Admin API。

#### Scenario: 样本过多

- **WHEN** 时间窗内消息量超过实现配置的扫描上限（默认 10000，可由环境变量覆盖）
- **THEN** 系统 MUST 在上限内聚合并可将 KPI/section 标为 `partial`
- **AND** MUST NOT 无界全表扫描直至超时拖垮进程

#### Scenario: 扫描超时

- **WHEN** metadata 聚合超过实现配置的超时阈值
- **THEN** 系统 MUST 降级返回（如 KPI 样本不足 / section partial）并记录警告日志
- **AND** MUST NOT 因单次超时拖垮整个 Admin 进程
