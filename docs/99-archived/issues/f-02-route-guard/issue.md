---
id: f-02-route-guard
type: issue
status: closed
track: frontend
priority: p0
summary: 实现路由守卫：未登录用户自动跳转到登录页，已登录用户访问登录页自动跳转到主界面。认证状态与路由联动，启动时检查登录态。
blocked_by: [f-01-auth-pages]
blocks: []
spec: docs/03-specs/f-02-route-guard/
plan: docs/04-plans/f-02-route-guard/v1.md
tests: docs/08-test-cases/f-02-route-guard/
token_estimate: 900
---

状态: needs-triage
分类: enhancement

## 要构建的内容

实现路由守卫：未登录用户自动跳转到登录页，已登录用户访问登录页自动跳转到主界面。

## 规格引用

- 功能规格: docs/03-specs/b-01-auth-api/feature-spec.md
- 行为规格: docs/03-specs/b-01-auth-api/behavior-spec.md
- API 规格: docs/03-specs/b-01-auth-api/api-spec.md

## 验收标准

- [ ] `packages/webui/src/router/guards.ts` 实现 `authGuard` 路由守卫
- [ ] 未登录用户访问任何需要认证的页面 → 自动跳转到 `/login`
- [ ] 已登录用户访问 `/login` 或 `/register` → 自动跳转到 `/`
- [ ] 应用启动时检查登录态：调用 `getSession()` 验证 Session Cookie 是否有效
- [ ] 登录态检查完成前显示加载状态（避免闪烁）
- [ ] 路由守卫应用到所有需要认证的路由（除登录、注册外）
- [ ] 守卫逻辑与 Pinia auth store 联动

## 阻塞于

- f-01-auth-pages（需要 auth store 和登录页）

## 范围外

- 基于角色的路由控制（RBAC）
- 登录过期自动刷新 Token
- 多设备登录管理

## Agent 简报

**分类：** enhancement
**摘要：** 路由守卫：未登录跳转登录页，已登录禁止访问登录页

**当前行为：**
前端无路由守卫，所有页面公开访问。

**期望行为：**
认证状态与路由联动，未登录无法进入主界面，已登录无需重复登录。

**关键接口：**
- `packages/webui/src/router/guards.ts` — 路由守卫
- `getSession()` — 启动时验证登录态
- Pinia auth store — 登录态来源

**验收标准：**
- [ ] 实现 `authGuard` 路由守卫
- [ ] 未登录访问认证页面 → 跳转登录页
- [ ] 已登录访问登录/注册页 → 跳转首页
- [ ] 启动时检查登录态
- [ ] 检查完成前显示加载状态
- [ ] 守卫应用到所有需要认证的路由
- [ ] 与 Pinia auth store 联动

**范围外：**
- 基于角色的路由控制
- Token 自动刷新
- 多设备登录管理
