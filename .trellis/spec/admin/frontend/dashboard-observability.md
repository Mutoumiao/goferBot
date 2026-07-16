# Admin Dashboard / Observability 前端开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为
> [openspec/changes/admin-dashboard-observability/specs/admin-observability/spec.md](../../../../openspec/changes/admin-dashboard-observability/specs/admin-observability/spec.md)
> 与 [admin/spec.md](../../../../openspec/changes/admin-dashboard-observability/specs/admin/spec.md)（WHAT）。

---

## Purpose

指导 Admin 前端实现观测 Hub 与详页：分层、权限入口、KPI 三态展示、禁止假数、ops 控制台样式边界与测试。

## Primary OpenSpec

- `openspec/changes/admin-dashboard-observability/specs/admin-observability/spec.md`
- `openspec/changes/admin-dashboard-observability/specs/admin/spec.md`

## Related OpenSpec

- 权限码：`openspec/specs/admin/spec.md`（`dashboard:read`、`system:metrics`）

## Related Trellis Guides

- [rbac-guard-architecture.md](./rbac-guard-architecture.md)
- [hook-guidelines.md](./hook-guidelines.md) — `useQueryWithRetry`
- Server：[../../server/backend/admin-dashboard-observability.md](../../server/backend/admin-dashboard-observability.md)

## When You Need To

- 改 Hub/详页 UI 或 KPI 展示
- 接新 summary/observability 字段
- 加观测路由或菜单

## Module Dependencies

- alova（`api/dashboard.ts` 只定义 method，不在 api 层 `.send()`）
- Zustand auth permissions
- TanStack Router + `ROUTES_REGISTER`
- 共享类型 `@goferbot/data`（DashboardSummary / ObservabilityDetail / Kpi）

## Development Entry

| 层 | 路径 |
|----|------|
| API | `packages/admin/src/api/dashboard.ts` |
| Hub service | `packages/admin/src/features/dashboard/services.ts` |
| Hub UI | `packages/admin/src/features/dashboard/components/DashboardView.tsx` |
| 样式 | `packages/admin/src/features/dashboard/obs-console.css`（scoped `.obs-console`） |
| 详页 | `packages/admin/src/features/observability/` |
| 路由 | `packages/admin/src/routes/_authenticated/dashboard.tsx`、`observability/rag.tsx`、`observability/companion.tsx` |
| 注册表 | `packages/admin/src/router-register.ts`（`nav:false` + `SYSTEM_METRICS`） |
| 单测 | `packages/admin/src/features/dashboard/services.spec.ts` |
| E2E | `e2e/specs/admin-dashboard-observability.spec.ts`、`e2e/pages/AdminPage.ts` |

## Implementation Notes

### 分层约定

```
routes → features/*/services → api/* → alovaInstance
```

- `api/` **禁止** `.send()` 与 mock 业务
- 仅 `services.getDashboardSummary` 在 `VITE_USE_DASHBOARD_MOCK=== '1'` 时返回 fixture
- 默认路径：`fetchDashboardSummary(window).send()`，失败上抛

### KPI 展示

- 仅 `status===ready` 且有 `value` 时显示数值，否则 `—`
- 三态 + partial 用状态灯（`.obs-status`），不要用假百分比填充
- quality / 硬中断说明文案保留（观测型、不出现在聊天记录）

### 权限

- Hub「查看详情」：`permissions.includes(SYSTEM_METRICS)`
- 路由 `requiredPermission: SYSTEM_METRICS`，`nav: false`
- 无权限时隐藏入口；直链由 beforeLoad → 403

### UI 范围

- 观测视觉样式 **仅** `.obs-console` 作用域，不改全局 antd 主题
- 禁止恢复 StatCards / CPU 条 / 假环比组件

### 设计决策：ops 控制台视觉

- RAG 青绿轨、Companion 琥珀轨；等宽数字（IBM Plex Mono）
- 网格底纹 + 入场 stagger；规模条弱化

---

## Scenario: 前端观测数据流（跨层）

### 1. Scope / Trigger

- 跨层契约消费 summary/detail；权限与 mock 红线 → code-spec 深度。

### 2. Signatures

```typescript
getDashboardSummary(window?: ObservabilityWindow): Promise<DashboardSummary>
getRagObservability(window?): Promise<ObservabilityDetail>
getCompanionObservability(window?): Promise<ObservabilityDetail>

// HTTP
GET /admin/dashboard/summary?window=
GET /admin/observability/rag?window=
GET /admin/observability/companion?window=
```

### 3. Contracts

| Env | 说明 |
|-----|------|
| VITE_USE_DASHBOARD_MOCK | 仅 `1` 启用 fixture；生产勿设 |

响应类型以 `@goferbot/data` 为准，勿再使用废弃 `DashboardData` 经营假形状。

### 4. Validation & Error Matrix

| 条件 | UI |
|------|-----|
| API 网络/5xx | Alert 错误 + 重试；无 mock 顶替 |
| loading | aria-busy + 面板降饱和 |
| KPI pending / insufficient | 文案状态灯 + 数值 `—` |
| 无 system:metrics | 隐藏详情链接；直链 403 |

### 5. Good / Base / Bad

- **Good**：summary 200 → 健康条 + 双域 KPI；点详情进 RAG sections
- **Base**：空流量 → 多样本不足，界面仍诚实
- **Bad**：catch 后 `getMockData()`；无权限仍显示详情链

### 6. Tests Required

| 测试 | 断言 |
|------|------|
| services.spec | 成功透传；失败 reject；mock 仅 env=1 |
| E2E | 控制台文案、summary 200、无 CPU 环比、详情/pending |

### 7. Wrong vs Correct

#### Wrong

```typescript
export async function getDashboardData() {
  try {
    return await api.send()
  } catch {
    return { users: 999, cpu: 42 } // 假数
  }
}
```

#### Correct

```typescript
export async function getDashboardSummary(window = '24h') {
  if (import.meta.env.VITE_USE_DASHBOARD_MOCK === '1') return getDevMockSummary(window)
  return fetchDashboardSummary(window).send()
}
```

---

## Testing Checklist

- [ ] services 无静默 mock
- [ ] Hub 权限控制详情入口
- [ ] E2E 真实后端冒烟（`pnpm test:e2e:admin` 含本 spec）
- [ ] 文案保留：控制台、依赖健康、RAG、Companion、空结果率、硬中断率、规模（弱化）

## Common Pitfalls

1. 在 `api/` 层 `.send()` 或 mock → 违反 Admin 分层
2. 把「样本不足」改成假 0% 当成功 → 违反 OpenSpec
3. 观测路由忘记 `router-register` + `nav:false` + permission
4. 改 heading 文案破坏 E2E：优先正则 `/RAG|Companion/`

## Review Checklist

- [ ] 无经营假环比/CPU 主叙事
- [ ] mock 仅显式 env
- [ ] 样式不泄漏出 `.obs-console`
- [ ] 与 server 契约字段名一致（camelCase KPI keys）
