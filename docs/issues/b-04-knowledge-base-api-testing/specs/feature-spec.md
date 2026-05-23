# 功能规格：KnowledgeBaseController 测试

## 用户故事
作为后端开发者，我希望 KnowledgeBaseController 拥有完整的模块级集成测试，以便在重构或升级依赖时快速发现回归问题。

## 边界

### 范围内
- KnowledgeBaseController 全部 4 个端点的模块级集成测试（Controller + Service + Prisma）
- KB CRUD 完整流程：list / create / update / delete
- DTO 校验、权限控制、错误响应的覆盖
- 空列表、空 name、超长 name 等边界场景
- 多用户认证隔离测试（用户 A 无法操作用户 B 的 KB）
- 测试后数据库清理

### 范围外
- FolderController 测试（属于 b-06）
- 搜索端点（代码中不存在）
- E2E 测试（单独 issue 或 b-06 覆盖）
- 前端 UI 测试
- 性能/压力测试

## 涉及模块
- `packages/server/src/modules/knowledge-base/knowledge-base.controller.ts`
- `packages/server/src/modules/knowledge-base/knowledge-base.service.ts`
- `packages/server/src/modules/knowledge-base/dto/create-kb.dto.ts`
- `packages/server/src/modules/knowledge-base/dto/update-kb.dto.ts`

## 相关功能
- **b-03-document-api-testing** — 提供测试模式参考（TestAppFactory + StorageService mock）
- **i-01** — 提供测试基础设施（数据库管理、外部服务 mock）

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 复用 TestAppFactory.create 启动完整 NestJS 应用 | b-03 已验证此方案可行，无需重复造轮 | 否 |
| 每个测试用例独立创建/销毁数据库 | 保证测试隔离，避免状态泄漏 | 否 |
| 不包含搜索端点测试 | 代码中 search 端点不存在 | 是（若后续添加可补充） |
| 响应体解析统一使用 `body.data` | 项目规范要求 `{ data: T }` 统一格式 | 否 |
