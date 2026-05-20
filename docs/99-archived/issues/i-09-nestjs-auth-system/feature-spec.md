---
issue_id: i-09-nestjs-auth-system
type: feature-spec
status: approved
summary: 基于 NestJS + JWT + bcrypt 的认证系统，支持邮箱注册/登录、Access/Refresh 双 Token 机制、Token 刷新轮换、登出及当前用户查询，提供 JwtAuthGuard 和 @CurrentUser() 装饰器。
---
# NestJS Auth System — 功能规格

> 对应 issue: `i-09-nestjs-auth-system`
> 依赖: `i-08-nestjs-server-setup`, `i-02-prisma-setup`
> 对齐安全基线: `i-10-nestjs-security`
> 关联前端: `i-14-jwt-api-client`

---

## 1. 目标

为 GoferBot 提供基于 NestJS + JWT + bcrypt 的认证能力，支持注册、登录、Token 刷新、登出和当前用户信息查询，并为后续所有业务 API 提供统一的 JWT 认证守卫。

---

## 2. 范围

### 2.1 范围内（MVP）

- 邮箱 + 密码注册与登录
- Access Token + Refresh Token 双 Token 机制
- Token 刷新（Refresh Token 轮换）
- 登出（Refresh Token 失效）
- 获取当前用户信息
- NestJS JWT 认证守卫（`JwtAuthGuard`）
- `@CurrentUser()` 装饰器
- Zod DTO 校验（`nestjs-zod`）
- bcrypt 密码哈希（cost factor 12）

### 2.2 范围外（后续扩展）

- OAuth 登录（GitHub / Google 等）
- 邮箱验证
- 密码重置
- 角色权限系统（RBAC）
- MFA / 设备绑定 / 异常登录检测

---

## 3. 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 认证框架 | `@nestjs/passport` + `passport-jwt` | NestJS 标准 JWT 策略 |
| Token 生成 | `@nestjs/jwt` | 基于 `jsonwebtoken`，支持 sign/verify |
| 密码哈希 | `bcrypt` | cost factor 12 |
| 输入验证 | `nestjs-zod` | Zod schema 管道校验 |
| 数据库 | Prisma 5 | 用户表、Refresh Token 表 |
| 响应格式 | 统一拦截器 `{ data }` | 由 `i-10-nestjs-security` 提供 |
| 错误格式 | 全局异常过滤器 | 由 `i-10-nestjs-security` 提供 |

---

## 4. 架构设计

### 4.1 模块结构

```
packages/server/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts          # AuthModule：导入 JwtModule、UserModule
│   │   │   ├── auth.controller.ts      # AuthController：5 个端点
│   │   │   ├── auth.service.ts         # AuthService：注册/登录/刷新/密码哈希
│   │   │   ├── dto/
│   │   │   │   ├── login.dto.ts        # LoginDto（Zod schema）
│   │   │   │   └── register.dto.ts     # RegisterDto（Zod schema）
│   │   │   ├── guards/
│   │   │   │   └── jwt.guard.ts        # JwtAuthGuard（@Injectable()）
│   │   │   └── strategies/
│   │   │       └── jwt.strategy.ts     # JwtStrategy（PassportStrategy）
│   │   └── user/
│   │       ├── user.module.ts          # UserModule
│   │       ├── user.service.ts         # UserService（CRUD / findByEmail）
│   │       └── user.controller.ts      # UserController（可选，内部使用）
│   ├── common/
│   │   └── decorators/
│   │       └── current-user.decorator.ts  # @CurrentUser() 装饰器
│   └── main.ts                         # 全局启用 ValidationPipe
├── .env.example                        # JWT_SECRET, JWT_ACCESS_EXPIRES, JWT_REFRESH_EXPIRES
```

### 4.2 认证流程

#### 4.2.1 注册流程

```
[前端] POST /api/auth/register
              body: { email, password, name? }
                  ↓
[后端] ZodValidationPipe 校验输入
                  ↓
       AuthService.register(dto)
                  ↓
       查询 users 表：email 是否已存在？
           ├─ 是 → 抛出 ConflictException(409)
           └─ 否 → bcrypt.hash(password, 12) → 创建用户记录
                  ↓
       生成 accessToken + refreshToken
                  ↓
       将 refreshToken 哈希后存入 refresh_tokens 表
                  ↓
       返回 201 { data: { user, accessToken, refreshToken } }
```

#### 4.2.2 登录流程

```
[前端] POST /api/auth/login
              body: { email, password }
                  ↓
[后端] ZodValidationPipe 校验输入
                  ↓
       AuthService.validateUser(email, password)
                  ↓
       查询 users 表：email 是否存在？
           ├─ 否 → 抛出 UnauthorizedException(401)
           └─ 是 → bcrypt.compare(password, hash)
                  ↓
              密码是否匹配？
           ├─ 否 → 抛出 UnauthorizedException(401)
           └─ 是 → 生成 accessToken + refreshToken
                  ↓
       将 refreshToken 哈希后存入 refresh_tokens 表
                  ↓
       返回 200 { data: { user, accessToken, refreshToken } }
```

#### 4.2.3 刷新 Token 流程

```
[前端] POST /api/auth/refresh
              body: { refreshToken }
                  ↓
[后端] ZodValidationPipe 校验输入
                  ↓
       AuthService.refresh(token)
                  ↓
       查询 refresh_tokens 表：token 是否存在且未过期？
           ├─ 否 → 抛出 UnauthorizedException(401)
           └─ 是 → bcrypt.compare(refreshToken, storedHash)
                  ↓
              是否匹配？
           ├─ 否 → 抛出 UnauthorizedException(401)
           └─ 是 → 删除旧 refreshToken（轮换）
                  ↓
       生成新的 accessToken + refreshToken
                  ↓
       将新 refreshToken 哈希后存入 refresh_tokens 表
                  ↓
       返回 200 { data: { accessToken, refreshToken } }
```

