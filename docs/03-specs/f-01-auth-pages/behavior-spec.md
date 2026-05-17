---
issue_id: f-01-auth-pages
type: behavior-spec
status: approved
summary: 定义登录页与注册页的入口路由、初始状态与 idle/loading/error/success 四种交互状态流转，覆盖表单校验、API 请求、错误提示及跳转逻辑。
---
# Behavior Spec: 认证页面（登录 / 注册）

> 关联 issue: `docs/02-issues/f-01-auth-pages.md`
> 关联 feature spec: `docs/03-specs/f-01-auth-pages/feature-spec.md`
> 日期: 2026-05-16

---

## 1. 入口

| 页面 | 路由 | 组件 | meta |
|------|------|------|------|
| 登录页 | `/login` | `LoginView.vue` | `hideSidebar: true`, `requiresAuth: false` |
| 注册页 | `/register` | `RegisterView.vue` | `hideSidebar: true`, `requiresAuth: false` |

---

## 2. 初始状态

### 2.1 登录页（LoginView）

- 邮箱输入框：空，placeholder 为 "请输入邮箱"
- 密码输入框：空，placeholder 为 "请输入密码"，类型为 password（隐藏输入）
- 登录按钮：文案 "登录"，可用状态
- 底部文字："还没有账号？去注册"，链接跳转到 `/register`
- 无错误提示
- 无 loading 状态

### 2.2 注册页（RegisterView）

- 邮箱输入框：空，placeholder 为 "请输入邮箱"
- 密码输入框：空，placeholder 为 "请输入密码"，类型为 password
- 确认密码输入框：空，placeholder 为 "请再次输入密码"，类型为 password
- 注册按钮：文案 "注册"，可用状态
- 底部文字："已有账号？去登录"，链接跳转到 `/login`
- 无错误提示
- 无 loading 状态

---

## 3. 交互状态表

### 3.1 登录页状态机

| 状态 | 触发条件 | UI 表现 |
|------|----------|---------|
| **empty** | 页面首次加载或用户清空输入 | 输入框无红色边框；错误提示隐藏；按钮可用 |
| **validating** | 用户点击登录按钮 | 对邮箱和密码进行前端校验 |
| **loading** | 前端校验通过，调用 `authStore.login()` | 按钮显示 loading spinner，按钮禁用，输入框禁用 |
| **error** | 前端校验失败 或 API 返回错误 | 按钮恢复可用，对应字段下方显示错误文案，输入框变红（`border-destructive`） |
| **success** | API 返回 200，token 已写入 store | 按钮禁用，短暂显示成功提示（可选），1s 内跳转到 `/` |

### 3.2 注册页状态机

| 状态 | 触发条件 | UI 表现 |
|------|----------|---------|
| **empty** | 页面首次加载或用户清空输入 | 同登录页 |
| **validating** | 用户点击注册按钮 | 对邮箱、密码、确认密码进行前端校验 |
| **loading** | 前端校验通过，调用 `authStore.register()` | 按钮显示 loading spinner，按钮禁用，输入框禁用 |
| **error** | 前端校验失败 或 API 返回错误 | 按钮恢复可用，对应字段下方或表单顶部显示错误文案，输入框变红 |
| **success** | API 返回 200，token 已写入 store | 同登录页，跳转到 `/` |

---

## 4. 正常流程

### 4.1 登录流程

```
用户打开 /login
    ↓
填写邮箱和密码
    ↓
点击"登录"按钮
    ↓
前端校验通过？
    ├─ 否 → 显示字段级错误，停留在当前页
    ↓ 是
调用 authStore.login({ email, password })
    ↓
API 返回 200
    ↓
token 写入 localStorage，user 写入 store
    ↓
路由跳转到 /
```

### 4.2 注册流程

```
用户打开 /register
    ↓
填写邮箱、密码、确认密码
    ↓
点击"注册"按钮
    ↓
前端校验通过？
    ├─ 否 → 显示字段级错误，停留在当前页
    ↓ 是
调用 authStore.register({ email, password })
    ↓
API 返回 200
    ↓
token 写入 localStorage，user 写入 store
    ↓
路由跳转到 /
```

---

## 5. 错误场景

### 5.1 前端校验规则

| 字段 | 规则 | 错误文案 |
|------|------|----------|
| 邮箱 | 必填；符合邮箱正则 `^[^\s@]+@[^\s@]+\.[^\s@]+$` | "请输入有效的邮箱地址" |
| 密码 | 必填；最少 6 个字符 | "密码长度不能少于 6 位" |
| 确认密码 | 必填；必须与密码一致 | "两次输入的密码不一致" |

