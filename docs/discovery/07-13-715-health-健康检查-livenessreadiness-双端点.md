# GoferBot Discovery Report

## 7. 复杂模块

### 7.15 Health 健康检查 — Liveness/Readiness 双端点

**数据来源**：[health.controller.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/health/health.controller.ts)、[health.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/health/health.service.ts)

| 端点 | 类型 | 行为 |
|------|------|------|
| `GET /health` | Liveness（存活） | 立即返回 `{status:"ok", timestamp, version}`，无外部依赖 |
| `GET /health/ready` | Readiness（就绪） | 并行探针 Postgres + Redis + MinIO，每探针 2500ms 超时 |

**探针状态分类**：

| 结果 | 状态 | 判定 |
|------|------|------|
| 成功 | `ok` | 正常 |
| 超时（timeout after 2500ms） | `degraded` | 降级（服务仍可用但性能下降） |
| 非超时错误（连接拒绝/认证失败） | `down` | 不可用 |

**整体状态聚合**：任一 `down` → `down`；无 `down` 但任一 `degraded` → `degraded`；全 `ok` → `ok`

**实现细节**：使用 `Promise.race(fn(), timeout)` 实现超时控制；错误详情从响应的 `components` 中剥离（仅记录日志），防止泄露内部信息。
