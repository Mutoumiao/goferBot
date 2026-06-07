# 行为规格：鉴权流程端到端迁移

> 状态：draft | 关联 issue：f-33

---

## 1. 登录页面交互

### 1.1 表单状态

| 事件 | 前置条件 | 行为 | 后置状态 |
|------|----------|------|----------|
| 页面加载 | — | 显示空表单：email 输入框 + password 输入框 + 登录按钮 + 注册链接 | idle |
| 输入 email | 焦点在 email 输入框 | 输入值实时更新 | dirty |
| 输入 password | 焦点在 password 输入框 | 输入值遮罩显示 | dirty |
| 点击登录按钮 | email 和 password 均非空 | 调用 `send({ email, password })` | loading |
| 点击登录按钮 | email 或 password 为空 | 表单验证提示"请填写完整" | error（客户端验证） |
| 登录请求中 | loading=true | 按钮显示 spinner + "登录中..."，输入框 disabled | loading |
| 登录成功 | 后端返回 AuthResponse | 调用 `setAuth(user, token)` → `router.navigate('/app')` | success |
| 登录失败 401 | 后端返回 401 | 显示"邮箱或密码错误" | error |
| 登录失败 网络 | fetch 抛出 | 显示"网络错误，请重试" + 重试按钮 | error |
| 点击重试 | 处于 error 态 | 重新调用 `send()` | loading |
| 按 Enter | 焦点在表单内任一输入框 | 触发登录（同点击登录按钮） | loading |
| Token 已有效 | 访问 /login | 自动跳转 `/app`（由路由守卫或页面内检查处理） | redirect |

### 1.2 错误场景

| 场景 | 触发条件 | 用户可见 |
|------|----------|----------|
| 邮箱格式错误 | `loginRequestSchema` 校验失败 | "请输入有效的邮箱地址" |
| 密码过短 | 密码 < 6 字符 | "密码至少 6 个字符" |
| 后端 401 | 凭证错误 | "邮箱或密码错误" |
| 后端 500 | 服务端异常 | "服务器错误，请稍后重试" |
| 网络超时 | 30s 超时 | "请求超时，请检查网络连接" |
| Token 刷新失败 | refresh 接口返回 401 | 清除 Token → 跳转 /login |
| 并发 401 | 多个请求同时 401 | 只调一次 refresh，其他排队等待 |

---

## 2. 注册页面交互

| 事件 | 前置条件 | 行为 | 后置状态 |
|------|----------|------|----------|
| 页面加载 | — | 显示注册表单 | idle |
| 点击注册按钮 | 表单有效 | 调用 `send()` 注册 → 成功后自动登录跳转 | success |
| 邮箱已存在 | 后端返回 409 | 显示"该邮箱已注册" | error |

---

## 3. Token 刷新时序

```
请求 A → 401
  → 设置 isRefreshing = true
  → 调 POST /api/auth/refresh
      ├─ 成功 → isRefreshing = false
      │         → refreshSubscribers.forEach(fn => fn(newToken))
      │         → 用新 Token 重试请求 A
      │         → 请求 A 返回结果给调用方
      └─ 失败 → isRefreshing = false
                → refreshSubscribers = []
                → clearAuth()
                → window.location.href = '/login'

请求 B（并发）→ 401
  → 检测 isRefreshing = true
  → 加入 refreshSubscribers 队列
  → refresh 成功后获得新 Token
  → 用新 Token 重试请求 B
```

---

## 4. 路由守卫时序

```
用户访问 /app/chat
  → beforeLoad 执行
  → 检查 localStorage.getItem('goferbot_access_token')
      ├─ null → throw redirect({ to: '/login' })
      └─ 存在 → 继续渲染 /app/chat
  → 页面内请求 /api/chat/history
      └─ 若 Token 过期 → 触发 Token 刷新机制（§3）
```

---

## 5. 测试映射

| AC | 测试场景 | 测试文件 |
|----|----------|----------|
| AC-01 | alova beforeRequest 注入 Token | `tests/unit/web/alova-instance.spec.ts` |
| AC-02 | Token 刷新队列：401→refresh→重放 | `tests/unit/web/token-refresh.spec.ts` |
| AC-03 | packages/data/ zod schema 编译通过 | 类型检查 |
| AC-04 | api/auth.ts 类型推断正确 | 类型检查 |
| AC-05 | auth Store setAuth/clearAuth + 持久化 | `tests/unit/web/auth-store.spec.ts` |
| AC-06 | /login 表单三态（loading/error/success） | `tests/unit/web/login-page.spec.tsx` |
| AC-07 | /register 表单可用 | `tests/unit/web/register-page.spec.tsx` |
| AC-08 | 未认证用户访问 /app → 302 | E2E 或集成测试 |
| AC-09 | 刷新页面鉴权状态保留 | E2E 或手动测试 |
