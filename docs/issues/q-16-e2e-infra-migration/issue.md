---
id: q-16
status: open
track: quality
priority: p1
summary: 重构 E2E 测试基础设施，废弃 Tauri 方案，建立真实 API 的 Web E2E 体系
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

将现有两套 E2E 体系（Mock 前端 E2E + Tauri 桌面 E2E）重构为统一的 Web SaaS 真实 API E2E 测试基础设施。

包含：
- 删除 `tests/e2e-full/` 目录及相关 Tauri 配置
- 重构 `tests/e2e/playwright.config.ts`，配置 webServer 同时启动前后端
- 创建 `fixtures/api-client.ts` — 直接 HTTP 调用后端 API 的辅助工具
- 创建 `fixtures/database.ts` — E2E 测试数据清理钩子
- 创建 `fixtures/auth.ts` — 真实注册/登录流程，获取 JWT Token
- 更新 `package.json` 中的 E2E 测试脚本

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 项目已从 Tauri 桌面应用彻底迁移为纯 Web SaaS
- 所有 E2E 测试必须走真实后端 API，禁止使用 `page.route()` mock
- LLM 外部调用仍需 mock（避免消耗真实 API Key）
- 数据库使用独立 E2E 数据库，每个 spec 前清理数据
- 前端运行在 `localhost:1420`，后端运行在 `localhost:3000`
