# 待办事项

> 自动生成于 2026-05-22，最后更新于 2026-06-01

## 进行中

_暂无_

## 待启动

- **f-XX Session 列表分页 UI** — 后端 b-14 已完成 Session 分页 API（`GET /api/sessions?page=&limit=`），当前前端仍一次性全量加载。需实现：分页组件、滚动加载或翻页、空状态处理。当前限制：会话超过 50 条时仅显示前 50 条，无翻页能力。

## 技术债务（已关闭但需重新验证）

- q-21：E2E 骨架需更新（移除 Milvus 引用）

## 技术债务（b-14 Admin 用户管理）

- **验证管道不统一**：Admin 模块使用 `class-validator` + `@UsePipes(ValidationPipe)`，其他模块使用 `ZodValidationPipe`。长期应统一验证方案。
- **PrismaService 代理模式可维护性**：手动代理每个模型方法，新增模型时需同步维护。未来可考虑 `Proxy` 自动代理或生成器脚本。
- **Admin API 响应格式不一致**：`GET /admin/users` 返回 `{ data, pagination }`（绕过 ResponseInterceptor），`PATCH /admin/users/:id/status` 返回 `{ data: {...} }`。当前为兼容前端 Session 解析方式，后续应统一为 `{ data, pagination }` 或全部走 ResponseInterceptor 包装。

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