### 5.2 校验时机

- 点击提交按钮时进行全量校验（`onSubmit`）。
- 字段级错误在用户修正该字段后即时清除（`onInput` 或 `onBlur` 时若当前值合法则清除错误）。

### 5.3 API 错误处理

| 场景 | HTTP 状态 | 预期错误文案 | 显示位置 |
|------|-----------|--------------|----------|
| 邮箱或密码错误 | 401 | "邮箱或密码错误" | 表单顶部通用错误区 |
| 用户不存在 | 401 | "邮箱或密码错误"（模糊化） | 表单顶部通用错误区 |
| 用户已存在 | 409 | "该邮箱已被注册" | 表单顶部通用错误区 |
| 后端验证失败 | 400 | 取 API 返回的 `message` 字段 | 表单顶部通用错误区 |
| 网络错误 | 无网络 | "网络异常，请稍后重试" | 表单顶部通用错误区 |
| 服务器错误 | 500 | "服务器繁忙，请稍后重试" | 表单顶部通用错误区 |

### 5.4 错误显示规范

- 通用错误（API / 网络 / 服务器）显示在表单卡片内、按钮上方的区域。
- 字段级错误（前端校验）显示在对应输入框下方，使用 `text-destructive` 颜色。
- 输入框在错误状态下添加 `border-destructive` 类。
- 错误信息在用户再次点击提交前保持显示；提交新请求时清空旧错误。

---

## 6. 组件与样式规范

### 6.1 使用的 shadcn-vue 组件

| 组件 | 用途 |
|------|------|
| `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` | 表单卡片容器 |
| `Label` | 输入框标签 |
| `Input` | 邮箱、密码、确认密码输入 |
| `Button` | 登录 / 注册按钮 |

### 6.2 布局

- 页面整体垂直水平居中（`min-h-screen flex items-center justify-center`）。
- 卡片最大宽度 `w-full max-w-md`。
- 背景使用 `bg-surface-1` 或默认背景色。

### 6.3 按钮状态

- 默认：主色填充（`variant="default"`）。
- Loading：显示 `Loader2` 图标旋转动画，按钮文字变为 "登录中..." / "注册中..."，按钮禁用。
- 禁用：透明度降低，不可点击。

---

## 7. 与 Auth Store 的交互

### 7.1 登录页调用

```ts
const authStore = useAuthStore()

async function handleLogin() {
  // 前端校验...
  try {
    await authStore.login({ email: email.value, password: password.value })
    router.push('/')
  } catch (e) {
    // 错误已由 store 写入 authStore.error，页面直接读取展示
  }
}
```

### 7.2 注册页调用

```ts
async function handleRegister() {
  // 前端校验...
  try {
    await authStore.register({ email: email.value, password: password.value })
    router.push('/')
  } catch (e) {
    // 同上
  }
}
```

### 7.3 Store 状态绑定

- 按钮 loading 状态绑定 `authStore.isLoading`。
- 通用错误信息绑定 `authStore.error`。
- 提交新请求前手动清空 `authStore.error = null`（避免旧错误残留）。

---

## 8. 路由守卫（关联行为）

虽然路由守卫的实现不在本 feature 范围内，但认证页面需配合以下行为：

- 已登录用户访问 `/login` 或 `/register` 时，应自动重定向到 `/`。
- 未登录用户访问需要认证的页面时，重定向到 `/login`。

---

## 9. 无障碍（A11y）

- 所有输入框必须关联 `<Label htmlFor="...">`，`Input` 设置对应 `id`。
- 按钮在 loading 状态时添加 `aria-busy="true"`。
- 错误信息使用 `role="alert"` 或 `aria-live="polite"` 播报。

---

## 10. 验收清单

- [ ] 登录页：邮箱、密码、登录按钮、注册链接均存在且功能正常
- [ ] 注册页：邮箱、密码、确认密码、注册按钮、登录链接均存在且功能正常
- [ ] 邮箱格式错误时显示 "请输入有效的邮箱地址"
- [ ] 密码少于 6 位时显示 "密码长度不能少于 6 位"
- [ ] 确认密码不一致时显示 "两次输入的密码不一致"
- [ ] API 401 错误显示 "邮箱或密码错误"
- [ ] API 409 错误显示 "该邮箱已被注册"
- [ ] 登录成功后 1s 内跳转到 `/`
- [ ] 注册成功后自动登录并跳转到 `/`
- [ ] loading 状态下按钮禁用且显示 spinner
- [ ] 使用 shadcn-vue 的 Card、Input、Button、Label 组件
- [ ] 页面在移动端（< 640px）正常显示，无横向滚动
