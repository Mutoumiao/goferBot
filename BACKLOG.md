# 待办事项

> 自动生成于 2026-05-22，最后更新于 2026-06-01

## 进行中

### q-17 待处理（真实 API 版本）

1. **q-17-e2e-auth-kb-specs** — E2E 认证流程与知识库生命周期测试
   - 状态：open（待 q-17-rev 完成后关闭）
   - 阻塞于：q-23（已关闭，集成测试基础设施已修复）
   - 已有提交：AuthPage POM、auth.spec.ts（mock）、knowledge-base.spec.ts（mock）
   - 缺口：AC-06、AC-08、AC-12、AC-15、AC-16（5 项 pending）
   - 处理方案：由 q-17-rev 实现真实 API 版本，本 issue 保持 open 直到 q-17-rev 完成

## 待启动

_暂无_

## 技术债务（已关闭但需重新验证）

- b-08 ~ b-11：代码基于 Milvus 实现，ADR 0005 实施后需重新验证 pgvector 兼容性
- q-21：E2E 骨架需更新（移除 Milvus 引用）

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
  - ⏳ q-17-rev 真实 API 版本（待执行）
  - ⏳ i-03 Milvus 代码清理（待执行）
