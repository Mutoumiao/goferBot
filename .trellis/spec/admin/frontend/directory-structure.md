# 目录结构

> 本项目 Admin 前端代码的组织方式。

---

## 概述

Admin 前端采用 **Feature-Sliced Architecture (FSA)** 架构模式，按功能模块组织代码。核心技术栈：TanStack Start + React 19 + Ant Design 6.x + Pro Components + Tailwind CSS v4。

---

## 目录布局

```
packages/admin/src/
├── api/                      # alova HTTP 客户端封装（按资源分组）
│   ├── admin.ts              # 用户管理 API
│   ├── audit.ts              # 审计日志 API
│   ├── auth.ts               # 认证 API
│   ├── dashboard.ts          # 仪表盘 API
│   ├── rag.ts                # RAG API
│   ├── role.ts               # 角色权限 API
│   ├── session.ts            # 会话管理 API
│   └── system-config.ts      # 系统配置 API
├── components/               # UI 组件层（通用组件 + 布局组件）
│   ├── common/               # 通用组件（EmptyState、PageHeader、StatusTag）
│   ├── layout/               # 布局组件（AdminLayout、MenuConfig、PasswordChangeLayout）
│   ├── ConfigProvider.tsx    # Ant Design 主题配置
│   └── ForbiddenPage.tsx     # 权限不足页面
├── constants/                # 常量定义（权限常量等）
│   └── permissions.ts        # RBAC 权限常量
├── features/                 # 功能模块（按业务域分组）
│   ├── auth/                 # 认证模块
│   │   ├── components/       # 模块内组件（LoginForm、CaptchaInput）
│   │   ├── services.ts       # 模块业务逻辑
│   │   └── services.spec.ts  # 单元测试
│   ├── users/                # 用户管理模块
│   ├── roles/                # 角色权限模块
│   ├── sessions/             # 会话管理模块
│   ├── audit/                # 审计日志模块
│   ├── dashboard/            # 仪表盘模块
│   ├── profile/              # 个人资料模块
│   ├── model-providers/      # 模型提供商管理
│   ├── module-settings/      # 模块配置管理
│   └── rag-observability/    # RAG 可观测性
├── hooks/                    # 自定义 Hook
│   ├── useQueryWithRetry.ts  # 带重试的数据查询 Hook
│   └── useQueryWithRetry.spec.ts
├── lib/                      # 工具库
│   └── utils.ts              # 通用工具函数（cn 等）
├── routes/                   # TanStack Router 路由
│   ├── _authenticated/       # 认证路由组
│   │   ├── users/$id.tsx     # 用户详情
│   │   ├── roles/$id.tsx     # 角色详情
│   │   ├── sessions/$id.tsx  # 会话详情
│   │   ├── users.tsx         # 用户列表
│   │   ├── roles.tsx         # 角色列表
│   │   ├── sessions.tsx      # 会话列表
│   │   ├── audit.tsx         # 审计日志
│   │   ├── dashboard.tsx     # 仪表盘
│   │   ├── profile.tsx       # 个人资料
│   │   ├── model-providers.tsx
│   │   ├── module-settings.tsx
│   │   ├── rag-observability.tsx
│   │   └── change-password.tsx
│   ├── __root.tsx            # 根路由
│   ├── _authenticated.tsx    # 认证守卫路由
│   ├── forbidden.tsx         # 禁止访问页面
│   ├── index.tsx             # 首页重定向
│   └── login.tsx             # 登录页
├── stores/                   # Zustand 全局状态
│   ├── auth.ts               # 认证状态（user、isAuthenticated）
│   ├── auth.spec.ts          # 认证状态测试
│   └── settings.ts           # 设置状态（外观等）
├── utils/                    # 工具函数
│   ├── auth-guard.ts         # 权限守卫工具
│   ├── auth-token.ts         # Token 管理工具
│   ├── confirm-action.tsx    # 确认操作弹窗
│   ├── error-mapper.ts       # 错误映射工具
│   ├── password.ts           # 密码验证工具
│   ├── password-encryption.ts
│   └── server.ts             # alova 实例配置
├── globals.css               # 全局样式（Tailwind CSS v4）
├── routeTree.gen.ts          # 路由树自动生成
├── router-register.ts        # 路由常量注册
└── router.tsx                # 路由配置入口
```

---

## 模块组织

### 新增模块流程

1. 在 `features/` 下创建新目录（如 `features/new-module/`）
2. 创建 `components/` 子目录存放模块内组件
3. 创建 `services.ts` 存放业务逻辑和 API 调用
4. 在 `api/` 下创建对应的 API 封装文件
5. 在 `routes/_authenticated/` 下创建路由文件
6. 在 `constants/permissions.ts` 中添加权限常量
7. 在 `components/layout/MenuConfig.tsx` 中添加菜单配置

### 模块内部结构

```
features/module-name/
├── components/               # 模块专属组件
│   ├── ModuleList.tsx        # 列表组件
│   ├── ModuleForm.tsx        # 表单组件
│   └── ModuleDetail.tsx      # 详情组件
├── services.ts               # 业务逻辑封装（调用 api/ + 错误处理 + toast）
└── services.spec.ts          # 单元测试
```

---

## 命名约定

| 类型 | 规则 | 示例 |
|------|------|------|
| 目录 | kebab-case | `features/user-management/` |
| 文件 | kebab-case | `user-table.tsx` |
| 组件 | PascalCase | `UserTable`, `AdminLayout` |
| Hook | useCamelCase | `useQueryWithRetry` |
| Store | camelCase + store 后缀 | `auth.ts`, `settings.ts` |
| API 函数 | camelCase | `listUsers`, `createUser` |
| 路由文件 | kebab-case | `users.tsx`, `change-password.tsx` |

---

## 示例

**组织良好的模块示例**: [users](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/users/)
- 清晰的分层：components + services
- 完整的 CRUD 操作封装
- 统一的错误处理模式（toast + error-mapper）