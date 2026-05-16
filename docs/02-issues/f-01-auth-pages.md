状态: needs-triage
分类: enhancement

## 要构建的内容

实现前端登录页和注册页，包含表单验证、错误提示、登录态持久化。

## 规格引用

- 功能规格: docs/03-specs/features/auth-system/feature-spec.md
- 行为规格: docs/03-specs/features/auth-system/behavior-spec.md
- API 规格: docs/03-specs/features/auth-system/api-spec.md

## 验收标准

- [ ] `packages/webui/src/views/LoginView.vue` 登录页：邮箱输入框、密码输入框、登录按钮、跳转到注册链接
- [ ] `packages/webui/src/views/RegisterView.vue` 注册页：邮箱、密码、确认密码、注册按钮、跳转到登录链接
- [ ] 表单前端验证：邮箱格式、密码长度（最少 8 位）、确认密码一致
- [ ] 错误提示：API 返回的错误信息正确显示（如"邮箱或密码错误"）
- [ ] 登录成功后跳转到主界面（问答首页）
- [ ] 注册成功后自动登录并跳转
- [ ] 使用 Better Auth Client (`better-auth/client`) 调用后端 API
- [ ] `packages/webui/src/stores/auth.ts` Pinia Store 管理登录态
- [ ] 登录态持久化：刷新页面后仍保持登录（依赖 Session Cookie）
- [ ] 页面样式使用 shadcn-vue 组件（Input、Button、Card、Label）

## 阻塞于

- b-01-auth-api（需要认证 API 就绪）

## 范围外

- OAuth 登录按钮（后续扩展）
- 邮箱验证页面
- 密码重置页面
- 记住我功能（Session Cookie 已处理）

## Agent 简报

**分类：** enhancement
**摘要：** 前端登录页和注册页，含表单验证和登录态管理

**当前行为：**
前端无认证页面，无法登录或注册。

**期望行为：**
用户可在登录页和注册页完成认证流程，登录态通过 Pinia Store 管理，刷新不丢失。

**关键接口：**
- `packages/webui/src/views/LoginView.vue` — 登录页
- `packages/webui/src/views/RegisterView.vue` — 注册页
- `packages/webui/src/stores/auth.ts` — 认证 Store
- Better Auth Client — `signIn.email`、`signUp.email`、`signOut`、`getSession`

**验收标准：**
- [ ] 登录页包含邮箱、密码、登录按钮、注册链接
- [ ] 注册页包含邮箱、密码、确认密码、注册按钮、登录链接
- [ ] 表单前端验证（邮箱格式、密码长度、确认密码一致）
- [ ] API 错误信息正确显示
- [ ] 登录成功跳转主界面
- [ ] 注册成功自动登录并跳转
- [ ] 使用 Better Auth Client 调用 API
- [ ] Pinia Store 管理登录态
- [ ] 登录态刷新不丢失
- [ ] 使用 shadcn-vue 组件

**范围外：**
- OAuth 登录按钮
- 邮箱验证页面
- 密码重置页面
- 记住我功能
