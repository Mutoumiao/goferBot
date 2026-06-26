# 后端开发指南

> GoferBot 后端（NestJS + Fastify）开发规范与最佳实践。

---

## 规范索引

> **Agent 阅读协议**：先读本文件了解全貌，再按当前开发阶段从下方索引中选择具体规范深入。
> 新增规范文件时，只需更新本索引表格，无需修改 skill。

| 阶段 | 文档 | 必读 | 说明 |
|------|------|------|------|
| 配置管理 | [configuration-guide.md](./configuration-guide.md) | ✅ 是 | 环境变量与配置中心（数据库）的分层原则、迁移路线图 |
| 编码约定 | [conventions.md](./conventions.md) | ✅ 是 | 验证方案、响应格式、DTO 模式、错误处理、分页规范 |
| 架构合规 | [architecture-compliance.md](./architecture-compliance.md) | 审查时 | 审查检查清单、常见违规模式速查 |
| API 测试 | [api-testing-guide.md](./api-testing-guide.md) | 按需 | API 测试编写指南（如不存在则跳过） |
| 测试体系 | [测试体系总览](../testing/README.md) | ✅ 是 | 测试分层、命令速查、目录映射 |
| 单元测试 | [单元测试指南](../testing/unit-testing-guide.md) | ✅ 是 | 前后端单元测试完整指南（第 7 章为后端） |
| 集成测试 | [集成测试指南](../testing/integration-testing-guide.md) | 按需 | 后端 API 集成测试完整指南 |
| E2E 测试 | [E2E 测试指南](../testing/e2e-testing-guide.md) | 按需 | Playwright 端到端测试完整指南 |

---

## 快速参考

### 新增 API 开发流程

1. 阅读 `docs/issues/{dir}/specs/api-spec.md` 了解契约
2. 按 [api-testing-guide.md](./api-testing-guide.md) 编写测试
3. 运行测试确认失败（Red）
4. 实现 Controller/Service/DTO
5. 运行测试确认通过（Green）
6. 提交代码

### 常用命令

```bash
# 运行全部后端集成测试
export TEST_DATABASE_ADMIN_URL="postgresql://{user}:{password}@{host}:{port}/postgres?schema=public"
export DATABASE_URL="postgresql://{user}:{password}@{host}:{port}/{dbname}_test?schema=public"
pnpm test:integration

# 类型检查
pnpm type-check

# 启动开发环境
pnpm infra:up   # 启动 Docker 基础设施
pnpm dev:server # 启动 NestJS watch 模式
```
