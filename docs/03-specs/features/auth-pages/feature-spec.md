# Feature Spec: 认证页面（登录 / 注册）

> 关联 issue: `docs/02-issues/f-01-auth-pages.md`
> 关联 ADR: `docs/05-adrs/0004-cloud-native-rearchitecture.md`
> 日期: 2026-05-16

---

## 1. 用户故事

### US-1 登录
作为已注册用户，我希望通过邮箱和密码登录，以便进入主界面使用问答和知识库功能。

### US-2 注册
作为新用户，我希望通过邮箱和密码注册账号，以便开始使用应用。

### US-3 错误反馈
作为用户，当我在登录或注册时输入了错误的邮箱格式、密码太短或 API 返回错误，我希望看到清晰的错误提示，以便修正输入。

### US-4 登录态持久化
作为已登录用户，我希望刷新页面后仍然保持登录状态，而不需要重新输入密码。

---

## 2. 范围

### 2.1 范围内（In Scope）

- 登录页面（`/login`）
- 注册页面（`/register`）
- 表单前端验证（邮箱格式、密码长度、确认密码一致）
- API 错误信息展示
- 登录成功后跳转到主界面（`/`）
- 注册成功后自动登录并跳转
- 使用 shadcn-vue 组件（Input、Button、Card、Label）
- 使用 Pinia auth store（`packages/webui/src/stores/auth.ts`）
- 登录态持久化（Access Token + Refresh Token 存储于 localStorage）

### 2.2 范围外（Out of Scope）

- OAuth 登录（Google / GitHub 等）
- 邮箱验证页面
- 密码重置页面
- "记住我"功能（Session Cookie 方式）
- 多因素认证（MFA）
- 用户头像上传

---

## 3. 涉及模块

| 模块 | 路径 | 职责 |
|------|------|------|
| LoginView | `packages/webui/src/views/LoginView.vue` | 登录页面 UI |
| RegisterView | `packages/webui/src/views/RegisterView.vue` | 注册页面 UI |
| Auth Store | `packages/webui/src/stores/auth.ts` | 认证状态管理、API 调用 |
| API Client | `packages/webui/src/api/client.ts` | HTTP 请求、401 自动刷新、错误解析 |
| Router | `packages/webui/src/router/index.ts` | 路由定义、导航守卫 |
| shadcn-vue 组件 | `packages/webui/src/components/ui/` | Input、Button、Card、Label 等基础 UI |

---

## 4. 已做决策（Decisions）

### DEC-1 认证方案：JWT + bcrypt
项目已从 Better Auth 迁移到自研 JWT 认证（i-09 + i-14 已完成）。前端不再使用 `better-auth/client`，直接通过 `api.post('/auth/login')` 和 `api.post('/auth/register')` 调用后端。

### DEC-2 Token 存储：localStorage
Access Token 和 Refresh Token 存储在 localStorage 中，key 分别为 `goferbot_access_token` 和 `goferbot_refresh_token`。API Client 自动附加 Authorization header，并在 401 时自动刷新。

### DEC-3 密码最小长度：6 位
虽然 issue 原始描述提到 8 位，但后端验证和当前 auth store 均按 6 位处理。前端统一使用 6 位作为最小长度提示。

### DEC-4 注册成功后自动登录
注册接口返回与登录相同的 `AuthResponse`（含 token 和 user），前端直接调用 `setTokens` 写入 store 并跳转，无需再次调用登录接口。

### DEC-5 页面布局：无侧边栏
登录和注册页面隐藏全局侧边栏（`meta: { hideSidebar: true }`），居中显示表单卡片。

---

## 5. 依赖与阻塞

- **依赖**: `b-01-auth-api`（后端认证 API 已就绪）
- **前置完成**: i-09（JWT 认证后端）、i-14（Auth Store 迁移）

---

## 6. 验收标准

- [ ] `LoginView.vue` 包含邮箱输入框、密码输入框、登录按钮、注册链接
- [ ] `RegisterView.vue` 包含邮箱输入框、密码输入框、确认密码输入框、注册按钮、登录链接
- [ ] 表单前端验证：邮箱格式正则校验、密码长度不少于 6 位、确认密码与密码一致
- [ ] API 错误信息正确显示在表单下方（如"邮箱或密码错误"、"用户已存在"）
- [ ] 登录成功后跳转到主界面（`/`）
- [ ] 注册成功后自动登录并跳转到主界面（`/`）
- [ ] 使用 shadcn-vue 的 Input、Button、Card、Label 组件
- [ ] 所有交互状态（empty / loading / error / success）均有视觉反馈
