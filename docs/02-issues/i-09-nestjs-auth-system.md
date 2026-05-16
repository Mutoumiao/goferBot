状态: completed
分类: enhancement

## 要构建的内容

基于 NestJS + JWT + bcrypt 的认证系统，替换 Better Auth。

## 背景

架构决策从 Better Auth 迁移到 JWT + bcrypt（ADR-0004 更新）。基于 nest-template 的 AuthGuard 模式实现。

## 验收标准

- [ ] `src/modules/auth/auth.module.ts` — AuthModule
- [ ] `src/modules/auth/auth.controller.ts` — 认证控制器
  - `POST /api/auth/login` — 登录，返回 `{ accessToken, refreshToken }`
  - `POST /api/auth/register` — 注册
  - `POST /api/auth/refresh` — 刷新 Token
  - `GET /api/auth/me` — 获取当前用户信息
- [ ] `src/modules/auth/auth.service.ts` — 认证服务
  - `validateUser(email, password)` — 验证用户（bcrypt compare）
  - `login(user)` — 生成 JWT
  - `register(dto)` — 创建用户（bcrypt hash）
  - `refresh(token)` — 刷新 Access Token
- [ ] `src/modules/auth/dto/login.dto.ts` — LoginDto（Zod schema）
- [ ] `src/modules/auth/dto/register.dto.ts` — RegisterDto（Zod schema）
- [ ] `src/common/guards/auth.guard.ts` — JWT AuthGuard（CanActivate）
- [ ] `src/common/decorators/current-user.decorator.ts` — 获取当前用户装饰器
- [ ] `src/modules/user/user.module.ts` — UserModule（用户管理）
- [ ] `src/modules/user/user.service.ts` — UserService（CRUD）
- [ ] `.env.example` 包含 `JWT_SECRET`、`JWT_ACCESS_EXPIRES`、`JWT_REFRESH_EXPIRES`
- [ ] `pnpm type-check` 通过
- [ ] curl 测试：注册 → 登录 → 获取 me → 刷新

## 阻塞于

- i-08-nestjs-server-setup（需要 NestJS 模块结构）
- i-02-prisma-setup（需要 User 表）

## 范围外

- OAuth 登录（后续扩展）
- 邮箱验证
- 密码重置
- RBAC 角色权限

## Agent 简报

**分类：** enhancement
**摘要：** NestJS JWT 认证系统（登录/注册/刷新/守卫）

**当前行为：**
Better Auth 集成遇到问题，需替换。

**期望行为：**
完整的 JWT 认证流程，基于 bcrypt 密码哈希，AuthGuard 保护路由。

**关键接口：**
- `POST /api/auth/login` — 登录
- `POST /api/auth/register` — 注册
- `POST /api/auth/refresh` — 刷新
- `GET /api/auth/me` — 当前用户
- `AuthGuard` — 路由守卫

**验收标准：**
- [ ] 登录/注册/刷新 API
- [ ] JWT 生成和验证
- [ ] bcrypt 密码哈希
- [ ] AuthGuard 守卫
- [ ] CurrentUser 装饰器
- [ ] type-check 通过
- [ ] curl 测试通过

**范围外：**
- OAuth
- 邮箱验证
- 密码重置
- RBAC
