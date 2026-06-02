# 后端开发指南

> GoferBot 后端（NestJS + Fastify）开发规范与最佳实践。

---

## 目录

| 文档 | 内容 |
|------|------|
| [测试体系总览](../testing/README.md) | 测试分层、命令速查、目录映射 |
| [单元测试指南](../testing/unit-testing-guide.md) | 前后端单元测试完整指南（含后端 Service/Worker/DTO 测试） |
| [集成测试指南](../testing/integration-testing-guide.md) | 后端 API 集成测试完整指南（环境、工具、模板、CI/CD） |
| [E2E 测试指南](../testing/e2e-testing-guide.md) | Playwright 端到端测试完整指南 |

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
export TEST_DATABASE_ADMIN_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/postgres?schema=public"
export DATABASE_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_test?schema=public"
pnpm test:integration

# 类型检查
pnpm type-check

# 启动开发环境
pnpm infra:up   # 启动 Docker 基础设施
pnpm dev:server # 启动 NestJS watch 模式
```
