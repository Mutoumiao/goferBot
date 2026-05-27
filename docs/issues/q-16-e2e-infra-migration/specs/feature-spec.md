# q-16 功能规格

## 概述

重构 E2E 测试基础设施，从 Tauri 桌面应用 + Mock API 模式迁移为纯 Web SaaS 真实 API 测试模式。

## 功能需求

### FR-01: 删除 Tauri E2E
- 删除 `tests/e2e-full/` 目录
- 删除 `tests/e2e/setup.ts` 中的 Tauri 相关代码（如存在）
- 清理 package.json 中 Tauri 相关的 E2E 脚本

### FR-02: Playwright 配置重构
- `globalSetup` 启动 docker 基础设施（`pnpm infra:up`）
- `webServer` 使用 `concurrently` 同时启动 `pnpm dev:server` 和 `pnpm dev:web`
- `baseURL` 指向 `http://localhost:1420`
- 支持 `reuseExistingServer` 开发模式
- 端口占用时自动检测并报错

### FR-03: API Client Fixture
- 封装 `fetch` 直接调用 `http://localhost:3000/api`
- 支持认证头注入
- 提供常用 API 辅助：创建用户、创建 KB、上传文件等

### FR-04: Database Cleanup Fixture
- 每个 spec 前执行 TRUNCATE 清理测试数据（用户、KB、会话、消息、设置）
- 或复用 `TestDatabaseManager` 为每个 spec 创建独立数据库
- 优先方案：单一 E2E 数据库 + `beforeEach` TRUNCATE（更快）

### FR-05: Auth Fixture
- 真实调用 `POST /api/auth/public-key` 获取公钥
- RSA-OAEP 加密密码
- 调用 `POST /api/auth/register` 注册
- 调用 `POST /api/auth/login` 登录
- 将 token 注入 localStorage

### FR-06: 环境配置
- 新增 `.env.e2e` 文件
- 定义 `E2E_DATABASE_URL` 指向独立数据库（如 `goferbot_e2e`）
- 定义 `PORT=3000` 和前端端口
- 后端启动时加载 `.env.e2e`

## 非功能需求

- E2E 测试总运行时间 < 5 分钟
- 支持 CI/CD 无头模式运行
- 测试失败自动截图/录像
- 并行 issue 测试数据隔离（用户名/KB 名加时间戳）
