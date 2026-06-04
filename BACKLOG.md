# 待办事项

> 自动生成于 2026-05-22，最后更新于 2026-06-01

## 进行中

_暂无_

## 待启动

- **f-XX Session 列表分页 UI** — 后端 b-14 已完成 Session 分页 API（`GET /api/sessions?page=&limit=`），当前前端仍一次性全量加载。需实现：分页组件、滚动加载或翻页、空状态处理。当前限制：会话超过 50 条时仅显示前 50 条，无翻页能力。

## 技术债务

- **PrismaService 代理模式可维护性**：手动代理每个模型方法，新增模型时需同步维护。未来可考虑 `Proxy` 自动代理或生成器脚本。

## 已修复（2026-06-04）

- ✅ **验证管道统一**：Admin 模块 DTO 已从 `class-validator` 迁移至 `ZodValidationPipe`，移除 `class-validator` + `class-transformer` 依赖
- ✅ **Admin API 响应格式统一**：移除 `@BypassResponse()`，所有 Admin API 统一走 `ResponseInterceptor` 包装为 `{ data: ... }` 格式

## 备注

- RAG SDK 系列 issue（d-11 ~ d-15）已全部关闭
- RAG Server 集成 issue（d-20 / b-10 / b-11 / b-08 / b-09 / f-16 / q-21 / q-22）已于 2026-05-29 完成开发
- q-21 E2E 测试骨架已完成，真实链路验证由 q-22 覆盖
- q-22 RAG 真实集成测试已完成（AC-01~AC-07 全部 passed），基础设施不可用时优雅跳过
- **2026-06-01 重建计划**：
  - ✅ i-02 Docker + Prisma Schema 更新（已关闭）
  - ✅ b-12 PgVectorStore + VectorService 切换（已关闭）
  - ✅ b-13 PrismaVectorIndexer 重写（已关闭）
  - ✅ q-23 集成测试层修复（已关闭）
  - ✅ q-17-rev 真实 API 版本（已关闭）
  - ✅ i-03 Milvus 代码清理（已关闭）
