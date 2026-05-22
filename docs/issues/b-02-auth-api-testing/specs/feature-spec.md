# 功能规格：AuthController 测试

## 用户故事
作为后端开发者，我希望 AuthController 拥有完整的模块级集成测试和 HTTP E2E 测试，以便在重构或新增功能时确保认证链路不回归。

## 边界
- 范围内：
  - AuthController 6 个端点的模块级集成测试（register / login / logout / refresh / me / public-key）
  - Auth 核心链路 HTTP E2E 测试（注册 → 登录 → me → 刷新 → 登出）
  - error cases：400（Zod 验证失败 / 解密失败 / 密码规则失败）、401（无效 token）、404（登录凭证错误）、409（邮箱已存在）
- 范围外：
  - UserService 的单元测试（已在 user 模块覆盖）
  - PasswordEncryptionService 的单元测试（已在 crypto 模块覆盖）
  - JWT Strategy 的独立测试（属于中间件层，不在本 issue 范围）
  - 前端登录 UI 测试

## 涉及模块
- `packages/server/src/auth/auth.controller.ts`
- `packages/server/src/auth/auth.service.ts`
- `packages/server/src/auth/crypto/password-encryption.service.ts`

## 相关功能
- i-01 测试基础设施 — 提供 TestModule 工厂、DB 清理、E2E app 启动器
- b-03 DocumentController 测试 — 复用本 issue 建立的 `loginAs` helper

## 已做决策
| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 模块级测试使用 `Test.createTestingModule` + 真实 DB | 验证 Controller + Service + DB 完整链路，比纯单元测试更有价值 | 是 |
| E2E 测试使用 `supertest` + NestJS 应用实例 | 验证 HTTP 层、全局拦截器、异常过滤器、路由前缀 | 是 |
| `loginAs` helper 内部自动获取公钥并加密密码 | 前端使用 RSA-OAEP 加密，测试必须模拟真实加密流程 | 否（除非前端改方案） |
| 测试数据统一使用 `test-*@example.com` 邮箱 | 避免与真实用户数据冲突，便于清理 | 是 |
