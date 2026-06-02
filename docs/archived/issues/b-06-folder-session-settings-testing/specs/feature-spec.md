# 功能规格：Folder/Session/Settings 模块级集成测试

## 用户故事
作为后端开发者，我希望为 FolderController、SessionController、SettingsController 编写模块级集成测试，以便在重构或升级依赖时确保三个核心模块的 API 行为稳定可靠。

## 边界

### 范围内
- FolderController 的 CRUD 端点（list、create、update、remove）
- SessionController 的 CRUD 端点（list、findOne、create、update、remove）
- SettingsController 的读写端点（getSettings、saveSettings）
- 认证守卫（JwtAuthGuard）的集成验证
- Zod 验证管道（ZodValidationPipe）的集成验证
- 所有请求路径包含 `/api` 前缀

### 范围外
- 前端 UI 测试
- E2E 测试（浏览器级别）
- 性能测试
- 负载测试
- 旧 SQLite 路由测试的维护（仅参考迁移）

## 涉及模块
- `packages/server/src/modules/knowledge-base/folder.controller.ts`
- `packages/server/src/modules/session/session.controller.ts`
- `packages/server/src/modules/settings/settings.controller.ts`

## 相关功能
- `b-05-chat-controller-sse-testing` — 提供 NestJS 模块级测试的参考模式
- `i-01` — 基础设施准备（数据库、认证中间件等）

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 NestJS TestingModule 而非直接请求路由 | 模块级测试应验证模块组装正确性，与生产环境一致 | 否 |
| 重写旧 SQLite 路由测试为模块级测试 | 旧测试基于已废弃的 SQLite 路由层，无法直接复用 | 否 |
| Settings 补充 Zod 验证失败测试 | 旧测试缺少验证失败场景，需补齐安全边界 | 否 |
| 集成测试使用真实数据库（不 Mock） | 项目规范要求集成测试必须 hit 真实数据库，避免 mock 与生产行为偏差 | 否 |
| 本 issue 无 behavior-spec | 纯后端测试 issue，不涉及前端交互状态 | — |

