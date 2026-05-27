# q-16 功能规格

## 概述

重构 E2E 测试基础设施，从 Tauri 桌面应用 + Mock API 模式迁移为纯 Web SaaS 真实 API 测试模式。

## 功能需求

### FR-01: 删除 Tauri E2E
- 删除 `tests/e2e-full/` 目录
- 删除 `tests/e2e/setup.ts` 中的 Tauri 相关代码（如存在）
- 清理 package.json 中 Tauri 相关的 E2E 脚本

### FR-02: Playwright 配置重构
- `webServer` 同时启动 `pnpm dev:server` 和 `pnpm dev:web`
- 或分别启动基础设施（docker）+ 后端 + 前端
- `baseURL` 指向 `http://localhost:1420`
- 支持 `reuseExistingServer` 开发模式

### FR-03: API Client Fixture
- 封装 `fetch` 直接调用 `http://localhost:3000/api`
- 支持认证头注入
- 提供常用 API 辅助：创建用户、创建 KB、上传文件等

### FR-04: Database Cleanup Fixture
- 每个 spec 前清理测试数据
- 或每个 spec 使用独立数据库
- 复用现有 `TestDatabaseManager` 或新建 E2E 专用清理逻辑

### FR-05: Auth Fixture
- 真实调用 `POST /api/auth/public-key` 获取公钥
- RSA-OAEP 加密密码
- 调用 `POST /api/auth/register` 注册
- 调用 `POST /api/auth/login` 登录
- 将 token 注入 localStorage

## 非功能需求

- E2E 测试总运行时间 < 5 分钟
- 支持 CI/CD 无头模式运行
- 测试失败自动截图/录像
