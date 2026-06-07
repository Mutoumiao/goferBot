# 前端迁移检查清单

> 用于 GoferBot Vue → React 迁移的逐项验证。
> 整理日期：2026-06-05

---

## 阶段一：基建搭建

### 项目初始化

- [ ] 创建 `packages/web` 目录
- [ ] 运行 `npm create @tanstack/start@latest --tailwind --add-ons shadcn`
- [ ] 配置 `vite.config.ts`（代理、别名、Tailwind）
- [ ] 更新 `pnpm-workspace.yaml`（`packages/*` 已覆盖全部项目）
- [ ] 安装额外依赖（zustand、@tanstack/react-query、lucide-react）
- [ ] 配置路径别名 `@/` 指向 `app/`
- [ ] 验证 `pnpm dev:web` 正常启动
- [ ] 验证代理 `/api` 转发到 `localhost:3000`
- [ ] 验证热更新（HMR）正常工作

### 共享代码迁移

- [ ] 迁移 `lib/utils.ts`（`cn` 函数）
- [ ] 迁移 `types/index.ts`
- [ ] 迁移 `api/client.ts`（HTTP 客户端）
- [ ] 迁移全局样式（Tailwind 变量、自定义 CSS）
- [ ] 验证类型检查通过

---

## 阶段二：核心能力

### 根路由与布局

- [ ] 创建 `app/routes/__root.tsx`
- [ ] 配置全局 Head（meta、stylesheet、favicon）
- [ ] 配置错误边界（`errorComponent`）
- [ ] 配置 404 页面（`notFoundComponent`）
- [ ] 创建 `app/routes/app/route.tsx`（认证布局）
- [ ] 实现 `beforeLoad` 鉴权守卫
- [ ] 验证未认证用户被重定向到 `/login`

### 状态管理

- [ ] 创建 `app/stores/auth.ts`（Zustand）
- [ ] 实现 `init`（恢复 token）
- [ ] 实现 `login`（调用 API + 存储 token）
- [ ] 实现 `logout`（清除 token）
- [ ] 实现 `fetchMe`（获取用户信息）
- [ ] 配置持久化（localStorage）
- [ ] 验证状态在刷新后保持

### Overlay 系统

- [ ] 创建 `app/overlays/` 目录结构（dialogs, context-menus, host, services, hooks, types）
- [ ] 安装 shadcn/ui Dialog 组件
- [ ] 安装 shadcn/ui DropdownMenu 组件
- [ ] 实现 OverlayHost（React Portal + Zustand Store）
- [ ] 实现 `openDialog()` / `openContextMenu()` 服务
- [ ] 实现 `useDialog()` / `useContextMenu()` hooks
- [ ] 迁移 Vue 的 `DialogBaseProps` / `ContextMenuBaseProps` 类型
- [ ] 验证路由切换时关闭所有 Overlay
- [ ] 验证页面刷新时清理 Overlay
- [ ] 验证命令式调用与 Vue 版本行为一致

---

## 阶段三：页面迁移

### 登录页 `/login`

- [ ] 创建 `app/routes/login.tsx`
- [ ] 迁移登录表单（邮箱 + 密码）
- [ ] 集成 Zod 表单验证
- [ ] 集成密码加密逻辑
- [ ] 错误提示（邮箱不存在、密码错误等）
- [ ] 登录成功后跳转 `/app/chat`
- [ ] 已登录用户访问 `/login` 重定向到 `/app/chat`
- [ ] 验证与后端 API 连通

### 注册页 `/register`

- [ ] 创建 `app/routes/register.tsx`
- [ ] 迁移注册表单（邮箱 + 密码 + 确认密码）
- [ ] 集成 Zod 表单验证
- [ ] 错误提示（邮箱已存在等）
- [ ] 注册成功后自动登录
- [ ] 验证与后端 API 连通

### Chat 页 `/app/chat`

- [ ] 创建 `app/routes/app/chat.tsx`
- [ ] 迁移侧边栏（对话列表）
- [ ] 迁移消息列表组件
- [ ] 迁移消息输入框
- [ ] 迁移消息气泡（用户 / AI）
- [ ] 迁移 Markdown 渲染
- [ ] 迁移代码高亮
- [ ] 迁移 SSE 流式接收
- [ ] 迁移历史记录加载
- [ ] 迁移新建对话
- [ ] 迁移删除对话
- [ ] 验证消息发送 / 接收正常
- [ ] 验证流式输出正常

### KnowledgeBase 页 `/app/knowledge-base`

- [ ] 创建 `app/routes/app/knowledge-base.tsx`
- [ ] 迁移文档列表
- [ ] 迁移文档上传
- [ ] 迁移文档删除
- [ ] 迁移文档详情
- [ ] 验证文件上传正常

### History 页 `/app/history`

