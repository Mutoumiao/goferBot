# q-16 行为规格：E2E 测试基础设施

## 入口

- 触发：运行 `pnpm test:e2e` 或 `pnpm test:e2e:ui`
- 配置文件：`tests/e2e/playwright.config.ts`

## 初始状态

- 若 docker 基础设施未启动：`globalSetup` 自动执行 `pnpm infra:up`
- 若前后端未运行：`webServer` 自动启动 `pnpm dev:server` + `pnpm dev:web`
- 若前后端已在运行（`reuseExistingServer: true`）：复用现有进程，跳过启动
- 浏览器打开 `http://localhost:1420`
- 测试串行执行（`workers: 1`），避免共享数据库状态冲突

## 交互状态

| 状态 | 视觉/日志 | 用户操作 | 系统响应 |
|------|-----------|----------|----------|
| starting | 控制台显示 "docker compose up" | 等待 | 启动 postgres/minio/redis |
| ready | 控制台显示 "Server running on :3000" | 等待 | Playwright 开始执行测试 |
| running | 测试用例逐条执行 | 观察 | 浏览器自动化操作页面 |
| passed | 绿色对勾，无报错 | 查看报告 | 生成 HTML 报告到 `tests/e2e/report/` |
| failed | 红色叉号，错误堆栈 | 查看截图/录像 | 自动保存到 `test-results/` 或 `playwright-report/` |
| partial | 部分通过部分失败 | 查看失败详情 | 重试失败项或修复后重跑 |
| skipped | 某些测试标记 skip | 检查跳过原因 | 补充前置条件后重跑 |
| timeout | 测试超时（默认 30s，可配置） | 重试 | 按 `testTimeout` 配置重试 |
| teardown | 全部完成后 | 等待 | `globalTeardown` 关闭 docker（CI 模式）|

## 正常流程

| 步骤 | 系统操作 | 预期状态 | 验证点 |
|------|----------|----------|--------|
| 1 | globalSetup 执行 `pnpm infra:up` | docker 容器健康 | `pg_isready` 通过 |
| 2 | webServer 启动后端 `pnpm dev:server` | NestJS 监听 3000 | `GET /api/health` 返回 200 |
| 3 | webServer 启动前端 `pnpm dev:web` | Vite 监听 1420 | 页面可访问 |
| 4 | Playwright 打开浏览器 | chromium 启动 | `baseURL` 可达 |
| 5 | beforeEach 清理数据库 | TRUNCATE 完成 | 无残留测试数据 |
| 6 | beforeEach 创建测试用户 | 注册+登录完成 | localStorage 含 token |
| 7 | 执行测试用例 | 页面交互正常 | API 返回真实数据 |
| 8 | afterEach 截图（失败时） | 截图保存 | 文件存在于 debug/ |
| 9 | 全部完成生成报告 | HTML 报告生成 | 可浏览器打开查看 |

## 错误场景

| 场景 | 触发 | 表现 | 恢复 |
|------|------|------|------|
| 端口占用 | 3000/1420 被开发进程占用 | webServer 启动失败报错 | 关闭开发进程或切换端口 |
| 数据库未启动 | docker 未运行或 postgres 故障 | globalSetup 超时失败 | 运行 `pnpm infra:up` 手动启动 |
| 后端编译错误 | NestJS 代码有 TS 错误 | dev:server 启动失败 | 修复编译错误 |
| 前端编译错误 | Vue 代码有错误 | dev:web 启动失败 | 修复编译错误 |
| 测试数据污染 | beforeEach 未正确清理 | 测试间数据冲突 | 检查 database.ts 清理逻辑 |
| LLM API 未 mock | 外部 API 被真实调用 | 消耗 API Key / 超时 | 确保 `page.route()` 拦截 |
| docker 残留 | globalTeardown 未执行 | 下次启动端口冲突 | 手动 `pnpm infra:down` |

## 测试映射

| 交互状态 | 测试文件 | 测试用例 |
|----------|----------|----------|
| starting | `tests/issues/q-16-e2e-infra-migration/infra.spec.ts` | `it('globalSetup starts docker infrastructure', ...)` |
| ready | `tests/issues/q-16-e2e-infra-migration/infra.spec.ts` | `it('webServer starts backend and frontend', ...)` |
| passed | `tests/issues/q-16-e2e-infra-migration/infra.spec.ts` | `it('example test passes with real API', ...)` |
| failed | `tests/issues/q-16-e2e-infra-migration/infra.spec.ts` | `it('reports port conflict when 3000 is occupied', ...)` |
| timeout | `tests/issues/q-16-e2e-infra-migration/infra.spec.ts` | `it('handles service startup timeout gracefully', ...)` |
| teardown | `tests/issues/q-16-e2e-infra-migration/infra.spec.ts` | `it('globalTeardown shuts down docker in CI', ...)` |
