---
issue: f-19
type: behavior-spec
status: completed
summary: 设置页 Tab 切换交互、登出流程
---

# f-19 行为规格

## 交互状态

### Tab 切换

- **默认**：进入设置页默认显示"模型设置" Tab
- **切换**：点击 Tab 标签切换内容区域，无页面跳转
- **激活态**：当前 Tab 标签高亮（白色背景 + 阴影），非激活 Tab 为透明背景

### 账户设置

- **正常**：显示用户邮箱和昵称（从 authStore.user 读取）
- **空值**：邮箱/昵称为空时显示 "—"
- **登出按钮**：红色边框轮廓按钮，hover 时背景变浅红

### 登出流程

- **点击登出**：调用 authStore.logout() → 清除 token → router.push({ name: 'login' })
- **登出中**：logout 内部 try-finally 保证 token 始终被清除
- **登出失败**：即使 API 调用失败，finally 块仍清除本地 token 并跳转

### 未保存提示

- **切换 Tab**：Tab 切换不改变路由，不需要离开拦截
- **离开页面**：如有未保存更改，由 onBeforeRouteLeave 拦截并弹窗确认