- [ ] 创建 `app/routes/app/history.tsx`
- [ ] 迁移历史记录列表
- [ ] 迁移搜索 / 筛选
- [ ] 验证数据加载正常

### Settings 页 `/app/settings`

- [ ] 创建 `app/routes/app/settings.tsx`
- [ ] 迁移配置表单
- [ ] 迁移未保存提示（`beforeunload` + 路由守卫）
- [ ] 验证配置保存正常

### RecycleBin 页 `/app/recycle-bin`

- [ ] 创建 `app/routes/app/recycle-bin.tsx`
- [ ] 迁移回收站列表
- [ ] 迁移恢复 / 彻底删除
- [ ] 验证功能正常

---

## 阶段四：UI 组件库

### shadcn/ui 替换

- [ ] 梳理 `packages/webui/src/components/ui/` 下所有组件
- [ ] 安装 shadcn/ui 对应组件
- [ ] 替换 Button
- [ ] 替换 Input
- [ ] 替换 Dialog
- [ ] 替换 DropdownMenu
- [ ] 替换 Tabs
- [ ] 替换 Table
- [ ] 替换 Form（结合 react-hook-form）
- [ ] 替换 Toast
- [ ] 替换 Tooltip
- [ ] 替换 Popover
- [ ] 替换 Select
- [ ] 替换 Checkbox / Radio
- [ ] 替换 Textarea
- [ ] 替换 Avatar
- [ ] 替换 Badge
- [ ] 替换 Card
- [ ] 替换 Sheet
- [ ] 替换 Skeleton
- [ ] 替换 Separator
- [ ] 替换 ScrollArea
- [ ] 替换 Collapsible
- [ ] 替换 Accordion
- [ ] 替换 Breadcrumb
- [ ] 替换 Pagination
- [ ] 替换 Slider
- [ ] 替换 Switch
- [ ] 替换 Calendar / DatePicker
- [ ] 替换 Command
- [ ] 替换 ContextMenu
- [ ] 替换 HoverCard
- [ ] 替换 Menubar
- [ ] 替换 NavigationMenu
- [ ] 替换 Progress
- [ ] 替换 Resizable
- [ ] 替换 Toggle / ToggleGroup
- [ ] 验证所有组件样式正确
- [ ] 验证暗色模式（如支持）

---

## 阶段五：测试与打磨

### 单元测试

- [ ] 配置 Vitest + React Testing Library
- [ ] 迁移 `lib/utils.ts` 测试
- [ ] 迁移 `api/client.ts` 测试
- [ ] 迁移 auth store 测试
- [ ] 迁移组件测试（至少核心组件）
- [ ] 验证 `pnpm test` 通过

### E2E 测试

- [ ] 更新 Playwright 配置
- [ ] 更新选择器（Vue → React）
- [ ] 验证登录流程
- [ ] 验证聊天流程
- [ ] 验证页面导航
- [ ] 验证 `pnpm test:e2e` 通过

### 类型检查

- [ ] 运行 `pnpm type-check`
- [ ] 修复所有类型错误
- [ ] 确保无 `any` 滥用

### 构建验证

- [ ] 运行 `pnpm build`
- [ ] 验证产物无错误
- [ ] 验证产物体积合理
- [ ] 验证产物可部署

### 清理

- [ ] 删除 `packages/webui`
- [ ] 更新根 `package.json` scripts
- [ ] 更新 README
- [ ] 更新环境变量文档
- [ ] 提交迁移总结

---

## 通用检查项

### 性能

- [ ] 首屏加载时间 ≤ Vue 版本
- [ ] 构建产物体积 ≤ Vue 版本 + 10%
- [ ] 无内存泄漏（特别是 SSE 连接）
- [ ] 路由切换流畅

### 可访问性

- [ ] 表单有正确的 label
- [ ] 按钮有正确的 aria-label
- [ ] 颜色对比度符合 WCAG 2.1
- [ ] 键盘导航正常

### 安全

- [ ] XSS 防护（DOMPurify 迁移）
- [ ] CSRF Token 处理
- [ ] 敏感信息不暴露在前端

---

## 风险项跟踪

| 风险 | 状态 | 备注 |
|------|------|------|
| TanStack Start 生态资料少 | ⏳ | 优先使用稳定功能 |
| shadcn/ui 组件 API 差异 | ⏳ | 逐个验证 |
| 迁移周期过长 | ⏳ | 按页面逐个替换 |
| 测试覆盖率下降 | ⏳ | 同步迁移测试 |
| BlockNote 集成复杂度 | ⏳ | Chat 迁移完成后评估 |

---

## 完成标准

- [ ] 所有页面功能正常
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] 构建成功
- [ ] 旧代码已清理
- [ ] 文档已更新
- [ ] 团队评审通过