#### 4.2.4 登出流程

```
[前端] POST /api/auth/logout
              Authorization: Bearer <accessToken>
              body: { refreshToken }
                  ↓
[后端] JwtAuthGuard 验证 accessToken
                  ↓
       从 refresh_tokens 表中删除该 refreshToken
                  ↓
       返回 200 { data: { success: true } }
```

#### 4.2.5 获取当前用户流程

```
[前端] GET /api/auth/me
              Authorization: Bearer <accessToken>
                  ↓
[后端] JwtAuthGuard 验证 accessToken
                  ↓
       从 JWT payload 提取 userId
                  ↓
       查询 users 表获取用户信息
                  ↓
       返回 200 { data: { id, email, name, avatar, createdAt } }
```

### 4.3 数据模型

#### 4.3.1 Prisma Schema（用户表）

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  password      String    // bcrypt 哈希值
  name          String?
  avatar        String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(uuid())
  tokenHash String   // bcrypt 哈希后的 refreshToken
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}
```

> 注：`password` 字段在 Prisma schema 中必须存在（MVP 要求）。`refresh_tokens` 表支持 Token 轮换和多设备登录。

---

## 5. 接口对齐

### 5.1 与 `i-10-nestjs-security` 的关系

- `i-10` 提供全局安全设施（`ResponseInterceptor`、`AllExceptionsFilter`、`ZodValidationPipe`、`ThrottlerGuard`）。
- `i-09` 的认证端点复用这些设施，并叠加 `@SkipThrottle()` 或自定义限速配置。
- 认证端点独立限速：**5 req/min/IP**（由 `@nestjs/throttler` 配置）。

### 5.2 与 `i-14-jwt-api-client` 的关系

- `i-09` 定义 JWT 响应格式（`{ accessToken, refreshToken }`）。
- `i-14` 前端客户端消费这些 Token，实现自动刷新和 Authorization Header 注入。

### 5.3 与 `i-02-prisma-setup` 的关系

- `i-02` 提供 PrismaService 和数据库连接。
- `i-09` 的 `UserService` / `AuthService` 依赖 `PrismaService` 进行用户和 Refresh Token 的 CRUD。

---

## 6. 安全要求（对齐 i-10-nestjs-security）

1. **速率限制**：认证端点（`/api/auth/login`, `/api/auth/register`）独立限速 **5 次/分钟/IP**，防止暴力破解。
2. **密码策略**：最小长度 8 位，Zod schema 校验；bcrypt cost factor 12。
3. **Token 安全**：
   - Access Token 短期有效（默认 15 分钟）
   - Refresh Token 长期有效（默认 7 天），存储 bcrypt 哈希值
   - Refresh Token 轮换：每次刷新生成新 Token，旧 Token 立即失效
4. **错误响应**：任何认证错误统一返回 `{ error: { code, message } }`，不暴露内部堆栈、数据库细节或用户是否存在。
5. **JWT Payload**：仅包含 `sub`（userId）和 `email`，不包含敏感信息。
6. **登出**：删除数据库中的 Refresh Token 记录，使 Token 失效。

---

## 7. 验收标准

- [ ] `src/modules/auth/auth.module.ts` — AuthModule，导入 JwtModule、PassportModule、UserModule
- [ ] `src/modules/auth/auth.controller.ts` — AuthController，5 个端点
  - `POST /api/auth/register` — 注册，返回 `{ user, accessToken, refreshToken }`
  - `POST /api/auth/login` — 登录，返回 `{ user, accessToken, refreshToken }`
  - `POST /api/auth/refresh` — 刷新 Token，返回 `{ accessToken, refreshToken }`
  - `POST /api/auth/logout` — 登出
  - `GET /api/auth/me` — 获取当前用户信息
- [ ] `src/modules/auth/auth.service.ts` — AuthService
  - `validateUser(email, password)` — bcrypt compare
  - `login(user)` — 生成双 Token
  - `register(dto)` — 创建用户（bcrypt hash）
  - `refresh(token)` — 验证并轮换 Refresh Token
  - `logout(userId, refreshToken)` — 删除 Refresh Token
- [ ] `src/modules/auth/dto/login.dto.ts` — LoginDto（Zod schema，nestjs-zod）
- [ ] `src/modules/auth/dto/register.dto.ts` — RegisterDto（Zod schema，nestjs-zod）
- [ ] `src/modules/auth/guards/jwt.guard.ts` — JwtAuthGuard（`@Injectable()`，继承 `AuthGuard('jwt')`）
- [ ] `src/modules/auth/strategies/jwt.strategy.ts` — JwtStrategy（`PassportStrategy(Strategy)`）
- [ ] `src/common/decorators/current-user.decorator.ts` — `@CurrentUser()` 装饰器
- [ ] `src/modules/user/user.module.ts` — UserModule
- [ ] `src/modules/user/user.service.ts` — UserService（`findByEmail`, `findById`, `create`）
- [ ] `.env.example` 包含 `JWT_SECRET`、`JWT_ACCESS_EXPIRES`、`JWT_REFRESH_EXPIRES`
- [ ] `pnpm type-check` 通过
- [ ] curl 测试：注册 → 登录 → 获取 me → 刷新 → 登出
