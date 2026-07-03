# Admin 前端开发指南索引

> **Purpose**：本索引是 Admin 管理后台前端开发的导航中枢。Trellis 记录"如何开发"（HOW），OpenSpec 记录"系统是什么"（WHAT）。
> AI Agent 在此找到对应的开发指南；如需业务规则（19 权限码、3 预置角色集、三层守卫编排流等），请按下方映射跳转 OpenSpec 权威源。

---

## 通用开发指南

> 适用于 Admin 前端所有模块的开发约定。

| 指南 | 描述 |
|------|------|
| [目录结构](./directory-structure.md) | Admin FSA 架构、目录布局 |
| [组件指南](./component-guidelines.md) | Ant Design 6.x 组件用法、ProComponents 模式 |
| [Hook 指南](./hook-guidelines.md) | useQueryWithRetry 核心 Hook 实现模式 |
| [状态管理](./state-management.md) | Admin Zustand + alova 分层集成模式 |
| [质量指南](./quality-guidelines.md) | 禁止模式、测试要求、代码审查清单 |
| [类型安全](./type-safety.md) | 类型组织、Zod 验证、Biome 配置 |

---

## 模块开发指南

> 每个业务模块的开发指南（Module Development Guide），含 10 个章节：Purpose / Primary OpenSpec / Related OpenSpec / Module Dependencies / Development Entry / Implementation Notes / Testing Checklist / Review Checklist / Common Pitfalls / Reusable Patterns。
>
> **重要**：业务规则（19 权限码、3 预置角色集、三层守卫编排、mustChangePassword 流、Token 刷新订阅者队列业务行为）不在 Trellis 中。请查阅对应 OpenSpec capability spec.md。

| 模块 | Trellis 开发指南 | OpenSpec 权威源 |
|------|-----------------|----------------|
| Admin RBAC 守卫 | [rbac-guard-architecture.md](./rbac-guard-architecture.md) | [openspec/specs/admin/spec.md](../../../openspec/specs/admin/spec.md) + [openspec/specs/auth/spec.md](../../../openspec/specs/auth/spec.md) |

---

## Progressive Knowledge Loading 流程

当你要实现/调试某个 Admin 前端功能时：

1. **第一步**：在上方"模块开发指南"找到对应模块 → 阅读其 Trellis Development Guide
2. **第二步**：若需业务规则（权限码、角色集、守卫编排流）→ 点击该指南顶部"Primary OpenSpec"链接跳转
3. **第三步**：若涉及跨模块依赖 → 沿"Related OpenSpec"链接跳转

**示例流程**：实现新的权限保护路由
↓
读 `rbac-guard-architecture.md`（开发指南：beforeLoad 模式、ROUTES_REGISTER 登记）
↓
读 `openspec/specs/admin/spec.md`（19 权限码定义、三层守卫编排业务流）
↓
若涉及 Token 刷新
↓
读 `openspec/specs/auth/spec.md`（订阅者队列业务行为）

---

## OpenSpec 相关 capability 索引

Admin 前端涉及的 OpenSpec 业务规范（按需查阅，不要预加载）：

- [admin](../../../openspec/specs/admin/spec.md) — 19 权限码、3 预置角色集、三层守卫编排、管理员认证、用户/角色/审计管理
- [auth](../../../openspec/specs/auth/spec.md) — Token 自动刷新订阅者队列、mustChangePassword 流
- [user](../../../openspec/specs/user/spec.md) — 用户角色定义、Super Admin
- [settings](../../../openspec/specs/settings/spec.md) — 系统配置业务规则

---

**语言**：所有文档使用**简体中文**编写。
