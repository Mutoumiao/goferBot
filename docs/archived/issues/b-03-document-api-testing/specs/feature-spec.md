# 功能规格：DocumentController 测试

## 用户故事
作为后端开发者，我希望 DocumentController 拥有完整的模块级集成测试和 HTTP E2E 测试，以便在重构或升级依赖时快速发现回归问题。

## 边界

### 范围内
- DocumentController 全部 5 个端点的模块级集成测试（Controller + Service + Prisma）
- 文件上传链路的 HTTP E2E 测试（multipart/form-data）
- DTO 校验、权限控制、错误响应的覆盖
- 50MB 大小限制、MIME 类型校验的覆盖
- 空列表、空 body、空文件等边界场景的覆盖
- 测试后数据库清理

### 范围外
- MinIO 真实上传（使用 mock）
- RAG 分块/向量化逻辑（属于 rag-sdk，已冻结）
- 前端上传 UI 测试
- 性能/压力测试

## 涉及模块
- `packages/server/src/modules/knowledge-base/document/document.controller.ts`
- `packages/server/src/modules/knowledge-base/document/document.service.ts`
- `packages/server/src/modules/knowledge-base/dto/create-document.dto.ts`
- `packages/server/src/modules/knowledge-base/dto/update-document.dto.ts`

## 相关功能
- **b-02-auth-api-testing** — 提供认证 fixtures（`AuthFixtures.createUser/loginAs`）和测试应用工厂（`TestAppFactory`）
- **i-01** — 提供测试基础设施（数据库管理、外部服务 mock）

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| MinIO 使用 mock，不调用真实服务 | 测试基础设施要求外部服务可 mock，避免环境依赖 | 是 |
| 每个测试用例独立创建/销毁数据库 | 保证测试隔离，避免状态泄漏 | 否（已标准化） |
| 文件上传测试使用 Fastify `inject()` 模拟 multipart | NestJS + Fastify 测试的标准做法 | 否 |
| 403 场景验证 kb 所有权；doc 跨 kb 访问由 Service 保证，Controller 层不重复测试 | DocumentService 已确保 doc 属于 kb，但需至少一条用例验证 doc 不存在时返回 404 | 是 |
